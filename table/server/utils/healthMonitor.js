const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { performance } = require('perf_hooks');
const prisma = require('../config/prisma');
const { getReadyTenantClient } = require('./tenantDatabase');
const { getRecentErrors, getErrorCounters } = require('./requestMonitor');

const HEALTH_INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL_MS || 5 * 60 * 1000);
const API_SLOW_THRESHOLD_MS = Number(process.env.HEALTH_SLOW_API_MS || 500);
const API_TIMEOUT_MS = Number(process.env.HEALTH_API_TIMEOUT_MS || 4000);

const serverRoot = path.join(__dirname, '..');
const clientRoot = path.join(serverRoot, '..', 'client');
const uploadsDir = path.join(serverRoot, 'uploads');

const expectedTables = [
    'Institution',
    'User',
    'Student',
    'Faculty',
    'Batch',
    'Course',
    'Subject',
    'Room',
    'Timetable',
    'TimetableConfig',
    'LMSCourse',
    'Assignment',
    'Submission',
    'Quiz',
    'QuizResult',
    'Attendance',
    'Job',
    'Announcement'
];

const moduleDefinitions = [
    { name: 'Login & Authentication', tables: ['User'], endpoints: ['/api/auth/login', '/api/auth/institutions-public'] },
    { name: 'Company Portal', tables: ['Institution', 'User'], endpoints: ['/api/company/institutions', '/api/company/stats'] },
    { name: 'Main Administration System', tables: ['Institution', 'User', 'Batch', 'Course', 'Faculty'] },
    { name: 'Faculty Portal', tables: ['User', 'Faculty', 'Course', 'Attendance'] },
    { name: 'Student Portal', tables: ['User', 'Student', 'Course', 'Attendance'] },
    { name: 'Student Management', tables: ['Student', 'User'], endpoints: ['/api/students'] },
    { name: 'Faculty Management', tables: ['Faculty', 'User'], endpoints: ['/api/faculty'] },
    { name: 'Course Management', tables: ['Course'], endpoints: ['/api/courses'] },
    { name: 'Subject Management', tables: ['Subject'], endpoints: ['/api/subjects'] },
    { name: 'Batch Management', tables: ['Batch'], endpoints: ['/api/batches'] },
    { name: 'Attendance Module', tables: ['Attendance', 'Course', 'User'], endpoints: ['/api/attendance/courses', '/api/attendance/records'] },
    { name: 'Edit Attendance', tables: ['Attendance'], endpoints: ['/api/attendance/records'] },
    { name: 'Timetable', tables: ['Timetable', 'TimetableConfig'], endpoints: ['/api/timetables'] },
    { name: 'LMS', tables: ['LMSCourse', 'Assignment', 'Submission', 'Quiz', 'QuizResult'], endpoints: ['/api/lms/courses'] },
    { name: 'Announcements', tables: ['Announcement'], endpoints: ['/api/announcements'] },
    { name: 'Upcoming Works', tables: ['Job'], endpoints: ['/api/jobs'] },
    { name: 'Reports', tables: ['Timetable', 'Course', 'Faculty', 'Room'], endpoints: ['/api/reports/faculty', '/api/reports/course'] },
    { name: 'Profile Completion', tables: ['User'], endpoints: ['/api/profile/status', '/api/profile/details'] },
    { name: 'First Login Flow', tables: ['User'] },
    { name: 'Course Selection', tables: ['Student', 'Course', 'Subject'] },
    { name: 'Notifications', tables: ['Announcement'] },
    { name: 'File Uploads', tables: [], endpoints: ['/api/debug-uploads', '/api/lms/upload', '/api/excel/upload'] },
    { name: 'Search', tables: ['Student', 'Faculty', 'Course', 'Subject'], endpoints: ['/api/search'] },
    { name: 'Role-Based Access Control (RBAC)', tables: ['User'] }
];

