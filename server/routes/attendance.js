const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

const ATTENDANCE_EDIT_RESTRICTION_MESSAGE = 'Attendance can only be edited on the same day it was marked.';

const toLocalDateKey = (value) => {
    const date = new Date(value);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
};

const isSameLocalDay = (value, comparison = new Date()) => {
    return toLocalDateKey(value) === toLocalDateKey(comparison);
};

const canEditAttendanceRecord = (req, record) => {
    return req.user?.role !== 'FACULTY' || isSameLocalDay(record.date);
};

// Helper: extract institution id from request
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    const id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

const getUserId = (req) => req.user?.id || req.user?._id;

const getFacultyCourseScope = async (req, institutionId) => {
    const userId = getUserId(req);
    const userName = String(req.user?.username || '').trim();
    const displayName = String(req.user?.name || '').trim();

    const facultyRecord = await prisma.faculty.findFirst({
        where: {
            institutionId,
            OR: [
                userName ? { facultyId: { equals: userName, mode: 'insensitive' } } : undefined,
                req.user?.email ? { email: { equals: req.user.email, mode: 'insensitive' } } : undefined,
                displayName ? { name: { equals: displayName, mode: 'insensitive' } } : undefined
            ].filter(Boolean)
        }
    });

    const facultyCode = String(facultyRecord?.facultyId || userName || '').trim();
    const facultyName = String(facultyRecord?.name || displayName || '').trim();
    const courseOr = [];

    if (facultyCode) {
        courseOr.push({ facultyId: { equals: facultyCode, mode: 'insensitive' } });
    }
    if (facultyName) {
        courseOr.push({ facultyName: { equals: facultyName, mode: 'insensitive' } });
    }

    return {
        userId,
        facultyCode,
        facultyName,
        courseWhere: courseOr.length > 0 ? { OR: courseOr } : null,
        attendanceWhere: userId ? { facultyId: userId } : { id: '__no_faculty_user__' }
    };
};

const applyFacultyAttendanceScope = async (req, institutionId, whereClause) => {
    if (req.user?.role !== 'FACULTY') return whereClause;

    const scope = await getFacultyCourseScope(req, institutionId);
    return {
        ...whereClause,
        ...scope.attendanceWhere,
        ...(scope.courseWhere ? { course: { is: scope.courseWhere } } : {})
    };
};

const ensureFacultyCanUseCourse = async (req, institutionId, courseId) => {
    if (req.user?.role !== 'FACULTY') return true;

    const scope = await getFacultyCourseScope(req, institutionId);
    if (!scope.courseWhere) return false;

    const course = await prisma.course.findFirst({
        where: {
            id: courseId,
            institutionId,
            ...scope.courseWhere
        },
        select: { id: true }
    });

    return Boolean(course);
};

