const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Middleware to extract institutionId
const getInstitutionId = (req) => {
    if (req.user && req.user.institutionId) return req.user.institutionId;
    let id = req.headers['x-institution-id'];
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// GET Configuration by Session
router.get('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const config = await prisma.timetableConfig.findFirst({
            where: { session: req.params.session, institutionId }
        });
        if (!config) {
            // Return default config if not found
            return res.json({
                session: req.params.session,
                periodsPerDay: 8,
                periodDuration: 60,
                startTime: '09:00',
                endTime: '17:00',
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                lunchBreak: { enabled: true, period: 4, duration: 60 }
            });
        }
        
        // Map id to _id for frontend compatibility
        res.json({ ...config, _id: config.id });
    } catch (err) {
        console.error('FETCH CONFIG ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

// SAVE/UPDATE Configuration
router.put('/config/:session', async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const { periodsPerDay, periodDuration, startTime, endTime, workingDays, lunchBreak } = req.body;

        const config = await prisma.timetableConfig.findFirst({
            where: { session: req.params.session, institutionId }
        });

        let result;
        if (config) {
            // Update existing
            result = await prisma.timetableConfig.update({
                where: { id: config.id },
                data: {
                    periodsPerDay,
                    periodDuration,
                    startTime,
                    endTime,
                    workingDays,
                    lunchBreak,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new
            result = await prisma.timetableConfig.create({
                data: {
                    session: req.params.session,
                    periodsPerDay,
                    periodDuration,
                    startTime,
                    endTime,
                    workingDays,
                    lunchBreak,
                    institutionId
                }
            });
        }

        res.json({ ...result, _id: result.id });
    } catch (err) {
        console.error('SAVE CONFIG ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