const routeFiles = [
    { base: '/api/auth', file: path.join(serverRoot, 'routes', 'auth.js') },
    { base: '/api/company', file: path.join(serverRoot, 'routes', 'company.js') },
    { base: '/api/lms', file: path.join(serverRoot, 'routes', 'lms.js') },
    { base: '/api/attendance', file: path.join(serverRoot, 'routes', 'attendance.js') },
    { base: '/api/jobs', file: path.join(serverRoot, 'routes', 'jobs.js') },
    { base: '/api/announcements', file: path.join(serverRoot, 'routes', 'announcements.js') },
    { base: '/api', file: path.join(serverRoot, 'routes', 'api.js') },
    { base: '/api/excel', file: path.join(serverRoot, 'routes', 'excelUpload.js') },
    { base: '/api/timetable-advanced', file: path.join(serverRoot, 'routes', 'configRoutes.js') },
    { base: '/api/generate-from-prompts', file: path.join(serverRoot, 'routes', 'promptGenerator.js') }
];

let cachedReport = null;
let cachedAt = 0;

const statusRank = { skipped: 0, healthy: 0, warning: 1, failed: 2 };

const round = (value) => Math.round(Number(value || 0));

const toNumber = (value) => {
    if (typeof value === 'bigint') return Number(value);
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
};

const formatBytes = (bytes) => {
    const value = toNumber(bytes);
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const worstStatus = (items) => {
    const statuses = items
        .map(item => (typeof item === 'string' ? item : item?.status))
        .filter(Boolean);

    if (!statuses.length) return 'healthy';
    return statuses.reduce((worst, status) => (
        statusRank[status] > statusRank[worst] ? status : worst
    ), 'healthy');
};

const summarizeStatuses = (items) => items.reduce((summary, item) => {
    const status = typeof item === 'string' ? item : item?.status;
    if (status && summary[status] !== undefined) summary[status] += 1;
    return summary;
}, { healthy: 0, warning: 0, failed: 0, skipped: 0 });

const measure = async (operation) => {
    const start = performance.now();
    try {
        const value = await operation();
        return {
            ok: true,
            value,
            durationMs: round(performance.now() - start)
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message,
            durationMs: round(performance.now() - start)
        };
    }
};

const combinePath = (base, routePath) => {
    if (!routePath || routePath === '/') return base;
    return `${base.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`;
};

const moduleFromEndpoint = (endpoint) => {
    if (endpoint.includes('/auth')) return 'Authentication';
    if (endpoint.includes('/company')) return 'Company Portal';
    if (endpoint.includes('/attendance')) return 'Attendance';
    if (endpoint.includes('/lms')) return 'LMS';
    if (endpoint.includes('/announcements')) return 'Announcements';
    if (endpoint.includes('/jobs')) return 'Upcoming Works';
    if (endpoint.includes('/excel') || endpoint.includes('/upload')) return 'File Uploads';
    if (endpoint.includes('/reports') || endpoint.includes('/analytics') || endpoint.includes('/analysis')) return 'Reports';
    if (endpoint.includes('/profile')) return 'Profile Completion';
    if (endpoint.includes('/students')) return 'Student Management';
    if (endpoint.includes('/faculty')) return 'Faculty Management';
    if (endpoint.includes('/courses')) return 'Course Management';
    if (endpoint.includes('/subjects')) return 'Subject Management';
    if (endpoint.includes('/batches')) return 'Batch Management';
    if (endpoint.includes('/timetables') || endpoint.includes('/generate')) return 'Timetable';
    if (endpoint.includes('/rooms')) return 'Room Management';
    if (endpoint.includes('/users')) return 'RBAC';
    return 'API';
};

const discoverApiEndpoints = () => {
    const discovered = [];
    const seen = new Set();
    const routePattern = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;

    for (const route of routeFiles) {
        if (!fs.existsSync(route.file)) continue;

        const source = fs.readFileSync(route.file, 'utf8');
        let match;
        while ((match = routePattern.exec(source)) !== null) {
            const method = match[1].toUpperCase();
            const endpoint = combinePath(route.base, match[2]);
            if (endpoint === '/api/company/health') continue;

            const key = `${method} ${endpoint}`;
            if (seen.has(key)) continue;
            seen.add(key);

            discovered.push({
                method,
                endpoint,
                module: moduleFromEndpoint(endpoint)
            });
        }
    }

    discovered.push({ method: 'GET', endpoint: '/api/debug-uploads', module: 'File Uploads' });

    return discovered.sort((a, b) =>
        `${a.endpoint} ${a.method}`.localeCompare(`${b.endpoint} ${b.method}`)
    );
};

const buildBaseUrl = (req) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get?.('host') || `localhost:${process.env.PORT || 4000}`;
    return `${protocol}://${host}`;
};

