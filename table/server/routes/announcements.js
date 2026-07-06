const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const prisma = require('../config/prisma');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/announcements');

const managerRoles = new Set(['COMPANY_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'FACULTY']);
const allowedExtensions = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.csv',
    '.txt',
    '.ppt',
    '.pptx',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.zip'
]);

const ensureStorage = () => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
};

const sanitizeFilename = (filename) => {
    const ext = path.extname(filename || '').toLowerCase();
    const base = path.basename(filename || 'attachment', ext)
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'attachment';
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`;
};

const getInstitutionId = (req) => {
    return req.institutionId ||
        req.headers['x-institution-id'] ||
        req.user?.institutionId ||
        'global';
};

const canManage = (user) => user && managerRoles.has(user.role);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureStorage();
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, sanitizeFilename(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!allowedExtensions.has(ext)) {
            return cb(new Error('Unsupported file type'));
        }
        cb(null, true);
    }
});

router.use((req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
});

router.get('/', async (req, res) => {
    const institutionId = getInstitutionId(req);

    if (!institutionId || institutionId === 'global') {
        return res.json({ announcements: [] });
    }

    try {
        const announcements = await prisma.announcement.findMany({
            where: { institutionId },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            announcements: announcements.map(item => ({
                ...item,
                _id: item.id,
                createdBy: {
                    id: item.createdById,
                    name: item.createdByName,
                    role: item.createdByRole
                }
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', upload.single('file'), async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Only admins and faculty can create announcements' });
    }

    const institutionId = getInstitutionId(req);
    if (!institutionId || institutionId === 'global') {
        return res.status(400).json({ error: 'Institution ID required' });
    }

    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();

    if (!title && !message && !req.file) {
        return res.status(400).json({ error: 'Add a title, message, or attachment' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const attachment = req.file ? {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `${protocol}://${host}/uploads/announcements/${req.file.filename}`
    } : null;

    try {
        const announcement = await prisma.announcement.create({
            data: {
                institutionId,
                title: title || (attachment ? attachment.originalName : 'Announcement'),
                message,
                attachment,
                createdById: req.user.id,
                createdByName: req.user.name || req.user.username || 'User',
                createdByRole: req.user.role
            }
        });

        res.status(201).json({
            announcement: {
                ...announcement,
                _id: announcement.id,
                createdBy: {
                    id: announcement.createdById,
                    name: announcement.createdByName,
                    role: announcement.createdByRole
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Only admins and faculty can delete announcements' });
    }

    const institutionId = getInstitutionId(req);
    if (!institutionId || institutionId === 'global') {
        return res.status(400).json({ error: 'Institution ID required' });
    }

    try {
        const removed = await prisma.announcement.findFirst({
            where: {
                id: req.params.id,
                institutionId
            }
        });

        if (!removed) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        await prisma.announcement.delete({
            where: { id: removed.id }
        });

        if (removed.attachment?.fileName) {
            const attachmentPath = path.join(uploadDir, removed.attachment.fileName);
            if (attachmentPath.startsWith(uploadDir) && fs.existsSync(attachmentPath)) {
                fs.unlink(attachmentPath, err => {
                    if (err) console.error('Failed to delete announcement attachment:', err);
                });
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Unsupported file type') {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

module.exports = router;
