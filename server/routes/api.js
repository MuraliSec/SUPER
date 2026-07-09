const express = require('express');
const prisma = require('../config/prisma');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Scheduler = require('../utils/scheduler');
const excelRouter = require('./excelUpload');
const configRoutes = require('./configRoutes');
const promptGeneratorRouter = require('./promptGenerator');

// Mount Sub-Routers
router.use('/excel', excelRouter);
router.use('/timetable-advanced', configRoutes);
router.use('/generate-from-prompts', promptGeneratorRouter);

// Helper: extract institution id from request
const getInstitutionId = (req) => {
  if (req.user && req.user.institutionId) return req.user.institutionId;
  const id = req.headers['x-institution-id'];
  if (!id || id === 'null' || id === 'undefined' || id === '') {
    return process.env.DEFAULT_INSTITUTION_ID;
  }
  return id;
};

// Helper: Get the query filter based on user role
const getInstFilter = (req) => {
  // If Company Admin, they can see everything unless a specific institution is requested
  if (req.user && req.user.role === 'COMPANY_ADMIN') {
    const requestedId = req.headers['x-institution-id'] || req.query.institutionId;
    return requestedId ? { institutionId: requestedId } : {};
  }
  // Otherwise, strictly filter by their assigned institution
  const id = getInstitutionId(req);
  return id ? { institutionId: id } : {};
};

const findManyWithTenantFallback = async (modelName, req, args = {}) => {
  const scopedItems = await prisma[modelName].findMany(args);

  if (
    scopedItems.length > 0 ||
    !req.tenantSlug ||
    !args.where ||
    !Object.prototype.hasOwnProperty.call(args.where, 'institutionId')
  ) {
    return scopedItems;
  }

  const { institutionId, ...fallbackWhere } = args.where;
  return prisma[modelName].findMany({
    ...args,
    where: fallbackWhere
  });
};

const canPreviewUser = (req) => {
  return req.user && ['COMPANY_ADMIN', 'COLLEGE_ADMIN', 'HOD'].includes(req.user.role);
};

const getRequestedUsername = (req) => {
  const requestedUsername = req.headers['x-username'] || req.query.username;
  if (canPreviewUser(req) && requestedUsername) return requestedUsername;
  return req.user?.username || requestedUsername;
};

const normalizeComparable = (value) => String(value || '').trim().toLowerCase();

const normalizeRosterName = (value) => normalizeComparable(value).replace(/\s+/g, ' ');

const rosterIncludesName = (rosterValue, targetName) => {
  const target = normalizeRosterName(targetName);
  if (!target) return false;

  return String(rosterValue || '')
    .split(',')
    .map(normalizeRosterName)
    .filter(Boolean)
    .includes(target);
};

const hasUsableSubjectCode = (value) => {
  const normalized = normalizeComparable(value);
  return normalized && normalized !== 'n/a' && normalized !== 'undefined';
};

const courseMatchesStudentSubject = (course, enrolledSubject) => {
  const courseName = normalizeComparable(course?.subject || course?.title);
  const courseCode = normalizeComparable(course?.courseCode);
  const enrolledName = normalizeComparable(enrolledSubject?.subjectName);
  const enrolledCode = normalizeComparable(enrolledSubject?.subjectCode);

  if (hasUsableSubjectCode(enrolledCode) && hasUsableSubjectCode(courseCode)) {
    return enrolledCode === courseCode;
  }

  return Boolean(enrolledName && courseName && enrolledName === courseName);
};

// Read-only global search for diagnostics and quick lookup surfaces.
router.get('/search', async (req, res) => {
  try {
    const institutionFilter = getInstFilter(req);
    const query = String(req.query.q || '').trim();
    const contains = query ? { contains: query, mode: 'insensitive' } : undefined;
    const take = Math.min(Number(req.query.limit) || 10, 25);
    const scoped = (where = {}) => ({ ...institutionFilter, ...where });

    const [students, faculty, courses, subjects] = await Promise.all([
      prisma.student.findMany({
        where: scoped(contains ? {
          OR: [
            { name: contains },
            { rollNumber: contains },
            { email: contains },
            { batch: contains },
            { branch: contains }
          ]
        } : {}),
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.faculty.findMany({
        where: scoped(contains ? {
          OR: [
            { name: contains },
            { facultyId: contains },
            { email: contains },
            { department: contains }
          ]
        } : {}),
        take
      }),
      prisma.course.findMany({
        where: scoped(contains ? {
          OR: [
            { subject: contains },
            { courseCode: contains },
            { facultyName: contains },
            { batch: contains },
            { department: contains }
          ]
        } : {}),
        take
      }),
      prisma.subject.findMany({
        where: scoped(contains ? {
          OR: [
            { name: contains },
            { code: contains }
          ]
        } : {}),
        take
      })
    ]);

    res.json({
      query,
      results: {
        students: students.map(item => ({ ...item, _id: item.id })),
        faculty: faculty.map(item => ({ ...item, _id: item.id })),
        courses: courses.map(item => ({ ...item, _id: item.id })),
        subjects: subjects.map(item => ({ ...item, _id: item.id }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const getAttendanceWeight = (record) => {
  const weight = Number(record.attendanceWeight);
  if (Number.isFinite(weight) && weight > 0) return weight;
  return record.classType === 'Lab' ? 2 : 1;
};

const getAttendanceAttendedUnits = (record) => {
  const weight = getAttendanceWeight(record);
  if (record.status === 'Present') return weight;
  if (record.status === 'Late') return weight * 0.5;
  return 0;
};

const formatStudentAttendanceRecord = (record) => {
  const course = record.courseId || record.course || {};
  const weight = getAttendanceWeight(record);

  return {
    id: record.id,
    _id: record._id || record.id,
    courseId: {
      ...course,
      _id: course._id || course.id
    },
    courseName: course.subject || course.title || 'Unknown Subject',
    subjectName: course.subject || course.title || 'Unknown Subject',
    courseCode: course.courseCode || 'N/A',
    date: record.date,
    session: record.session || '',
    classType: record.classType || 'Lecture',
    status: record.status,
    attendanceWeight: weight,
    attendedUnits: getAttendanceAttendedUnits(record),
    conductedUnits: weight
  };
};

// ════════════════════════════════════════════════════════════════════
// PERIOD LABEL MAP
// ════════════════════════════════════════════════════════════════════
const PERIOD_LABELS = {
  1: '9:00-10:00', 2: '10:00-11:00', 3: '11:00-12:00', 4: '12:00-1:00',
  5: '1:00-2:00', 6: '2:00-3:00', 7: '3:00-4:00', 8: '4:00-5:00'
};

// ── User Management (Institutional) ──────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: getInstFilter(req)
    });
    const formatted = users.map(user => {
      const u = { ...user, _id: user.id };
      delete u.password;
      return u;
    });
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { username, password, role, name, email, batch, department } = req.body;
    
    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: { username }
    });
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const user = await prisma.user.create({
      data: {
        username,
        password,
        role,
        name,
        email,
        batch,
        department,
        institutionId
      }
    });
    
    const userResponse = { ...user, _id: user.id };
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { username, role, name, email, batch, department } = req.body;
    const updateData = { username, role, name, email, batch, department };
    
    // Check if another user has this username
    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username,
          id: { not: req.params.id }
        }
      });
      if (existing) return res.status(400).json({ error: 'Username already exists' });
    }

    if (req.body.password) {
        const user = await prisma.user.findFirst({
          where: { id: req.params.id, institutionId }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const updatedUser = await prisma.user.update({
          where: { id: req.params.id },
          data: {
            ...updateData,
            password: req.body.password
          }
        });
        const userResponse = { ...updatedUser, _id: updatedUser.id };
        delete userResponse.password;
        return res.json(userResponse);
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!existingUser) return res.status(404).json({ error: 'User not found' });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    const userResponse = { ...user, _id: user.id };
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await prisma.user.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

// flattenTimetables – expands elective sub-allocations for faculty/room lookups.
// Each elective group is a separate entry so faculty/room availability is accurate.
// ⚠️  Do NOT use this for period counting – use countValidPeriods() instead.
function flattenTimetables(timetables) {
  const entries = [];
  timetables.forEach(tt => {
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (p.type === 'Free' || p.type === 'Lunch') return;
        if (p.isElective && Array.isArray(p.electiveAllocations) && p.electiveAllocations.length > 0) {
          p.electiveAllocations.forEach(alloc => {
            entries.push({
              batch: tt.batch, batchId: tt.batchId,
              day: daySch.day, period: p.period, type: p.type,
              classType: alloc.classType || p.classType || p.type || 'Lecture',
              subject: alloc.subject, faculty: alloc.faculty, room: alloc.room,
              subjectType: 'Elective', isElective: true
            });
          });
        } else {
          entries.push({
            batch: tt.batch, batchId: tt.batchId,
            day: daySch.day, period: p.period, type: p.type,
            classType: p.classType || p.type || 'Lecture',
            subject: p.subject, faculty: p.faculty, room: p.room,
            subjectType: p.subjectType || 'Core', isElective: false
          });
        }
      });
    });
  });
  return entries;
}

