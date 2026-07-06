# 🚀 CampusCore: Deep Technical Documentation

CampusCore is a full-stack, multi-tenant academic management ecosystem built to scale across multiple universities. This document provides an exhaustive breakdown of the technologies, algorithms, and file structures that power the platform.

---

## 🛠️ Technology Stack

### Frontend (Client-side)
| Technology | Description |
|---|---|
| **React 18** | Core UI framework for component-based architecture. |
| **Vite** | Ultra-fast build tool and development server. |
| **Vanilla CSS** | custom premium styling without the overhead of heavy CSS frameworks. |
| **Axios** | Handles asynchronous API requests to the backend. |
| **Lucide React** | modern icon set for the UI. |

### Backend (Server-side)
| Technology | Description |
|---|---|
| **Node.js** | JavaScript runtime environment. |
| **Express.js** | Web framework for building RESTful API routes. |
| **MongoDB & Mongoose** | NoSQL database for flexible data modeling across institutions. |
| **JSON Web Tokens (JWT)** | Secure authentication and session management. |
| **Multer** | Middleware for handling multipart/form-data (file uploads). |
| **XLSX** | Engine for parsing Excel spreadsheets for bulk data import. |

---

## 📐 DSA & Algorithms

CampusCore leverages several computer science concepts to solve complex university scheduling and data management problems.

### 1. Greedy Heuristic Scheduler (Timetable Brain)
The core scheduling problem is NP-hard. We use a **Greedy Algorithm** with specific heuristics to find a valid solution efficiently:
- **Priority Queueing**: All subjects are converted into "Tasks". Tasks are sorted by difficulty (Elective Groups > Labs > Lectures).
- **Candidate Scoring**: For every free slot, the algorithm calculates a "score" based on:
    - **Spreading**: Reducing same-subject frequency on the same day.
    - **Time Bias**: Preferring certain periods for labs vs lectures.
    - **Global Occupancy**: Checking resource availability across *all* institutional timetables simultaneously.
- **Backtracking Fallback**: If a placement fails, the system attempts to rearrange previous non-critical slots.

### 2. O(1) Clash Detection (HashMap/Set)
To ensure no faculty or room is double-booked:
- **Occupancy Map**: The backend maintains a HashMap where keys are strings like `"Day#Period"` and values are `Sets` of occupied Faculty IDs and Room IDs.
- **Benefit**: Instead of looping through all records (O(N)), we check conflicts in **constant time O(1)** using Set lookups.

### 3. Dynamic Model Instantiation (Multi-Tenancy)
- **Problem**: Traditional apps use one schema for everyone.
- **Algorithm**: On every request, the `tenantManager` extracts the institution's ID and dynamically creates/switches the Mongoose connection and models.
- **Benefit**: Virtualized database isolation with zero cross-tenant risk.

---

## 📂 File-by-File Purpose Mapping

### 🖥️ Client (Frontend)
- **`App.jsx`**: Root component. Manages global navigation, authentication state, and the main dashboard layout.
- **`AdminPortal.jsx`**: The command center for HODs. Handles subject configuration, timetable generation, and manual editing.
- **`StudentPortal.jsx`**: A streamlined view for students to find and view their specific batch schedules.
- **`LMSPortal.jsx`**: Manages the Learning Management System (Modules, Assignments, Quizzes).
- **`AttendancePortal.jsx`**: Dedicated portal for marking and viewing attendance reports.
- **`CompanyPortal.jsx`**: Super-admin interface for creating and managing different institutions.
- **`ExcelUpload.jsx`**: Handles the logic for mapping Excel columns to database fields.
- **`Register.jsx` / `Login.jsx`**: User authentication and onboarding.
- **`TimetableConfig.jsx`**: Sets global rules for periods, timings, and working days.
- **`api/axios.js`**: Pre-configured Axios instance with base URLs and interceptors for JWT tokens.

### ⚙️ Server (Backend)
#### Models (Schemas)
- **`User.js`**: Stores student, faculty, and admin profiles.
- **`Institution.js`**: Tracks institution details and database slugs.
- **`Timetable.js` / `TimetableConfig.js`**: Stores the generated grid and global timing settings.
- **`LMSCourse.js`**: The container for modules, materials, and linked students.
- **`Assignment.js` / `Submission.js`**: Tracks homework tasks and student uploads.
- **`Quiz.js` / `QuizResult.js`**: Logic for multiple-choice assessments.
- **`Attendance.js`**: Raw logs of every student's presence.
- **`Course.js` / `Subject.js`**: Master data for academic subjects.
- **`Faculty.js` / `Room.js`**: Resource tracking for clash detection.
- **`Job.js`**: Schema for the internship and career portal.

#### Routes (APIs)
- **`auth.js`**: Logic for signup, login, and profile management.
- **`lms.js`**: Handles all classroom operations (uploads, grading, quiz logic).
- **`attendance.js`**: API for marking attendance and generating complex reports.
- **`api.js`**: The heavy-lifter. Contains the timetable generation and retrieval logic.
- **`excelUpload.js`**: Logic for processing `.xlsx` files into the database.
- **`company.js`**: Routes for institution management.

#### Utils (The Engine)
- **`scheduler.js`**: Contains the complex Greedy Algorithm logic for timetable generation.
- **`tenantManager.js`**: The critical logic that handles dynamic database switching for multi-tenancy.
- **`db.js`**: Handles the primary connection to the central management database.

#### Middleware
- **`tenant.js`**: Intercepts requests to inject the correct database models based on the institution.

---

## 📖 Operational Guide
For step-by-step instructions on operating the portals, see the **[USER_GUIDE.md](file:///c:/Users/DELL/Videos/table/USER_GUIDE.md)**.
