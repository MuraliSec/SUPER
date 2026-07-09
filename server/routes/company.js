const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const {
    generateSafeDatabaseName,
    provisionTenantDatabase,
    getReadyTenantClient
} = require('../utils/tenantDatabase');
const { getHealthReport } = require('../utils/healthMonitor');

const toSlug = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'college';

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

const publicInstitution = (institution) => ({
    ...institution,
    _id: institution.id,
    databaseUrl: institution.databaseUrl ? '[stored]' : null
});

// @route   GET api/company/health
// @desc    Company Admin system health and diagnostics report
router.get('/health', async (req, res) => {
    if (!req.user || req.user.role !== 'COMPANY_ADMIN') {
        return res.status(403).json({ error: 'Company Admin access required' });
    }

    try {
        const report = await getHealthReport({
            req,
            force: req.query.refresh === 'true'
        });
        res.json(report);
    } catch (err) {
        console.error('Company health check failed:', err);
        res.status(500).json({
            error: 'Health check failed',
            details: err.message
        });
    }
});

// @route   GET api/company/institutions
// @desc    Get all institutions with their admin details from tenant DBs
router.get('/institutions', async (req, res) => {
    console.log(`Company: fetching institutions for ${req.user?.username || 'Guest'}`);
    try {
        const master = prisma.getMasterClient();
        const institutions = await master.institution.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const enrichedInstitutions = await Promise.all(institutions.map(async (inst) => {
            let adminUsername = 'N/A';
            const tenant = getReadyTenantClient(inst);

            if (tenant) {
                try {
                    const admin = await tenant.user.findFirst({
                        where: {
                            institutionId: inst.id,
                            role: 'COLLEGE_ADMIN'
                        },
                        select: { username: true }
                    });
                    adminUsername = admin?.username || 'N/A';
                } catch (err) {
                    adminUsername = 'Tenant DB unavailable';
                }
            } else if (inst.databaseStatus === 'FAILED') {
                adminUsername = 'Provisioning failed';
            } else if (inst.databaseStatus !== 'READY') {
                adminUsername = 'Provisioning pending';
            }

            return {
                ...publicInstitution(inst),
                adminUsername
            };
        }));

        res.json(enrichedInstitutions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/company/institutions
// @desc    Create institution metadata, provision tenant DB, and create tenant admin user
router.post('/institutions', async (req, res) => {
    const { name, code, address, contact, adminUsername, adminPassword, slug: providedSlug } = req.body;

    if (!name || !code || !adminUsername || !adminPassword) {
        return res.status(400).json({ error: 'Name, code, admin username, and admin password are required' });
    }

    const master = prisma.getMasterClient();
    const slug = toSlug(providedSlug || name);
    const databaseName = generateSafeDatabaseName(slug);

    let institution = null;

    try {
        institution = await master.institution.create({
            data: {
                name,
                code,
                slug,
                address,
                contact,
                databaseName,
                databaseStatus: 'PENDING'
            }
        });

        const { institution: readyInstitution, verification } = await provisionTenantDatabase(institution);
        const tenant = getReadyTenantClient(readyInstitution);

        if (!tenant) {
            throw new Error('Tenant database was created but no ready client could be opened');
        }

        const hashedPassword = await hashPassword(adminPassword);
        const user = await tenant.user.create({
            data: {
                username: adminUsername,
                password: hashedPassword,
                role: 'COLLEGE_ADMIN',
                institutionId: readyInstitution.id,
                name: `${name} Admin`,
                isActive: true,
                mustChangePassword: true,
                profileCompleted: false
            }
        });

        res.status(201).json({
            institution: publicInstitution(readyInstitution),
            user: { username: user.username, role: user.role },
            database: {
                name: readyInstitution.databaseName,
                status: readyInstitution.databaseStatus,
                verifiedTables: verification.tableCount
            }
        });
    } catch (err) {
        console.error('Company: failed to create tenant institution:', err);
        const failedInstitution = institution
            ? await master.institution.findUnique({ where: { id: institution.id } })
            : null;

        res.status(500).json({
            error: 'College was saved, but database provisioning failed',
            details: err.message,
            institution: failedInstitution ? publicInstitution(failedInstitution) : null
        });
    }
});

// @route   GET api/company/stats
// @desc    Get global stats aggregated across ready tenant DBs
router.get('/stats', async (req, res) => {
    console.log('Company: fetching global stats');
    try {
        const master = prisma.getMasterClient();
        const institutions = await master.institution.findMany();
        let totalFaculty = 0;
        let totalBatches = 0;

        for (const inst of institutions) {
            const tenant = getReadyTenantClient(inst);
            if (!tenant) continue;

            try {
                const [facCount, batCount] = await Promise.all([
                    tenant.faculty.count({ where: { institutionId: inst.id } }),
                    tenant.batch.count({ where: { institutionId: inst.id } })
                ]);

                totalFaculty += facCount;
                totalBatches += batCount;
            } catch (instErr) {
                console.error(`Company stats failed for ${inst.name}:`, instErr.message);
            }
        }

        res.json({
            institutions: institutions.length,
            totalFaculty,
            totalBatches
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE api/company/institutions/:id
// @desc    Delete institution metadata. Tenant DB is preserved unless DROP_TENANT_DB_ON_DELETE is implemented externally.
router.delete('/institutions/:id', async (req, res) => {
    try {
        const master = prisma.getMasterClient();
        const instId = req.params.id;
        const institution = await master.institution.findUnique({
            where: { id: instId }
        });

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        await master.institution.delete({
            where: { id: instId }
        });

        res.json({ message: 'Institution metadata deleted successfully. Tenant database was left intact.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   PUT api/company/institutions/:id/reset-password
// @desc    Reset password for an institution's tenant admin
router.put('/institutions/:id/reset-password', async (req, res) => {
    try {
        const master = prisma.getMasterClient();
        const instId = req.params.id;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const institution = await master.institution.findUnique({
            where: { id: instId }
        });

        if (!institution) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        const tenant = getReadyTenantClient(institution);
        if (!tenant) {
            return res.status(503).json({ error: 'College database is not ready' });
        }

        const admin = await tenant.user.findFirst({
            where: {
                institutionId: instId,
                role: 'COLLEGE_ADMIN'
            }
        });

        if (!admin) {
            return res.status(404).json({ error: 'Admin user not found in tenant database' });
        }

        const hashedPassword = await hashPassword(newPassword);
        await tenant.user.update({
            where: { id: admin.id },
            data: {
                password: hashedPassword,
                mustChangePassword: true
            }
        });

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
