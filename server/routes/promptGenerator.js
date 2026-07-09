const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const Scheduler = require('../utils/scheduler');

// Simple helper to parse the comma-separated strings
const parseList = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

// Helper to get institution ID
const getInstitutionId = (req) => {
    let id = (req.user && req.user.institutionId) ? req.user.institutionId : req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

router.post('/', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

        if (req.body.isParsedData) {
            // Highly robust parsed data from frontend prompt
            const { batches, lectureRooms, labRooms, subjectConfig } = req.body;

            if (Object.keys(subjectConfig).length === 0) return res.status(400).json({ error: "No subjects extracted" });
            if (lectureRooms.length === 0 && labRooms.length === 0) return res.status(400).json({ error: "No rooms extracted" });

            const config = {
                periodsPerDay: 8,
                periodDuration: 60,
                startTime: "09:00",
                endTime: "17:00",
                workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                lunchBreak: { enabled: true, period: 4, duration: 60 }
            };

            const data = {
                batches: batches.map(b => ({ batchId: b })),
                rooms: [
                    ...lectureRooms.map(r => ({ roomId: r, name: r, type: 'Lecture', capacity: 60 })),
                    ...labRooms.map(r => ({ roomId: r, name: r, type: 'Lab', capacity: 30 }))
                ],
                subjects: Object.keys(subjectConfig).map(sub => ({
                    name: sub,
                    code: sub,
                    slotGroup: subjectConfig[sub].slotGroup || null
                })),
                courses: [],
                faculties: []
            };

            // Build courses and faculties
            let courseCounter = 1;
            let facultyCounter = 1;
            Object.keys(subjectConfig).forEach(sub => {
                const conf = subjectConfig[sub];
                const type = conf.type || 'Core';
                const load = conf.load || 3;
                const assignedFaculty = conf.faculty || `Faculty_${facultyCounter++}`;

                data.faculties.push({
                    facultyId: assignedFaculty,
                    name: assignedFaculty,
                    email: `${assignedFaculty.toLowerCase()}@college.edu`,
                    department: 'CSE',
                    maxWeeklyLoad: 20
                });

                batches.forEach(b => {
                    data.courses.push({
                        courseCode: `CS-${courseCounter++}`,
                        subject: sub,
                        type: type,
                        batch: b,
                        courseL: type === 'Core' ? load : 0,
                        courseT: 0,
                        courseP: type === 'Lab' ? load : 0,
                        credits: load,
                        year: '2024',
                        semester: 1,
                        program: 'B.Tech',
                        department: 'CSE',
                        facultyId: assignedFaculty,
                        facultyName: assignedFaculty,
                        facultyL: type === 'Core' ? load : 0,
                        facultyT: 0,
                        facultyP: type === 'Lab' ? load : 0,
                        totalLoad: load,
                        session: '2024-25'
                    });
                });
            });

            console.log('🤖 RUNNING GENERATION VIA SCHEDULER IN PROMPT ROUTE');
            const schedulerResult = Scheduler.generateTimetable(data, config);

            if (schedulerResult.error) {
                return res.status(400).json({ error: schedulerResult.error });
            }

            // Save the first batch generated timetable to DB if requested
            if (req.body.saveToDb && batches.length > 0) {
                const bId = batches[0];
                const schedule = schedulerResult.timetable[bId] || [];

                // Delete old timetable if exists
                await prisma.timetable.deleteMany({
                    where: { batch: bId, institutionId }
                });

                const created = await prisma.timetable.create({
                    data: {
                        institutionId,
                        title: `Generated Timetable - Batch ${bId}`,
                        year: "2024",
                        batchId: bId,
                        batch: bId,
                        config: config,
                        timetable: schedulerResult.timetable,
                        schedule: schedule,
                        facultySummary: schedulerResult.facultySummary,
                        roomSummary: schedulerResult.roomSummary,
                        generatedAt: new Date()
                    }
                });

                return res.json({
                    message: "Successfully generated and saved to DB",
                    timetable: schedulerResult.timetable,
                    facultySummary: schedulerResult.facultySummary,
                    roomSummary: schedulerResult.roomSummary,
                    savedId: created.id
                });
            }

            return res.json(schedulerResult);
        }

        // Parse from raw prompt variables
        const { facultyNames, courseCodes, roomNames, batchNames, sessions } = req.body;
        const faculties = parseList(facultyNames);
        const courses = parseList(courseCodes);
        const rooms = parseList(roomNames);
        const batches = parseList(batchNames);

        const promptText = `
            Please generate a scheduling config. We have:
            - Faculty: ${faculties.join(', ')}
            - Courses: ${courses.join(', ')}
            - Rooms: ${rooms.join(', ')}
            - Batches: ${batches.join(', ')}
            - Session: ${sessions || '2024-25'}

            Please extract this into a JSON structure containing:
            1. batches: Array of batch IDs (e.g. CSE-A)
            2. lectureRooms: Array of room IDs for lectures
            3. labRooms: Array of room IDs for labs
            4. subjectConfig: Object mapping subject/course names to:
               - type: 'Core' or 'Lab'
               - load: Number of weekly loads/periods
               - faculty: Faculty ID/name assigned to it
               - slotGroup: 'A', 'B', etc.
        `;

        res.json({ prompt: promptText });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
