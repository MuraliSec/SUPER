require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const prisma = require('../config/prisma');
const {
  provisionTenantDatabase,
  getReadyTenantClient,
  seedTenantInstitution
} = require('../utils/tenantDatabase');

const master = prisma.getMasterClient();

const copyMany = async (label, sourceDelegate, targetDelegate, where) => {
  const rows = await sourceDelegate.findMany({ where });
  if (!rows.length) return 0;

  await targetDelegate.createMany({
    data: rows,
    skipDuplicates: true
  });

  console.log(`  copied ${rows.length} ${label}`);
  return rows.length;
};

const copyLmsCourses = async (institutionId, tenant) => {
  const courses = await master.lMSCourse.findMany({
    where: { institutionId },
    include: {
      students: { select: { id: true } }
    }
  });

  for (const course of courses) {
    const { students, ...data } = course;
    await tenant.lMSCourse.upsert({
      where: { id: course.id },
      update: data,
      create: data
    });

    if (students.length) {
      await tenant.lMSCourse.update({
        where: { id: course.id },
        data: {
          students: {
            connect: students.map(student => ({ id: student.id }))
          }
        }
      }).catch(err => {
        console.warn(`  LMS student links skipped for ${course.title}: ${err.message}`);
      });
    }
  }

  if (courses.length) console.log(`  copied ${courses.length} LMS courses`);
  return courses.length;
};

const copyInstitutionData = async (institution) => {
  const tenant = getReadyTenantClient(institution);
  if (!tenant) throw new Error(`Tenant client not ready for ${institution.name}`);

  await seedTenantInstitution(institution);

  const where = { institutionId: institution.id };
  const lmsCourses = await master.lMSCourse.findMany({
    where,
    select: { id: true }
  });
  const lmsCourseIds = lmsCourses.map(course => course.id);
  const assignments = lmsCourseIds.length
    ? await master.assignment.findMany({ where: { courseId: { in: lmsCourseIds } }, select: { id: true } })
    : [];
  const assignmentIds = assignments.map(assignment => assignment.id);
  const quizzes = lmsCourseIds.length
    ? await master.quiz.findMany({ where: { courseId: { in: lmsCourseIds } }, select: { id: true } })
    : [];
  const quizIds = quizzes.map(quiz => quiz.id);

  await copyMany('users', master.user, tenant.user, {
    institutionId: institution.id,
    role: { not: 'COMPANY_ADMIN' }
  });
  await copyMany('faculties', master.faculty, tenant.faculty, where);
  await copyMany('students', master.student, tenant.student, where);
  await copyMany('batches', master.batch, tenant.batch, where);
  await copyMany('rooms', master.room, tenant.room, where);
  await copyMany('subjects', master.subject, tenant.subject, where);
  await copyMany('courses', master.course, tenant.course, where);
  await copyMany('timetable configs', master.timetableConfig, tenant.timetableConfig, where);
  await copyMany('timetables', master.timetable, tenant.timetable, where);
  await copyLmsCourses(institution.id, tenant);
  if (lmsCourseIds.length) {
    await copyMany('assignments', master.assignment, tenant.assignment, { courseId: { in: lmsCourseIds } });
    await copyMany('quizzes', master.quiz, tenant.quiz, { courseId: { in: lmsCourseIds } });
  }
  if (assignmentIds.length) {
    await copyMany('submissions', master.submission, tenant.submission, { assignmentId: { in: assignmentIds } });
  }
  if (quizIds.length) {
    await copyMany('quiz results', master.quizResult, tenant.quizResult, { quizId: { in: quizIds } });
  }
  await copyMany('attendance records', master.attendance, tenant.attendance, where);
  await copyMany('jobs', master.job, tenant.job, where);
  await copyMany('announcements', master.announcement, tenant.announcement, where);
};

const main = async () => {
  const targetInstitutionId = process.argv[2];
  const institutions = await master.institution.findMany(
    targetInstitutionId ? { where: { id: targetInstitutionId } } : {}
  );

  if (!institutions.length) {
    console.log('No institutions found.');
    return;
  }

  for (const institution of institutions) {
    console.log(`\nProvisioning tenant for ${institution.name} (${institution.id})`);

    let readyInstitution = institution;
    if (!institution.databaseUrl || institution.databaseStatus !== 'READY') {
      const result = await provisionTenantDatabase(institution);
      readyInstitution = result.institution;
      console.log(`  database ready: ${readyInstitution.databaseName}`);
    }

    await copyInstitutionData(readyInstitution);
  }
};

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await master.$disconnect();
  });