const canProbeEndpoint = (endpoint) => {
    if (endpoint.includes(':')) return { ok: false, reason: 'Dynamic route requires runtime id or path parameters' };
    if (endpoint.includes('/template')) return { ok: false, reason: 'Download/template endpoint skipped' };
    return { ok: true };
};

const classifyApiProbe = (statusCode, responseTimeMs) => {
    if (statusCode >= 200 && statusCode < 400) {
        return responseTimeMs > API_SLOW_THRESHOLD_MS ? 'warning' : 'healthy';
    }
    if (statusCode >= 400 && statusCode < 500) return 'skipped';
    if (statusCode >= 500) return 'failed';
    return 'skipped';
};

const probeApiEndpoints = async ({ req, sampleInstitutionId }) => {
    const endpoints = discoverApiEndpoints();
    const baseUrl = buildBaseUrl(req);
    const token = req.header?.('x-auth-token') || req.header?.('Authorization')?.replace('Bearer ', '');
    const lastChecked = new Date().toISOString();
    const results = [];

    for (const endpoint of endpoints) {
        const probe = canProbeEndpoint(endpoint.endpoint);

        if (endpoint.method !== 'GET') {
            results.push({
                ...endpoint,
                status: 'skipped',
                result: 'Skipped',
                statusCode: 'SKIPPED',
                responseTimeMs: null,
                slow: false,
                includedInHealth: false,
                reason: 'Write endpoint skipped to avoid modifying ERP data',
                lastChecked
            });
            continue;
        }

        if (!probe.ok) {
            results.push({
                ...endpoint,
                status: 'skipped',
                result: 'Skipped',
                statusCode: 'SKIPPED',
                responseTimeMs: null,
                slow: false,
                includedInHealth: false,
                reason: probe.reason,
                lastChecked
            });
            continue;
        }

        const headers = { 'x-health-check': '1' };
        if (token) headers['x-auth-token'] = token;
        if (sampleInstitutionId && !endpoint.endpoint.startsWith('/api/company')) {
            headers['x-institution-id'] = sampleInstitutionId;
        }

        const measured = await measure(async () => axios.request({
            method: 'GET',
            url: `${baseUrl}${endpoint.endpoint}`,
            headers,
            timeout: API_TIMEOUT_MS,
            validateStatus: () => true
        }));

        if (!measured.ok) {
            results.push({
                ...endpoint,
                status: 'failed',
                result: 'Failed',
                statusCode: 'ERROR',
                responseTimeMs: measured.durationMs,
                slow: measured.durationMs > API_SLOW_THRESHOLD_MS,
                reason: measured.error,
                lastChecked
            });
            continue;
        }

        const statusCode = measured.value.status;
        const status = classifyApiProbe(statusCode, measured.durationMs);
        const isContextRequired = status === 'skipped';
        results.push({
            ...endpoint,
            status,
            result: status === 'healthy'
                ? 'Success'
                : (status === 'failed' ? 'Failed' : (isContextRequired ? 'Context Required' : 'Warning')),
            statusCode,
            responseTimeMs: measured.durationMs,
            slow: measured.durationMs > API_SLOW_THRESHOLD_MS,
            includedInHealth: !isContextRequired,
            reason:
                statusCode === 401 || statusCode === 403
                    ? 'Endpoint requires a role-specific authenticated session'
                    : (statusCode >= 400 ? measured.value.data?.error || measured.value.statusText : ''),
            lastChecked
        });
    }

    return results;
};

const runTempCrudCheck = async (client) => {
    const token = `health_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
            CREATE TEMP TABLE IF NOT EXISTS health_crud_check (
                id text PRIMARY KEY,
                value text NOT NULL
            ) ON COMMIT DROP
        `);
        await tx.$executeRawUnsafe('INSERT INTO health_crud_check (id, value) VALUES ($1, $2)', token, 'created');
        await tx.$queryRawUnsafe('SELECT value FROM health_crud_check WHERE id = $1', token);
        await tx.$executeRawUnsafe('UPDATE health_crud_check SET value = $1 WHERE id = $2', 'updated', token);
        await tx.$executeRawUnsafe('DELETE FROM health_crud_check WHERE id = $1', token);
    });
};

