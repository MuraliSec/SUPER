const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Helper to get institution ID
const getInstitutionId = (req) => {
    let id = (req.user && req.user.institutionId) ? req.user.institutionId : req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// GET /api/faculty-availability
// Returns a matrix of availability for all faculty
router.get('/availability', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

        // 1. Get all faculty & rooms
        const allFaculty = await prisma.faculty.findMany({
            where: { institutionId },
            select: { name: true, department: true }
        });
        const totalFacultyCount = allFaculty.length;

        const allRooms = await prisma.room.findMany({
            where: { institutionId },
            select: { name: true, type: true, capacity: true }
        });
        const totalRoomCount = allRooms.length;

        // 2. Get all timetables to find busy slots
        const allTimetables = await prisma.timetable.findMany({
            where: { institutionId }
        });

        // 3. Initialize availability matrix
        // 5 Days x 8 Periods
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const periods = [1, 2, 3, 4, 5, 6, 7, 8];

        const matrix = days.map(day => {
            return {
                day,
                periods: periods.map(period => {
                    return {
                        period,
                        totalFaculty: totalFacultyCount,
                        busyFaculty: new Set(),
                        busyRooms: new Set(),
                    };
                })
            };
        });

        // 4. Fill busy slots
        allTimetables.forEach(tt => {
            const schedule = tt.schedule;
            if (!schedule || !Array.isArray(schedule)) return;
            
            schedule.forEach(daySch => {
                const dayIndex = days.indexOf(daySch.day);
                if (dayIndex === -1) return;

                const dayPeriods = daySch.periods;
                if (!dayPeriods || !Array.isArray(dayPeriods)) return;

                dayPeriods.forEach(p => {
                    const pIndex = periods.indexOf(p.period);

                    // Check if period is busy (assigned to a faculty)
                    if (p.faculty && p.faculty.trim() !== "") {
                        if (pIndex !== -1) {
                            matrix[dayIndex].periods[pIndex].busyFaculty.add(p.faculty);
                        }
                    }

                    // Check if room is busy
                    if (p.room && p.room.trim() !== "") {
                        if (pIndex !== -1) {
                            matrix[dayIndex].periods[pIndex].busyRooms.add(p.room);
                        }
                    }
                });
            });
        });

        // 5. Format response
        const responseCallback = matrix.map(d => ({
            day: d.day,
            periods: d.periods.map(p => {
                const busySet = p.busyFaculty;
                const availableFacultyList = allFaculty.filter(f => !busySet.has(f.name));

                // Process Rooms
                const busyRoomSet = p.busyRooms;
                const availableRoomList = allRooms.filter(r => !busyRoomSet.has(r.name));

                return {
                    period: p.period,

                    // Faculty Data
                    totalFaculty: p.totalFaculty,
                    busyFacultyCount: busySet.size,
                    availableFacultyCount: availableFacultyList.length,
                    availableFaculty: availableFacultyList,
                    busyFacultyNames: Array.from(busySet),

                    // Room Data
                    totalRooms: totalRoomCount,
                    busyRoomCount: busyRoomSet.size,
                    availableRoomCount: availableRoomList.length,
                    availableRooms: availableRoomList,
                    busyRoomNames: Array.from(busyRoomSet)
                };
            })
        }));

        res.json(responseCallback);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
