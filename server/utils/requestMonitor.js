const MAX_RECENT_ERRORS = 150;

const recentErrors = [];
const counters = {
    failedRequests: 0,
    failedLogins: 0,
    validationErrors: 0,
    databaseErrors: 0,
    serverExceptions: 0
};

const nowIso = () => new Date().toISOString();

const getSeverity = (statusCode, type) => {
    if (type === 'server-exception' || statusCode >= 500) return 'critical';
    if (statusCode === 401 || statusCode === 403) return 'warning';
    if (statusCode >= 400) return 'warning';
    return 'info';
};

const getModuleFromPath = (path = '') => {
    if (path.includes('/auth')) return 'Authentication';
    if (path.includes('/company')) return 'Company Portal';
    if (path.includes('/attendance')) return 'Attendance';
    if (path.includes('/lms')) return 'LMS';
    if (path.includes('/announcements')) return 'Announcements';
    if (path.includes('/jobs')) return 'Upcoming Works';
    if (path.includes('/excel') || path.includes('/upload')) return 'File Uploads';
    if (path.includes('/reports') || path.includes('/analytics') || path.includes('/analysis')) return 'Reports';
    if (path.includes('/profile')) return 'Profile Completion';
    if (path.includes('/students')) return 'Student Management';
    if (path.includes('/faculty')) return 'Faculty Management';
    if (path.includes('/courses')) return 'Course Management';
    if (path.includes('/subjects')) return 'Subject Management';
    if (path.includes('/batches')) return 'Batch Management';
    if (path.includes('/timetables') || path.includes('/generate')) return 'Timetable';
    return 'API';
};

const classify = (statusCode, path = '', message = '') => {
    const loweredMessage = String(message || '').toLowerCase();
    const loweredPath = String(path || '').toLowerCase();

    if (loweredPath.includes('/auth/login') && statusCode === 401) return 'failed-login';
    if (statusCode === 400 || loweredMessage.includes('validation')) return 'validation-error';
    if (loweredMessage.includes('prisma') || loweredMessage.includes('database') || loweredMessage.includes('postgres')) {
        return 'database-error';
    }
    if (statusCode >= 500) return 'server-exception';
    return 'failed-request';
};

const incrementCounter = (type) => {
    if (type === 'failed-login') counters.failedLogins += 1;
    else if (type === 'validation-error') counters.validationErrors += 1;
    else if (type === 'database-error') counters.databaseErrors += 1;
    else if (type === 'server-exception') counters.serverExceptions += 1;
    else counters.failedRequests += 1;
};

const recordError = ({
    type,
    method,
    path,
    statusCode = 500,
    message,
    module,
    responseTimeMs,
    severity,
    user
}) => {
    const finalType = type || classify(statusCode, path, message);
    incrementCounter(finalType);

    recentErrors.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: finalType,
        severity: severity || getSeverity(statusCode, finalType),
        module: module || getModuleFromPath(path),
        method: method || 'SYSTEM',
        path: path || 'process',
        statusCode,
        message: message || 'Request failed',
        responseTimeMs: Number.isFinite(responseTimeMs) ? Math.round(responseTimeMs) : null,
        user: user || null,
        timestamp: nowIso()
    });

    if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.length = MAX_RECENT_ERRORS;
    }
};

const requestMonitor = (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        if (req.headers['x-health-check'] === '1') return;
        if (res.statusCode < 400) return;

        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        recordError({
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            message: res.statusMessage,
            responseTimeMs: elapsedMs,
            user: req.user?.username || null
        });
    });

    next();
};

const getRecentErrors = (limit = 50) => recentErrors.slice(0, limit);

const getErrorCounters = () => ({
    ...counters,
    total:
        counters.failedRequests +
        counters.failedLogins +
        counters.validationErrors +
        counters.databaseErrors +
        counters.serverExceptions,
    recent: recentErrors.length
});

module.exports = {
    requestMonitor,
    recordError,
    getRecentErrors,
    getErrorCounters
};
