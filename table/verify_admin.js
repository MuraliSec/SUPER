const path = require('path');
const { createRequire } = require('module');
const serverDir = path.join(__dirname, 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));

serverRequire('dotenv').config({
    path: path.join(serverDir, '.env'),
});

const bcrypt = serverRequire('bcryptjs');
const prisma = require(path.join(serverDir, 'config', 'prisma'));

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

const comparePassword = async (user, enteredPassword) => {
    if (!user || typeof user.password !== 'string') return false;
    if (!isBcryptHash(user.password)) return String(enteredPassword) === user.password;
    return bcrypt.compare(String(enteredPassword), user.password);
};

async function verify() {
    try {
        const username = process.argv[2] || process.env.COMPANY_ADMIN_USERNAME;
        const password = process.argv[3] || process.env.COMPANY_ADMIN_PASSWORD || 'admin123';

        await prisma.$connect();
        console.log('Connected to PostgreSQL through Prisma');
        const user = await prisma.user.findFirst({
            where: {
                role: 'COMPANY_ADMIN',
                ...(username ? { username: { equals: username, mode: 'insensitive' } } : {})
            }
        });
        if (!user) {
            console.log('No COMPANY_ADMIN found!');
        } else {
            console.log('User found:', user.username);
            const isMatch = await comparePassword(user, password);
            console.log('Password match:', isMatch);
            console.log('Status:', {
                isActive: user.isActive,
                mustChangePassword: user.mustChangePassword,
                profileCompleted: user.profileCompleted,
                institutionId: user.institutionId
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
