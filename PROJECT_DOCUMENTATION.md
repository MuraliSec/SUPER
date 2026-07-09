# 🎓 CampusCore: Comprehensive Project Documentation

CampusCore is a sophisticated, multi-tenant university management platform designed to streamline academic operations. It integrates automated timetable generation, a full-featured Learning Management System (LMS), and real-time attendance tracking into a single, cohesive ecosystem.

---

## 🏗️ Architecture & Multi-Tenancy

CampusCore uses a **Dynamic Multi-Tenant Architecture** to ensure complete data isolation between different institutions while running on a single code base.

### 1. Database Isolation
- **Tenant-Specific Databases**: Each institution has its own isolated MongoDB database.
- **Tenant Manager (`server/utils/tenantManager.js`)**: Dynamically resolves the database connection based on the `tenantSlug` or `institutionId`.
- **Dynamic Model Resolution**: Models like `User`, `Course`, and `Timetable` are generated on-the-fly for the specific tenant's connection, preventing any cross-institutional data leakage.

### 2. The Tech Stack
- **Frontend**: React 18 with Vite, Vanilla CSS for premium styling, and Axios for API communication.
- **Backend**: Node.js & Express.js with Mongoose ODM.
- **Storage**: Local filesystem for PDF uploads (Assignments/Materials) and MongoDB for structured data.

---

## 📚 Module 1: LMS (Learning Management System)

The LMS provides a virtual classroom experience for students and faculty.

### Key Features:
- **Course Modules**: Organizes content by week or topic.
- **Materials**: Supports PDF, video links, and external URLs.
- **Assignments**:
    - Faculty can upload question documents (PDF).
    - Students can submit text or files.
    - **Grading System**: Faculty/HODs can review submissions, assign marks, and provide feedback.
- **Quizzes**:
    - Integrated quiz builder with multiple-choice questions.
    - Automated scoring and results tracking.

### Recent Enhancements:
- **Attachment Visibility**: Fixed a critical issue where assignment PDFs were not visible to students by updating the database schema and frontend rendering.
- **Grading & Quiz Fixes**: Resolved 404 errors in grading and question-adding by implementing missing backend routes.

---

## 📈 Module 2: Attendance Management

A robust system for tracking and reporting student presence.

### Workflows:
- **Marking Attendance**: Faculty/HODs select a batch and subject to mark students as Present, Absent, or Late.
- **Reporting Dashboard**:
    - **Course-Wise**: Attendance percentage per subject.
    - **Time-Wise**: Monthly and daily trends.
    - **Detailed History**: Full audit trail of all attendance records.
- **Institutional Overview**: HODs and Admins can see the global attendance health of the entire college.

### Recent Enhancements:
- **HOD Navigation**: Fixed a bug where the "View Reports" tab disappeared during marking.
- **Data Integrity**: Implemented "NaN" protection in report labels for a cleaner UI.
- **Faculty Access**: Extended the "View Reports" feature to Faculty members for better transparency.

---

## 🗓️ Module 3: Automated Timetable Engine

The core "brain" of the project that solves the complex problem of scheduling.

### The Algorithm: **Greedy Heuristic Scheduler**
- **Priority-Based Tasking**: Schedules Elective Groups first, then Labs (contiguous blocks), then LECTURES.
- **Clash Detection**: Real-time checking of Faculty availability and Room occupancy across ALL batch timetables.
- **Elective Slot Grouping**: Allows multiple subjects (A, B, C) to occupy the same period slot for different student groups.
- **Manual Overrides**: Admins can manually edit any generated slot with a real-time conflict checker.

---

## 🔐 Security & Roles

CampusCore uses **JWT (JSON Web Tokens)** and role-based middleware to enforce permissions:

1.  **STUDENT**: Can view their own timetable, access LMS materials, submit assignments, and see their personal attendance stats.
2.  **FACULTY**: Can mark attendance for their courses, upload LMS content, grade assignments, and view institutional reports.
3.  **HOD (Head of Department)**: Has full control over departmental data, timetable generation, and attendance oversight.
4.  **COLLEGE_ADMIN**: Manages the entire institution's configuration, master data (Excel uploads), and user accounts.
5.  **COMPANY_ADMIN**: The super-user who can create new institutions and manage global platform settings.

---

## 🚀 Technical Setup

### Environment Variables (.env)
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=4000
DEFAULT_INSTITUTION_ID=primary_id_for_fallback
```

### Installation
1.  **Backend**: `cd server && npm install && npm run dev`
2.  **Frontend**: `cd client && npm install && npm run dev`

---

## 📁 Repository Structure
- `/client/src`: React components and state management.
- `/server/routes`: API endpoints grouped by module (lms, attendance, auth, etc.).
- `/server/models`: Database schemas.
- `/server/utils`: Core logic like the Scheduler and Tenant Manager.

---

## 📖 User Guides
For detailed instructions on how to use each portal (Student, Faculty, HOD, Admin), please refer to the **[USER_GUIDE.md](file:///c:/Users/DELL/Videos/table/USER_GUIDE.md)**.