// @route   GET /api/attendance/courses
// @desc    Get courses for attendance marking
// @access  Faculty/Admin
router.get('/courses', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const whereClause = { institutionId };

        // If Faculty, handle mapping to timetable facultyId
        if (req.user.role === 'FACULTY') {
            const facultyRecord = await prisma.faculty.findFirst({
                where: {
                    institutionId,
                    OR: [
                        { facultyId: req.user.username },
                        { email: req.user.email },
                        { name: { contains: req.user.name, mode: 'insensitive' } }
                    ]
                }
            });

            if (facultyRecord) {
                whereClause.OR = [
                    { facultyId: facultyRecord.facultyId },
                    { facultyName: facultyRecord.name }
                ];
            } else {
                whereClause.OR = [
                    { facultyId: req.user.username },
                    { facultyName: { contains: req.user.name, mode: 'insensitive' } }
                ];
            }
        }

        const batchFilter = req.query.batch;
        if (batchFilter) {
            whereClause.batch = { equals: batchFilter.trim(), mode: 'insensitive' };
        }

        const formalCourses = await prisma.course.findMany({
            where: whereClause
        });

        // Map id to _id for frontend compatibility
        const mappedFormalCourses = formalCourses.map(c => ({
            ...c,
            _id: c.id
        }));

        // --- Synthesize virtual courses from student-registered subjects ---
        // When a batch is selected, look up what subjects students in that batch enrolled in.
        // This ensures the course dropdown populates even before faculty creates formal Course docs.
        let virtualCourses = [];

        if (batchFilter) {
            // Build set of existing course codes/names in the formal courses for this batch to avoid duplicates
            const existingCodes = new Set(mappedFormalCourses.map(c => (c.courseCode || '').toLowerCase().trim()));
            const existingNames = new Set(mappedFormalCourses.map(c => (c.subject || '').toLowerCase().trim()));

            // Synthesize from student subjects in relevant batches
            const studentsInBatch = await prisma.student.findMany({
                where: {
                    institutionId,
                    batch: { equals: batchFilter.trim(), mode: 'insensitive' }
                },
                select: {
                    batch: true,
                    subjects: true,
                    semester: true,
                    branch: true
                }
            });

            studentsInBatch.forEach(student => {
                const subjects = Array.isArray(student.subjects) ? student.subjects : [];
                subjects.forEach(sub => {
                    const code = (sub.subjectCode || '').toLowerCase().trim();
                    const name = (sub.subjectName || '').toLowerCase().trim();
                    if (!code && !name) return;
                    if (existingCodes.has(code) || existingNames.has(name)) return; // already in formal courses for this batch

                    // Create a virtual Course-like document so frontend can use it
                    virtualCourses.push({
                        _id: `virtual_${sub.subjectCode || sub.subjectName}`,
                        institutionId,
                        courseCode: sub.subjectCode || '',
                        subject: sub.subjectName || sub.subjectCode,
                        batch: student.batch || batchFilter || '',
                        semester: student.semester || 1,
                        department: student.branch || '',
                        facultyId: req.user.username,
                        facultyName: req.user.name || '',
                        type: 'Core',
                        credits: 3,
                        year: '',
                        program: '',
                        totalLoad: 3,
                        session: '',
                        isVirtual: true  // flag for frontend awareness
                    });

                    existingCodes.add(code);
                    existingNames.add(name);
                });
            });
        }

        res.json([...mappedFormalCourses, ...virtualCourses]);
    } catch (err) {
        console.error('Error in GET /attendance/courses:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/students/:courseId', auth, async (req, res) => {
    try {
        let course;
        const courseIdParam = req.params.courseId;

        if (courseIdParam.startsWith('virtual_')) {
            // Virtual course: reconstruct from ID (format: "virtual_<subjectCode>")
            const subjectCode = courseIdParam.replace(/^virtual_/, '');
            // Find subject details from a student in this batch
            const batchParam = req.query.batch;
            const institutionIdTemp = getInstitutionId(req);
            let subjectName = subjectCode;
            if (batchParam) {
                const studentsInBatch = await prisma.student.findMany({
                    where: {
                        institutionId: institutionIdTemp,
                        batch: { equals: batchParam.trim(), mode: 'insensitive' }
                    }
                });
                const sampleStudent = studentsInBatch.find(student => {
                    const subjects = Array.isArray(student.subjects) ? student.subjects : [];
                    return subjects.some(s => s.subjectCode?.toLowerCase() === subjectCode.toLowerCase());
                });
                if (sampleStudent) {
                    const subjects = Array.isArray(sampleStudent.subjects) ? sampleStudent.subjects : [];
                    const sub = subjects.find(s =>
                        s.subjectCode?.toLowerCase() === subjectCode.toLowerCase()
                    );
                    if (sub) subjectName = sub.subjectName || subjectCode;
                }
            }
            course = {
                _id: courseIdParam,
                subject: subjectName,
                courseCode: subjectCode,
                code: subjectCode,
                batch: batchParam || '',
                isVirtual: true
            };
        } else {
            const courseRecord = await prisma.course.findUnique({
                where: { id: courseIdParam }
            });
            if (!courseRecord) return res.status(404).json({ msg: 'Course not found' });
            course = {
                ...courseRecord,
                _id: courseRecord.id
            };
        }
 
        const institutionId = getInstitutionId(req);
        const reqBatch = req.query.batch || course.batch;

        console.log(`[DEBUG] Selected Batch: "${reqBatch}", Selected Course: "${course.subject}" (Code: "${course.courseCode || course.code}")`); 
        // Build case-insensitive query for batch
        // NOTE: Attendance visibility is based on batch + course enrollment only.
        // Faculty-wise ownership (createdByFacultyId) applies to Student Management only, NOT attendance.
        const studentProfilesInBatch = await prisma.student.findMany({
            where: {
                institutionId,
                batch: { equals: (reqBatch || '').trim(), mode: 'insensitive' }
            }
        });

        console.log(`[DEBUG] Students returned from database in Batch (count: ${studentProfilesInBatch.length}):`);
        studentProfilesInBatch.forEach(s => {
            const subjects = Array.isArray(s.subjects) ? s.subjects : [];
            console.log(`  - Student: "${s.name}" (Roll: "${s.rollNumber}"), Batch: "${s.batch}", Subjects count: ${subjects.length}`);
            console.log(`    Subjects:`, JSON.stringify(subjects, null, 2));
        });
 
        // --- Filter students by course enrollment ---
        const courseSubjectName = (course.subject || '').trim().toLowerCase();
        const courseSubjectCode = (course.courseCode || course.code || '').trim().toLowerCase();
 
        // Filter for enrolled students and extract their roll numbers in one step.
        const enrolledRollNumbers = studentProfilesInBatch.filter(student => {
            const subjects = Array.isArray(student.subjects) ? student.subjects : [];
            // Ensure student has a subjects array
            if (subjects.length === 0) {
                console.log(`    -> Match Result for Roll "${student.rollNumber}": Not Matched (empty subjects array)`);
                return false;
            }
 
            // Check if any of the student's subjects match the selected course
            const matched = subjects.some(enrolledSubject => {
                if (!enrolledSubject) return false; // Skip null/undefined entries in subjects array
 
                const studentSubjectName = String(enrolledSubject.subjectName || '').trim().toLowerCase();
                const studentSubjectCode = String(enrolledSubject.subjectCode || '').trim().toLowerCase();
 
                // Priority 1: Match by code if both are valid and not 'n/a'
                if (courseSubjectCode && studentSubjectCode && courseSubjectCode !== 'n/a' && studentSubjectCode !== 'n/a') {
                    const codeMatch = studentSubjectCode === courseSubjectCode;
                    console.log(`      Comparing code: "${studentSubjectCode}" vs "${courseSubjectCode}" -> ${codeMatch ? 'MATCHED' : 'NO MATCH'}`);
                    return codeMatch;
                }
 
                // Priority 2: Fallback to matching by name
                const nameMatch = studentSubjectName === courseSubjectName;
                console.log(`      Comparing name: "${studentSubjectName}" vs "${courseSubjectName}" -> ${nameMatch ? 'MATCHED' : 'NO MATCH'}`);
                return nameMatch;
            });

            console.log(`    -> Match Result for Roll "${student.rollNumber}": ${matched ? 'MATCHED' : 'NOT MATCHED'}`);
            return matched;
        }).map(student => student.rollNumber);
 
        let students = [];
        if (enrolledRollNumbers.length > 0) {
            // Support uppercase, lowercase and original casing of usernames
            const lowerRollNumbers = enrolledRollNumbers.map(r => r.toLowerCase());
            const upperRollNumbers = enrolledRollNumbers.map(r => r.toUpperCase());
            const uniqueRolls = Array.from(new Set([...enrolledRollNumbers, ...lowerRollNumbers, ...upperRollNumbers]));
 
            const userRecords = await prisma.user.findMany({
                where: {
                    institutionId,
                    role: 'STUDENT',
                    username: { in: uniqueRolls }
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    batch: true,
                    department: true
                }
            });
            students = userRecords.map(u => ({
                ...u,
                _id: u.id
            }));
        }
 
        console.log(`[DEBUG] Final student list returned to the frontend (count: ${students.length}):`, JSON.stringify(students.map(s => s.username), null, 2));
        res.json(students);
    } catch (err) {
        console.error('Fetch Students for Attendance Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   GET api/attendance/records
// @desc    Get attendance records for a specific course, date, and session (for editing)
router.get('/records', auth, async (req, res) => {
    try {
        const { courseId, date, session } = req.query;
        const institutionId = getInstitutionId(req);
        
        if (!courseId || !date) {
            return res.status(400).json({ error: 'CourseId and Date are required' });
        }

        // --- PERMISSION FIX: Allow HOD/Admin to view/edit any record, not just their own ---
        const whereClause = {
            institutionId,
            courseId: courseId,
            session: session || 'Current',
            date: {
                gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                lte: new Date(new Date(date).setHours(23, 59, 59, 999))
            }
        };

        const scopedWhere = await applyFacultyAttendanceScope(req, institutionId, whereClause);

        const records = await prisma.attendance.findMany({
            where: scopedWhere
        });

        const mappedRecords = records.map(r => ({
            ...r,
            _id: r.id,
            canEdit: canEditAttendanceRecord(req, r),
            editRestrictionMessage: canEditAttendanceRecord(req, r) ? '' : ATTENDANCE_EDIT_RESTRICTION_MESSAGE
        }));

        res.json(mappedRecords);
    } catch (err) {
        console.error('Fetch Records Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/mark', auth, async (req, res) => {
    try {
        let institutionId = getInstitutionId(req);
        
        if (!institutionId && req.user?.institutionId) {
            institutionId = req.user.institutionId;
        }

        let { courseId, date, attendanceData, session, classType, batch: reqBatch, courseCode: reqCourseCode, subject: reqSubject } = req.body;
        const facultyId = req.user.id || req.user._id;
        const userId = req.user._id || req.user.id;
        const currentSession = session || 'Current';
        const currentClassType = classType || 'Lecture';
        const weight = currentClassType === 'Lab' ? 2 : 1;

        // --- Resolve virtual courseId to a real Course Database ID ---
        if (typeof courseId === 'string' && courseId.startsWith('virtual_')) {
            const subjectCode = courseId.replace(/^virtual_/, '');

            // Check if a real Course already exists for this code + batch
            let existingCourse = null;
            if (reqBatch) {
                existingCourse = await prisma.course.findFirst({
                    where: {
                        institutionId,
                        courseCode: { equals: subjectCode.trim(), mode: 'insensitive' },
                        batch: { equals: reqBatch.trim(), mode: 'insensitive' }
                    }
                });
            }

            if (!existingCourse) {
                // Resolve subject name from student records
                let resolvedSubjectName = reqSubject || subjectCode;
                let resolvedBatch = reqBatch || '';
                let resolvedSemester = 1;
                let resolvedDept = '';

                if (reqBatch) {
                    const studentsInBatch = await prisma.student.findMany({
                        where: {
                            institutionId,
                            batch: { equals: reqBatch.trim(), mode: 'insensitive' }
                        }
                    });
                    const sampleStudent = studentsInBatch.find(student => {
                        const subjects = Array.isArray(student.subjects) ? student.subjects : [];
                        return subjects.some(s => s.subjectCode?.toLowerCase() === subjectCode.toLowerCase());
                    });
                    if (sampleStudent) {
                        const subjects = Array.isArray(sampleStudent.subjects) ? sampleStudent.subjects : [];
                        const sub = subjects.find(s =>
                            s.subjectCode?.toLowerCase() === subjectCode.toLowerCase()
                        );
                        if (sub) resolvedSubjectName = sub.subjectName || subjectCode;
                        resolvedSemester = sampleStudent.semester || 1;
                        resolvedDept = sampleStudent.branch || '';
                    }
                }

                // Auto-create the Course document
                existingCourse = await prisma.course.create({
                    data: {
                        institutionId,
                        facultyId: String(req.user.username || facultyId),
                        facultyName: req.user.name || '',
                        courseCode: subjectCode,
                        subject: resolvedSubjectName,
                        type: 'Core',
                        batch: resolvedBatch,
                        credits: 3,
                        year: 'N/A',
                        semester: resolvedSemester,
                        program: 'N/A',
                        department: resolvedDept || 'N/A',
                        totalLoad: 3,
                        session: 'N/A',
                        courseL: 0, courseT: 0, courseP: 0,
                        facultyL: 0, facultyT: 0, facultyP: 0
                    }
                });
                console.log(`📚 Auto-created Course "${resolvedSubjectName}" (${subjectCode}) for batch "${resolvedBatch}"`);
            }

            courseId = existingCourse.id;
        }

        console.log(`📝 Marking attendance: Course ${courseId}, Date ${date}, Session ${currentSession}, ClassType ${currentClassType}, Count ${attendanceData.length}`);

        const canUseCourse = await ensureFacultyCanUseCourse(req, institutionId, courseId);
        if (!canUseCourse) {
            return res.status(403).json({ error: 'You can only mark attendance for your assigned courses.' });
        }

        const dayStart = new Date(new Date(date).setHours(0, 0, 0, 0));
        const dayEnd = new Date(new Date(date).setHours(23, 59, 59, 999));

        // Find existing records to determine if we should update or create
        const studentIds = attendanceData.map(item => item.studentId);
        const existingRecords = await prisma.attendance.findMany({
            where: {
                institutionId,
                courseId,
                session: currentSession,
                date: {
                    gte: dayStart,
                    lte: dayEnd
                },
                studentId: { in: studentIds },
                ...(req.user.role === 'FACULTY' ? { facultyId } : {})
            }
        });

        const existingMap = {};
        existingRecords.forEach(r => {
            existingMap[r.studentId] = r;
        });

        if (req.user.role === 'FACULTY') {
            const lockedRecord = existingRecords.find(record => !isSameLocalDay(record.date));
            if (lockedRecord) {
                return res.status(403).json({ error: ATTENDANCE_EDIT_RESTRICTION_MESSAGE });
            }
        }

        // Upsert each record: update if exists, insert if not
        const upsertPromises = attendanceData.map(item => {
            const existing = existingMap[item.studentId];
            if (existing) {
                return prisma.attendance.update({
                    where: { id: existing.id },
                    data: {
                        status: item.status,
                        classType: currentClassType,
                        attendanceWeight: weight,
                        updatedBy: userId,
                        updatedAt: new Date()
                    }
                });
            } else {
                return prisma.attendance.create({
                    data: {
                        institutionId,
                        studentId: item.studentId,
                        facultyId,
                        courseId,
                        date: new Date(date),
                        status: item.status,
                        session: currentSession,
                        classType: currentClassType,
                        attendanceWeight: weight,
                        createdBy: userId,
                        createdAt: new Date(),
                        updatedBy: userId,
                        updatedAt: new Date()
                    }
                });
            }
        });

        await Promise.all(upsertPromises);

        // Fetch and return the saved records
        const savedRecords = await prisma.attendance.findMany({
            where: {
                institutionId,
                courseId,
                session: currentSession,
                date: { gte: dayStart, lte: dayEnd },
                ...(req.user.role === 'FACULTY' ? { facultyId } : {})
            }
        });

        console.log(`✅ Saved/Updated ${savedRecords.length} records for session ${currentSession}`);
        res.status(200).json(savedRecords.map(r => ({ ...r, _id: r.id })));
    } catch (err) {
        console.error('Attendance Mark Error:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

router.get('/student/:studentId', auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const institutionId = getInstitutionId(req);
        
        // --- ID MISMATCH FIX ---
        let resolvedStudentId = studentId;
        if (req.user?.username) {
            const tenantUser = await prisma.user.findFirst({
                where: { username: req.user.username }
            });
            if (tenantUser) {
                resolvedStudentId = tenantUser.id;
            }
        }
        
        const records = await prisma.attendance.findMany({
            where: { studentId: resolvedStudentId },
            include: {
                course: {
                    select: {
                        id: true,
                        subject: true,
                        courseCode: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Map course to courseId for frontend format compatibility
        const recordsWithMappedFormat = records.map(rec => {
            const copy = { ...rec, _id: rec.id };
            if (rec.course) {
                copy.courseId = {
                    ...rec.course,
                    _id: rec.course.id
                };
            }
            return copy;
        });

        // --- FILTER by student's selected subjects (matching api.js logic) ---
        const studentProfile = await prisma.student.findFirst({ 
            where: {
                rollNumber: req.user?.username, 
                institutionId 
            }
        });
        const enrolledSubjects = Array.isArray(studentProfile?.subjects) ? studentProfile.subjects : [];

        const filteredRecords = enrolledSubjects.length > 0
            ? recordsWithMappedFormat.filter(rec => {
                const courseName = String(rec.courseId?.subject || '').trim().toLowerCase();
                const courseCode = String(rec.courseId?.courseCode || '').trim().toLowerCase();
                return enrolledSubjects.some(s => {
                    const enrolledName = String(s.subjectName || '').trim().toLowerCase();
                    const enrolledCode = String(s.subjectCode || '').trim().toLowerCase();
                    let isMatch = false;
                    if (enrolledCode && courseCode && enrolledCode !== 'n/a' && courseCode !== 'n/a' && enrolledCode !== 'undefined' && courseCode !== 'undefined') {
                        isMatch = (enrolledCode === courseCode);
                    }
                    if (!isMatch && enrolledName && courseName) {
                        isMatch = (enrolledName === courseName);
                    }
                    return isMatch;
                });
            })
            : recordsWithMappedFormat;

        const stats = {};
        filteredRecords.forEach(rec => {
            const cId = rec.courseId?._id || 'unknown';
            if (!stats[cId]) {
                stats[cId] = {
                    courseTitle: rec.courseId?.subject || 'Unknown Course',
                    courseCode: rec.courseId?.courseCode || 'N/A',
                    present: 0, absent: 0, late: 0, total: 0,
                    attendedUnits: 0, conductedUnits: 0
                };
            }
            const weight = rec.attendanceWeight || (rec.classType === 'Lab' ? 2 : 1);
            stats[cId].total++;
            stats[cId].conductedUnits += weight;
            if (rec.status === 'Present') {
                stats[cId].present++;
                stats[cId].attendedUnits += weight;
            } else if (rec.status === 'Absent') {
                stats[cId].absent++;
            } else if (rec.status === 'Late') {
                stats[cId].late++;
                stats[cId].attendedUnits += (weight * 0.5);
            }
        });

        const formattedStats = Object.values(stats).map(stat => ({
            ...stat,
            percentage: stat.conductedUnits > 0 ? ((stat.attendedUnits / stat.conductedUnits) * 100).toFixed(2) : '0.00'
        }));

        res.json({ records: filteredRecords, stats: formattedStats });
    } catch (err) {
        console.error('Error in GET /student/:studentId:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const { courseId } = req.params;
        const institutionId = getInstitutionId(req);
        const records = await prisma.attendance.findMany({
            where: { courseId, institutionId },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        const mappedRecords = records.map(r => {
            const copy = { ...r, _id: r.id };
            if (r.student) {
                copy.studentId = {
                    ...r.student,
                    _id: r.student.id
                };
            }
            return copy;
        });

        res.json(mappedRecords);
    } catch (err) {
        console.error('Error in GET /course/:courseId:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/faculty/history', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const whereClause = await applyFacultyAttendanceScope(req, institutionId, { institutionId });
        const records = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                course: {
                    select: {
                        id: true,
                        subject: true,
                        courseCode: true
                    }
                },
                student: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        const mappedRecords = records.map(r => {
            const copy = { ...r, _id: r.id };
            if (r.course) {
                copy.courseId = {
                    ...r.course,
                    _id: r.course.id,
                    title: r.course.subject,
                    subject: r.course.subject
                };
            }
            if (r.student) {
                copy.studentId = {
                    ...r.student,
                    _id: r.student.id
                };
            }
            return copy;
        });

        res.json(mappedRecords);
    } catch (err) {
        console.error('Error in GET /faculty/history:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/admin/report', auth, async (req, res) => {
    try {
        if (!['COLLEGE_ADMIN', 'COMPANY_ADMIN', 'HOD', 'FACULTY'].includes(req.user.role)) {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const institutionId = getInstitutionId(req);
        const { courseId, studentId, startDate, endDate } = req.query;
        
        const whereClause = { 
            institutionId
        };
 
        if (req.user.role === 'FACULTY') {
            Object.assign(whereClause, await applyFacultyAttendanceScope(req, institutionId, {}));
            if (studentId) whereClause.studentId = studentId;
        } else if (studentId) {
            whereClause.studentId = studentId;
        }
        
        if (courseId) whereClause.courseId = courseId;
        if (startDate || endDate) {
            whereClause.date = {};
            if (startDate) whereClause.date.gte = new Date(startDate);
            if (endDate) whereClause.date.lte = new Date(endDate);
        }
 
        console.log(`📊 Fetching filtered report for faculty: ${req.user.username}`);
 
        const records = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                course: {
                    select: {
                        id: true,
                        subject: true,
                        department: true,
                        courseCode: true,
                        batch: true
                    }
                },
                student: {
                    select: {
                        id: true,
                        name: true,
                        department: true,
                        username: true
                    }
                }
            }
        });

        const mappedRecords = records.map(r => {
            const copy = { ...r, _id: r.id };
            if (r.course) {
                copy.courseId = {
                    ...r.course,
                    _id: r.course.id
                };
            }
            if (r.student) {
                copy.studentId = {
                    ...r.student,
                    _id: r.student.id
                };
            }
            return copy;
        });

        res.json(mappedRecords);
    } catch (err) {
        console.error('Error in GET /admin/report:', err);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/attendance/history
// @desc    Get grouped attendance session history with summary counts
// @access  Faculty/Admin/HOD
router.get('/history', auth, async (req, res) => {
    try {
        if (!['COLLEGE_ADMIN', 'COMPANY_ADMIN', 'HOD', 'FACULTY'].includes(req.user.role)) {
            return res.status(403).json({ msg: 'Access denied' });
        }
        const institutionId = getInstitutionId(req);
        const { courseId, batch, startDate, endDate } = req.query;

        const match = {
            institutionId
        };

        if (req.user.role === 'FACULTY') {
            Object.assign(match, await applyFacultyAttendanceScope(req, institutionId, {}));
        }

        if (courseId) match.courseId = courseId;

        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        if (startDate || endDate) match.date = dateFilter;

        const records = await prisma.attendance.findMany({
            where: match,
            include: {
                course: {
                    select: {
                        id: true,
                        subject: true,
                        courseCode: true,
                        batch: true
                    }
                },
                faculty: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                }
            }
        });

        // Perform JS-based grouping
        const groups = {};
        for (const r of records) {
            const dateStr = r.date.toISOString().split('T')[0];
            const cid = r.courseId || 'unknown';
            const sess = r.session || 'Current';
            const key = `${cid}_${dateStr}_${sess}`;

            if (!groups[key]) {
                groups[key] = {
                    courseId: cid,
                    courseName: r.course?.subject || 'Unknown Course',
                    courseCode: r.course?.courseCode || 'N/A',
                    batch: r.course?.batch || 'N/A',
                    date: r.date,
                    dateStr,
                    session: sess,
                    classType: r.classType || 'Lecture',
                    facultyName: r.faculty?.name || 'Unknown',
                    totalStudents: 0,
                    presentCount: 0,
                    absentCount: 0,
                    lateCount: 0
                };
            }

            groups[key].totalStudents++;
            if (r.status === 'Present') groups[key].presentCount++;
            else if (r.status === 'Absent') groups[key].absentCount++;
            else if (r.status === 'Late') groups[key].lateCount++;
        }

        let groupedArray = Object.values(groups);

        // Sort by date desc
        groupedArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        // If batch filter provided, filter after grouping
        if (batch) {
            const batchVal = String(batch).toLowerCase().trim();
            groupedArray = groupedArray.filter(s => {
                const courseBatch = String(s.batch || '').toLowerCase().trim();
                return courseBatch.includes(batchVal);
            });
        }

        const result = groupedArray.map(s => ({
            id: `${s.courseId}_${s.dateStr}_${s.session}`,
            courseId: s.courseId,
            courseName: s.courseName,
            courseCode: s.courseCode,
            batch: s.batch,
            date: s.date,
            session: s.session,
            classType: s.classType,
            facultyName: s.facultyName,
            totalStudents: s.totalStudents,
            presentCount: s.presentCount,
            absentCount: s.absentCount,
            lateCount: s.lateCount
        }));

        res.json(result);
    } catch (err) {
        console.error('Attendance History Error:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

module.exports = router;
