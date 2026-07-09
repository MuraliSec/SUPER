const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const prisma = require('../config/prisma');

const modelChecks = [
  ['institutions', () => prisma.institution.count()],
  ['users', () => prisma.user.count()],
  ['students', () => prisma.student.count()],
  ['faculties', () => prisma.faculty.count()],
  ['batches', () => prisma.batch.count()],
  ['courses', () => prisma.course.count()],
  ['subjects', () => prisma.subject.count()],
  ['rooms', () => prisma.room.count()],
  ['timetables', () => prisma.timetable.count()],
  ['timetableConfigs', () => prisma.timetableConfig.count()],
  ['lmsCourses', () => prisma.lMSCourse.count()],
  ['assignments', () => prisma.assignment.count()],
  ['submissions', () => prisma.submission.count()],
  ['quizzes', () => prisma.quiz.count()],
  ['quizResults', () => prisma.quizResult.count()],
  ['attendanceRecords', () => prisma.attendance.count()],
  ['jobs', () => prisma.job.count()],
];

async function runDatabaseCheck() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is missing.');
    process.exitCode = 1;
    return;
  }

  await prisma.$connect();
  console.log('PostgreSQL connection verified through Prisma.');

  const counts = await Promise.all(
    modelChecks.map(async ([modelName, count]) => ({
      model: modelName,
      rows: await count(),
    }))
  );

  console.table(counts);
}

runDatabaseCheck()
  .catch((err) => {
    console.error('Database check failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
