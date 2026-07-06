const prisma = require('../config/prisma');

module.exports = async (req, res, next) => {
    try {
        const masterOnlyPaths = [
            '/api/company',
            '/api/auth/login',
            '/api/auth/register-company-admin',
            '/api/auth/institutions-public',
            '/api/debug-uploads',
            '/debug-uploads'
        ];

        if (masterOnlyPaths.some(path => req.path.startsWith(path))) {
            return prisma.runWithPrismaContext({ mode: 'master' }, next);
        }

        // 1. Identify the institution ID
        // Logic: Students are always locked to their own institution. 
        // Others (Admins/Faculty) can use the viewing header/query if provided.
        // We also check req.body for cases like login where it might be sent there.
        let institutionId = req.headers['x-institution-id'] || req.query.institutionId || req.body?.institutionId;
        
        if (req.user && req.user.role === 'STUDENT') {
            institutionId = req.user.institutionId;
        } else if (!institutionId && req.user) {
            institutionId = req.user.institutionId;
        }

        if (!institutionId) {
            // Fallback for global routes (like login/public inst lists) or if not provided
            return prisma.runWithPrismaContext({ mode: 'master' }, next);
        }

        // 2. Fetch the institution from PostgreSQL via Prisma to get its slug
        const master = prisma.getMasterClient();
        const inst = await master.institution.findUnique({
            where: { id: institutionId }
        });
        
        if (!inst || !inst.slug) {
            console.warn(`Tenant middleware: No institution or slug found for ID ${institutionId}`);
            return prisma.runWithPrismaContext({ mode: 'master' }, next);
        }

        if (!inst.databaseUrl || inst.databaseStatus !== 'READY') {
            if (process.env.ALLOW_LEGACY_SINGLE_DB_FALLBACK === 'true') {
                console.warn(`Tenant middleware: using legacy master DB fallback for ${inst.name}.`);
                req.tenantSlug = inst.slug;
                req.institutionId = inst.id;
                req.institution = inst;
                return prisma.runWithPrismaContext({ mode: 'master', institution: inst }, next);
            }

            return res.status(503).json({
                error: 'College database is not ready',
                institutionId: inst.id,
                databaseStatus: inst.databaseStatus || 'PENDING',
                databaseError: inst.databaseError || null
            });
        }

        // 3. Attach tenant details to the request object
        req.tenantSlug = inst.slug;
        req.institutionId = inst.id;
        req.institution = inst;
        
        return prisma.runWithPrismaContext({ mode: 'tenant', institution: inst }, next);
    } catch (err) {
        console.error('Tenant Middleware Error:', err);
        return prisma.runWithPrismaContext({ mode: 'master' }, next);
    }
};
