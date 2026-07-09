const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const auth = require('../middleware/auth');

// Helper to get institution ID
const getInstitutionId = (req) => {
    let id = (req.user && req.user.institutionId) ? req.user.institutionId : req.headers['x-institution-id'];
    
    if (!id || id === 'null' || id === 'undefined' || id === '') {
        return process.env.DEFAULT_INSTITUTION_ID;
    }
    return id;
};

// @route   GET /api/jobs
// @desc    Get all jobs for the institution
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        if (!institutionId) return res.status(400).json({ error: 'Institution ID required' });

        const jobs = await prisma.job.findMany({
            where: { institutionId },
            orderBy: { createdAt: 'desc' }
        });
        
        // Map id to _id for frontend compatibility
        res.json(jobs.map(j => ({ ...j, _id: j.id })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   POST /api/jobs
// @desc    Post a new job (HOD or Faculty)
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { title, company, description, location, salary, link } = req.body;
        const institutionId = getInstitutionId(req);

        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!['HOD', 'FACULTY', 'COLLEGE_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized to post jobs' });
        }

        console.log('📝 Saving Job:', { title, company, institutionId, postedBy: req.user.id });
        
        const job = await prisma.job.create({
            data: {
                title,
                company,
                description,
                location,
                salary,
                link,
                institutionId,
                postedBy: req.user.id || req.user._id,
                postedByName: req.user.username
            }
        });
        
        console.log('✅ Job saved successfully');
        res.json({ ...job, _id: job.id });
    } catch (err) {
        console.error('❌ Error posting job:', err);
        res.status(500).json({ error: err.message });
    }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const institutionId = getInstitutionId(req);
        const job = await prisma.job.findFirst({
            where: { id: req.params.id, institutionId }
        });
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Only HOD or the person who posted it can delete
        if (req.user.role !== 'HOD' && req.user.role !== 'COLLEGE_ADMIN' && job.postedBy !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await prisma.job.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Job removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
