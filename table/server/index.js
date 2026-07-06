const express = require('express');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');
const api = require('./routes/api');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const lmsRoutes = require('./routes/lms');
const attendanceRoutes = require('./routes/attendance');
const jobRoutes = require('./routes/jobs');
const announcementRoutes = require('./routes/announcements');
const authMiddleware = require('./middleware/auth');
const tenantMiddleware = require('./middleware/tenant');
const profileCheckMiddleware = require('./middleware/profileCheck');
const { requestMonitor, recordError } = require('./utils/requestMonitor');

require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
app.use(compression());

// PostgreSQL access is handled through Prisma Client, initialized lazily.

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestMonitor);
const path = require('path');
const fs = require('fs');

// Static Files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Debug Route
app.get('/debug-uploads', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        res.json({ 
            cwd: process.cwd(), 
            __dirname, 
            uploadsDir, 
            exists: fs.existsSync(uploadsDir),
            files 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(authMiddleware);
app.use(tenantMiddleware);
app.use(profileCheckMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/announcements', announcementRoutes);
app.get('/api/debug-uploads', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        res.json({ 
            cwd: process.cwd(), 
            __dirname, 
            uploadsDir, 
            exists: fs.existsSync(uploadsDir),
            files 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.use('/api', api);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  recordError({
    type: 'server-exception',
    statusCode: 500,
    message: err.message,
    path: 'unhandledRejection',
    module: 'Backend'
  });
  // Close server & exit process
  // server.close(() => process.exit(1));
});
