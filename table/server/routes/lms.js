const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let storage;

// Check if Cloudinary credentials are provided and NOT placeholders
const isCloudinaryConfigured = 
    process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_CLOUD_NAME.includes('your_') &&
    process.env.CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_KEY.includes('your_') &&
    process.env.CLOUDINARY_API_SECRET && !process.env.CLOUDINARY_API_SECRET.includes('your_');

if (isCloudinaryConfigured) {
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    const cloudinary = require('cloudinary').v2;

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'campuscore_uploads',
            allowed_formats: ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'],
            resource_type: 'auto'
        }
    });
    console.log('✅ LMS: Using Cloudinary Storage');
} else {
    // Fallback to local disk storage
    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    });
    console.log('⚠️ LMS: Cloudinary credentials missing, using local Disk Storage');
}

const upload = multer({ storage });

// Helper to map id to _id and remove passwords to maintain compatibility
const mapId = (obj) => {
    if (!obj) return obj;
    if (Array.isArray(obj)) {
        return obj.map(mapId);
    }
    if (obj instanceof Date) {
        return obj;
    }
    if (typeof obj === 'object') {
        const plain = typeof obj.toJSON === 'function' ? obj.toJSON() : { ...obj };
        if (plain.id !== undefined) {
            plain._id = plain.id;
        }
        if (plain.password !== undefined) {
            delete plain.password;
        }
        for (const key in plain) {
            if (plain[key] && typeof plain[key] === 'object') {
                plain[key] = mapId(plain[key]);
            }
        }
        return plain;
    }
    return obj;
};

// Helper function to resolve user ID
const resolveTenantUserId = async (req, userId) => {
    const tenantUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    
    if (tenantUser) return tenantUser.id;
    
    if (req.user && req.user.username) {
        const resolvedUser = await prisma.user.findFirst({
            where: { username: req.user.username }
        });
        if (resolvedUser) return resolvedUser.id;
    }
    
    return userId; // Fallback
};

// Helper to populate assignments and quizzes inside modules
const populateCourseModules = async (course) => {
    if (!course) return null;
    
    const plainCourse = { ...course };
    
    let modules = [];
    if (plainCourse.modules) {
        modules = typeof plainCourse.modules === 'string' 
            ? JSON.parse(plainCourse.modules) 
            : plainCourse.modules;
    }
    if (!Array.isArray(modules)) {
        modules = [];
    }

    const assignments = await prisma.assignment.findMany({
        where: { courseId: plainCourse.id }
    });
    
    const quizzes = await prisma.quiz.findMany({
        where: { courseId: plainCourse.id }
    });

    const populatedModules = modules.map(mod => {
        const modId = mod.id || mod._id;
        const modAssignments = assignments.filter(a => a.moduleId === modId);
        const modQuizzes = quizzes.filter(q => q.moduleId === modId);
        
        return {
            ...mod,
            assignments: modAssignments,
            quizzes: modQuizzes
        };
    });

    plainCourse.modules = populatedModules;
    return plainCourse;
};

// Helper to get a course by ID with faculty, students, and populated modules
const getFullCourse = async (courseId) => {
    const course = await prisma.lMSCourse.findUnique({
        where: { id: courseId },
        include: {
            faculty: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            students: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    lastLogin: true,
                    loginCount: true
                }
            }
        }
    });
    
    if (!course) return null;
    
    const plainCourse = { ...course };
    if (plainCourse.faculty) {
        plainCourse.facultyId = plainCourse.faculty;
        delete plainCourse.faculty;
    }
    
    return await populateCourseModules(plainCourse);
};

