const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:katakam3190@localhost:5432/sr_university_db?schema=public'
        }
    }
});

async function main() {
    const tts = await prisma.timetable.findMany();
    console.log(`Total timetables: ${tts.length}`);
    tts.forEach(tt => {
        console.log(`- Batch: ${tt.batch} | ID: ${tt.id}`);
        // Let's print out what is occupied in this timetable
        const schedule = tt.schedule;
        if (Array.isArray(schedule)) {
            schedule.forEach(day => {
                day.periods.forEach(p => {
                    if (p.type !== 'Free' && p.type !== 'Lunch' && p.type !== 'Blocked') {
                        console.log(`  [${day.day} Period ${p.period}] Subj: ${p.subject} | Fac: ${p.faculty} | Room: ${p.room}`);
                    }
                });
            });
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
