# 🎓 Smart Timetable Management System

A full-stack web application for automatically generating, managing, and displaying academic timetables for university departments. The system handles core subjects, elective groupings, lab allocations, faculty clash detection, and manual slot editing with real-time slot-utilization feedback.

---

## 📋 Table of Contents

1. [Technologies Used](#technologies-used)
2. [Project Architecture](#project-architecture)
3. [Features](#features)
4. [DSA and Algorithms Used](#dsa-and-algorithms-used)
5. [Database Design](#database-design)
6. [Installation and Setup](#installation-and-setup)
7. [Project Workflow](#project-workflow)
8. [API Reference](#api-reference)
9. [Future Enhancements](#future-enhancements)

---

## 🛠️ Technologies Used

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.2.0 | UI component framework |
| **Vite** | 5.x | Development server and bundler |
| **TailwindCSS** | 3.x | Utility-first CSS styling |
| **Axios** | 1.4.0 | HTTP client for REST API calls |
| **@hello-pangea/dnd** | 18.x | Drag-and-drop for elective grouping |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | JavaScript runtime |
| **Express.js** | 4.18.x | Web framework and REST API routing |
| **Mongoose** | 7.x | MongoDB ODM (Object Document Mapper) |
| **Multer** | 1.4.x | File upload middleware |
| **XLSX** | 0.18.x | Excel file parsing for bulk data import |
| **dotenv** | 17.x | Environment variable management |
| **CORS** | 2.8.x | Cross-Origin Resource Sharing middleware |
| **Nodemon** | 3.x | Development auto-restart |

### Database
- **MongoDB Atlas** (Cloud-hosted NoSQL database)

---

## 🏗️ Project Architecture

```
table/
├── client/                     # React Frontend (Vite)
│   └── src/
│       ├── App.jsx             # Root component with tab navigation
│       ├── AdminPortal.jsx     # Timetable generation & editing
│       ├── StudentPortal.jsx   # Student timetable viewer
│       ├── ExcelUpload.jsx     # Bulk data import via Excel
│       ├── TimetableConfig.jsx # Session/period configuration
│       ├── FacultyAvailability.jsx  # Faculty schedule viewer
│       ├── ElectiveGrouping.jsx     # Drag-drop elective slot grouping
│       └── api/                # Axios instance configuration
│
└── server/                     # Node.js Backend (Express)
    ├── index.js                # App entry point
    ├── config/
    │   └── db.js               # MongoDB connection
    ├── models/                 # Mongoose data models
    │   ├── Batch.js
    │   ├── Course.js
    │   ├── Faculty.js
    │   ├── Room.js
    │   ├── Subject.js
    │   ├── Timetable.js
    │   └── TimetableConfig.js
    ├── routes/
    │   ├── api.js              # Main API (generate, timetables, stats)
    │   ├── configRoutes.js     # Timetable configuration routes
    │   ├── excelUpload.js      # Excel bulk import routes
    │   ├── facultyAvailability.js  # Faculty schedule routes
    │   └── upload.js           # File upload handler
    └── utils/
        └── scheduler.js        # Core scheduling engine (greedy algorithm)
```

### Data Flow

```
[Admin Configures Subjects]
        │
        ▼
[Frontend: AdminPortal.jsx]
   - Selects batch, rooms, lecture/lab hours per subject
   - Assigns faculty and slot groups for electives
        │
        ▼ POST /api/generate
[Backend: api.js → Scheduler.generate()]
   - Creates allocation tasks (SLOT_GROUP, LAB, LECTURE)
   - Sorts by priority: SLOT_GROUP > LAB > LECTURE
   - Greedy slot finder with resource clash detection
   - Returns completed schedule grid
        │
        ▼
[MongoDB: Timetable saved]
        │
        ▼
[Frontend renders timetable grid]
   - AdminPortal: view + manual edit
   - StudentPortal: read-only view
   - FacultyAvailability: per-faculty view
```

---

## ✨ Features

### 👨‍💼 Admin Features

#### Timetable Generation
- Select a student batch and configure each subject's weekly hours
- Set **lecture hours** (1–5 per week), **lab hours** (2–6 per week in blocks), and **training hours** (3-hour blocks)
- Assign a faculty member per subject
- Choose from available lecture rooms and lab rooms
- One-click **Generate Timetable** triggers the automated scheduler
- Supports **regeneration** of existing timetables

#### Manual Slot Editing
- Click any generated period in the timetable to open the **Edit Period modal**
- Change subject, faculty, room, and class type (Lecture / Lab)
- Editing a period automatically **clears stale elective group data** so only the newly selected subject appears
- **Delete** a period to reset it to Free

#### Multi-Timetable Management
- View **all generated timetables** in a list view
- Delete timetables
- Print or save as PDF

#### Real-Time Slot Counter
- Live **Allocated Slots / Total Slots** progress bar updates as subjects are configured
- Accurately reflects both grouped elective slots and individual extra-hour slots
- Shows remaining **Free Slots**

#### 🗄️ Manage Data (All-in-One CRUD)
- Dedicated "Manage Data" panel to view, search, and edit core entities
- **Searchable Tables**: Each table (Faculty, Rooms, Batches, Courses) features live search with result counts.
- **Full CRUD**: Buttons to Add, Edit, or Delete records directly from the UI without manual DB access.
- **Smart Validation**: Forms ensure IDs and codes follow correct formats.

#### Room Management
- Rooms classified automatically as Lecture or Lab based on their type field
- Separate selection panels for Lecture Rooms and Lab Rooms

#### Faculty Clash Detection
- Prevents two subjects from booking the same faculty at the same time period
- Cross-checks against **all existing timetables** (other batches) so no faculty is double-booked institution-wide

### 🧩 Elective Subject Handling

Elective subjects require special scheduling because multiple groups of students take different electives **simultaneously** in the same period slot.

#### Slot Groups
- Admin assigns elective subjects to **Slot A** or **Slot B**
- All subjects in the same slot group are scheduled **together** in the same period
- The timetable cell shows all elective options for that slot, one per student choice

#### Base + Extra Hours Logic
- **Base hours** = minimum `lectureHours` across all subjects in the group → scheduled as one shared group slot
- **Extra hours** = any subject's `lectureHours` beyond the minimum → scheduled as an individual lecture slot for **that subject only**
- Same logic applies to lab hours
- Example: Group A has SubA(3), SubB(2), SubC(2) lectures → 2 group slots (SubA+SubB+SubC) + 1 individual slot (SubA only)

### 🎓 Student Features (StudentPortal)
- View generated timetables by searching for specific **Batches**.
- Filter the batch list by **Degree**, **Department**, and **Year** to find your schedule.
- Color-coded timetable grid (Core Lecture / Elective / Lab / Training / Lunch / Free).
- Elective slots show all subject options for that period.
- **Faculty Availability View**: Real-time grid showing which faculty members and rooms are free during any given period.

### 🗓️ Faculty Availability
- View per-faculty weekly schedule across all batches
- Immediately see which periods a faculty member is occupied
- Useful for verifying teacher workloads

### 📊 Excel Bulk Import
- Import Courses, Faculty, Batches, Rooms, and Subjects from Excel (.xlsx) files
- Field mapping documentation provided in `EXCEL_TEMPLATE_GUIDE.md`
- Validation and error reporting on import

### ⚙️ Timetable Configuration
- Configure per-session settings:
  - Periods per day (default: 8)
  - Period duration in minutes (default: 60)
  - Start and end time
  - Working days (Mon–Fri configurable)
  - Lunch break period and duration

---

## 📐 DSA and Algorithms Used

### 1. Greedy Scheduling Algorithm

The core of the system is a **Greedy Heuristic Scheduler** implemented in `server/utils/scheduler.js`.

#### Task Creation Phase
Before allocating, all subjects are converted into structured **Task objects**:
```
Task Types:
  SLOT_GROUP  → Elective group (all subjects in same slot, highest priority = 100)
  LAB         → Lab session (2- or 3-period contiguous block, priority = 50–95)
  LECTURE     → Individual lecture hour (priority = 10)
```

Tasks are sorted **descending by priority** so the most constrained allocations (elective groups, then labs) are placed first, leaving more slots free for flexible lecture hour placement.

#### Slot Selection — Greedy with Scoring
For each task, the scheduler:
1. **Iterates all `(day, period)` combinations** as candidate slots
2. **Checks slot space**: all required consecutive periods must be `Free`
3. **Checks resources**: faculty and room must not be occupied (in this or other timetables)
4. **Scores** each valid candidate based on a heuristic
5. **Picks the highest-scoring slot** (greedy choice)

Scoring heuristics include:
- Prefer spreading the same subject across different days
- Avoid placing labs at the very start or end of day
- Prefer mid-week days for variety

#### Commit Phase
Once the best slot is selected, it is **committed**:
- For `SLOT_GROUP`: all subject allocations are written into `electiveAllocations[]` on the period object (`subject`, `faculty`, `room`, `batches` per entry)
- For individual `LAB` / `LECTURE`: a single period object is updated with the subject, faculty, room; **stale elective group fields are explicitly cleared** (`isElective = false`, `electiveAllocations = null`, `slotGroup = null`)

### 2. Data Structures Used

| Data Structure | Where Used | Purpose |
|---|---|---|
| **2D Array** (days × periods) | `this.schedule` grid | Represents the weekly timetable; `schedule[dayIndex][periodIndex]` accesses a period |
| **HashMap (Object / Map)** | `this.globalOccupancy` | Maps `"DayName#PeriodNum"` → `{ faculty: Set, rooms: Set }` for O(1) conflict lookup |
| **Set** | `globalOccupancy[key].faculty`, `.rooms` | Deduplication and O(1) membership check for conflict detection |
| **Array (sorted tasks)** | `tasks[]` | Priority-sorted list of allocation tasks |
| **Array** | `validSlots[]` | Candidate slots gathered per task before greedy selection |
| **Set** | `usedRooms`, `usedFaculty` in `checkResources` | Prevents double-booking within the same elective group slot |

### 3. Clash Detection Logic

#### Cross-Batch Faculty Clash
On initialization, the scheduler calls `buildGlobalOccupancy()`:
```
For every existing timetable (other batches):
  For every occupied period:
    globalOccupancy["Day#Period"].faculty.add(facultyName)
    globalOccupancy["Day#Period"].rooms.add(roomName)
```
When placing a new period, `isResourceFree(day, period, faculty, room)` does a **O(1) Set lookup** — if the faculty or room is already in the set, the slot is rejected.

#### Within-Batch Room/Faculty Conflict
The `reserve(day, period, faculty, room)` method is called after every successful commit, adding the newly allocated resources to `globalOccupancy`. Subsequent placements automatically see these reservations.

#### Elective Group Internal Conflict
During `checkResources` for `SLOT_GROUP` tasks, temporary `usedFaculty` and `usedRooms` Sets are populated within the loop, preventing two subjects in the same elective group from claiming the same faculty or room.

### 4. Min-Based Extra Hours Detection

For elective groups where subjects have different hour counts:
```
minLectureHours = Math.min(...groupSubjects.map(s => s.lectureHours))
groupSessions   = minLectureHours                   // Shared SLOT_GROUP task
extraSessions   = subjectLectureHours - minLecture  // Individual LECTURE task per subject
```
This ensures the counter and the scheduler always agree on how many slots are consumed.

---

## 🗄️ Database Design

### Collections

#### 1. `batches`
```
{
  batchId:    String,   // e.g. "2025-2029"
  semester:   String,   // e.g. "3"
  degree:     String,   // e.g. "B.Tech"
  yearLabel:  String,   // e.g. "Second Year"
  department: String,   // e.g. "CSE"
  session:    String    // e.g. "2025-26-Odd"
}
```

#### 2. `courses`
```
{
  facultyId:   String,
  facultyName: String,
  courseCode:  String,
  subject:     String,
  type:        "Core" | "Elective",
  batch:       String,
  courseL:     Number,   // Weekly lecture hours
  courseT:     Number,   // Weekly tutorial hours
  courseP:     Number,   // Weekly practical hours
  credits:     Number,
  year:        String,
  semester:    Number,
  program:     String,
  department:  String,
  session:     String
}
```

#### 3. `faculties`
```
{
  facultyId:     String,
  name:          String,
  department:    String,
  email:         String,
  maxWeeklyLoad: Number  // Default: 20
}
```

#### 4. `rooms`
```
{
  roomId:      String,
  name:        String,
  type:        String,   // "Classroom", "Lab", "Lecture Hall", etc.
  capacity:    Number,
  sessionYear: String
}
```

#### 5. `subjects`
```
{
  name:      String (unique),
  code:      String,
  slotGroup: "A" | "B" | null
}
```

#### 6. `timetables`
```
{
  title:         String,
  batch:         String,
  batchId:       String,
  generatedAt:   Date,
  schedule:      Mixed,   // Array of { day, periods[] }
  facultySummary: Mixed,
  roomSummary:   Mixed,
  createdAt:     Date
}
```
Each period in `schedule[day].periods[]`:
```
{
  period:              Number,
  type:                "Free" | "Lunch" | "Lecture" | "Lab" | "Elective",
  subject:             String | null,
  faculty:             String | null,
  room:                String | null,
  subjectType:         "Core" | "Elective" | "Training",
  isElective:          Boolean,
  slotGroup:           "A" | "B" | null,
  electiveAllocations: [ { subject, faculty, room, batches } ] | null,
  originalSubjects:    [ String ] | null,
  batches:             [ String ] | null
}
```

#### 7. `timetableconfigs`
```
{
  session:        String (unique),
  periodsPerDay:  Number,
  periodDuration: Number,   // minutes
  startTime:      String,   // "HH:MM"
  endTime:        String,
  workingDays:    [String],
  lunchBreak: {
    enabled:  Boolean,
    period:   Number,
    duration: Number
  }
}
```

### Entity Relationships

```
Batch ──────────────── has many ──── Courses
Batch ──────────────── has one ───── Timetable
Course ─────────────── belongs to ── Faculty
Timetable ──────────── uses ─────── Rooms
TimetableConfig ─────── scopes ────── Session (1:1)
Subject ─────────────── grouped in ── SlotGroup (A/B)
```

---

## 🚀 Installation and Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd table
```

### 2. Backend Setup
```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:
```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
PORT=4000
```

Start the server:
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```
Server runs on **http://localhost:4000**

### 3. Frontend Setup
```bash
cd client
npm install
```

Start the development server:
```bash
npm run dev -- --port 3001
```
Frontend runs on **http://localhost:3001**

### 4. Database Setup
No manual schema creation is required — Mongoose creates collections automatically on first use.

To import initial data (faculty, courses, rooms), use the **Excel Upload** tab in the UI, or use the provided Excel templates (`EXCEL_TEMPLATE_GUIDE.md`).

---

## 📋 Project Workflow

### Step-by-Step Guide

#### Step 1: Initial Configuration
1. Open the **Configuration** tab
2. Set the academic session (e.g., `2025-26-Odd`)
3. Configure periods per day, working days, start/end times, and lunch break period

#### Step 2: Import Master Data
1. Go to the **Excel Upload** tab
2. Upload faculty list, subject list, room list, and course allocation data using the provided Excel templates

#### Step 3: Set Up Elective Groups (Optional)
1. Go to the **Elective Grouping** tab
2. Drag elective subjects into **Slot A** or **Slot B** groups
3. Subjects in the same slot group will be scheduled simultaneously (students pick one)

#### Step 4: Generate Timetable
1. Go to the **Admin Portal** tab
2. Select a **Batch** from the dropdown
3. Select **Lecture Rooms** and **Lab Rooms** to allow
4. In the **Subject Configuration** panel:
   - Switch between **Core**, **Elective**, and **Training** tabs
   - Check each subject to include it
   - Set **Lectures/Week** and **Labs/Week** for each
   - Select a **Faculty** for each subject
   - For electives, select a **Slot Group** (A or B)
   - Optionally add participating **Batches** for shared electives
5. Watch the **Allocated Slots / 35** live counter update
6. Click **Generate Timetable**

#### Step 5: Review and Edit
1. The generated timetable grid appears on the right
2. Click any cell to **edit** or add an entry
3. Use **View All Timetables** to manage multiple batches
4. Click **Print / Save PDF** to export

#### Step 6: Student & Faculty View
1. Open the **Student Portal** tab to find a batch's specific timetable using the search/filter tools.
2. Open the **Faculty Availability** tab to see a global view of all faculty and rooms.
3. Use the **Meeting Scheduler** (in Faculty Availability) to find free slots where multiple faculty members are available simultaneously.
4. Click **Print / Save PDF** on any timetable to export it.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/batches` | List all batches |
| POST | `/api/batches` | Create a new batch |
| PUT | `/api/batches/:id` | Update a batch |
| DELETE | `/api/batches/:id` | Delete a batch |
| GET | `/api/faculty` | List all faculty |
| POST | `/api/faculty` | Create a new faculty member |
| PUT | `/api/faculty/:id` | Update a faculty member |
| DELETE | `/api/faculty/:id` | Delete a faculty member |
| GET | `/api/rooms` | List all rooms |
| POST | `/api/rooms` | Create a new room |
| PUT | `/api/rooms/:id` | Update a room |
| DELETE | `/api/rooms/:id` | Delete a room |
| GET | `/api/subjects` | List all subjects |
| GET | `/api/courses` | List all courses |
| POST | `/api/courses` | Create a new course |
| PUT | `/api/courses/:id` | Update a course |
| DELETE | `/api/courses/:id` | Delete a course |
| GET | `/api/timetables` | List all timetables |
| GET | `/api/timetables/:id` | Get timetable by ID |
| PUT | `/api/timetables/:id` | Update timetable (manual edit) |
| DELETE | `/api/timetables/:id` | Delete a timetable |
| POST | `/api/generate` | Generate a new timetable |
| POST | `/api/stats/preview` | Live slot usage estimation |
| GET | `/api/timetable-advanced/config/:session` | Get session config |
| POST | `/api/timetable-advanced/config` | Save session config |
| POST | `/api/excel/upload` | Bulk import from Excel |

---

## 🔮 Future Enhancements

| Feature | Description |
|---|---|
| **Authentication & Roles** | Admin / Faculty / Student login with JWT for secure access |
| **Conflict Report** | Generate a detailed PDF report of unallocated subjects and clash reasons |
| **Drag-and-Drop Editing** | Move timetable cells via drag-and-drop directly on the grid |
| **Faculty Workload Limit** | Enforce `maxWeeklyLoad` constraint during scheduling to prevent overloading |
| **Multi-Section Support** | Handle multiple sections (A, B, C) of the same batch with independent timetables |
| **Mobile App** | React Native student app for timetable viewing with push notifications for changes |
| **Export to iCal** | Allow faculty/students to import schedules into Google Calendar / Outlook |
| **Auto-Balance** | Algorithm improvement to reduce free slots and improve room/faculty utilization |
| **Timetable Versioning** | Keep history of all versions of a timetable for audit and rollback |
| **Department Dashboard** | Analytics view showing occupancy rates per room, faculty load distribution |

---

## 👥 Project Info

- **Type**: Academic Timetable Management System
- **Stack**: MERN (MongoDB, Express, React, Node.js)
- **Scheduling Engine**: Custom Greedy Algorithm with Priority Queuing
- **Conflict Detection**: O(1) Set-based occupancy map per (Day, Period)
