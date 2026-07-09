const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { Client } = require('pg');
const prisma = require('../config/prisma');

const execFileAsync = promisify(execFile);
const serverRoot = path.join(__dirname, '..');
const schemaPath = path.join(serverRoot, 'prisma', 'schema.prisma');

const quoteIdentifier = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

const normalizeSlug = (value) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');

    return normalized || 'college';
};

const generateSafeDatabaseName = (slugOrName) => {
    let base = normalizeSlug(slugOrName);
    if (/^\d/.test(base)) base = `college_${base}`;

    const suffix = '_db';
    const maxBaseLength = 63 - suffix.length;
    if (base.length > maxBaseLength) {
        base = base.slice(0, maxBaseLength).replace(/_+$/g, '');
    }

    return `${base}${suffix}`;
};

const getMasterDatabaseUrl = () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is required to create tenant databases');
    }
    return url;
};

const buildDatabaseUrl = (databaseName) => {
    const url = new URL(getMasterDatabaseUrl());
    url.pathname = `/${databaseName}`;
    return url.toString();
};

const buildMaintenanceUrl = () => {
    const url = new URL(getMasterDatabaseUrl());
    const maintenanceDatabase = process.env.POSTGRES_MAINTENANCE_DB || 'postgres';
    url.pathname = `/${maintenanceDatabase}`;
    return url.toString();
};

const createDatabaseIfMissing = async (databaseName) => {
    const connectionString = buildMaintenanceUrl();
    const isAws = connectionString.includes('rds.amazonaws.com');
    const client = new Client({
        connectionString,
        ssl: isAws ? { rejectUnauthorized: false } : undefined
    });
    await client.connect();
    try {
        const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
        if (existing.rowCount === 0) {
            await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
        }
    } finally {
        await client.end();
    }
};

const runPrismaDbPush = async (databaseUrl) => {
    const prismaCliPath = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js');
    const args = [
        prismaCliPath,
        'db',
        'push',
        '--schema',
        schemaPath,
        '--accept-data-loss',
        '--skip-generate'
    ];

    await execFileAsync(process.execPath, args, {
        cwd: serverRoot,
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl
        },
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10
    });
};

const publicInstitutionData = (institution) => ({
    id: institution.id,
    name: institution.name,
    code: institution.code,
    slug: institution.slug,
    address: institution.address || null,
    contact: institution.contact || null,
    collegeName: institution.collegeName || institution.name || '',
    logo: institution.logo || '',
    databaseName: institution.databaseName || null,
    databaseStatus: institution.databaseStatus || 'READY',
    databaseCreatedAt: institution.databaseCreatedAt || null,
    databaseVerifiedAt: institution.databaseVerifiedAt || null,
    createdAt: institution.createdAt || new Date()
});

const seedTenantInstitution = async (institution) => {
    const tenant = prisma.getTenantClient(institution);
    const data = publicInstitutionData(institution);

    await tenant.institution.upsert({
        where: { id: institution.id },
        update: data,
        create: data
    });
};

const verifyTenantDatabase = async (institution) => {
    const tenant = prisma.getTenantClient(institution);
    await tenant.$connect();

    const [tableCountResult, seededInstitution] = await Promise.all([
        tenant.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
        `,
        tenant.institution.findUnique({
            where: { id: institution.id },
            select: { id: true }
        })
    ]);

    const tableCount = Number(tableCountResult?.[0]?.count || 0);
    if (tableCount < 5 || !seededInstitution) {
        throw new Error('Tenant database verification failed: expected tables or institution seed row are missing');
    }

    return { tableCount };
};

const provisionTenantDatabase = async (institution) => {
    const databaseName = institution.databaseName || generateSafeDatabaseName(institution.slug || institution.name);
    const databaseUrl = institution.databaseUrl || buildDatabaseUrl(databaseName);
    const master = prisma.getMasterClient();

    const provisioningData = {
        databaseName,
        databaseUrl,
        databaseStatus: 'CREATING',
        databaseError: null
    };

    await master.institution.update({
        where: { id: institution.id },
        data: provisioningData
    });

    const enrichedInstitution = {
        ...institution,
        ...provisioningData
    };

    try {
        await createDatabaseIfMissing(databaseName);
        await runPrismaDbPush(databaseUrl);

        const readyAt = new Date();
        const readyInstitution = {
            ...enrichedInstitution,
            databaseCreatedAt: enrichedInstitution.databaseCreatedAt || readyAt,
            databaseVerifiedAt: readyAt,
            databaseStatus: 'READY',
            databaseError: null
        };

        await seedTenantInstitution(readyInstitution);
        const verification = await verifyTenantDatabase(readyInstitution);

        const updated = await master.institution.update({
            where: { id: institution.id },
            data: {
                databaseName,
                databaseUrl,
                databaseStatus: 'READY',
                databaseError: null,
                databaseCreatedAt: readyInstitution.databaseCreatedAt,
                databaseVerifiedAt: readyAt
            }
        });

        return { institution: updated, verification };
    } catch (err) {
        await prisma.invalidateTenantClient({ ...enrichedInstitution, databaseUrl });
        await master.institution.update({
            where: { id: institution.id },
            data: {
                databaseName,
                databaseUrl,
                databaseStatus: 'FAILED',
                databaseError: err.message
            }
        });
        throw err;
    }
};

const getReadyTenantClient = (institution) => {
    if (!institution?.databaseUrl || institution.databaseStatus !== 'READY') {
        return null;
    }
    return prisma.getTenantClient(institution);
};

module.exports = {
    generateSafeDatabaseName,
    buildDatabaseUrl,
    createDatabaseIfMissing,
    runPrismaDbPush,
    seedTenantInstitution,
    verifyTenantDatabase,
    provisionTenantDatabase,
    getReadyTenantClient
};