// Helper to get course using custom query (e.g. including institutionId filter)
const getFullCourseWithQuery = async (query) => {
    const course = await prisma.lMSCourse.findFirst({
        where: query,
        include: {
            faculty: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            students: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });
    
    if (!course) return null;
    
    const plainCourse = { ...course };
    if (plainCourse.faculty) {
        plainCourse.facultyId = plainCourse.faculty;
        delete plainCourse.faculty;
    }
    
    return await populateCourseModules(plainCourse);
};

router.post('/upload', upload.single('file'), (req, res) => {
    try {
        console.log('📤 LMS Upload attempt:', req.file ? req.file.originalname : 'No file');
        
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        
        let fileUrl;
        if (req.file.path && req.file.path.startsWith('http')) {
            fileUrl = req.file.path;
        } else {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        }
        
        console.log('✅ File uploaded successfully:', fileUrl);
        res.json({ url: fileUrl });
    } catch (err) {
        console.error('❌ Upload error:', err);
        res.status(500).json({ message: 'Internal server error during upload', error: err.message });
    }
});

// @route   GET /api/lms/courses
// @desc    Get courses (students only see their enrolled courses, others see full library)
router.get('/courses', auth, async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        
        if (!institutionId && req.user.role !== 'COMPANY_ADMIN') {
            return res.status(400).json({ message: 'Institution ID is required' });
        }

        const query = {};
        if (institutionId) query.institutionId = institutionId;

        const courses = await prisma.lMSCourse.findMany({
            where: query,
            include: {
                faculty: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                students: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        username: true,
                        lastLogin: true,
                        loginCount: true
                    }
                }
            }
        });

        const formattedCourses = courses.map(course => {
            const plainCourse = { ...course };
            if (plainCourse.faculty) {
                plainCourse.facultyId = plainCourse.faculty;
                delete plainCourse.faculty;
            }
            return plainCourse;
        });

        res.json(mapId(formattedCourses));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/courses', auth, async (req, res) => {
    try {
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const institutionId = req.user.institutionId || req.body.institutionId;
        if (!institutionId) return res.status(400).json({ message: 'Institution ID is required' });

        const facultyId = req.user.role === 'FACULTY' ? req.user.id : (req.body.facultyId || req.user.id);

        const savedCourse = await prisma.lMSCourse.create({
            data: {
                title: req.body.title,
                courseCode: req.body.courseCode,
                description: req.body.description,
                category: req.body.category,
                department: req.body.department,
                branch: req.body.branch,
                batch: req.body.batch,
                academicYear: req.body.academicYear,
                semester: req.body.semester,
                institutionId,
                facultyId,
                isActive: req.body.isActive !== undefined ? req.body.isActive : true,
                modules: req.body.modules || []
            }
        });

        res.status(201).json(mapId(savedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/courses/:id', auth, async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        const query = { id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await getFullCourseWithQuery(query);
        
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(mapId(course));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/courses/:id/modules', auth, async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.body.institutionId;
        const query = { id: req.params.id };
        if (institutionId && req.user.role !== 'COMPANY_ADMIN') query.institutionId = institutionId;

        const course = await prisma.lMSCourse.findFirst({ where: query });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        let modules = Array.isArray(course.modules) ? course.modules : [];
        const newModuleId = crypto.randomUUID();
        modules.push({
            id: newModuleId,
            _id: newModuleId,
            title: req.body.title,
            week: req.body.week,
            description: req.body.description,
            materials: [],
            assignments: [],
            quizzes: []
        });

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.status(201).json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Add Material to Module
router.post('/courses/:id/modules/:moduleId/materials', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        let modules = Array.isArray(course.modules) ? course.modules : [];
        const moduleIndex = modules.findIndex(m => m.id === req.params.moduleId || m._id === req.params.moduleId);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Module not found' });

        const materialId = crypto.randomUUID();
        const newMaterial = {
            id: materialId,
            _id: materialId,
            title: req.body.title,
            url: req.body.url,
            type: req.body.type
        };

        if (!modules[moduleIndex].materials) {
            modules[moduleIndex].materials = [];
        }
        modules[moduleIndex].materials.push(newMaterial);

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.status(201).json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/assignments', auth, async (req, res) => {
    try {
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const savedAssignment = await prisma.assignment.create({
            data: {
                courseId: req.body.courseId,
                moduleId: req.body.moduleId,
                title: req.body.title,
                description: req.body.description,
                dueDate: new Date(req.body.dueDate),
                maxMarks: parseInt(req.body.maxMarks, 10),
                attachments: req.body.attachments || [],
                attachmentUrl: req.body.attachmentUrl,
                url: req.body.url
            }
        });
        
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.body.courseId } });
        if (course) {
            let modules = Array.isArray(course.modules) ? course.modules : [];
            const moduleIndex = modules.findIndex(m => m.id === req.body.moduleId || m._id === req.body.moduleId);
            if (moduleIndex !== -1) {
                if (!modules[moduleIndex].assignments) {
                    modules[moduleIndex].assignments = [];
                }
                modules[moduleIndex].assignments.push(savedAssignment.id);
                
                await prisma.lMSCourse.update({
                    where: { id: course.id },
                    data: { modules }
                });
            }
        }

        const updatedCourse = await getFullCourse(req.body.courseId);
        res.status(201).json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/quizzes', auth, async (req, res) => {
    try {
        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const savedQuiz = await prisma.quiz.create({
            data: {
                courseId: req.body.courseId,
                moduleId: req.body.moduleId,
                title: req.body.title,
                description: req.body.description,
                timeLimit: req.body.timeLimit ? parseInt(req.body.timeLimit, 10) : 30,
                questions: req.body.questions || []
            }
        });
        
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.body.courseId } });
        if (course) {
            let modules = Array.isArray(course.modules) ? course.modules : [];
            const moduleIndex = modules.findIndex(m => m.id === req.body.moduleId || m._id === req.body.moduleId);
            if (moduleIndex !== -1) {
                if (!modules[moduleIndex].quizzes) {
                    modules[moduleIndex].quizzes = [];
                }
                modules[moduleIndex].quizzes.push(savedQuiz.id);
                
                await prisma.lMSCourse.update({
                    where: { id: course.id },
                    data: { modules }
                });
            }
        }

        const updatedCourse = await getFullCourse(req.body.courseId);
        res.status(201).json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/courses/:id/enroll', auth, async (req, res) => {
    try {
        const isStaff = ['HOD', 'FACULTY', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role);
        const { studentId } = req.body;
        
        if (!isStaff && studentId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const resolvedStudentId = await resolveTenantUserId(req, studentId);

        const studentIdsToConnect = [...new Set([studentId, resolvedStudentId])].filter(Boolean);
        
        const existingUsers = await prisma.user.findMany({
            where: { id: { in: studentIdsToConnect } },
            select: { id: true }
        });
        
        const validIdsToConnect = existingUsers.map(u => u.id);
        
        if (validIdsToConnect.length > 0) {
            await prisma.lMSCourse.update({
                where: { id: req.params.id },
                data: {
                    students: {
                        connect: validIdsToConnect.map(id => ({ id }))
                    }
                }
            });
        }

        const updatedCourse = await getFullCourse(req.params.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/courses/:id/student-stats', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const studentQuery = { institutionId: course.institutionId, role: 'STUDENT' };

        if (req.user && req.user.role === 'FACULTY') {
            const facultyId = req.user.id || req.user._id;
            const studentProfiles = await prisma.student.findMany({
                where: { institutionId: course.institutionId, createdByFacultyId: facultyId },
                select: { rollNumber: true }
            });
            const rolls = studentProfiles.map(p => p.rollNumber);
            studentQuery.username = { in: rolls };
        }

        const students = await prisma.user.findMany({
            where: studentQuery,
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                lastLogin: true,
                loginCount: true
            }
        });

        let modules = Array.isArray(course.modules) ? course.modules : [];
        const quizIds = modules.flatMap(m => Array.isArray(m.quizzes) ? m.quizzes : []);

        const results = await prisma.quizResult.findMany({
            where: { quizId: { in: quizIds } }
        });

        const stats = students.map(s => {
            const studentResults = results.filter(r => r.studentId === s.id);
            const completedCount = new Set(studentResults.map(r => r.quizId)).size;
            const totalQuizzes = quizIds.length;
            
            return {
                ...s,
                completedQuizzes: completedCount,
                totalQuizzes: totalQuizzes,
                progress: totalQuizzes > 0 ? Math.round((completedCount / totalQuizzes) * 100) : 0
            };
        });

        res.json(mapId(stats));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/institution-students', auth, async (req, res) => {
    try {
        const institutionId = req.user.institutionId || req.query.institutionId;
        if (!institutionId) return res.status(400).json({ message: 'Institution ID required' });

        const query = { institutionId, role: 'STUDENT' };

        if (req.user && req.user.role === 'FACULTY') {
            const facultyId = req.user.id || req.user._id;
            const studentProfiles = await prisma.student.findMany({
                where: { institutionId, createdByFacultyId: facultyId },
                select: { rollNumber: true }
            });
            const rolls = studentProfiles.map(p => p.rollNumber);
            query.username = { in: rolls };
        }

        const students = await prisma.user.findMany({
            where: query,
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                lastLogin: true,
                loginCount: true
            }
        });
        res.json(mapId(students));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/assignments/:id/submissions', auth, async (req, res) => {
    try {
        const submissions = await prisma.submission.findMany({
            where: { assignmentId: req.params.id },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        const fixedSubmissions = await Promise.all(submissions.map(async (sub) => {
            const subObj = { ...sub };
            if (subObj.student) {
                subObj.studentId = subObj.student;
                delete subObj.student;
            } else {
                const searchId = subObj.studentId;
                if (searchId) {
                    const mainUser = await prisma.user.findUnique({
                        where: { id: searchId },
                        select: { id: true, name: true, username: true, email: true }
                    });
                    if (mainUser) {
                        subObj.studentId = mainUser;
                    }
                }
            }
            return subObj;
        }));

        res.json(mapId(fixedSubmissions));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/submissions', auth, async (req, res) => {
    try {
        const resolvedStudentId = await resolveTenantUserId(req, req.user.id);
        const savedSubmission = await prisma.submission.create({
            data: {
                assignmentId: req.body.assignmentId,
                studentId: resolvedStudentId,
                content: req.body.content,
                fileUrl: req.body.fileUrl,
                status: req.body.status || 'submitted',
                grade: req.body.grade !== undefined && req.body.grade !== null ? parseInt(req.body.grade, 10) : null,
                feedback: req.body.feedback
            }
        });
        res.status(201).json(mapId(savedSubmission));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/submissions/:id', auth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.grade !== undefined && updateData.grade !== null) {
            updateData.grade = parseInt(updateData.grade, 10);
        }
        delete updateData.id;
        delete updateData._id;
        delete updateData.student;
        delete updateData.assignment;

        const submission = await prisma.submission.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(mapId(submission));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/quiz-results', auth, async (req, res) => {
    try {
        const resolvedStudentId = await resolveTenantUserId(req, req.user.id);

        const existingResult = await prisma.quizResult.findFirst({
            where: {
                quizId: req.body.quizId,
                studentId: resolvedStudentId
            }
        });
        if (existingResult) {
            return res.status(409).json({ message: 'Quiz already attempted. Retake is not allowed.' });
        }

        const savedResult = await prisma.quizResult.create({
            data: {
                quizId: req.body.quizId,
                studentId: resolvedStudentId,
                score: parseInt(req.body.score, 10),
                totalMarks: parseInt(req.body.totalMarks, 10),
                answers: req.body.answers || []
            }
        });
        res.status(201).json(mapId(savedResult));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/quizzes/:id/results', auth, async (req, res) => {
    try {
        const results = await prisma.quizResult.findMany({
            where: { quizId: req.params.id },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true
                    }
                }
            }
        });
        
        const fixedResults = await Promise.all(results.map(async (result) => {
            const resultObj = { ...result };
            if (resultObj.student) {
                resultObj.studentId = resultObj.student;
                delete resultObj.student;
            } else {
                const searchId = resultObj.studentId;
                if (searchId) {
                    const mainUser = await prisma.user.findUnique({
                        where: { id: searchId },
                        select: { id: true, name: true, username: true, email: true }
                    });
                    if (mainUser) {
                        resultObj.studentId = mainUser;
                    }
                }
            }
            return resultObj;
        }));

        res.json(mapId(fixedResults));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/quizzes/:id', auth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.id;
        delete updateData._id;
        delete updateData.course;
        delete updateData.results;
        
        if (updateData.timeLimit !== undefined) {
            updateData.timeLimit = parseInt(updateData.timeLimit, 10);
        }

        const quiz = await prisma.quiz.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(mapId(quiz));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/my-submissions', auth, async (req, res) => {
    try {
        const submissions = await prisma.submission.findMany({
            where: { studentId: req.user.id }
        });
        res.json(mapId(submissions));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/my-quiz-results', auth, async (req, res) => {
    try {
        const resolvedStudentId = await resolveTenantUserId(req, req.user.id);
        const studentIds = [...new Set([String(req.user.id), String(resolvedStudentId)])];
        const results = await prisma.quizResult.findMany({
            where: { studentId: { in: studentIds } }
        });
        res.json(mapId(results));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Course
router.delete('/courses/:id', auth, async (req, res) => {
    try {
        if (!['HOD', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        await prisma.lMSCourse.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Course deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Edit Module
router.put('/courses/:id/modules/:moduleId', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        let modules = Array.isArray(course.modules) ? course.modules : [];
        const moduleIndex = modules.findIndex(m => m.id === req.params.moduleId || m._id === req.params.moduleId);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Module not found' });
        
        const mod = modules[moduleIndex];
        mod.title = req.body.title || mod.title;
        mod.week = req.body.week || mod.week;
        mod.description = req.body.description || mod.description;
        
        modules[moduleIndex] = mod;

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete Module
router.delete('/courses/:id/modules/:moduleId', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        let modules = Array.isArray(course.modules) ? course.modules : [];
        const filteredModules = modules.filter(m => m.id !== req.params.moduleId && m._id !== req.params.moduleId);

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules: filteredModules }
        });

        // Also delete assignments and quizzes associated with this module
        await prisma.assignment.deleteMany({
            where: { courseId: course.id, moduleId: req.params.moduleId }
        });
        await prisma.quiz.deleteMany({
            where: { courseId: course.id, moduleId: req.params.moduleId }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Edit Material
router.put('/courses/:id/modules/:moduleId/materials/:materialId', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        let modules = Array.isArray(course.modules) ? course.modules : [];
        const moduleIndex = modules.findIndex(m => m.id === req.params.moduleId || m._id === req.params.moduleId);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Module not found' });
        
        let materials = Array.isArray(modules[moduleIndex].materials) ? modules[moduleIndex].materials : [];
        const materialIndex = materials.findIndex(mat => mat.id === req.params.materialId || mat._id === req.params.materialId);
        if (materialIndex === -1) return res.status(404).json({ message: 'Material not found' });
        
        materials[materialIndex] = {
            ...materials[materialIndex],
            ...req.body
        };
        
        modules[moduleIndex].materials = materials;

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete Material
router.delete('/courses/:id/modules/:moduleId/materials/:materialId', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        let modules = Array.isArray(course.modules) ? course.modules : [];
        const moduleIndex = modules.findIndex(m => m.id === req.params.moduleId || m._id === req.params.moduleId);
        if (moduleIndex === -1) return res.status(404).json({ message: 'Module not found' });
        
        let materials = Array.isArray(modules[moduleIndex].materials) ? modules[moduleIndex].materials : [];
        const filteredMaterials = materials.filter(mat => mat.id !== req.params.materialId && mat._id !== req.params.materialId);
        
        modules[moduleIndex].materials = filteredMaterials;

        await prisma.lMSCourse.update({
            where: { id: course.id },
            data: { modules }
        });

        const updatedCourse = await getFullCourse(course.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Edit/Delete Assignment
router.put('/assignments/:id', auth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.id;
        delete updateData._id;
        delete updateData.course;
        delete updateData.submissions;
        
        if (updateData.dueDate !== undefined) {
            updateData.dueDate = new Date(updateData.dueDate);
        }
        if (updateData.maxMarks !== undefined) {
            updateData.maxMarks = parseInt(updateData.maxMarks, 10);
        }

        const assignment = await prisma.assignment.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(mapId(assignment));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/assignments/:id', auth, async (req, res) => {
    try {
        const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
        if (assignment) {
            const course = await prisma.lMSCourse.findUnique({ where: { id: assignment.courseId } });
            if (course) {
                let modules = Array.isArray(course.modules) ? course.modules : [];
                const updatedModules = modules.map(m => {
                    let assignments = Array.isArray(m.assignments) ? m.assignments : [];
                    return {
                        ...m,
                        assignments: assignments.filter(id => id !== assignment.id && id !== assignment._id)
                    };
                });
                await prisma.lMSCourse.update({
                    where: { id: course.id },
                    data: { modules: updatedModules }
                });
            }
            await prisma.assignment.delete({ where: { id: req.params.id } });
        }
        res.json({ message: 'Assignment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete Quiz
router.delete('/quizzes/:id', auth, async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
        if (quiz) {
            const course = await prisma.lMSCourse.findUnique({ where: { id: quiz.courseId } });
            if (course) {
                let modules = Array.isArray(course.modules) ? course.modules : [];
                const updatedModules = modules.map(m => {
                    let quizzes = Array.isArray(m.quizzes) ? m.quizzes : [];
                    return {
                        ...m,
                        quizzes: quizzes.filter(id => id !== quiz.id && id !== quiz._id)
                    };
                });
                await prisma.lMSCourse.update({
                    where: { id: course.id },
                    data: { modules: updatedModules }
                });
            }
            await prisma.quiz.delete({ where: { id: req.params.id } });
        }
        res.json({ message: 'Quiz deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Unenroll Student
router.delete('/courses/:id/enroll/:studentId', auth, async (req, res) => {
    try {
        const course = await prisma.lMSCourse.findUnique({ where: { id: req.params.id } });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        
        await prisma.lMSCourse.update({
            where: { id: req.params.id },
            data: {
                students: {
                    disconnect: { id: req.params.studentId }
                }
            }
        });
        
        const updatedCourse = await getFullCourse(req.params.id);
        res.json(mapId(updatedCourse));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
