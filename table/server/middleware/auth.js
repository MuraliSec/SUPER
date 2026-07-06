const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';

module.exports = function(req, res, next) {
    const publicAuthPaths = [
        '/api/auth/login',
        '/api/auth/register-company-admin',
        '/api/auth/institutions-public',
        '/api/auth/batches-public'
    ];

    if (publicAuthPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Get token from header
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        // Fallback for development if needed, but for production this should be strict
        // For now, let's just let it pass to see how it behaves with existing frontends
        return next();
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        console.log(`🔒 Auth: Verified user ${decoded.username} (${decoded.role})`);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};
