const prisma = require('../config/prisma');

const whitelistedPaths = [
    '/api/auth',
    '/api/profile/status',
    '/api/profile/complete',
    '/api/profile/details',
    '/api/institution/profile',
    '/api/subjects'
];

module.exports = async function(req, res, next) {
    // Only check requests starting with /api
    if (!req.path.startsWith('/api')) {
        return next();
    }

    // Check if path is whitelisted
    const isWhitelisted = whitelistedPaths.some(p => req.path.startsWith(p));
    if (isWhitelisted) {
        return next();
    }

    // If user is authenticated and has profileCompleted === false, block them
    if (req.user) {
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: req.user.id }
            });
            
            if (dbUser && dbUser.profileCompleted === false) {
                return res.status(403).json({ 
                    error: 'Profile completion required', 
                    profileCompleted: false 
                });
            }
        } catch (err) {
            console.error('Error in profileCheck middleware:', err);
        }
    }

    next();
};
