require('dotenv').config();
const prisma = require('./config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
    const username = process.argv[2] || process.env.COMPANY_ADMIN_USERNAME || 'company_admin';
    const newPassword = process.argv[3] || process.env.COMPANY_ADMIN_PASSWORD || 'admin123';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const result = await prisma.user.updateMany({
        where: {
            username: { equals: username, mode: 'insensitive' },
            role: 'COMPANY_ADMIN'
        },
        data: {
            password: hashedPassword,
            isActive: true
        }
    });
    console.log(`Updated ${result.count} COMPANY_ADMIN user(s) for username "${username}".`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
