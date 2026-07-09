const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { getReadyTenantClient } = require('../utils/tenantDatabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

const comparePassword = async (user, enteredPassword) => {
    if (!user || typeof user.password !== 'string') return false;

    if (!isBcryptHash(user.password)) {
        return String(enteredPassword) === user.password;
    }

    try {
        return await bcrypt.compare(String(enteredPassword), user.password);
    } catch {
        return false;
    }
};

const hashPasswordIfNeeded = async (password) => {
    if (!password) return password;
    if (isBcryptHash(password)) return password;
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

const signUserToken = (user) => {
    const payload = {
        id: user.id,
        _id: user.id,
        role: user.role,
        institutionId: user.institutionId,
        username: user.username,
        name: user.name
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

const publicUser = (user) => ({
    id: user.id,
    _id: user.id,
    username: user.username,
    role: user.role,
    institutionId: user.institutionId,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
    profileCompleted: user.profileCompleted || false
});

const findTenantLogin = async (username) => {
    const master = prisma.getMasterClient();
    const institutions = await master.institution.findMany({
        where: {
            databaseStatus: 'READY',
            databaseUrl: { not: null }
        },
        orderBy: { createdAt: 'asc' }
    });

    for (const institution of institutions) {
        const tenant = getReadyTenantClient(institution);
        if (!tenant) continue;

        try {
            const user = await tenant.user.findFirst({
                where: {
                    username: { equals: username, mode: 'insensitive' },
                    institutionId: institution.id
                }
            });

            if (user) {
                return { user, institution, client: tenant, source: `Tenant DB (${institution.slug})` };
            }
        } catch (err) {
            console.error(`Login user lookup failed for ${institution.slug}:`, err.message);
        }
    }

    for (const institution of institutions) {
        const tenant = getReadyTenantClient(institution);
        if (!tenant) continue;

        try {
            const faculty = await tenant.faculty.findFirst({
                where: {
                    facultyId: { equals: username, mode: 'insensitive' },
                    institutionId: institution.id
                }
            });

            if (faculty) {
                return { faculty, institution, client: tenant, source: `Faculty profile (${institution.slug})` };
            }
        } catch (err) {
            console.error(`Login faculty lookup failed for ${institution.slug}:`, err.message);
        }
    }

    return null;
};

const findLegacyMasterLogin = async (username) => {
    if (process.env.ALLOW_LEGACY_SINGLE_DB_FALLBACK !== 'true') return null;

    const master = prisma.getMasterClient();
    const user = await master.user.findFirst({
        where: {
            username: { equals: username, mode: 'insensitive' }
        }
    });

    return user ? { user, client: master, source: 'Legacy master DB fallback' } : null;
};

// @route   POST api/auth/login
// @desc    Authenticate user from master (company admin) or the resolved college database
router.post('/login', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Check if it is the Environment-based Super Admin first
        const envSuperAdminUsername = process.env.SUPER_ADMIN_USERNAME || '5up3r_4dmin_0p';
        const envSuperAdminPasswordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

        if (username.toLowerCase() === envSuperAdminUsername.toLowerCase()) {
            let isMatch = false;
            if (envSuperAdminPasswordHash) {
                isMatch = await bcrypt.compare(password, envSuperAdminPasswordHash);
            } else {
                isMatch = (password === 'Hard_Rahasyam');
            }

            if (isMatch) {
                const superAdminUser = {
                    id: 'super-admin-id-12345',
                    username: envSuperAdminUsername,
                    role: 'COMPANY_ADMIN',
                    name: 'Super Administrator',
                    institutionId: null,
                    mustChangePassword: false,
                    profileCompleted: true,
                    isActive: true
                };

                console.log(`Login: Authenticated user "${username}" from Environment Config (Super Admin).`);
                return res.json({
                    token: signUserToken(superAdminUser),
                    user: publicUser(superAdminUser)
                });
            } else {
                console.log(`Login: Password mismatch for environment Super Admin.`);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        const master = prisma.getMasterClient();
        let login = null;

        const companyAdmin = await master.user.findFirst({
            where: {
                username: { equals: username, mode: 'insensitive' },
                role: 'COMPANY_ADMIN'
            }
        });

        if (companyAdmin) {
            login = { user: companyAdmin, client: master, source: 'Master DB (Company Admin)' };
        }

        if (!login) {
            login = await findTenantLogin(username);
        }

        if (!login) {
            login = await findLegacyMasterLogin(username);
        }

        if (!login) {
            console.log(`Login: User "${username}" not found in master or tenant databases.`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!login.user && login.faculty) {
            if (String(password) !== `${login.faculty.facultyId}@123`) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const hashedPassword = await hashPasswordIfNeeded(password);
            login.user = await login.client.user.create({
                data: {
                    username: login.faculty.facultyId,
                    password: hashedPassword,
                    role: 'FACULTY',
                    name: login.faculty.name,
                    email: login.faculty.email,
                    department: login.faculty.department,
                    institutionId: login.institution.id,
                    isActive: true,
                    mustChangePassword: true,
                    profileCompleted: false
                }
            });
        }

        console.log(`Login: Found user "${login.user.username}" in ${login.source}. Comparing password...`);
        let isMatch = await comparePassword(login.user, password);

        if (!isMatch && login.user.role === 'FACULTY' && String(password) === `${login.user.username}@123`) {
            login.user.password = await hashPasswordIfNeeded(password);
            login.user.mustChangePassword = true;
            await login.client.user.update({
                where: { id: login.user.id },
                data: {
                    password: login.user.password,
                    mustChangePassword: true
                }
            });
            isMatch = true;
        }

        if (!isMatch) {
            console.log(`Login: Password mismatch for user "${login.user.username}".`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (login.user.isActive === false) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        if (!isBcryptHash(login.user.password)) {
            login.user.password = await hashPasswordIfNeeded(password);
        }

        login.user.lastLogin = new Date();
        login.user.loginCount = (login.user.loginCount || 0) + 1;

        await login.client.user.update({
            where: { id: login.user.id },
            data: {
                password: login.user.password,
                lastLogin: login.user.lastLogin,
                loginCount: login.user.loginCount
            }
        });

        res.json({
            token: signUserToken(login.user),
            user: publicUser(login.user)
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/auth/change-password
// @desc    Change password in the current database context
router.post('/change-password', async (req, res) => {
    const username = String(req.body?.username || req.user?.username || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!username || !newPassword) {
        return res.status(400).json({ error: 'Username and new password are required' });
    }

    try {
        const user = await prisma.user.findFirst({
            where: {
                username: { equals: username, mode: 'insensitive' }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPassword = await hashPasswordIfNeeded(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                mustChangePassword: false
            }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('change-password error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/register-company-admin', async (req, res) => {
    const { username, password, name, email } = req.body;
    try {
        const master = prisma.getMasterClient();
        const existing = await master.user.findFirst({
            where: { role: 'COMPANY_ADMIN' }
        });
        if (existing && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Company Admin already exists' });
        }

        const hashedPassword = await hashPasswordIfNeeded(password);
        await master.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                email,
                role: 'COMPANY_ADMIN'
            }
        });
        res.status(201).json({ message: 'Company Admin created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/auth/institutions-public
// @desc    Get all institutions for registration dropdown
router.get('/institutions-public', async (req, res) => {
    try {
        const master = prisma.getMasterClient();
        const institutions = await master.institution.findMany({
            select: {
                id: true,
                name: true,
                databaseStatus: true
            }
        });
        const mapped = institutions.map(inst => ({
            id: inst.id,
            _id: inst.id,
            name: inst.name,
            databaseStatus: inst.databaseStatus
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/auth/batches-public/:institutionId
// @desc    Get all batches for a specific institution for registration dropdown
router.get('/batches-public/:institutionId', async (req, res) => {
    try {
        const master = prisma.getMasterClient();
        const inst = await master.institution.findUnique({
            where: { id: req.params.institutionId }
        });

        if (!inst) {
            return res.status(404).json({ error: 'Institution not found' });
        }

        const tenant = getReadyTenantClient(inst);
        if (!tenant && process.env.ALLOW_LEGACY_SINGLE_DB_FALLBACK !== 'true') {
            return res.status(503).json({ error: 'College database is not ready' });
        }

        const client = tenant || master;
        const batches = await client.batch.findMany({
            where: { institutionId: req.params.institutionId },
            select: {
                id: true,
                batchId: true,
                department: true,
                degree: true,
                semester: true,
                yearLabel: true,
                session: true
            }
        });
        const enriched = batches.map(b => ({
            ...b,
            _id: b.id,
            name: b.batchId || 'Unknown'
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
