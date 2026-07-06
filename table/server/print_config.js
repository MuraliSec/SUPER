const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:katakam3190@localhost:5432/sr_university_db?schema=public'
        }
    }
});

async function main() {
    const config = await prisma.timetableConfig.findFirst({
        where: { institutionId: 'a945ff3d-849c-4a92-8b08-f266d1785578' }
    });
    console.log(config);
}

main().catch(console.error).finally(() => prisma.$disconnect());