// countValidPeriods – counts UNIQUE scheduled periods (1 per day+period slot).
// Fixes the 42-vs-35 bug: elective slots with multiple sub-groups counted only once.
function countValidPeriods(timetable) {
  let count = 0;
  (timetable.schedule || []).forEach(daySch => {
    (daySch.periods || []).forEach(p => {
      if (p.type !== 'Free' && p.type !== 'Lunch') count++;
    });
  });
  return count;
}

// getDistinctValues – safe set extraction
const parseNonNegativeInt = (value) => {
  const parsed = parseInt(value || 0, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

function sanitizeSubjectConfig(subjectConfig = {}) {
  const sanitized = {};

  Object.entries(subjectConfig || {}).forEach(([subjectName, conf]) => {
    if (!subjectName || !conf) return;

    const lectureHours = parseNonNegativeInt(conf.lectureHours);
    const labHours = parseNonNegativeInt(conf.labHours);
    const extraLectureHours = parseNonNegativeInt(conf.extraLectureHours);
    const extraLabHours = parseNonNegativeInt(conf.extraLabHours);

    if (lectureHours + labHours + extraLectureHours + extraLabHours <= 0) return;

    sanitized[subjectName] = {
      ...conf,
      lectureHours,
      labHours,
      extraLectureHours,
      extraLabHours
    };
  });

  return sanitized;
}

function distinct(entries, key) {
  return [...new Set(entries.map(e => e[key]).filter(Boolean))];
}

// ════════════════════════════════════════════════════════════════════
// STANDARD DATA CRUD ROUTES
// ════════════════════════════════════════════════════════════════════

// ── Batches ──────────────────────────────────────────────────────────
router.get('/batches', async (req, res) => {
  try {
    const batches = await findManyWithTenantFallback('batch', req, {
      where: getInstFilter(req)
    });

    // Helper: derive year label from semester number
    const semToYear = (sem) => {
      const s = parseInt(sem, 10);
      if (s <= 2) return '1st Year';
      if (s <= 4) return '2nd Year';
      if (s <= 6) return '3rd Year';
      if (s <= 8) return '4th Year';
      return '5th Year+';
    };

    // Enrich each batch with computed fields
    const enriched = batches.map(b => {
      const obj = { ...b, _id: b.id };
      // Assign name if missing
      if (!obj.name) obj.name = obj.batchId || 'Unknown';
      // Compute year: prefer yearLabel, else derive from semester
      obj.computedYear = (obj.yearLabel && obj.yearLabel.trim())
        ? obj.yearLabel.trim()
        : semToYear(obj.semester);
      return obj;
    });

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const batch = await prisma.batch.create({
      data: { ...req.body, institutionId }
    });
    res.json({ ...batch, _id: batch.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/batches/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const existingBatch = await prisma.batch.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!existingBatch) return res.status(404).json({ error: 'Batch not found' });

    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ ...batch, _id: batch.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/batches/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const batch = await prisma.batch.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    await prisma.batch.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Batch deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches/bulk-delete', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await prisma.batch.deleteMany({
      where: {
        id: { in: ids },
        institutionId
      }
    });
    res.json({ message: `${ids.length} batches deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sync Helpers ──────────────────────────────────────────────────────
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const buildFacultyUserData = async (faculty) => {
  return {
    username: faculty.facultyId,
    password: await hashPassword(`${faculty.facultyId}@123`),
    role: 'FACULTY',
    name: faculty.name || faculty.facultyId,
    email: faculty.email || '',
    department: faculty.department || '',
    institutionId: faculty.institutionId,
    isActive: true,
    mustChangePassword: true,
    profileCompleted: false
  };
};

const ensureFacultyLoginUser = async (faculty) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      username: {
        equals: faculty.facultyId,
        mode: 'insensitive'
      }
    }
  });

  if (!existingUser) {
    await prisma.user.create({
      data: await buildFacultyUserData(faculty)
    });
    return;
  }

  await prisma.user.update({
    where: { id: existingUser.id },
    data: {
      username: faculty.facultyId,
      role: 'FACULTY',
      name: faculty.name || existingUser.name,
      email: faculty.email || existingUser.email,
      department: faculty.department || existingUser.department,
      institutionId: faculty.institutionId || existingUser.institutionId,
      isActive: true
    }
  });
};

const syncFacultyCreate = async (req, faculty) => {
  const tempPassword = faculty.facultyId + '@123';

  await ensureFacultyLoginUser(faculty);

  return tempPassword;
};

const syncFacultyUpdate = async (req, oldFacultyId, faculty) => {
  const existingUser = await prisma.user.findFirst({
    where: { username: { equals: oldFacultyId, mode: 'insensitive' } }
  });

  if (!existingUser) {
    await ensureFacultyLoginUser(faculty);
  } else {
    const updateFields = {
      username: faculty.facultyId,
      role: 'FACULTY',
      name: faculty.name,
      email: faculty.email,
      department: faculty.department,
      institutionId: faculty.institutionId,
      isActive: true
    };

    await prisma.user.update({
      where: { id: existingUser.id },
      data: updateFields
    });
  }
};

const syncFacultyDelete = async (req, facultyId) => {
  await prisma.user.deleteMany({
    where: { username: facultyId }
  });
};

const syncFacultyCourseMapping = async (req, oldFaculty, faculty) => {
  try {
    if (!faculty.batch || !faculty.subject) return;

    if (oldFaculty && (oldFaculty.batch !== faculty.batch || oldFaculty.subject !== faculty.subject || oldFaculty.name !== faculty.name)) {
      const query = {
        institutionId: faculty.institutionId,
        facultyId: oldFaculty.facultyId,
        batch: oldFaculty.batch,
        subject: oldFaculty.subject
      };
      const existing = await prisma.course.findFirst({ where: query });
      if (existing) {
        await prisma.course.updateMany({
          where: query,
          data: {
            batch: faculty.batch,
            subject: faculty.subject,
            facultyName: faculty.name
          }
        });
        return;
      }
    }

    const query = {
      institutionId: faculty.institutionId,
      facultyId: faculty.facultyId,
      batch: faculty.batch,
      subject: faculty.subject
    };
    const existing = await prisma.course.findFirst({ where: query });
    if (!existing) {
      const courseCode = faculty.subject.toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + faculty.batch.toUpperCase().replace(/[^A-Z0-9]/g, '');
      await prisma.course.create({
        data: {
          institutionId: faculty.institutionId,
          facultyId: faculty.facultyId,
          facultyName: faculty.name,
          courseCode,
          subject: faculty.subject,
          type: 'Core',
          batch: faculty.batch,
          credits: 3,
          year: '1st Year',
          semester: 1,
          program: 'B.Tech',
          department: faculty.department || 'CSE',
          totalLoad: 3,
          session: '2025-26-Even'
        }
      });
    } else {
      await prisma.course.updateMany({
        where: query,
        data: { facultyName: faculty.name }
      });
    }
  } catch (err) {
    console.error('Error syncing faculty course mapping:', err);
  }
};

const syncStudentCreate = async (req, student) => {
  const tempPassword = student.rollNumber + '@123';

  await prisma.user.create({
    data: {
      username: student.rollNumber,
      password: tempPassword,
      role: 'STUDENT',
      name: student.name,
      email: student.email,
      department: student.branch,
      batch: student.batch,
      institutionId: student.institutionId,
      mustChangePassword: true,
      profileCompleted: false
    }
  });

  return tempPassword;
};

const syncStudentUpdate = async (req, oldRollNumber, student) => {
  const existingUser = await prisma.user.findFirst({
    where: { username: { equals: oldRollNumber, mode: 'insensitive' } }
  });

  if (!existingUser) {
    const tempPassword = student.rollNumber + '@123';
    await prisma.user.create({
      data: {
        username: student.rollNumber,
        password: tempPassword,
        role: 'STUDENT',
        name: student.name,
        email: student.email,
        department: student.branch,
        batch: student.batch,
        institutionId: student.institutionId,
        mustChangePassword: true,
        profileCompleted: false
      }
    });
  } else {
    const updateFields = {
      username: student.rollNumber,
      name: student.name,
      email: student.email,
      department: student.branch,
      batch: student.batch
    };

    await prisma.user.updateMany({
      where: { username: { equals: oldRollNumber, mode: 'insensitive' } },
      data: updateFields
    });
  }
};

const syncStudentDelete = async (req, rollNumber) => {
  await prisma.user.deleteMany({
    where: { username: rollNumber }
  });
};

// ── Faculty ───────────────────────────────────────────────────────────
const getFacultyWriteData = (body = {}) => ({
  facultyId: String(body.facultyId || '').trim(),
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim(),
  department: String(body.department || '').trim()
});

router.get('/faculty', async (req, res) => {
  try {
    const filter = getInstFilter(req);
    const search = req.query.search;
    
    let whereClause = { ...filter };
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { facultyId: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const faculty = await findManyWithTenantFallback('faculty', req, {
      where: whereClause
    });
    res.json(faculty.map(f => ({ ...f, _id: f.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/faculty', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const facultyData = getFacultyWriteData(req.body);

    if (!facultyData.facultyId || !facultyData.name || !facultyData.email || !facultyData.department) {
      return res.status(400).json({ error: 'Faculty ID, name, email, and department are required' });
    }
    
    const existing = await prisma.faculty.findFirst({
      where: { facultyId: facultyData.facultyId, institutionId }
    });
    if (existing) return res.status(400).json({ error: 'Faculty ID already exists' });
    
    const faculty = await prisma.faculty.create({
      data: { ...facultyData, institutionId }
    });
    
    const formattedFaculty = { ...faculty, _id: faculty.id };
    const tempPassword = await syncFacultyCreate(req, formattedFaculty);
    await syncFacultyCourseMapping(req, null, formattedFaculty);
    
    res.json({ faculty: formattedFaculty, tempPassword });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/faculty/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const facultyData = getFacultyWriteData(req.body);

    if (!facultyData.facultyId || !facultyData.name || !facultyData.email || !facultyData.department) {
      return res.status(400).json({ error: 'Faculty ID, name, email, and department are required' });
    }
    
    const oldFaculty = await prisma.faculty.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!oldFaculty) return res.status(404).json({ error: 'Faculty not found' });
    
    const faculty = await prisma.faculty.update({
      where: { id: req.params.id },
      data: facultyData
    });
    
    const formattedFaculty = { ...faculty, _id: faculty.id };
    await syncFacultyUpdate(req, oldFaculty.facultyId, formattedFaculty);
    await syncFacultyCourseMapping(req, oldFaculty, formattedFaculty);
    
    res.json(formattedFaculty);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/faculty/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    
    const faculty = await prisma.faculty.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    
    await prisma.faculty.delete({
      where: { id: req.params.id }
    });
    
    await syncFacultyDelete(req, faculty.facultyId);
    res.json({ message: 'Faculty deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/faculty/bulk-delete', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    
    const facultiesToDelete = await prisma.faculty.findMany({
      where: {
        id: { in: ids },
        institutionId
      }
    });
    for (const f of facultiesToDelete) {
      await syncFacultyDelete(req, f.facultyId);
    }
    
    await prisma.faculty.deleteMany({
      where: {
        id: { in: ids },
        institutionId
      }
    });
    res.json({ message: `${ids.length} faculty deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Students ──────────────────────────────────────────────────────────

// Student self-service: get own profile (matched by login username = rollNumber)
router.get('/students/me', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const username = getRequestedUsername(req);
    if (!username) return res.status(400).json({ error: 'Username required' });
    const student = await prisma.student.findFirst({
      where: { rollNumber: username, institutionId }
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });
    res.json({ ...student, _id: student.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/students/my-attendance
// Calculates student course-wise attendance stats and overall summaries for the dashboard
router.get('/students/my-attendance', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);

    // Resolve student from username/roll number (either authenticated user, query or header)
    const username = getRequestedUsername(req);
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const studentProfile = await prisma.student.findFirst({
      where: { rollNumber: username, institutionId }
    });
    if (!studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Find student user account (attendance is logged using User.id)
    const tenantUser = await prisma.user.findFirst({
      where: { username, role: 'STUDENT', institutionId }
    });
    if (!tenantUser) {
      return res.status(404).json({ error: 'Student user account not found' });
    }

    // Fetch attendance records sorted newest first
    const records = await prisma.attendance.findMany({
      where: {
        studentId: tenantUser.id,
        institutionId
      },
      include: {
        course: {
          select: {
            id: true,
            subject: true,
            courseCode: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    const formattedRecords = records.map(rec => {
      const r = { ...rec, _id: rec.id };
      if (rec.course) {
        r.courseId = {
          ...rec.course,
          _id: rec.course.id
        };
      }
      return r;
    });

    // Map stats to the student's selected courses using robust code-or-name matching
    const enrolledSubjects = Array.isArray(studentProfile.subjects) ? studentProfile.subjects : [];

    // Filter records to only include courses selected by this student.
    const filteredRecords = formattedRecords.filter(rec =>
      enrolledSubjects.some(subject => courseMatchesStudentSubject(rec.courseId, subject))
    );

    const activityRecords = filteredRecords.map(formatStudentAttendanceRecord);

    let totalPresentOverall = 0;
    let totalConductedOverall = 0;
    let totalAttendedUnitsOverall = 0;
    let totalConductedUnitsOverall = 0;

    const coursesStats = enrolledSubjects.map(s => {
      let present = 0;
      let absent = 0;
      let total = 0;
      let attendedUnits = 0;
      let conductedUnits = 0;

      filteredRecords.forEach(rec => {
        if (courseMatchesStudentSubject(rec.courseId, s)) {
          total++;
          const weight = getAttendanceWeight(rec);
          conductedUnits += weight;
          if (rec.status === 'Present') {
            present++;
            attendedUnits += weight;
          } else if (rec.status === 'Absent') {
            absent++;
          } else if (rec.status === 'Late') {
            present++;
            attendedUnits += (weight * 0.5);
          }
        }
      });

      totalPresentOverall += present;
      totalConductedOverall += total;
      totalAttendedUnitsOverall += attendedUnits;
      totalConductedUnitsOverall += conductedUnits;

      const percentage = conductedUnits > 0 
        ? Math.round((attendedUnits / conductedUnits) * 100) 
        : 0;

      const shortage = conductedUnits > 0 && percentage < 75;
      const required = (conductedUnits > 0 && percentage < 75)
        ? Math.max(0, Math.ceil(3 * conductedUnits - 4 * attendedUnits))
        : 0;

      // Status Badge logic
      let statusBadge = 'Safe ✔';
      if (conductedUnits > 0) {
        if (percentage >= 95) statusBadge = 'Excellent ✅';
        else if (percentage >= 80) statusBadge = 'Good 👍';
        else if (percentage >= 75) statusBadge = 'Safe ✔';
        else if (percentage >= 60) statusBadge = 'Warning ⚠';
        else statusBadge = 'Critical 🔴';
      } else {
        statusBadge = 'Safe ✔'; // default
      }

      return {
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
        presentClasses: present,
        absentClasses: absent,
        totalClasses: total,
        attendedUnits: attendedUnits,
        conductedUnits: conductedUnits,
        attendancePercentage: percentage,
        attendanceShortage: shortage,
        classesRequiredFor75Percent: required,
        statusBadge
      };
    });

    const overallPercentage = totalConductedUnitsOverall > 0 
      ? Math.round((totalAttendedUnitsOverall / totalConductedUnitsOverall) * 100) 
      : 0;

    const overallShortage = overallPercentage < 75;
    const overallRequired = (totalConductedUnitsOverall > 0 && overallPercentage < 75)
      ? Math.max(0, Math.ceil(3 * totalConductedUnitsOverall - 4 * totalAttendedUnitsOverall))
      : 0;

    const quickStats = {
      totalCourses: enrolledSubjects.length,
      totalClasses: totalConductedOverall,
      presentClasses: totalPresentOverall,
      absentClasses: totalConductedOverall - totalPresentOverall,
      attendedUnits: totalAttendedUnitsOverall,
      conductedUnits: totalConductedUnitsOverall
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayRecords = activityRecords.filter(rec => {
      const recDate = new Date(rec.date);
      return recDate >= todayStart && recDate <= todayEnd;
    });
    const recentActivity = todayRecords.slice(0, 10);
    const allActivity = activityRecords;

    res.json({
      student: {
        name: studentProfile.name,
        rollNumber: studentProfile.rollNumber,
        batch: studentProfile.batch,
        branch: studentProfile.branch
      },
      overallAttendance: {
        present: totalPresentOverall,
        total: totalConductedOverall,
        attendedUnits: totalAttendedUnitsOverall,
        conductedUnits: totalConductedUnitsOverall,
        percentage: overallPercentage,
        attendanceShortage: overallShortage,
        classesRequiredFor75Percent: overallRequired
      },
      quickStats,
      courses: coursesStats,
      recentActivity,
      allActivity,
      records: activityRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/my-dashboard
// Returns faculty profile, today's schedule, assigned courses, attendance summary
router.get('/faculty/my-dashboard', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);

    // Resolve faculty from logged-in user (username = facultyId)
    const username = getRequestedUsername(req);
    if (!username) return res.status(400).json({ error: 'Username required' });

    const facultyProfile = await prisma.faculty.findFirst({
      where: { facultyId: username, institutionId }
    });
    if (!facultyProfile) return res.status(404).json({ error: 'Faculty profile not found' });

    const facultyUser = await prisma.user.findFirst({
      where: { username, role: 'FACULTY', institutionId }
    });

    // Get all timetables and extract this faculty's schedule
    const timetables = await findManyWithTenantFallback('timetable', req, {
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);
    const myEntries = entries.filter(e => rosterIncludesName(e.faculty, facultyProfile.name));

    const getScheduleKey = (subject, batch) => `${normalizeRosterName(subject)}#${normalizeRosterName(batch)}`;
    const scheduledByCourse = {};
    const scheduledBySubject = {};

    myEntries.forEach(e => {
      const isLab = normalizeComparable(e.classType || e.type).includes('lab');
      const courseKey = getScheduleKey(e.subject, e.batch);
      const subjectKey = normalizeRosterName(e.subject);

      if (!scheduledByCourse[courseKey]) {
        scheduledByCourse[courseKey] = { lectureHours: 0, labHours: 0, totalHours: 0 };
      }
      if (!scheduledBySubject[subjectKey]) {
        scheduledBySubject[subjectKey] = { lectureHours: 0, labHours: 0, totalHours: 0 };
      }

      const bucket = isLab ? 'labHours' : 'lectureHours';
      scheduledByCourse[courseKey][bucket]++;
      scheduledByCourse[courseKey].totalHours++;
      scheduledBySubject[subjectKey][bucket]++;
      scheduledBySubject[subjectKey].totalHours++;
    });

    // Today's schedule
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDay = dayNames[new Date().getDay()];
    const todaySchedule = myEntries
      .filter(e => e.day === todayDay)
      .sort((a, b) => a.period - b.period)
      .map(e => ({
        period: e.period,
        timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
        subject: e.subject,
        batch: e.batch,
        room: e.room,
        type: e.type || 'Lecture',
        classType: e.classType || e.type || 'Lecture'
      }));

    // Weekly schedule grid
    const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const entryDays = [...new Set(myEntries.map(e => e.day).filter(Boolean))];
    const DAYS = [...DEFAULT_DAYS, ...entryDays.filter(day => !DEFAULT_DAYS.includes(day))];
    const weeklySchedule = {};
    DAYS.forEach(d => { weeklySchedule[d] = {}; });
    myEntries.forEach(e => {
      if (weeklySchedule[e.day]) {
        weeklySchedule[e.day][e.period] = {
          subject: e.subject, batch: e.batch, room: e.room, type: e.type, classType: e.classType
        };
      }
    });

    // Assigned courses
    const allCourses = await findManyWithTenantFallback('course', req, {
      where: { institutionId }
    });
    const assignedCourses = allCourses.filter(c =>
      rosterIncludesName(c.facultyName, facultyProfile.name) ||
      rosterIncludesName(c.faculty, facultyProfile.name) ||
      normalizeRosterName(c.facultyId) === normalizeRosterName(username)
    );

    const assignedCourseKeys = new Set(assignedCourses.map(c => getScheduleKey(c.subject, c.batch)));
    myEntries.forEach(e => {
      const key = getScheduleKey(e.subject, e.batch);
      if (assignedCourseKeys.has(key)) return;

      assignedCourseKeys.add(key);
      assignedCourses.push({
        id: key,
        subject: e.subject,
        batch: e.batch,
        courseCode: '',
        facultyName: facultyProfile.name,
        facultyId: username,
        institutionId
      });
    });

    // Unique assigned batches
    const assignedBatches = [...new Set(assignedCourses.map(c => c.batch).filter(Boolean))];
    const assignedSubjects = [...new Set(assignedCourses.map(c => c.subject).filter(Boolean))];

    // Attendance stats per course (classes marked by this faculty)
    let totalClassesMarked = 0;
    let totalStudentsReached = new Set();

    const courseAttendanceStats = await Promise.all(assignedCourses.map(async (course) => {
      const isPersistedCourse = typeof course.id === 'string' && /^[0-9a-f-]{20,}$/i.test(course.id);
      const records = isPersistedCourse ? await prisma.attendance.findMany({
        where: { courseId: course.id, institutionId }
      }) : [];
      const uniqueDates = new Set(records.map(r => r.date?.toISOString().split('T')[0]));
      const classesConducted = uniqueDates.size;
      totalClassesMarked += classesConducted;
      records.forEach(r => totalStudentsReached.add(r.studentId?.toString()));

      const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const totalStudents = new Set(records.map(r => r.studentId?.toString())).size;

      // Unique sessions are defined by date and session key
      const sessionMap = new Map();
      records.forEach(r => {
        const dateStr = r.date?.toISOString().split('T')[0] || '';
        const sessId = r.session || 'Current';
        const key = `${dateStr}_${sessId}`;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, {
            classType: r.classType || 'Lecture',
            weight: r.attendanceWeight || (r.classType === 'Lab' ? 2 : 1)
          });
        }
      });

      let lectureSessions = 0;
      let labSessions = 0;
      let totalUnitsConducted = 0;

      sessionMap.forEach(sess => {
        if (sess.classType === 'Lab') {
          labSessions++;
        } else {
          lectureSessions++;
        }
        totalUnitsConducted += sess.weight;
      });

      const scheduledHours =
        scheduledByCourse[getScheduleKey(course.subject, course.batch)] ||
        scheduledBySubject[normalizeRosterName(course.subject)] ||
        { lectureHours: 0, labHours: 0, totalHours: 0 };

      return {
        courseId: course.id,
        _id: course.id,
        subject: course.subject,
        batch: course.batch,
        courseCode: course.courseCode || '',
        classesConducted,
        totalRecords: records.length,
        presentRecords: presentCount,
        totalUniqueStudents: totalStudents,
        lectureSessions: scheduledHours.lectureHours,
        labSessions: scheduledHours.labHours,
        lectureHours: scheduledHours.lectureHours,
        labHours: scheduledHours.labHours,
        totalUnitsConducted
      };
    }));

    // Weekly load (periods per week)
    const weeklyLoad = myEntries.length;
    const weeklyLectureHours = myEntries.filter(e => !normalizeComparable(e.classType || e.type).includes('lab')).length;
    const weeklyLabHours = myEntries.filter(e => normalizeComparable(e.classType || e.type).includes('lab')).length;

    const summary = {
      faculty: {
        name: facultyProfile.name,
        facultyId: facultyProfile.facultyId,
        email: facultyProfile.email,
        department: facultyProfile.department,
        branch: facultyProfile.branch || '',
        qualification: facultyProfile.qualification || '',
        maxWeeklyLoad: facultyProfile.maxWeeklyLoad || 20,
      },
      stats: {
        assignedSubjects: assignedSubjects.length,
        assignedBatches: assignedBatches.length,
        totalWeeklyPeriods: weeklyLoad,
        weeklyLectureHours,
        weeklyLabHours,
        totalClassesMarked,
        totalStudentsReached: totalStudentsReached.size,
        todayClassCount: todaySchedule.length
      },
      todayDay,
      todaySchedule,
      scheduleDays: DAYS,
      weeklySchedule,
      assignedCourses: courseAttendanceStats,
      assignedBatches,
      assignedSubjects,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/faculty/my-profile
// Faculty can update their own assigned subjects & batches (from setup wizard)
router.put('/faculty/my-profile', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const username = req.user?.username || req.headers['x-username'] || req.body.username;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const existingProfile = await prisma.faculty.findFirst({
      where: { facultyId: username, institutionId }
    });
    if (!existingProfile) return res.status(404).json({ error: 'Faculty profile not found' });

    res.json({ success: true, profile: { ...existingProfile, _id: existingProfile.id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students', async (req, res) => {
  try {
    const filter = getInstFilter(req);
    let whereClause = { ...filter };

    // Filter by creator faculty based on user role and query params
    if (req.user && req.user.role === 'FACULTY') {
      whereClause.createdByFacultyId = req.user.id || req.user._id;
    } else if (req.query.facultyId) {
      whereClause.createdByFacultyId = req.query.facultyId;
    }

    if (req.query.search) {
      const search = req.query.search;
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { branch: { contains: search, mode: 'insensitive' } },
        { batch: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } }
      ];
    }

    const students = await findManyWithTenantFallback('student', req, {
      where: whereClause
    });
    res.json(students.map(s => ({ ...s, _id: s.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/students', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    
    const existing = await prisma.student.findFirst({
      where: { rollNumber: req.body.rollNumber, institutionId }
    });
    if (existing) return res.status(400).json({ error: 'Roll number already exists' });
    
    const studentData = { ...req.body, institutionId };

    // If creator is a faculty, store their info
    if (req.user && req.user.role === 'FACULTY') {
        studentData.createdByFacultyId = req.user.id;
        studentData.createdByFacultyName = req.user.name;
    }

    if (typeof studentData.subjects === 'string') {
      try {
        studentData.subjects = JSON.parse(studentData.subjects);
      } catch (e) {
        studentData.subjects = [];
      }
    }

    const student = await prisma.student.create({
      data: studentData
    });
    
    const formattedStudent = { ...student, _id: student.id };
    const tempPassword = await syncStudentCreate(req, formattedStudent);
    res.json({ student: formattedStudent, tempPassword });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/students/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    
    const query = { id: req.params.id, institutionId };
    if (req.user?.role === 'FACULTY') {
      query.createdByFacultyId = req.user.id || req.user._id;
      // Prevent faculty from changing ownership
      delete req.body.createdByFacultyId;
      delete req.body.createdByFacultyName;
    }
    
    const oldStudent = await prisma.student.findFirst({
      where: query
    });
    if (!oldStudent) return res.status(404).json({ error: 'Student not found' });
    
    const updateData = { ...req.body };
    if (typeof updateData.subjects === 'string') {
      try {
        updateData.subjects = JSON.parse(updateData.subjects);
      } catch (e) {
        updateData.subjects = [];
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    const formattedStudent = { ...student, _id: student.id };
    await syncStudentUpdate(req, oldStudent.rollNumber, formattedStudent);
    
    res.json(formattedStudent);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.delete('/students/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    
    const query = { id: req.params.id, institutionId };
    if (req.user?.role === 'FACULTY') {
      query.createdByFacultyId = req.user.id || req.user._id;
    }
    
    const student = await prisma.student.findFirst({
      where: query
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    await prisma.student.delete({
      where: { id: req.params.id }
    });

    await syncStudentDelete(req, student.rollNumber);
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.post('/students/bulk-delete', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    
    const query = { id: { in: ids }, institutionId };
    if (req.user?.role === 'FACULTY') {
      query.createdByFacultyId = req.user.id || req.user._id;
    }
    
    const studentsToDelete = await prisma.student.findMany({
      where: query
    });
    for (const s of studentsToDelete) {
      await syncStudentDelete(req, s.rollNumber);
    }
    
    const delResult = await prisma.student.deleteMany({
      where: query
    });
    res.json({ message: `${delResult.count} students deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Rooms ─────────────────────────────────────────────────────────────
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await findManyWithTenantFallback('room', req, {
      where: getInstFilter(req)
    });
    res.json(rooms.map(r => ({ ...r, _id: r.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rooms', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const room = await prisma.room.create({
      data: { ...req.body, institutionId }
    });
    res.json({ ...room, _id: room.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const existingRoom = await prisma.room.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!existingRoom) return res.status(404).json({ error: 'Room not found' });

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ ...room, _id: room.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const room = await prisma.room.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    await prisma.room.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Room deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rooms/bulk-delete', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await prisma.room.deleteMany({
      where: {
        id: { in: ids },
        institutionId
      }
    });
    res.json({ message: `${ids.length} rooms deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Subjects ──────────────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await findManyWithTenantFallback('subject', req, {
      where: getInstFilter(req)
    });
    res.json(subjects.map(s => ({ ...s, _id: s.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subjects', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { name, code } = req.body;
    const subject = await prisma.subject.create({
      data: { name, code, institutionId }
    });
    res.json({ ...subject, _id: subject.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/subjects/grouping', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { updates } = req.body;
    
    await Promise.all(updates.map(async ({ subjectName, slotGroup }) => {
      const existing = await prisma.subject.findFirst({
        where: { name: subjectName, institutionId }
      });
      if (existing) {
        await prisma.subject.update({
          where: { id: existing.id },
          data: { slotGroup }
        });
      } else {
        await prisma.subject.create({
          data: {
            name: subjectName,
            code: subjectName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'SUBJ',
            slotGroup,
            institutionId
          }
        });
      }
    }));
    res.json({ message: 'Subject groupings updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Courses ───────────────────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const courses = await findManyWithTenantFallback('course', req, {
      where: { institutionId }
    });
    res.json(courses.map(c => ({ ...c, _id: c.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/courses', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const course = await prisma.course.create({
      data: { ...req.body, institutionId }
    });
    res.json({ ...course, _id: course.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const existingCourse = await prisma.course.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!existingCourse) return res.status(404).json({ error: 'Course not found' });

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ ...course, _id: course.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    await prisma.course.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/courses/bulk-delete', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { ids } = req.body;
    await prisma.course.deleteMany({
      where: {
        id: { in: ids },
        institutionId
      }
    });
    res.json({ message: `${ids.length} courses deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// TIMETABLE ROUTES
// ════════════════════════════════════════════════════════════════════

router.get('/timetables', async (req, res) => {
  try {
    const items = await findManyWithTenantFallback('timetable', req, {
      where: getInstFilter(req),
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(items.map(t => ({ ...t, _id: t.id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/timetables/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const item = await prisma.timetable.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ ...item, _id: item.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/timetables/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const result = await prisma.timetable.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!result) return res.status(404).json({ error: 'Timetable not found' });

    await prisma.timetable.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Timetable deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE all timetables for this institution (bulk cleanup)
router.delete('/timetables', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });
    const result = await prisma.timetable.deleteMany({ where: { institutionId } });
    res.json({ message: `Deleted ${result.count} timetable(s)`, count: result.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.put('/timetables/:id', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { schedule } = req.body;
    const existing = await prisma.timetable.findFirst({
      where: { id: req.params.id, institutionId }
    });
    if (!existing) return res.status(404).json({ error: 'Timetable not found' });

    const result = await prisma.timetable.update({
      where: { id: req.params.id },
      data: { schedule }
    });
    res.json({ ...result, _id: result.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// TIMETABLE GENERATION
// ════════════════════════════════════════════════════════════════════

router.post('/generate', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

    const { batchId, batchIds, batchNames, subjectConfig, batchConfigs, batchRooms, batchLunchConfigs, selectedRooms, weeklySlots, blockedSlots } = req.body;
    const targetBatchIds = batchIds || [batchId];

    if (!targetBatchIds || targetBatchIds.length === 0) {
      return res.status(400).json({ error: 'Batch selection required' });
    }

    const batches = await prisma.batch.findMany({
      where: {
        id: { in: targetBatchIds },
        institutionId
      }
    });
    if (batches.length === 0) return res.status(404).json({ error: 'Batches not found' });

    let config = null;
    if (batches[0].session) {
      config = await prisma.timetableConfig.findFirst({
        where: { session: batches[0].session, institutionId }
      });
    }

    const rooms = {
      lectureRooms: (selectedRooms?.lectureRooms?.length > 0) ? selectedRooms.lectureRooms : ['Classroom'],
      labRooms: (selectedRooms?.labRooms?.length > 0) ? selectedRooms.labRooms : ['Lab']
    };

    const existingTimetables = await prisma.timetable.findMany({
      where: {
        institutionId,
        batchId: { notIn: targetBatchIds }
      }
    });

    const batchNamesMap = {};
    batches.forEach(b => {
      batchNamesMap[b.id.toString()] = b.name || b.batchId || b.id.toString();
    });

    const schedulerOptions = {
      weeklySlots: weeklySlots || null,
      batchRooms: batchRooms || null,
      batchNamesMap: batchNamesMap,
      blockedSlots: blockedSlots || {},
      batchLunchConfigs: batchLunchConfigs || {}
    };

    const mappedExisting = existingTimetables.map(t => ({ ...t, _id: t.id }));
    const mappedConfig = config ? { ...config, _id: config.id } : null;

    const scheduler = new Scheduler(mappedConfig, rooms, mappedExisting, institutionId, schedulerOptions);
    const batchesData = batches.map(b => {
      const bObj = { ...b, _id: b.id };
      // Find index in targetBatchIds to get correct batchName from UI if available
      const idx = targetBatchIds.indexOf(b.id.toString());
      const bName = (batchNames && batchNames[idx]) ? batchNames[idx] : (b.name || b.batchId || b.id.toString());
      bObj.batchId = bName; // temporary set for scheduler

      const rawConf = (batchConfigs && (batchConfigs[b.id.toString()] || batchConfigs[b.batchId])) || subjectConfig;
      const finalConf = sanitizeSubjectConfig(rawConf);

      return {
        batch: bObj,
        subjectConfig: finalConf
      };
    });

    const results = scheduler.generateMulti(batchesData);

    const savedTimetables = [];
    for (const result of results) {
      await prisma.timetable.deleteMany({
        where: {
          institutionId,
          OR: [
            { batch: result.batchName },
            { batchId: result.batchId }
          ]
        }
      });

      const tt = await prisma.timetable.create({
        data: {
          institutionId,
          title: `Timetable for ${result.batchName}`,
          batch: result.batchName,
          batchId: result.batchId,
          schedule: result.schedule,
          createdAt: new Date()
        }
      });
      savedTimetables.push({ ...tt, _id: tt.id });
    }

    const allWarnings = results.flatMap(r => r.warnings || []);

    res.json({
      message: `${savedTimetables.length} Timetables generated successfully`,
      timetable: savedTimetables[0],
      timetables: savedTimetables,
      warnings: allWarnings
    });
  } catch (err) {
    console.error("GENERATE ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Stats preview (without generating)
router.post('/stats/preview', async (req, res) => {
  try {
    const { batchId, subjectConfig } = req.body;
    let totalSlots = 35;

    if (batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: batchId }
      });
      if (batch && batch.session) {
        try {
          const config = await prisma.timetableConfig.findFirst({
            where: { session: batch.session }
          });
          if (config) {
            const pPerDay = config.periodsPerDay || 8;
            const days = (config.workingDays && config.workingDays.length > 0) ? config.workingDays.length : 5;
            const lunchEnabled = config.lunchBreak && config.lunchBreak.enabled;
            totalSlots = (pPerDay * days) - (lunchEnabled ? days : 0);
          }
        } catch (e) { /* fallback */ }
      }
    }

    let allocatedSlots = 0;
    const groupedElectiveSubjects = {};

    Object.entries(subjectConfig).forEach(([subject, conf]) => {
      const lectures = parseInt(conf.lectureHours || 0);
      const labs = parseInt(conf.labHours || 0);
      const slotGroup = String(conf.slotGroup || '').trim().toUpperCase();
      const isGroupedElective = String(conf.subjectType || '').toLowerCase() === 'elective' &&
        (slotGroup === 'A' || slotGroup === 'B');

      if (isGroupedElective) {
        if (!groupedElectiveSubjects[slotGroup]) groupedElectiveSubjects[slotGroup] = [];
        groupedElectiveSubjects[slotGroup].push(subject);
        return;
      }
      allocatedSlots += lectures + labs;
    });

    Object.entries(groupedElectiveSubjects).forEach(([, slotSubjects]) => {
      if (!slotSubjects || slotSubjects.length === 0) return;
      const allLecHours = slotSubjects.map(s => parseInt(subjectConfig[s]?.lectureHours || 0));
      const minLecHours = Math.min(...allLecHours);
      allocatedSlots += minLecHours;
      slotSubjects.forEach(s => {
        const extra = parseInt(subjectConfig[s]?.lectureHours || 0) - minLecHours;
        if (extra > 0) allocatedSlots += extra;
      });
      const labSubjects = slotSubjects.filter(s => parseInt(subjectConfig[s]?.labHours || 0) > 0);
      if (labSubjects.length > 0) {
        const allLabHours = labSubjects.map(s => parseInt(subjectConfig[s]?.labHours || 0));
        const minLabHours = Math.min(...allLabHours);
        const labDuration = (minLabHours % 3 === 0) ? 3 : 2;
        allocatedSlots += Math.floor(minLabHours / labDuration) * labDuration;
        labSubjects.forEach(s => {
          const extraLab = parseInt(subjectConfig[s]?.labHours || 0) - minLabHours;
          if (extraLab > 0) {
            const d = (extraLab % 3 === 0) ? 3 : 2;
            allocatedSlots += Math.floor(extraLab / d) * d;
          }
        });
      }
    });

    res.json({
      totalSlots, allocatedSlots,
      freeSlots: Math.max(0, totalSlots - allocatedSlots),
      remainingHours: Math.max(0, totalSlots - allocatedSlots)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// REPORTING & ANALYTICS – Comprehensive Implementation
// ════════════════════════════════════════════════════════════════════

// ── 1. Faculty Wise Report ───────────────────────────────────────────
router.get('/reports/faculty', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { facultyNames } = req.query;
    const names = Array.isArray(facultyNames)
      ? facultyNames
      : (facultyNames ? facultyNames.split(',').map(s => s.trim()).filter(Boolean) : []);

    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const allFaculty = await prisma.faculty.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const targetNames = names.length > 0 ? names : allFaculty.map(f => f.name);

    const report = {};
    targetNames.forEach(name => {
      const myEntries = entries.filter(e => e.faculty === name);
      const schedule = myEntries.map(e => ({
        day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
        subject: e.subject, room: e.room, batch: e.batch, type: e.type
      }));

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const weeklyGrid = {};
      days.forEach(d => { weeklyGrid[d] = {}; });
      schedule.forEach(s => { if (weeklyGrid[s.day]) weeklyGrid[s.day][s.period] = s; });

      report[name] = {
        schedule, weeklyGrid,
        totalHours: schedule.length,
        freeSlots: Math.max(0, (5 * 7) - schedule.length)
      };
    });

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 2. Room Wise Report ──────────────────────────────────────────────
router.get('/reports/room', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { roomNames } = req.query;
    const names = Array.isArray(roomNames)
      ? roomNames
      : (roomNames ? roomNames.split(',').map(s => s.trim()).filter(Boolean) : []);

    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const allRooms = await prisma.room.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const targetNames = names.length > 0 ? names : allRooms.map(r => r.name);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const allPeriods = [1, 2, 3, 4, 5, 6, 7, 8];

    const report = {};
    targetNames.forEach(name => {
      const myEntries = entries.filter(e => e.room === name);
      const occupied = myEntries.map(e => ({
        day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
        subject: e.subject, faculty: e.faculty, batch: e.batch, type: e.type
      }));

      const grid = {};
      days.forEach(d => {
        grid[d] = {};
        allPeriods.forEach(p => { grid[d][p] = { status: 'Free', data: null }; });
      });
      occupied.forEach(o => {
        if (grid[o.day]) grid[o.day][o.period] = { status: 'Occupied', data: o };
      });

      const roomInfo = allRooms.find(r => r.name === name);
      const totalSlots = days.length * allPeriods.length;          // 5 × 8 = 40
      report[name] = {
        type: roomInfo?.type || 'Unknown',
        capacity: roomInfo?.capacity || '-',
        occupied, grid,
        usedHours: occupied.length,
        totalHours: totalSlots,
        utilizationPct: ((occupied.length / totalSlots) * 100).toFixed(1)
      };
    });

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 3. Course Wise Report ────────────────────────────────────────────
router.get('/reports/course', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { courseName } = req.query;

    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    if (!courseName) {
      const distinctCourses = [...new Set(entries.map(e => e.subject).filter(Boolean))].sort();
      return res.json({ courses: distinctCourses });
    }

    const myEntries = entries.filter(e =>
      e.subject && e.subject.toLowerCase().includes(courseName.toLowerCase())
    );

    const schedule = myEntries.map(e => ({
      day: e.day, period: e.period, timeLabel: PERIOD_LABELS[e.period] || `P${e.period}`,
      faculty: e.faculty, room: e.room, batch: e.batch, type: e.type
    }));

    res.json({
      courseName, schedule,
      faculties: [...new Set(myEntries.map(e => e.faculty).filter(Boolean))],
      rooms: [...new Set(myEntries.map(e => e.room).filter(Boolean))],
      batches: [...new Set(myEntries.map(e => e.batch).filter(Boolean))],
      totalEntries: schedule.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 4. Batch Wise Report ─────────────────────────────────────────────
router.get('/reports/batch', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { batchId } = req.query;
    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));

    if (!batchId) {
      const summaries = mappedTimetables.map(tt => {
        const entries = flattenTimetables([tt]);
        return {
          id: tt._id, batchId: tt.batchId, batchName: tt.batch,
          totalPeriods: countValidPeriods(tt),           // ← fixed: deduped count
          subjects: distinct(entries, 'subject').length,
          faculty: distinct(entries, 'faculty').length,
        };
      });
      return res.json(summaries);
    }

    const tt = mappedTimetables.find(t =>
      t.batchId === batchId || t._id.toString() === batchId || t.batch === batchId
    );
    if (!tt) return res.status(404).json({ error: 'Timetable not found for batch' });

    const entries = flattenTimetables([tt]);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const allPeriods = [1, 2, 3, 4, 5, 6, 7, 8];

    const grid = {};
    days.forEach(d => { grid[d] = {}; allPeriods.forEach(p => { grid[d][p] = null; }); });
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (grid[daySch.day]) grid[daySch.day][p.period] = p;
      });
    });

    // Subject distribution – count each PERIOD once even for elective slots
    const subjectDist = {};
    (tt.schedule || []).forEach(daySch => {
      (daySch.periods || []).forEach(p => {
        if (p.type === 'Free' || p.type === 'Lunch') return;
        if (p.isElective && Array.isArray(p.electiveAllocations) && p.electiveAllocations.length > 0) {
          // For grouped electives, list each subject individually
          p.electiveAllocations.forEach(alloc => {
            if (alloc.subject) subjectDist[alloc.subject] = (subjectDist[alloc.subject] || 0) + 1;
          });
        } else if (p.subject) {
          subjectDist[p.subject] = (subjectDist[p.subject] || 0) + 1;
        }
      });
    });

    // totalPeriods = unique (day, period) slots that are scheduled (not Free/Lunch)
    const totalPeriods = countValidPeriods(tt);

    res.json({
      batchName: tt.batch, batchId: tt.batchId,
      schedule: tt.schedule, grid, entries,
      summary: {
        subjects: distinct(entries, 'subject'),
        faculty: distinct(entries, 'faculty'),
        rooms: distinct(entries, 'room')
      },
      subjectDistribution: subjectDist,
      totalPeriods
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Legacy batch wise report by param (keep for compatibility)
router.get('/reports/batch/:batchId', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const tt = await prisma.timetable.findFirst({
      where: {
        institutionId,
        OR: [
          { batchId: req.params.batchId },
          { batch: req.params.batchId }
        ]
      }
    });
    if (!tt) return res.status(404).json({ error: 'Timetable not found for batch' });
    res.json({ ...tt, _id: tt.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 5. Week & Time Slot Analysis ─────────────────────────────────────
router.get('/analysis/slots', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { day, periods } = req.query;
    const periodNums = periods ? periods.split(',').map(Number).filter(n => !isNaN(n)) : [1, 2, 3, 4, 5, 6, 7, 8];
    const targetDay = day || 'Monday';

    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const allFaculty = await prisma.faculty.findMany({
      where: { institutionId }
    });
    const allRooms = await prisma.room.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const result = periodNums.map(pNum => {
      const slotEntries = entries.filter(e => e.day === targetDay && e.period === pNum);
      const busyFaculty = new Set(slotEntries.map(e => e.faculty).filter(Boolean));
      const busyRooms = new Set(slotEntries.map(e => e.room).filter(Boolean));

      return {
        period: pNum,
        timeLabel: PERIOD_LABELS[pNum] || `Period ${pNum}`,
        freeFaculty: allFaculty.filter(f => !busyFaculty.has(f.name)).map(f => ({ name: f.name, department: f.department })),
        busyFaculty: slotEntries.map(e => ({ name: e.faculty, subject: e.subject, room: e.room, batch: e.batch })).filter(e => e.name),
        freeRooms: allRooms.filter(r => !busyRooms.has(r.name)).map(r => ({ name: r.name, type: r.type })),
        busyRooms: slotEntries.map(e => ({ name: e.room, subject: e.subject, faculty: e.faculty, batch: e.batch })).filter(e => e.name),
        occupancy: slotEntries
      };
    });

    res.json({ day: targetDay, periods: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 6. Room Utilization Analytics ────────────────────────────────────
router.get('/analytics/room-utilization', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const allRooms = await prisma.room.findMany({
      where: { institutionId }
    });
    const config = await prisma.timetableConfig.findFirst({
      where: { institutionId }
    });

    const daysCount = config?.workingDays?.length || 5;
    const periodsCount = config?.periodsPerDay || 8;
    const lunchDed = (config?.lunchBreak?.enabled) ? daysCount : 0;
    const totalPossible = (periodsCount * daysCount) - lunchDed;

    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const utilization = {};
    allRooms.forEach(r => {
      utilization[r.name] = { usedHours: 0, totalHours: totalPossible, type: r.type, capacity: r.capacity };
    });

    entries.forEach(e => {
      if (e.room && utilization[e.room]) utilization[e.room].usedHours++;
    });

    const report = Object.entries(utilization)
      .map(([name, s]) => ({
        room: name, type: s.type, capacity: s.capacity,
        usedHours: s.usedHours, totalHours: s.totalHours,
        freeHours: s.totalHours - s.usedHours,
        percentage: s.totalHours > 0 ? ((s.usedHours / s.totalHours) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 7. Course Load Distribution (L-T-P) ──────────────────────────────
router.get('/analytics/course-load', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const courses = await prisma.course.findMany({
      where: { institutionId }
    });

    const grouped = {};
    courses.forEach(c => {
      const key = c.subject || c.courseCode || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = {
          courseName: c.subject, courseCode: c.courseCode,
          department: c.department, program: c.program,
          L: 0, T: 0, P: 0, credits: c.credits || 0, faculty: new Set()
        };
      }
      if (c.facultyName) grouped[key].faculty.add(c.facultyName);
      grouped[key].L = Math.max(grouped[key].L, c.courseL || 0);
      grouped[key].T = Math.max(grouped[key].T, c.courseT || 0);
      grouped[key].P = Math.max(grouped[key].P, c.courseP || 0);
    });

    const report = Object.values(grouped).map(g => ({
      courseName: g.courseName, courseCode: g.courseCode,
      department: g.department, program: g.program,
      noOfFaculty: g.faculty.size,
      facultyNames: Array.from(g.faculty),
      L: g.L, T: g.T, P: g.P,
      total: g.L + g.T + g.P,
      credits: g.credits
    })).sort((a, b) => b.total - a.total);

    res.json(report);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 8. Distinct courses list (for dropdowns) ─────────────────────────
router.get('/reports/courses-list', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const courses = await prisma.course.findMany({
      where: { institutionId },
      select: { subject: true, courseCode: true, department: true }
    });
    const distinct = [...new Map(courses.map(c => [c.subject, c])).values()]
      .map(c => ({ name: c.subject, code: c.courseCode, dept: c.department }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(distinct);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 9. Faculty Availability Heat-Map ─────────────────────────────────
router.get('/faculty-info/availability', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8];

    const allFaculty = await prisma.faculty.findMany({
      where: { institutionId }
    });
    const allRooms = await prisma.room.findMany({
      where: { institutionId }
    });
    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const availability = days.map(day => {
      const periodData = periods.map(period => {
        const slotEntries = entries.filter(e => e.day === day && e.period === period);
        const occupiedFaculty = new Set(slotEntries.map(e => e.faculty).filter(Boolean));
        const occupiedRooms = new Set(slotEntries.map(e => e.room).filter(Boolean));
        const availableFacultyList = allFaculty.filter(f => !occupiedFaculty.has(f.name)).map(f => ({ ...f, _id: f.id }));
        const availableRoomsList = allRooms.filter(r => !occupiedRooms.has(r.name)).map(r => ({ ...r, _id: r.id }));

        return {
          period,
          total: allFaculty.length,
          availableCount: availableFacultyList.length,
          availableFaculty: availableFacultyList,
          busyFacultyNames: Array.from(occupiedFaculty),
          totalRooms: allRooms.length,
          availableRoomCount: availableRoomsList.length,
          availableRooms: availableRoomsList
        };
      });
      return { day, periods: periodData };
    });

    res.json(availability);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 10. Conflict Checker ──────────────────────────────────────────────
router.get('/timetables/conflicts/:day/:period', async (req, res) => {
  try {
    const institutionId = getInstitutionId(req);
    const { day, period } = req.params;
    const periodNum = parseInt(period);
    const timetables = await prisma.timetable.findMany({
      where: { institutionId }
    });
    const mappedTimetables = timetables.map(t => ({ ...t, _id: t.id }));
    const entries = flattenTimetables(mappedTimetables);

    const slotEntries = entries.filter(e => e.day === day && e.period === periodNum);
    const occupiedRooms = [...new Set(slotEntries.map(e => e.room).filter(Boolean))];
    const occupiedFaculty = [...new Set(slotEntries.map(e => e.faculty).filter(Boolean))];

    // Build day-level faculty busy map for consecutive check
    const dayEntries = entries.filter(e => e.day === day);
    const facultyBusyMap = {};
    dayEntries.forEach(e => {
      if (e.faculty) {
        if (!facultyBusyMap[e.faculty]) facultyBusyMap[e.faculty] = [];
        facultyBusyMap[e.faculty].push(e.period);
      }
    });

    res.json({ occupiedRooms, occupiedFaculty, facultyBusyMap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/institution/profile
// Returns the college name and logo for branding
router.get('/institution/profile', async (req, res) => {
  try {
    const institutionId = req.headers['x-institution-id'] || req.query.institutionId || req.user?.institutionId || req.institutionId;
    if (!institutionId) {
      return res.json({ collegeName: '', logo: '' });
    }
    const inst = await prisma.institution.findUnique({
      where: { id: institutionId }
    });
    const profile = inst || req.institution;
    if (!profile) return res.json({ collegeName: '', logo: '' });

    res.json({
      collegeName: profile.collegeName || profile.name || '',
      logo: profile.logo || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/details
// Returns the logged-in user's full profile details (including role-specific data)
router.get('/profile/details', async (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-username'] || req.query.username;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const details = {
      name: user.name || '',
      username: user.username,
      role: user.role,
      email: user.email || '',
      mobileNumber: user.mobileNumber || '',
      profilePhoto: user.profilePhoto || '',
      branch: user.branch || '',
      department: user.department || ''
    };

    if (user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { rollNumber: user.username, institutionId: user.institutionId }
      });
      if (student) {
        details.academicYear = student.academicYear || '';
        details.batch = student.batch || '';
        details.address = student.address || '';
        details.parentDetails = student.parentDetails || '';
        details.subjects = student.subjects || [];
      }
    } else if (user.role === 'FACULTY') {
      const faculty = await prisma.faculty.findFirst({
        where: { facultyId: user.username, institutionId: user.institutionId }
      });
      if (faculty) {
        details.department = faculty.department || '';
        details.branch = '';
      }
    } else if (user.role === 'HOD' || user.role === 'COLLEGE_ADMIN') {
      if (user.institutionId) {
        const inst = await prisma.institution.findUnique({
          where: { id: user.institutionId }
        });
        if (inst) {
          details.collegeName = inst.collegeName || inst.name || '';
        }
      }
    }

    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/status
// Returns the status of the logged-in user's profile and password requirement
router.get('/profile/status', async (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-username'] || req.query.username;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      mustChangePassword: user.mustChangePassword || false,
      profileCompleted: user.profileCompleted || false,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/complete
// Saves the first-login profile completion form details for all roles
router.post('/profile/complete', async (req, res) => {
  try {
    let username = req.user?.username || req.headers['x-username'] || req.body.username;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const role = req.user?.role || req.body.role;
    if (!role) return res.status(400).json({ error: 'User role required' });

    const institutionId = req.user?.institutionId || req.body.institutionId || getInstitutionId(req);

    let updatedName = "";
    let updatedEmail = "";
    let updatedMobile = "";
    let updatedPhoto = "";

    // 1. Process Role-Specific Profiles
    if (role === 'COMPANY_ADMIN' || role === 'COLLEGE_ADMIN' || role === 'HOD') {
      const { collegeName, email, mobileNumber, profilePhoto } = req.body;
      if (!collegeName || !email) {
        return res.status(400).json({ error: 'College Name and Email are required' });
      }
      
      // Update Institution name and logo
      if (institutionId) {
        await prisma.institution.update({
          where: { id: institutionId },
          data: { 
            name: collegeName,
            collegeName: collegeName,
            logo: profilePhoto || ""
          } 
        });

        const master = prisma.getMasterClient();
        await master.institution.update({
          where: { id: institutionId },
          data: {
            name: collegeName,
            collegeName: collegeName,
            logo: profilePhoto || ""
          }
        }).catch(err => {
          console.error('Failed to sync institution metadata to master DB:', err.message);
        });
      }
      
      updatedEmail = email;
      updatedMobile = mobileNumber || "";
      updatedPhoto = profilePhoto || "";
    }
    else if (role === 'FACULTY') {
      const { facultyName, facultyId, email } = req.body;
      let { department } = req.body;

      if (!department && req.user) {
        const existingUser = await prisma.user.findUnique({
          where: { id: req.user.id }
        });
        if (existingUser && existingUser.department) {
          department = existingUser.department;
        }
      }

      if (!department) {
        const existingFaculty = await prisma.faculty.findFirst({
          where: { facultyId: username, institutionId }
        });
        if (existingFaculty && existingFaculty.department) {
          department = existingFaculty.department;
        }
      }

      if (!department) department = "CSE";

      if (!facultyName || !facultyId || !email || !department) {
        return res.status(400).json({ error: 'Faculty Name, ID, Email and Department are required' });
      }

      await prisma.faculty.upsert({
        where: {
          institutionId_facultyId: {
            facultyId: username,
            institutionId
          }
        },
        update: {
          name: facultyName,
          facultyId: facultyId,
          email: email,
          department: department
        },
        create: {
          institutionId,
          name: facultyName,
          facultyId: facultyId,
          email: email,
          department: department
        }
      });

      updatedName = facultyName;
      updatedEmail = email;
      updatedMobile = "";
      updatedPhoto = "";
    }
    else if (role === 'STUDENT') {
      const { 
        studentName, rollNumber, email, mobileNumber, academicYear, 
        branch, batch, semester, address, parentDetails, profilePhoto, subjects 
      } = req.body;

      if (!studentName || !rollNumber || !email || !batch || !semester) {
        return res.status(400).json({ error: 'Student Name, Roll Number, Email, Batch, and Semester are required' });
      }

      let existingStudent = await prisma.student.findFirst({
        where: { rollNumber: username, institutionId }
      });
      if (!existingStudent) {
        existingStudent = await prisma.student.findFirst({
          where: { rollNumber: rollNumber, institutionId }
        });
      }

      if (existingStudent) {
        await prisma.student.update({
          where: { id: existingStudent.id },
          data: {
            name: studentName,
            rollNumber: rollNumber,
            email: email,
            mobileNumber: mobileNumber || "",
            academicYear: academicYear || "",
            branch: branch || "",
            batch: batch,
            semester: semester ? parseInt(semester, 10) : null,
            address: address || "",
            parentDetails: parentDetails || "",
            profilePhoto: profilePhoto || "",
            subjects: Array.isArray(subjects) ? subjects : []
          }
        });
      } else {
        await prisma.student.create({
          data: {
            institutionId,
            rollNumber: rollNumber,
            name: studentName,
            email: email,
            mobileNumber: mobileNumber || "",
            academicYear: academicYear || "",
            branch: branch || "",
            batch: batch,
            semester: semester ? parseInt(semester, 10) : null,
            address: address || "",
            parentDetails: parentDetails || "",
            profilePhoto: profilePhoto || "",
            subjects: Array.isArray(subjects) ? subjects : []
          }
        });
      }

      // Sync User username to match submitted rollNumber so /students/me lookup works
      if (username !== rollNumber) {
        const userId = req.user?.id || req.user?._id;
        const userQuery = userId 
          ? { id: userId } 
          : { username: { equals: username, mode: 'insensitive' }, institutionId };

        const targetUser = await prisma.user.findFirst({
          where: userQuery
        });

        if (targetUser) {
          await prisma.user.update({
            where: { id: targetUser.id },
            data: { username: rollNumber }
          });
        }
        
        username = rollNumber;
      }

      updatedName = studentName;
      updatedEmail = email;
      updatedMobile = mobileNumber || "";
      updatedPhoto = profilePhoto || "";
    }

    // 2. Sync User Document (which is now same as tenant DB in Prisma)
    const userId = req.user?.id || req.user?._id;
    const mainUserQuery = userId 
      ? { id: userId } 
      : { username: { equals: username, mode: 'insensitive' } };
    const mainUser = await prisma.user.findFirst({
      where: mainUserQuery
    });
    if (mainUser) {
      const updateData = {
        mobileNumber: updatedMobile,
        profilePhoto: updatedPhoto,
        profileCompleted: true
      };
      if (updatedName) updateData.name = updatedName;
      if (updatedEmail) updateData.email = updatedEmail;

      await prisma.user.update({
        where: { id: mainUser.id },
        data: updateData
      });
    }

    // Generate fresh JWT token with updated profile information (like name or updated username)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';
    const payload = {
        id: req.user?.id || req.user?._id || mainUser?.id,
        role: role,
        institutionId: institutionId,
        username: username,
        name: updatedName || req.user?.name || ''
    };
    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({ success: true, profileCompleted: true, username: username, token: newToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
