require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./config/prisma');

async function main() {
    const passwordToCheck = process.argv[2] || process.env.COMPANY_ADMIN_PASSWORD;
    const users = await prisma.user.findMany({
        where: { role: 'COMPANY_ADMIN' },
        select: {
            id: true,
            username: true,
            role: true,
            name: true,
            email: true,
            institutionId: true,
            isActive: true,
            mustChangePassword: true,
            profileCompleted: true,
            password: true
        },
        orderBy: { username: 'asc' }
    });

    console.log(`Found ${users.length} COMPANY_ADMIN user(s) in PostgreSQL.`);
    for (const u of users) {
        let passwordMatches = undefined;
        if (passwordToCheck) {
            passwordMatches = /^\$2[aby]\$\d{2}\$/.test(u.password || '')
                ? await bcrypt.compare(passwordToCheck, u.password)
                : passwordToCheck === u.password;
        }

        console.log({
            username: u.username,
            role: u.role,
            name: u.name,
            email: u.email,
            institutionId: u.institutionId,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword,
            profileCompleted: u.profileCompleted,
            passwordHashType: /^\$2[aby]\$\d{2}\$/.test(u.password || '') ? 'bcrypt' : 'plain-or-empty',
            ...(passwordToCheck ? { passwordMatches } : {})
        });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