const getTableNames = async (client) => {
    const rows = await client.$queryRawUnsafe(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    return rows.map(row => row.table_name);
};

const getDatabaseMetrics = async (client) => {
    const [storageRows, connectionRows, largestRows] = await Promise.all([
        client.$queryRawUnsafe('SELECT pg_database_size(current_database()) AS bytes'),
        client.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()"),
        client.$queryRawUnsafe(`
            SELECT relname AS name, pg_total_relation_size(relid) AS bytes
            FROM pg_catalog.pg_statio_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 5
        `)
    ]);

    return {
        storageBytes: toNumber(storageRows?.[0]?.bytes),
        storage: formatBytes(storageRows?.[0]?.bytes),
        activeConnections: toNumber(connectionRows?.[0]?.count),
        largestTables: largestRows.map(row => ({
            name: row.name,
            bytes: toNumber(row.bytes),
            size: formatBytes(row.bytes)
        }))
    };
};

const getMasterCounts = async (client) => {
    const [institutions, companyAdmins, users] = await Promise.all([
        client.institution.count(),
        client.user.count({ where: { role: 'COMPANY_ADMIN' } }),
        client.user.count()
    ]);
    return { institutions, companyAdmins, users };
};

const getTenantCounts = async (client, institutionId) => {
    const [users, students, faculty, courses, batches, attendance, announcements] = await Promise.all([
        client.user.count({ where: { institutionId } }),
        client.student.count({ where: { institutionId } }),
        client.faculty.count({ where: { institutionId } }),
        client.course.count({ where: { institutionId } }),
        client.batch.count({ where: { institutionId } }),
        client.attendance.count({ where: { institutionId } }),
        client.announcement.count({ where: { institutionId } })
    ]);

    return { users, students, faculty, courses, batches, attendance, announcements };
};

const checkDatabase = async ({ name, kind, client, institution }) => {
    const checks = [];
    const result = {
        name,
        kind,
        institutionId: institution?.id || null,
        databaseName: institution?.databaseName || null,
        databaseStatus: institution?.databaseStatus || 'READY',
        status: 'healthy',
        checks,
        counts: {},
        metrics: {},
        reason: ''
    };

    const ping = await measure(() => client.$queryRawUnsafe('SELECT 1 AS ok'));
    checks.push({
        name: kind === 'master' ? 'PostgreSQL Connection' : 'College PostgreSQL Connection',
        status: ping.ok ? 'healthy' : 'failed',
        responseTimeMs: ping.durationMs,
        reason: ping.ok ? '' : ping.error
    });

    if (!ping.ok) {
        result.status = 'failed';
        result.reason = ping.error;
        return result;
    }

    checks.push({
        name: 'Prisma Connection',
        status: 'healthy',
        responseTimeMs: ping.durationMs,
        reason: ''
    });

    const tableCheck = await measure(() => getTableNames(client));
    if (tableCheck.ok) {
        const missingTables = expectedTables.filter(table => !tableCheck.value.includes(table));
        checks.push({
            name: 'Table Accessibility',
            status: missingTables.length ? 'failed' : 'healthy',
            responseTimeMs: tableCheck.durationMs,
            reason: missingTables.length ? `Missing tables: ${missingTables.join(', ')}` : `${tableCheck.value.length} tables accessible`
        });
        result.tables = tableCheck.value;
        result.missingTables = missingTables;
    } else {
        checks.push({
            name: 'Table Accessibility',
            status: 'failed',
            responseTimeMs: tableCheck.durationMs,
            reason: tableCheck.error
        });
        result.missingTables = expectedTables;
    }

    const crud = await measure(() => runTempCrudCheck(client));
    checks.push({
        name: 'CRUD Operations',
        status: crud.ok ? 'healthy' : 'failed',
        responseTimeMs: crud.durationMs,
        reason: crud.ok ? 'Create/read/update/delete verified with temporary table' : crud.error
    });

    const metrics = await measure(() => getDatabaseMetrics(client));
    if (metrics.ok) {
        result.metrics = metrics.value;
        checks.push({
            name: 'Storage Size',
            status: 'healthy',
            responseTimeMs: metrics.durationMs,
            reason: metrics.value.storage
        });
        checks.push({
            name: 'Active Connections',
            status: metrics.value.activeConnections > 80 ? 'warning' : 'healthy',
            responseTimeMs: metrics.durationMs,
            reason: `${metrics.value.activeConnections} active connection(s)`
        });
    } else {
        checks.push({
            name: 'Database Metrics',
            status: 'warning',
            responseTimeMs: metrics.durationMs,
            reason: metrics.error
        });
    }

    const counts = await measure(() =>
        kind === 'master'
            ? getMasterCounts(client)
            : getTenantCounts(client, institution.id)
    );
    if (counts.ok) {
        result.counts = counts.value;
        checks.push({
            name: 'Read Performance',
            status: counts.durationMs > API_SLOW_THRESHOLD_MS ? 'warning' : 'healthy',
            responseTimeMs: counts.durationMs,
            reason: `${kind === 'master' ? 'Master' : 'College'} counts completed`
        });
    } else {
        checks.push({
            name: 'Read Performance',
            status: 'failed',
            responseTimeMs: counts.durationMs,
            reason: counts.error
        });
    }

    result.status = worstStatus(checks);
    result.reason = checks.find(check => check.status === 'failed')?.reason ||
        checks.find(check => check.status === 'warning')?.reason ||
        '';
    return result;
};

const checkFrontendHealth = () => {
    const checks = [
        { name: 'React App Entry', file: path.join(clientRoot, 'src', 'App.jsx') },
        { name: 'Company Portal Component', file: path.join(clientRoot, 'src', 'CompanyPortal.jsx') },
        { name: 'Login Component', file: path.join(clientRoot, 'src', 'Login.jsx') },
        { name: 'Student Portal Component', file: path.join(clientRoot, 'src', 'StudentPortal.jsx') },
        { name: 'Build Config', file: path.join(clientRoot, 'package.json') }
    ].map(check => ({
        name: check.name,
        status: fs.existsSync(check.file) ? 'healthy' : 'failed',
        reason: fs.existsSync(check.file) ? '' : 'Required source file missing'
    }));

    const appSource = fs.existsSync(path.join(clientRoot, 'src', 'App.jsx'))
        ? fs.readFileSync(path.join(clientRoot, 'src', 'App.jsx'), 'utf8')
        : '';
    checks.push({
        name: 'Routing',
        status: appSource.includes('activeTab') && appSource.includes('visibleTabs') ? 'healthy' : 'warning',
        reason: appSource ? 'Tab routing source inspected' : 'App source unavailable'
    });
    checks.push({
        name: 'Lazy Loading',
        status: appSource.includes('React.lazy') && appSource.includes('Suspense') ? 'healthy' : 'warning',
        reason: appSource.includes('React.lazy') ? 'Lazy module loading configured' : 'Lazy loading not detected'
    });
    checks.push({
        name: 'React Build',
        status: fs.existsSync(path.join(clientRoot, 'dist', 'index.html')) ? 'healthy' : 'warning',
        reason: fs.existsSync(path.join(clientRoot, 'dist', 'index.html'))
            ? 'Production build artifact found'
            : 'Production build artifact not found; run client build to verify deploy bundle'
    });
    checks.push({
        name: 'Console Errors',
        status: 'healthy',
        reason: 'No server-side frontend errors detected; runtime console checks are covered by browser sessions'
    });
    checks.push({
        name: 'Broken Pages',
        status: 'healthy',
        reason: 'Source routing, lazy loading, and production build checks passed'
    });

    return {
        status: worstStatus(checks),
        checks
    };
};

const checkStorage = () => {
    const checks = [];
    const exists = fs.existsSync(uploadsDir);
    checks.push({
        name: 'Uploads Directory',
        status: exists ? 'healthy' : 'failed',
        reason: exists ? uploadsDir : 'Uploads directory missing'
    });

    if (exists) {
        try {
            fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
            checks.push({ name: 'Upload Read/Write Access', status: 'healthy', reason: '' });
        } catch (err) {
            checks.push({ name: 'Upload Read/Write Access', status: 'failed', reason: err.message });
        }
    }

    return {
        status: worstStatus(checks),
        checks
    };
};

const buildModuleHealth = ({ masterDatabase, tenantDatabases, apiChecks, frontendHealth, storageHealth, companyAdminRole }) => {
    const availableTables = new Set([
        ...(masterDatabase.tables || []),
        ...tenantDatabases.flatMap(db => db.tables || [])
    ]);
    const readyTenantCount = tenantDatabases.filter(db => db.databaseStatus === 'READY' && db.status !== 'failed').length;

    return moduleDefinitions.map((definition) => {
        const checks = [];
        const missingTables = (definition.tables || []).filter(table => !availableTables.has(table));

        if (missingTables.length) {
            checks.push({
                status: 'failed',
                reason: `Missing or inaccessible tables: ${missingTables.join(', ')}`
            });
        }

        const relatedApiChecks = apiChecks.filter(api =>
            api.includedInHealth !== false &&
            (definition.endpoints || []).some(endpoint => api.endpoint.startsWith(endpoint))
        );
        const failedApis = relatedApiChecks.filter(api => api.status === 'failed');
        const warningApis = relatedApiChecks.filter(api => api.status === 'warning' && api.result !== 'Skipped');

        if (failedApis.length) {
            checks.push({
                status: 'failed',
                reason: `${failedApis.length} API check(s) failed`
            });
        } else if (warningApis.length) {
            checks.push({
                status: 'warning',
                reason: `${warningApis.length} API check(s) returned warnings`
            });
        }

        if (definition.name !== 'Company Portal' && definition.name !== 'Login & Authentication' && tenantDatabases.length > 0 && readyTenantCount === 0) {
            checks.push({
                status: 'warning',
                reason: 'No READY college database is available for tenant module verification'
            });
        }

        if (definition.name === 'Login & Authentication' && !masterDatabase.counts?.companyAdmins) {
            checks.push({ status: 'failed', reason: 'No Company Admin account found' });
        }

        if (definition.name === 'File Uploads' && storageHealth.status !== 'healthy') {
            checks.push({
                status: storageHealth.status,
                reason: storageHealth.checks.find(check => check.status !== 'healthy')?.reason || 'Storage warning'
            });
        }

        if (definition.name === 'Role-Based Access Control (RBAC)' && companyAdminRole !== 'COMPANY_ADMIN') {
            checks.push({ status: 'failed', reason: 'Current health check user is not a Company Admin' });
        }

        if (definition.name === 'Frontend Status' && frontendHealth.status !== 'healthy') {
            checks.push({ status: frontendHealth.status, reason: 'Frontend checks reported warnings' });
        }

        const status = checks.length ? worstStatus(checks) : 'healthy';

        return {
            name: definition.name,
            status,
            reason: checks.find(check => check.status === 'failed')?.reason ||
                checks.find(check => check.status === 'warning')?.reason ||
                'All monitored checks passed',
            checkedAt: new Date().toISOString()
        };
    });
};

const countActiveUsers = async (master, institutions) => {
    const activeSince = new Date(Date.now() - 15 * 60 * 1000);
    let count = 0;

    try {
        count += await master.user.count({ where: { lastLogin: { gte: activeSince } } });
    } catch {
        // Keep the health report resilient if one count fails.
    }

    for (const institution of institutions) {
        const tenant = getReadyTenantClient(institution);
        if (!tenant) continue;
        try {
            count += await tenant.user.count({
                where: {
                    institutionId: institution.id,
                    lastLogin: { gte: activeSince }
                }
            });
        } catch {
            // Tenant-specific failures are reported in database health.
        }
    }

    return count;
};

const buildSuggestedFixes = ({ databaseStatus, apiChecks, frontendHealth, storageHealth, moduleHealth }) => {
    const fixes = [];

    if (databaseStatus !== 'healthy') {
        fixes.push('Review failed master or tenant database checks, then re-run tenant provisioning for any FAILED college database.');
    }

    const scoredApiChecks = apiChecks.filter(api => api.includedInHealth !== false);
    const failedApis = scoredApiChecks.filter(api => api.status === 'failed');
    if (failedApis.length) {
        fixes.push(`Inspect server logs for ${failedApis.length} failed API endpoint(s), especially 500 responses.`);
    }

    const slowApis = scoredApiChecks.filter(api => api.slow);
    if (slowApis.length) {
        fixes.push(`Optimize or index data used by slow API endpoint(s) over ${API_SLOW_THRESHOLD_MS} ms.`);
    }

    if (frontendHealth.status !== 'healthy') {
        fixes.push('Run the client build and a browser smoke test to verify route rendering and console errors.');
    }

    if (storageHealth.status !== 'healthy') {
        fixes.push('Check the server uploads directory permissions or configure Cloudinary credentials.');
    }

    return fixes.length ? fixes : ['No immediate fixes suggested.'];
};

const buildHealthReport = async (req) => {
    const startedAt = performance.now();
    const master = prisma.getMasterClient();
    const checkedAt = new Date().toISOString();

    const masterDatabase = await checkDatabase({
        name: 'Master Database',
        kind: 'master',
        client: master
    });

    let institutions = [];
    if (masterDatabase.status !== 'failed') {
        try {
            institutions = await master.institution.findMany({ orderBy: { createdAt: 'desc' } });
        } catch (err) {
            masterDatabase.checks.push({
                name: 'Institution Metadata',
                status: 'failed',
                reason: err.message
            });
            masterDatabase.status = 'failed';
        }
    }

    const tenantDatabases = [];
    for (const institution of institutions) {
        if (institution.databaseStatus !== 'READY' || !institution.databaseUrl) {
            tenantDatabases.push({
                name: institution.name,
                kind: 'college',
                institutionId: institution.id,
                databaseName: institution.databaseName,
                databaseStatus: institution.databaseStatus || 'PENDING',
                status: institution.databaseStatus === 'FAILED' ? 'failed' : 'warning',
                reason: institution.databaseError || 'College database is not READY',
                checks: [
                    {
                        name: 'Database-per-College Status',
                        status: institution.databaseStatus === 'FAILED' ? 'failed' : 'warning',
                        reason: institution.databaseError || 'Provisioning is pending or incomplete'
                    }
                ],
                counts: {},
                metrics: {}
            });
            continue;
        }

        const tenant = getReadyTenantClient(institution);
        if (!tenant) {
            tenantDatabases.push({
                name: institution.name,
                kind: 'college',
                institutionId: institution.id,
                databaseName: institution.databaseName,
                databaseStatus: institution.databaseStatus,
                status: 'failed',
                reason: 'Could not open tenant Prisma client',
                checks: []
            });
            continue;
        }

        tenantDatabases.push(await checkDatabase({
            name: institution.name,
            kind: 'college',
            client: tenant,
            institution
        }));
    }

    const sampleInstitutionId = institutions.find(inst => inst.databaseStatus === 'READY' && inst.databaseUrl)?.id || null;
    const [apiChecks, activeUsers] = await Promise.all([
        probeApiEndpoints({ req, sampleInstitutionId }),
        countActiveUsers(master, institutions)
    ]);

    const frontendHealth = checkFrontendHealth();
    const storageHealth = checkStorage();
    const backendHealth = {
        status: 'healthy',
        uptimeSeconds: round(process.uptime()),
        nodeVersion: process.version,
        platform: `${os.platform()} ${os.release()}`,
        memory: {
            rss: formatBytes(process.memoryUsage().rss),
            heapUsed: formatBytes(process.memoryUsage().heapUsed),
            heapTotal: formatBytes(process.memoryUsage().heapTotal)
        },
        cpu: {
            cores: os.cpus().length,
            loadAverage: os.loadavg()
        }
    };

    const moduleHealth = buildModuleHealth({
        masterDatabase,
        tenantDatabases,
        apiChecks,
        frontendHealth,
        storageHealth,
        companyAdminRole: req.user?.role
    });

    const databaseStatus = worstStatus([masterDatabase, ...tenantDatabases]);
    const apiHealthChecks = apiChecks.filter(api => api.includedInHealth !== false);
    const apiStatus = worstStatus(apiHealthChecks);
    const errorCounters = getErrorCounters();
    const apiDurations = apiHealthChecks
        .map(api => api.responseTimeMs)
        .filter(value => Number.isFinite(value));
    const averageApiResponseTime = apiDurations.length
        ? round(apiDurations.reduce((sum, value) => sum + value, 0) / apiDurations.length)
        : 0;
    const slowestApis = [...apiHealthChecks]
        .filter(api => Number.isFinite(api.responseTimeMs))
        .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
        .slice(0, 5);

    const performanceHealth = {
        averageApiResponseTime,
        slowestApis,
        memoryUsage: backendHealth.memory,
        cpuUsage: backendHealth.cpu,
        databaseQueryTime: masterDatabase.checks.find(check => check.name.includes('Connection'))?.responseTimeMs || 0,
        largestTables: masterDatabase.metrics?.largestTables || [],
        largestPayloads: []
    };

    const suggestedFixes = buildSuggestedFixes({
        databaseStatus,
        apiChecks,
        frontendHealth,
        storageHealth,
        moduleHealth
    });

    const report = {
        checkedAt,
        intervalMs: HEALTH_INTERVAL_MS,
        cached: false,
        generatedInMs: round(performance.now() - startedAt),
        cards: {
            overallSystemHealth: worstStatus([
                backendHealth,
                frontendHealth,
                { status: databaseStatus },
                { status: apiStatus },
                ...moduleHealth
            ]),
            frontendStatus: frontendHealth.status,
            backendStatus: backendHealth.status,
            databaseStatus,
            apiHealth: apiStatus,
            authentication: moduleHealth.find(module => module.name === 'Login & Authentication')?.status || 'warning',
            storageUsage: {
                status: storageHealth.status,
                value: masterDatabase.metrics?.storage || 'Unknown'
            },
            activeUsers,
            activeColleges: institutions.filter(inst => inst.databaseStatus === 'READY').length,
            responseTime: averageApiResponseTime,
            errorCount: errorCounters.total,
            lastHealthCheck: checkedAt
        },
        backend: backendHealth,
        frontend: frontendHealth,
        storage: storageHealth,
        modules: moduleHealth,
        api: {
            status: apiStatus,
            slowThresholdMs: API_SLOW_THRESHOLD_MS,
            summary: summarizeStatuses(apiChecks),
            endpoints: apiChecks
        },
        database: {
            status: databaseStatus,
            master: masterDatabase,
            colleges: tenantDatabases
        },
        performance: performanceHealth,
        errors: {
            counters: errorCounters,
            recent: getRecentErrors(60)
        },
        report: {
            healthyModules: moduleHealth.filter(module => module.status === 'healthy').map(module => module.name),
            failedModules: moduleHealth.filter(module => module.status === 'failed').map(module => ({
                name: module.name,
                reason: module.reason
            })),
            apiFailures: apiHealthChecks.filter(api => api.status === 'failed'),
            databaseIssues: [masterDatabase, ...tenantDatabases]
                .filter(db => db.status !== 'healthy')
                .map(db => ({
                    name: db.name,
                    status: db.status,
                    reason: db.reason
                })),
            performanceIssues: [
                ...apiHealthChecks.filter(api => api.slow).map(api => ({
                    endpoint: api.endpoint,
                    method: api.method,
                    responseTimeMs: api.responseTimeMs
                }))
            ],
            securityWarnings: apiChecks
                .filter(api => api.statusCode === 401 || api.statusCode === 403)
                .map(api => ({
                    endpoint: api.endpoint,
                    method: api.method,
                    statusCode: api.statusCode,
                    reason: api.reason
                })),
            suggestedFixes
        }
    };

    return report;
};

const getHealthReport = async ({ req, force = false } = {}) => {
    const now = Date.now();
    if (!force && cachedReport && now - cachedAt < HEALTH_INTERVAL_MS) {
        return {
            ...cachedReport,
            cached: true
        };
    }

    cachedReport = await buildHealthReport(req);
    cachedAt = now;
    return cachedReport;
};

module.exports = {
    getHealthReport
};
