import React, { useState, useEffect } from 'react';
import api from './api/axios';
import BatchConfigColumn from './BatchConfigColumn';
import PromptGenerator from './PromptGenerator';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, LineChart, Line } from 'recharts';

function AdminPortal({ role }) {
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState(null);
    // ── Multi-batch hierarchical selection ──
    const [selectedBatches, setSelectedBatches] = useState([]); // all checked batches (multi)
    const [batchFilterYear, setBatchFilterYear] = useState('');   // step 1
    const [batchFilterSem, setBatchFilterSem] = useState('');     // step 2
    const [batchStepSearch, setBatchStepSearch] = useState('');   // step 3 live search
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'create' | 'viewAll' | 'manageData' | 'prompt'
    const [blockedSlots, setBlockedSlots] = useState({}); // { batchId: ["Day#Period"] }
    const [blockBatchId, setBlockBatchId] = useState(null);

    // ── Dashboard State ──
    const [studentsList, setStudentsList] = useState([]);
    const [dashView, setDashView] = useState(null); // null | 'students' | 'faculty' | 'academicYear' | 'branches'
    const [dashYearFilter, setDashYearFilter] = useState('');
    const [dashBranchFilter, setDashBranchFilter] = useState('');
    const [dashFacultyFilter, setDashFacultyFilter] = useState(''); // New state for faculty filter
    const [dashSearch, setDashSearch] = useState('');
    // Unified search filters
    const [sRollSearch, setSRollSearch] = useState('');
    const [sNameSearch, setSNameSearch] = useState('');
    const [sBranchSearch, setSBranchSearch] = useState('');
    const [sBatchSearch, setSBatchSearch] = useState('');
    const [sYearSearch, setSYearSearch] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [fIdSearch, setFIdSearch] = useState('');
    const [fNameSearch, setFNameSearch] = useState('');
    const [fDeptSearch, setFDeptSearch] = useState('');
    const [fEmailSearch, setFEmailSearch] = useState('');
    const [fLoadSearch, setFLoadSearch] = useState('');
    const [facultySearch, setFacultySearch] = useState('');

    useEffect(() => {
        if (role === 'facultyAdmin' && (viewMode === 'manageData' || viewMode === 'prompt')) {
            setViewMode('create');
        }
    }, [role, viewMode]);

    const [subjects, setSubjects] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [subjectConfig, setSubjectConfig] = useState({});
    const [subjectSearchTerm, setSubjectSearchTerm] = useState("");
    const [activeSubjectTab, setActiveSubjectTab] = useState('Core');
    const [categorizedSubjects, setCategorizedSubjects] = useState({ Core: [], Elective: [], Training: [] });

    const [rooms, setRooms] = useState([]);
    const [selectedLectureRooms, setSelectedLectureRooms] = useState([]);
    const [selectedLabRooms, setSelectedLabRooms] = useState([]);

    const [facultyList, setFacultyList] = useState([]);
    const [facultySearchTerms, setFacultySearchTerms] = useState({});

    const [courses, setCourses] = useState([]);

    // Search terms for selection
    const [batchSearchTerm, setBatchSearchTerm] = useState("");
    const [lectureRoomSearchTerm, setLectureRoomSearchTerm] = useState("");
    const [labRoomSearchTerm, setLabRoomSearchTerm] = useState("");
    const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

    const [maxWeeklyHours, setMaxWeeklyHours] = useState(40);
    const [timetable, setTimetable] = useState(null);
    const [multiTimetables, setMultiTimetables] = useState([]);
    const [allTimetables, setAllTimetables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // States for editing empty periods
    const [editingTimetable, setEditingTimetable] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState(null);
    const [editForm, setEditForm] = useState({
        subject: '',
        faculty: '',
        room: '',
        type: 'Lecture'
    });
    const [occupiedRooms, setOccupiedRooms] = useState([]);
    const [occupiedFaculty, setOccupiedFaculty] = useState([]);
    const [editModalSubjectSearch, setEditModalSubjectSearch] = useState('');

    // Drag and Drop state
    const [draggingPeriod, setDraggingPeriod] = useState(null);

    // ── Data Management CRUD ──
    const [dataTab, setDataTab] = useState('faculty'); // 'faculty' | 'rooms' | 'batches' | 'courses'
    const [crudModal, setCrudModal] = useState(null); // null | { type, mode, item }
    const batchConfigsRef = React.useRef({});

    useEffect(() => {
        if (selectedBatch) {
            batchConfigsRef.current[selectedBatch._id] = {
                subjectConfig: { ...subjectConfig }
            };
        }
    }, [subjectConfig, selectedBatch]);
    const [crudForm, setCrudForm] = useState({});
    const [crudError, setCrudError] = useState('');
    // Search terms per tab
    const [facSearch, setFacSearch] = useState('');
    const [roomSearch, setRoomSearch] = useState('');
    const [batchSearch, setBatchSearch] = useState('');
    const [courseSearch, setCourseSearch] = useState('');

    const [selectedItems, setSelectedItems] = useState([]); // Selected IDs for bulk actions

    useEffect(() => {
        setSelectedItems([]);
    }, [dataTab]);



    const PERIODS = [
        { id: 1, label: "9:00 - 10:00" },
        { id: 2, label: "10:00 - 11:00" },
        { id: 3, label: "11:00 - 12:00" },
        { id: 4, label: "12:00 - 1:00" },
        { id: 5, label: "1:00 - 2:00" },
        { id: 6, label: "2:00 - 3:00" },
        { id: 7, label: "3:00 - 4:00" },
        { id: 8, label: "4:00 - 5:00" },
    ];

    const getPeriodLabel = (periodId) => {
        return PERIODS.find(period => period.id === periodId)?.label || `Period ${periodId}`;
    };

    const getScheduleDays = (schedule = []) => {
        const days = (schedule || []).map(daySchedule => daySchedule.day).filter(Boolean);
        return days.length > 0 ? days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    };

    const getSchedulePeriods = (schedule = []) => {
        const periodIds = new Set();
        (schedule || []).forEach(daySchedule => {
            (daySchedule.periods || []).forEach(period => {
                if (period && Number.isFinite(Number(period.period))) {
                    periodIds.add(Number(period.period));
                }
            });
        });

        const ids = periodIds.size > 0 ? Array.from(periodIds).sort((a, b) => a - b) : PERIODS.map(period => period.id);
        return ids.map(id => ({ id, label: getPeriodLabel(id) }));
    };

    useEffect(() => {
        fetchBatches();
        fetchFaculty();
        fetchRooms();
        fetchSubjects();
        fetchCourses();
        fetchAllTimetables();
        fetchStudents();
    }, []);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/batches');
            setBatches(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFaculty = async () => {
        try {
            const res = await api.get('/faculty');
            setFacultyList(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRooms = async () => {
        try {
            const res = await api.get('/rooms');
            setRooms(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSubjects = async () => {
        try {
            const res = await api.get('/subjects');
            setAllSubjects(res.data);
            setSubjects(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCourses = async () => {
        try {
            const res = await api.get('/courses');
            setCourses(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAllTimetables = async () => {
        try {
            const res = await api.get('/timetables');
            setAllTimetables(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchStudents = async () => {
        try {
            const params = new URLSearchParams();
            if (dashFacultyFilter) {
                params.append('facultyId', dashFacultyFilter);
            }
            const res = await api.get(`/students?${params.toString()}`);
            setStudentsList(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (viewMode === 'dashboard' && dashView === 'students') {
            fetchStudents();
        }
    }, [dashFacultyFilter]); // Refetch when faculty filter changes

    // Helper to classify rooms
    const isLabRoom = (room) => {
        if (!room.type) return false;
        const type = room.type.toLowerCase();
        return type.includes('lab') ||
            type.includes('computing') ||
            type.includes('practice') ||
            type.includes('workshop') ||
            type.includes('studio');
    };

    const isLectureRoom = (room) => {
        if (!room.type) return false;
        const type = room.type.toLowerCase();
        // If it's explicitly a lecture room
        if (type.includes('lecture') || type.includes('class') || type.includes('hall') || type.includes('theory')) return true;
        // Or if it's NOT a lab
        return !isLabRoom(room);
    };

    const handleBatchSelect = (batchId) => {
        if (!batchId) {
            setSelectedBatch(null);
            setSubjectConfig({});
            return;
        }
        const batch = batches.find(b => b._id === batchId);
        if (!batch) return;
        setSelectedBatch(batch);
        const initialConfig = {};

        console.log("Selected Batch:", batch);

        // Find courses that match this batch
        // Strategy 1: Direct Batch Name/ID Match
        // We normalize names to handle "2025-29" vs "2025-2029" discrepancies
        const normalizeBatchName = (name) => {
            if (!name) return "";
            // Convert YYYY-YY to YYYY-YYYY (e.g., 2025-29 -> 2025-2029)
            const standardized = name.trim().replace(/^(\d{4})\s*-\s*(\d{2})$/, (match, p1, p2) => `${p1}-20${p2}`);
            return standardized.toLowerCase();
        };

        const targetBatchName = normalizeBatchName(batch.name);
        const targetBatchId = normalizeBatchName(batch.batchId);

        const strategy1Courses = courses.filter(c => {
            const courseBatch = normalizeBatchName(c.batch);
            return courseBatch === targetBatchName ||
                courseBatch === targetBatchId ||
                (targetBatchId && courseBatch === targetBatchId);
        });

        console.log(`Strategy 1 found ${strategy1Courses.length} courses`);

        // Strategy 2: Match by Metadata (Dept + Semester)
        // We now ALWAYS run this to find courses from other batches (e.g., 2023-2028) that share Sem/Dept
        const strategy2Courses = courses.filter(c => {
            // Match Semester (Essential)
            if (parseInt(c.semester) !== parseInt(batch.semester)) return false;

            // Match Department (Essential - fuzzy match)
            const batchDept = (batch.department || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const courseDept = (c.department || "").toLowerCase().replace(/[^a-z0-9]/g, '');

            // If either dept is missing, we can't be sure, so skip
            if (!batchDept || !courseDept) return false;

            const deptMatch = batchDept.includes(courseDept) || courseDept.includes(batchDept);
            return deptMatch;
        });

        console.log(`Strategy 2 found ${strategy2Courses.length} courses`);

        // Combine and deduplicate by subject name
        // Use a Map to deduplicate by subject name
        const uniqueCourses = new Map();
        [...strategy1Courses, ...strategy2Courses].forEach(c => {
            uniqueCourses.set(c.subject, c);
        });

        const batchCourses = Array.from(uniqueCourses.values());

        console.log(`Found ${batchCourses.length} courses for batch ${batch.name}`);

        // Helper to normalize subject names for comparison
        const normalize = (str) => (str || "").toLowerCase().trim();

        const core = new Set();
        const elective = new Set();
        const training = new Set();

        batchCourses.forEach(c => {
            const type = (c.type || "").toLowerCase();
            if (type === 'elective') {
                elective.add(c.subject);
            } else if (type === 'training') {
                training.add(c.subject);
            } else {
                core.add(c.subject);
            }
        });

        // Fallback: if no courses found, use batch.subjects (legacy) and put all in Core
        if (batchCourses.length === 0 && batch.subjects && batch.subjects.length > 0) {
            batch.subjects.forEach(s => core.add(s));
        }

        const newCategorized = {
            Core: Array.from(core).sort(),
            Elective: Array.from(elective).sort(),
            Training: Array.from(training).sort()
        };

        setCategorizedSubjects(newCategorized);

        // Update subjects state for valid rendering (though we now use categorizedSubjects for the main list)
        const allRelevant = [...newCategorized.Core, ...newCategorized.Elective];
        const relevantSubjects = allSubjects.filter(s => allRelevant.includes(s.name));

        if (relevantSubjects.length > 0) {
            setSubjects(relevantSubjects); // Keep this for backward compatibility if needed elsewhere
        } else {
            // If no linked subjects found at all, show all in Core? 
            // Or just let user add them. 
            // If user searches, we might want to fallback to allSubjects search?
            // For now, let's pre-populate Core with allSubjects if truly empty?
            // No, empty is better, let user search if needed.
            // Actually, if completely empty, let's put allSubjects in Core so user can pick.
            if (allRelevant.length === 0) {
                setCategorizedSubjects({
                    Core: [...new Set(allSubjects.map(s => s.name))].sort(),
                    Elective: [],
                    Training: []
                });
            }
        }

        // DO NOT pre-select subjects (User request)
        setSubjectConfig({});
        setSubjectSearchTerm("");
        setActiveSubjectTab('Core'); // Reset to Core tab

        // Fetch Timetable Config for this session to determine Max Hours
        fetchTimetableConfig(batch.session);
    };

    const fetchTimetableConfig = async (session) => {
        try {
            // Check if backend has this endpoint. If not, we might need to rely on defaults or update backend.
            // Based on previous context, there is a config endpoint: /api/timetable-advanced/config/:session
            const res = await api.get(`/timetable-advanced/config/${session}`);
            const config = res.data;
            if (config) {
                const pPerDay = config.periodsPerDay || 8;
                const days = config.workingDays ? config.workingDays.length : 5;
                const lunch = config.lunchBreak && config.lunchBreak.enabled ? days : 0; // 1 lunch per working day
                const total = (pPerDay * days) - lunch;
                setMaxWeeklyHours(total);
                console.log(`Calculated Max Hours: ${total} (${pPerDay}*${days} - ${lunch})`);
            } else {
                setMaxWeeklyHours(35); // Default fallback (8*5 - 5)
            }
        } catch (err) {
            console.error("Error fetching timetable config:", err);
            setMaxWeeklyHours(35); // Default safely
        }
    };

    const handleCreateNewSubject = async () => {
        const name = prompt("Enter Subject Name:");
        if (!name) return;
        const code = prompt("Enter Subject Code (e.g., CSE101):");
        if (!code) return;

        try {
            await api.post('/subjects', { name, code });
            fetchSubjects();
            alert("Subject added successfully!");
        } catch (err) {
            alert("Error adding subject: " + (err.response?.data?.error || err.message));
        }
    };

    const handleConfigChange = (subject, field, value) => {
        let val = value;

        if (field === 'lectureHours' || field === 'labHours') {
            val = parseInt(value, 10);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;

            // Enforce constraints: Max 5 Lecture, Max 6 Lab
            if (field === 'lectureHours' && val > 5) val = 5;
            if (field === 'labHours' && val > 6) val = 6;
        }

        setSubjectConfig(prev => ({
            ...prev,
            [subject]: { ...prev[subject], [field]: val }
        }));
    };

    const handleSubjectSearch = (term) => {
        setSubjectSearchTerm(term);
        const filtered = allSubjects.filter(s =>
            s.name.toLowerCase().includes(term.toLowerCase()) ||
            s.code.toLowerCase().includes(term.toLowerCase()) ||
            (subjectConfig[s.name]?.faculty || "").toLowerCase().includes(term.toLowerCase())
        );
        setSubjects(filtered);
    };

    const handleFacultySearch = (subjectName, term) => {
        setFacultySearchTerms(prev => ({
            ...prev,
            [subjectName]: term
        }));
    };

    const getFilteredFacultyForSubject = (subjectName) => {
        const searchTerm = facultySearchTerms[subjectName] || "";
        if (!searchTerm) return facultyList;
        return facultyList.filter(f =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const handleRoomToggle = (roomName, roomType) => {
        if (roomType === 'Lecture') {
            setSelectedLectureRooms(prev =>
                prev.includes(roomName)
                    ? prev.filter(r => r !== roomName)
                    : [...prev, roomName]
            );
        } else {
            setSelectedLabRooms(prev =>
                prev.includes(roomName)
                    ? prev.filter(r => r !== roomName)
                    : [...prev, roomName]
            );
        }
    };

    const [slotSummary, setSlotSummary] = useState(null);

    // Fetch slot summary whenever config changes
    useEffect(() => {
        const fetchSlotSummary = async () => {
            if (!selectedBatch) return;
            try {
                // Determine subjectType for accurate preview
                const processedSubjectConfig = {};
                // Ensure categorizedSubjects has arrays (defensive)
                const electives = categorizedSubjects.Elective || [];
                const trainings = categorizedSubjects.Training || [];

                const electiveSet = new Set(electives.map(s => (s || "").trim().toLowerCase()));
                const trainingSet = new Set(trainings.map(s => (s || "").trim().toLowerCase()));

                Object.keys(subjectConfig).forEach(subName => {
                    const isElective = electiveSet.has((subName || "").trim().toLowerCase());
                    const isTraining = trainingSet.has((subName || "").trim().toLowerCase());
                    processedSubjectConfig[subName] = {
                        ...subjectConfig[subName],
                        subjectType: isTraining ? 'Training' : (isElective ? 'Elective' : 'Core')
                    };
                });

                const res = await api.post('/stats/preview', {
                    batchId: selectedBatch._id,
                    subjectConfig: processedSubjectConfig
                });
                setSlotSummary(res.data);
            } catch (err) {
                console.error("Error fetching slot summary:", err);
            }
        };

        // Debounce to avoid too many requests
        const timeoutId = setTimeout(() => {
            fetchSlotSummary();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [subjectConfig, selectedBatch, categorizedSubjects]);

    // calculateTotalHours removed in favor of slotSummary

    const generateTimetable = async () => {
        if (selectedLectureRooms.length === 0 || selectedLabRooms.length === 0) {
            setError("Please select at least one lecture room and one lab room globally.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Ensure subjectType is explicitly set for all subjects before sending
            const processedSubjectConfig = {};
            const electives = categorizedSubjects.Elective || [];
            const trainings = categorizedSubjects.Training || [];

            const electiveSet = new Set(electives.map(s => (s || "").trim().toLowerCase()));
            const trainingSet = new Set(trainings.map(s => (s || "").trim().toLowerCase()));

            const currentConfig = batchConfigsRef.current['COMMON']?.subjectConfig || subjectConfig;
            Object.keys(currentConfig).forEach(subName => {
                const isElective = electiveSet.has((subName || "").trim().toLowerCase());
                const isTraining = trainingSet.has((subName || "").trim().toLowerCase());
                processedSubjectConfig[subName] = {
                    ...currentConfig[subName],
                    subjectType: isTraining ? 'Training' : (isElective ? 'Elective' : 'Core')
                };
            });

            const primaryBatch = selectedBatches.length > 0 ? selectedBatches[0] : (selectedBatch || {});

            const payload = {
                batchId: primaryBatch._id,
                batchIds: selectedBatches.length > 0 ? selectedBatches.map(b => b._id) : [primaryBatch._id],
                batchNames: selectedBatches.length > 0 ? selectedBatches.map(b => b.name || b.batchId) : [primaryBatch.name || primaryBatch.batchId],
                batchConfigs: (selectedBatches.length > 0 ? selectedBatches : [primaryBatch]).reduce((acc, b) => {
                    const conf = batchConfigsRef.current['COMMON']?.subjectConfig || {};
                    const procConf = {};
                    Object.keys(conf).forEach(subName => {
                        const subjObj = allSubjects.find(s => s.name === subName) || {};
                        const type = (subjObj.type || subjObj.courseType || 'Core').toString().toLowerCase();
                        const isTraining = type.includes('training');
                        const isElective = type.includes('elective');

                        // Better logic: Check if maps exist and have actual data
                        let lecFac = [];
                        if (conf[subName].lectureFacultyMap && Object.keys(conf[subName].lectureFacultyMap).length > 0) {
                            lecFac = conf[subName].lectureFacultyMap[b._id] || [];
                        } else if (conf[subName].lectureFaculty && Array.isArray(conf[subName].lectureFaculty)) {
                            lecFac = conf[subName].lectureFaculty;
                        }

                        let labFac = [];
                        if (conf[subName].labFacultyMap && Object.keys(conf[subName].labFacultyMap).length > 0) {
                            labFac = conf[subName].labFacultyMap[b._id] || [];
                        } else if (conf[subName].labFaculty && Array.isArray(conf[subName].labFaculty)) {
                            labFac = conf[subName].labFaculty;
                        }

                        procConf[subName] = {
                            ...conf[subName],
                            subjectType: isTraining ? 'Training' : (isElective ? 'Elective' : 'Core'),
                            lectureFaculty: lecFac || [],
                            labFaculty: labFac || []
                        };
                    });
                    acc[b._id] = procConf;
                    return acc;
                }, {}),
                batchRooms: (selectedBatches.length > 0 ? selectedBatches : [primaryBatch]).reduce((acc, b) => {
                    acc[b._id] = {
                        lectureRooms: selectedLectureRooms,
                        labRooms: selectedLabRooms
                    };
                    return acc;
                }, {}),
                batchLunchConfigs: (selectedBatches.length > 0 ? selectedBatches : [primaryBatch]).reduce((acc, b) => {
                    const lunchConfigs = batchConfigsRef.current['COMMON']?.lunchConfigs || {};
                    acc[b._id] = lunchConfigs[b._id] || null;
                    return acc;
                }, {}),
                subjectConfig: processedSubjectConfig, // Use the processed config
                selectedRooms: {
                    lectureRooms: selectedLectureRooms,
                    labRooms: selectedLabRooms
                },
                blockedSlots
            };
            const res = await api.post('/generate', payload);

            if (res.data.timetables && res.data.timetables.length > 0) {
                setMultiTimetables(res.data.timetables);
                setTimetable(res.data.timetables[0]); // Set first one as main for fallback
            } else {
                setMultiTimetables([]);
                setTimetable(res.data.timetable);
            }

            // Stats are now handled by the realtime preview, so we don't need to pop them up unless requested.
            // User requested NO POPUP messages.

            fetchAllTimetables();

            if (res.data.warnings && res.data.warnings.length > 0) {
                // Keep warning alert as it's critical
                alert(`Timetable generated with WARNINGS:\n\n${res.data.warnings.join('\n')}\n\nPlease check resource conflicts or add more rooms.`);
            } else {
                // No success popup requested
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateSingleTimetable = async (singleBatchId) => {
        setLoading(true);
        setError(null);
        try {
            const singleBatch = selectedBatches.find(b => b._id === singleBatchId) || selectedBatch;
            if (!singleBatch) return;

            const conf = batchConfigsRef.current['COMMON'] || {};
            const lecRooms = selectedLectureRooms;
            const labRooms = selectedLabRooms;
            if (lecRooms.length === 0 || labRooms.length === 0) {
                setError(`Please select at least one lecture room and one lab room globally.`);
                setLoading(false);
                return;
            }

            const procConf = {};
            const subjectConfLocal = conf.subjectConfig || {};
            Object.keys(subjectConfLocal).forEach(subName => {
                const subjObj = allSubjects.find(s => s.name === subName) || {};
                const type = (subjObj.type || subjObj.courseType || 'Core').toString().toLowerCase();
                procConf[subName] = { ...subjectConfLocal[subName], subjectType: type.includes('training') ? 'Training' : (type.includes('elective') ? 'Elective' : 'Core') };
            });

            const payload = {
                batchId: singleBatch._id,
                batchIds: [singleBatch._id],
                batchNames: [singleBatch.name || singleBatch.batchId],
                batchConfigs: { [singleBatch._id]: procConf },
                batchRooms: { [singleBatch._id]: { lectureRooms: lecRooms, labRooms: labRooms } },
                batchLunchConfigs: { [singleBatch._id]: conf?.lunchConfig || null },
                subjectConfig: procConf, // For single payload logic compatibility
                selectedRooms: { lectureRooms: lecRooms, labRooms: labRooms },
                blockedSlots
            };

            const res = await api.post('/generate', payload);

            if (res.data.timetables && res.data.timetables.length > 0) {
                setMultiTimetables(res.data.timetables);
                setTimetable(res.data.timetables[0]);
            } else {
                setMultiTimetables([]);
                setTimetable(res.data.timetable);
            }

            fetchAllTimetables();

            if (res.data.warnings && res.data.warnings.length > 0) {
                alert(`Timetable generated with WARNINGS:\n\n${res.data.warnings.join('\n')}\n\nPlease check resource conflicts.`);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Callback helper removed
    console.log("AdminPortal Render Cycle", { slotSummary });

    const handleDeleteTimetable = async (timetableId, batchName) => {
        const confirmed = window.confirm(`Are you sure you want to delete the timetable for "${batchName}"? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            await api.delete(`/timetables/${timetableId}`);
            fetchAllTimetables();
            alert('Timetable deleted successfully!');
        } catch (err) {
            alert('Error deleting timetable: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteAllTimetables = async () => {
        if (allTimetables.length === 0) {
            alert('No timetables to delete.');
            return;
        }
        const confirmed = window.confirm(`Are you sure you want to delete ALL ${allTimetables.length} timetable(s) for this institution? This cannot be undone.`);
        if (!confirmed) return;
        try {
            const res = await api.delete('/timetables');
            fetchAllTimetables();
            alert(res.data.message || 'All timetables deleted!');
        } catch (err) {
            alert('Error deleting all timetables: ' + (err.response?.data?.error || err.message));
        }
    };


    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) return;
        const confirmed = window.confirm(`Are you sure you want to delete ${selectedItems.length} selected items? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            await api.post(`/${dataTab}/bulk-delete`, { ids: selectedItems });
            setSelectedItems([]);
            // Refresh the appropriate list
            if (dataTab === 'faculty') fetchFaculty();
            else if (dataTab === 'rooms') fetchRooms();
            else if (dataTab === 'batches') fetchBatches();
            else if (dataTab === 'courses') fetchCourses();

            alert('Items deleted successfully!');
        } catch (err) {
            alert('Error deleting items: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSelectAll = (filteredItems) => {
        if (selectedItems.length === filteredItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(filteredItems.map(item => item._id));
        }
    };

    const handleSelectItem = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRegenerateTimetable = async (tt) => {
        const confirmed = window.confirm(`Do you want to regenerate the timetable for "${tt.batch}"? This will create a new version.`);
        if (!confirmed) return;

        // Find the batch
        const batch = batches.find(b => b.name === tt.batch);
        if (!batch) {
            alert('Batch not found. Please ensure the batch still exists in the database.');
            return;
        }

        // Switch to create mode and pre-fill the batch
        setViewMode('create');
        setSelectedBatch(batch);

        // Initialize config from existing timetable
        const initialConfig = {};
        const oldConfig = (tt.config && tt.config.batchConfigs && tt.config.batchConfigs[batch._id])
            || (tt.config && tt.config.subjectConfig)
            || {};

        batch.subjects.forEach(sub => {
            if (oldConfig[sub]) {
                initialConfig[sub] = oldConfig[sub];
            } else {
                initialConfig[sub] = { lectureHours: 3, labHours: 0, lectureFaculty: [], labFaculty: [], labRoom: "" };
            }
        });
        setSubjectConfig(initialConfig);

        alert('Batch selected! Please configure subjects, faculty, and rooms, then click "Generate Timetable".');
    };

    const handleEditPeriod = async (timetableId, dayIndex, periodIndex) => {
        let tt = allTimetables.find(t => t._id === timetableId);
        if (!tt) tt = multiTimetables.find(t => t._id === timetableId);
        if (!tt) return;

        const day = tt.schedule[dayIndex].day;
        const period = tt.schedule[dayIndex].periods[periodIndex].period;
        const currentPeriod = tt.schedule[dayIndex].periods[periodIndex];

        // Fetch occupied rooms and faculty for this day and period
        try {
            const response = await api.get(`/timetables/conflicts/${day}/${period}`);
            let occupiedRoomsList = response.data.occupiedRooms;
            let occupiedFacultyList = response.data.occupiedFaculty;

            // If editing an existing period, exclude current room/faculty from conflicts
            if (currentPeriod.type !== 'Free' && currentPeriod.type !== 'Lunch') {
                occupiedRoomsList = occupiedRoomsList.filter(r => r !== currentPeriod.room);
                occupiedFacultyList = occupiedFacultyList.filter(f => f !== currentPeriod.faculty);
            }

            setOccupiedRooms(occupiedRoomsList);
            setOccupiedFaculty(occupiedFacultyList);
        } catch (err) {
            console.error('Error fetching conflicts:', err);
            setOccupiedRooms([]);
            setOccupiedFaculty([]);
        }

        setEditingTimetable(tt);
        setEditingPeriod({ dayIndex, periodIndex });

        // Pre-fill form if editing an existing period
        if (currentPeriod.type !== 'Free' && currentPeriod.type !== 'Lunch') {
            setEditForm({
                subject: currentPeriod.subject || '',
                faculty: currentPeriod.faculty || '',
                room: currentPeriod.room || '',
                type: currentPeriod.classType || currentPeriod.type || 'Lecture'
            });
        } else {
            setEditForm({
                subject: '',
                faculty: '',
                room: '',
                type: 'Lecture'
            });
        }

        setEditModalSubjectSearch('');
        setShowEditModal(true);
    };

    const handleSavePeriod = async () => {
        if (!editForm.subject || !editForm.faculty || !editForm.room) {
            alert('Please fill in all fields');
            return;
        }

        if (occupiedFaculty.includes(editForm.faculty)) {
            alert('Faculty Clash Detected! The selected faculty is already assigned to another class during this period.');
            return;
        }

        if (occupiedRooms.includes(editForm.room)) {
            alert('Room Double Booking Detected! The selected room/lab is already occupied during this period.');
            return;
        }

        try {
            // Deep copy to avoid direct state mutation issues
            const updatedSchedule = JSON.parse(JSON.stringify(editingTimetable.schedule));

            // Determine subject type for coloring
            let newSubjectType = 'Core';
            if (categorizedSubjects.Elective.includes(editForm.subject)) {
                newSubjectType = 'Elective';
            } else if (categorizedSubjects.Training.includes(editForm.subject)) {
                newSubjectType = 'Training';
            }

            // ─── NEW: Consecutive Hours Check ───
            const day = updatedSchedule[editingPeriod.dayIndex].day;
            const periodNum = updatedSchedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex].period;

            // Re-fetch conflicts to get the latest facultyBusyMap
            const conflictRes = await api.get(`/timetables/conflicts/${day}/${periodNum}`);
            const { facultyBusyMap } = conflictRes.data;

            const isConsecutiveViolated = (fac) => {
                if (!fac || fac === 'Multiple') return false;
                const busyPeriods = (facultyBusyMap[fac] || []).filter(p => {
                    // Exclude the current period if we are editing it
                    const currentPeriod = editingTimetable.schedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex];
                    if (currentPeriod.faculty === fac && p === periodNum) return false;
                    return true;
                });

                // Add the new period we're trying to save
                const newBusyPeriods = [...new Set([...busyPeriods, periodNum])].sort((a, b) => a - b);

                // Check for 3+ consecutive
                let count = 1;
                for (let i = 1; i < newBusyPeriods.length; i++) {
                    if (newBusyPeriods[i] === newBusyPeriods[i - 1] + 1) {
                        count++;
                        if (count >= 3) return true;
                    } else {
                        count = 1;
                    }
                }
                return false;
            };

            if (isConsecutiveViolated(editForm.faculty)) {
                alert("Faculty cannot be assigned more than 2 continuous hours of class or lab.");
                return;
            }
            // ────────────────────────────────────

            updatedSchedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex] = {
                ...updatedSchedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex],
                subject: editForm.subject,
                faculty: editForm.faculty,
                room: editForm.room,
                type: editForm.type,
                classType: editForm.type,
                subjectType: newSubjectType,
                // CLEARED FIELDS: ensure previous elective group data is removed
                electiveAllocations: null, // Send null to explicitly clear in DB
                slotGroup: null,
                originalSubjects: null,
                isElective: newSubjectType === 'Elective', // Only true if new subject is elective
                batches: null // Clear batches
            };

            await api.put(`/timetables/${editingTimetable._id}`, {
                schedule: updatedSchedule
            });

            // Update local state to reflect changes immediately
            const updatedTT = { ...editingTimetable, schedule: updatedSchedule };
            if (timetable && timetable._id === editingTimetable._id) setTimetable(updatedTT);
            setMultiTimetables(prev => prev.map(t => t._id === editingTimetable._id ? updatedTT : t));

            fetchAllTimetables();
            setShowEditModal(false);
            setEditingTimetable(null);
            setEditingPeriod(null);
            // alert('Period updated successfully!'); // User requested no popup
        } catch (err) {
            alert('Error updating period: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeletePeriod = async () => {
        const confirmed = window.confirm('Are you sure you want to remove this class from the timetable?');
        if (!confirmed) return;

        try {
            const updatedSchedule = [...editingTimetable.schedule];
            updatedSchedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex] = {
                ...updatedSchedule[editingPeriod.dayIndex].periods[editingPeriod.periodIndex],
                subject: '',
                faculty: '',
                room: '',
                type: 'Free'
            };

            await api.put(`/timetables/${editingTimetable._id}`, {
                schedule: updatedSchedule
            });

            // Update local state to reflect changes immediately
            const updatedTT = { ...editingTimetable, schedule: updatedSchedule };
            if (timetable && timetable._id === editingTimetable._id) setTimetable(updatedTT);
            setMultiTimetables(prev => prev.map(t => t._id === editingTimetable._id ? updatedTT : t));

            fetchAllTimetables();
            setShowEditModal(false);
            setEditingTimetable(null);
            setEditingPeriod(null);
            // alert('Period cleared successfully!');
        } catch (err) {
            alert('Error clearing period: ' + (err.response?.data?.error || err.message));
        }
    };

    // ── Drag & Swap Handlers ──
    const handleDragStart = (timetableId, dayIndex, periodIndex) => {
        setDraggingPeriod({ timetableId, dayIndex, periodIndex });
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow drop
    };

    const handleDrop = async (e, targetDayIndex, targetPeriodIndex) => {
        e.preventDefault();
        if (!draggingPeriod) return;

        const { timetableId, dayIndex: sourceDayIndex, periodIndex: sourcePeriodIndex } = draggingPeriod;

        // Prevent swap if same slot
        if (sourceDayIndex === targetDayIndex && sourcePeriodIndex === targetPeriodIndex) {
            setDraggingPeriod(null);
            return;
        }

        const tt = allTimetables.find(t => t._id === timetableId);
        if (!tt) return;

        const sourceDay = tt.schedule[sourceDayIndex];
        const sourceP = sourceDay.periods[sourcePeriodIndex];
        const targetDay = tt.schedule[targetDayIndex];
        const targetP = targetDay.periods[targetPeriodIndex];

        // 1. Protection: cannot drop into Lunch
        if (targetP.type === 'Lunch') {
            alert("Cannot swap with a Lunch period.");
            setDraggingPeriod(null);
            return;
        }

        // 2. Conflict Checks
        try {
            // Check conflicts for Source period in Target slot
            const targetConflictsRes = await api.get(`/timetables/conflicts/${targetDay.day}/${targetP.period}`);
            const targetConflicts = targetConflictsRes.data;

            // Check conflicts for Target period in Source slot
            const sourceConflictsRes = await api.get(`/timetables/conflicts/${sourceDay.day}/${sourceP.period}`);
            const sourceConflicts = sourceConflictsRes.data;

            // Helper to check if a specific period has conflicts at a slot
            const hasSlotConflict = (period, conflicts, oppositePeriod, targetPeriodNum) => {
                if (period.type === 'Free' || period.type === 'Lunch') return false;

                // Faculty conflict
                if (period.faculty && period.faculty !== 'Multiple') {
                    if (conflicts.occupiedFaculty.includes(period.faculty) && period.faculty !== oppositePeriod.faculty) {
                        return true;
                    }

                    // Consecutive check
                    const busyPeriods = (conflicts.facultyBusyMap?.[period.faculty] || []).filter(p => {
                        // Exclude the source period itself since it's being moved
                        if (period.faculty === oppositePeriod.faculty && p === targetPeriodNum) return false;
                        return true;
                    });
                    const newBusyPeriods = [...new Set([...busyPeriods, targetPeriodNum])].sort((a, b) => a - b);
                    let count = 1;
                    for (let i = 1; i < newBusyPeriods.length; i++) {
                        if (newBusyPeriods[i] === newBusyPeriods[i - 1] + 1) {
                            count++;
                            if (count >= 4) return true;
                        } else {
                            count = 1;
                        }
                    }
                }
                // Room conflict
                if (period.room && period.room !== 'Multiple') {
                    if (conflicts.occupiedRooms.includes(period.room) && period.room !== oppositePeriod.room) {
                        return true;
                    }
                }

                // Elective conflicts
                if (period.isElective && Array.isArray(period.electiveAllocations)) {
                    for (const alloc of period.electiveAllocations) {
                        if (conflicts.occupiedFaculty.includes(alloc.faculty) || conflicts.occupiedRooms.includes(alloc.room)) {
                            // Check if it's NOT the same as the opposite period (swapping within itself is fine)
                            const isSameAsOpposite = oppositePeriod.isElective && oppositePeriod.electiveAllocations?.some(oa => oa.faculty === alloc.faculty || oa.room === alloc.room);
                            if (!isSameAsOpposite) return true;
                        }
                    }
                }
                return false;
            };

            if (hasSlotConflict(sourceP, targetConflicts, targetP, targetP.period) || hasSlotConflict(targetP, sourceConflicts, sourceP, sourceP.period)) {
                alert("Faculty cannot be assigned more than 3 continuous hours of class or lab.");
                setDraggingPeriod(null);
                return;
            }

            // 3. Perform Swap
            const updatedSchedule = JSON.parse(JSON.stringify(tt.schedule));
            const p1 = updatedSchedule[sourceDayIndex].periods[sourcePeriodIndex];
            const p2 = updatedSchedule[targetDayIndex].periods[targetPeriodIndex];

            // Swap essential data but KEEP the period IDs/numbers
            const swapData = (from, to) => {
                const keysToSwap = ['type', 'subject', 'faculty', 'room', 'subjectType', 'isElective', 'slotGroup', 'electiveAllocations', 'originalSubjects', 'batches'];
                const temp = {};
                keysToSwap.forEach(k => { temp[k] = from[k]; from[k] = to[k]; to[k] = temp[k]; });
            };

            swapData(p1, p2);

            await api.put(`/timetables/${tt._id}`, { schedule: updatedSchedule });
            fetchAllTimetables();
            alert('Periods swapped successfully!');

        } catch (err) {
            console.error('Swap error:', err);
            alert('Error during swap: ' + (err.response?.data?.error || err.message));
        } finally {
            setDraggingPeriod(null);
        }
    };

    const getCellStyle = (period, batchName) => {
        if (period.type === 'Lunch') return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 flex items-center justify-center font-bold tracking-wider';
        if (period.type === 'Free') return 'bg-gray-100 text-gray-400';

        // Check Training FIRST — training labs should be orange, not blue
        if (period.subjectType === 'Training' || period.type === 'Training') {
            return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
        }

        // 1. Check explicit type from DB
        let isElective = period.subjectType === 'Elective';

        // 2. Fallback: Check categorizedSubjects (if active session)
        if (!isElective && categorizedSubjects && categorizedSubjects.Elective && categorizedSubjects.Elective.includes(period.subject)) {
            isElective = true;
        }

        // 3. Deep Fallback: Check courses list directly (for saved timetables when no batch selected)
        if (!isElective && batchName && period.subject && courses.length > 0) {
            const course = courses.find(c =>
                (c.batch === batchName || c.batch === batchName.split('(')[0].trim()) &&
                c.subject === period.subject
            );
            if (course && course.type === 'Elective') {
                isElective = true;
            }
        }

        if (period.type === 'Lab') {
            if (isElective) {
                return 'bg-purple-100 text-purple-800 border-l-4 border-purple-500';
            }
            return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500';
        }

        if (isElective) {
            return 'bg-pink-100 text-pink-800 border-l-4 border-pink-500';
        }
        return 'bg-green-100 text-green-800 border-l-4 border-green-500';
    };


    const renderPeriodDetails = (periodData) => {
        if (periodData?.isElective && Array.isArray(periodData.electiveAllocations) && periodData.electiveAllocations.length > 0) {
            return (
                <div className="space-y-1">
                    {periodData.electiveAllocations.map((alloc, idx) => (
                        <div key={`${alloc.subject}-${idx}`} className="text-[11px] leading-tight bg-pink-50/70 border border-pink-200 rounded px-1.5 py-1">
                            <div className="font-semibold text-gray-800">
                                {alloc.subject} ({alloc.mode === 'P' ? 'Lab' : alloc.mode === 'L+P' ? 'Lecture + Lab' : 'Lecture'}){alloc.subjectCode ? ` (${alloc.subjectCode})` : ''}
                            </div>
                            <div className="text-gray-700">Faculty: {alloc.faculty}</div>
                            <div className="text-gray-700">Room: {alloc.room}</div>
                            {alloc.batches && alloc.batches.length > 0 && (
                                <div className="text-[10px] text-indigo-700 mt-0.5">Batches: {alloc.batches.join(', ')}</div>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        // Debug logging
        if (periodData?.subject) {
            console.log(`[Period] ${periodData.subject}:`, { faculty: periodData.faculty, room: periodData.room, type: periodData.type, fullData: periodData });
        }

        return (
            <div className="text-gray-800 space-y-0.5 font-medium">
                <div>Faculty: {periodData.faculty || '(not set)'}</div>
                <div>Room: {periodData.room || '(not set)'}</div>
                {periodData.batches && periodData.batches.length > 0 && (
                    <div className="text-[10px] text-indigo-600 bg-indigo-50 rounded px-1 mt-0.5 border border-indigo-100">
                        Batches: {periodData.batches.join(', ')}
                    </div>
                )}
            </div>
        );
    };

    const renderTimetableTable = (tt) => {
        const days = getScheduleDays(tt.schedule);
        const periods = getSchedulePeriods(tt.schedule);

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-gray-800">
                    <thead>
                        <tr>
                            <th className="p-3 border-2 border-gray-800 bg-gray-100 text-left text-sm font-bold text-gray-800 w-32">
                                Time / Day
                            </th>
                            {days.map(day => (
                                <th key={day} className="p-3 border-2 border-gray-800 bg-gray-100 text-center text-sm font-bold text-gray-800">
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map(period => {
                            return (
                                <tr key={period.id}>
                                    <td className="p-3 border-2 border-gray-800 bg-gray-50 font-semibold text-gray-700 text-xs align-top">
                                        <div className="text-center">
                                            <div className="font-bold">{period.label}</div>
                                        </div>
                                    </td>
                                    {days.map(day => {
                                        const daySchedule = tt.schedule.find(d => d.day === day);
                                        const periodData = daySchedule?.periods.find(p => p.period === period.id);
                                        const dayIndex = tt.schedule.findIndex(d => d.day === day);
                                        const periodIndex = daySchedule?.periods?.findIndex(p => p.period === period.id);

                                        return (
                                            <td
                                                key={day}
                                                className={`p-2 border-2 border-gray-800 align-top min-h-[80px] transition-colors ${draggingPeriod ? 'hover:bg-blue-50 cursor-copy' : ''}`}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, dayIndex, periodIndex)}
                                            >
                                                {periodData?.type === 'Lunch' ? (
                                                    <div className="bg-yellow-100 p-3 rounded text-center font-bold text-yellow-800">
                                                         LUNCH
                                                    </div>
                                                ) : periodData?.type === 'Blocked' ? (
                                                    <div className="bg-red-50 p-3 rounded text-center font-bold text-red-500 min-h-[70px] flex items-center justify-center relative overflow-hidden border border-red-200 shadow-inner">
                                                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ef4444 10px, #ef4444 20px)' }}></div>
                                                        <span className="relative z-10 text-xs tracking-wider"> BLOCKED</span>
                                                    </div>
                                                ) : (periodData && periodData.type !== 'Free') ? (
                                                    <div
                                                        draggable={true}
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData('text/plain', '');
                                                            handleDragStart(tt._id, dayIndex, periodIndex);
                                                        }}
                                                        className={`relative p-2 min-h-[70px] cursor-move active:opacity-50 active:scale-95 transition-all ${getCellStyle(periodData, tt.batch)} ${draggingPeriod?.dayIndex === dayIndex && draggingPeriod?.periodIndex === periodIndex ? 'opacity-30 border-dashed border-2 border-blue-500' : ''}`}
                                                    >
                                                        <div className="text-xs">
                                                            <div className="font-bold text-gray-800 mb-1">
                                                                {periodData.subject} ({periodData.classType || periodData.type})
                                                            </div>
                                                            {renderPeriodDetails(periodData)}
                                                        </div>
                                                        <button
                                                            onClick={() => handleEditPeriod(tt._id, dayIndex, periodIndex)}
                                                            className="absolute top-1 right-1 bg-white hover:bg-gray-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition"
                                                            title="Edit this period"
                                                        >
                                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="relative bg-gray-50 p-3 min-h-[70px] flex items-center justify-center border-2 border-transparent hover:border-blue-300 hover:bg-blue-50 transition-all rounded">
                                                        <button
                                                            onClick={() => handleEditPeriod(tt._id, dayIndex, periodIndex)}
                                                            className="bg-green-500 hover:bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg shadow-md transition"
                                                            title="Add class to this period"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // ── CRUD Helpers ──────────────────────────────────────────────────────────
    const openAddModal = (type) => {
        setCrudError('');
        const defaults = {
            faculty: { facultyId: '', name: '', department: '', email: '', mobileNumber: '', branch: '', qualification: '', profilePhoto: '', maxWeeklyLoad: 20 },
            rooms: { roomId: '', name: '', type: 'Classroom', capacity: '', sessionYear: '' },
            batches: { batchId: '', semester: '', degree: 'B.Tech', yearLabel: '', department: '', session: '' },
            courses: {
                courseCode: '', subject: '', type: 'Core', batch: '', courseL: 0, courseT: 0, courseP: 0,
                credits: 0, year: '', semester: 1, program: 'B.Tech', department: '', totalLoad: 0,
                facultyId: '', facultyName: '', session: ''
            },
        };
        setCrudForm(defaults[type]);
        setCrudModal({ type, mode: 'add' });
    };

    const openEditModal = (type, item) => {
        setCrudError('');
        setCrudForm({ ...item });
        setCrudModal({ type, mode: 'edit', item });
    };

    const handleCrudSubmit = async () => {
        const { type, mode, item } = crudModal;
        const endpoint = { faculty: 'faculty', rooms: 'rooms', batches: 'batches', courses: 'courses' }[type];
        try {
            let res;
            if (mode === 'add') {
                res = await api.post(`/${endpoint}`, crudForm);
                if (type === 'faculty' && res.data && res.data.tempPassword) {
                    setTempPasswordInfo({
                        username: res.data.faculty.facultyId,
                        password: res.data.tempPassword,
                        name: res.data.faculty.name,
                        role: 'FACULTY'
                    });
                }
            } else {
                res = await api.put(`/${endpoint}/${item._id}`, crudForm);
            }
            // Refresh the relevant list
            if (type === 'faculty') await fetchFaculty();
            if (type === 'rooms') await fetchRooms();
            if (type === 'batches') await fetchBatches();
            if (type === 'courses') await fetchCourses();
            setCrudModal(null);
        } catch (err) {
            setCrudError(err.response?.data?.error || err.message);
        }
    };

    const handleCrudDelete = async (type, item) => {
        if (!window.confirm(`Delete this ${type.slice(0, -1)}? This cannot be undone.`)) return;
        const endpoint = { faculty: 'faculty', rooms: 'rooms', batches: 'batches', courses: 'courses' }[type];
        try {
            await api.delete(`/${endpoint}/${item._id}`);
            if (type === 'faculty') await fetchFaculty();
            if (type === 'rooms') await fetchRooms();
            if (type === 'batches') await fetchBatches();
            if (type === 'courses') await fetchCourses();
        } catch (err) {
            alert('Delete failed: ' + (err.response?.data?.error || err.message));
        }
    };

    const renderCrudForm = () => {
        if (!crudModal) return null;
        const { type, mode } = crudModal;
        const title = mode === 'add' ? `Add ${type.slice(0, -1)}` : `Edit ${type.slice(0, -1)}`;
        const fields = {
            faculty: [
                { key: 'facultyId', label: 'Faculty ID' },
                { key: 'name', label: 'Name' },
                { key: 'department', label: 'Department' },
                { key: 'email', label: 'Email' },
            ],
            rooms: [
                { key: 'roomId', label: 'Room ID' },
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type', select: ['Classroom', 'Lab', 'Lecture Hall', 'Seminar Hall'] },
                { key: 'capacity', label: 'Capacity', type: 'number' },
                { key: 'sessionYear', label: 'Session Year' },
            ],
            batches: [
                { key: 'batchId', label: 'Batch ID' },
                { key: 'semester', label: 'Semester' },
                { key: 'degree', label: 'Degree', select: ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'BCA', 'B.Sc'] },
                { key: 'yearLabel', label: 'Year Label (e.g. Second Year)' },
                { key: 'department', label: 'Department' },
                { key: 'session', label: 'Session (e.g. 2025-26-Odd)' },
            ],
            courses: [
                { key: 'courseCode', label: 'Course Code' },
                { key: 'subject', label: 'Subject Name' },
                { key: 'type', label: 'Type', select: ['Core', 'Elective'] },
                { key: 'batch', label: 'Batch', select: ['', ...batches.map(b => b.batchId || b.name)] },
                { key: 'facultySelect', label: 'Faculty Assignment *', customSelect: true },
                { key: 'courseL', label: 'Lecture Hours', type: 'number' },
                { key: 'courseT', label: 'Tutorial Hours', type: 'number' },
                { key: 'courseP', label: 'Practical Hours', type: 'number' },
                { key: 'credits', label: 'Credits', type: 'number' },
                { key: 'year', label: 'Year' },
                { key: 'semester', label: 'Semester', type: 'number' },
                { key: 'program', label: 'Program', select: ['B.Tech', 'M.Tech', 'MBA', 'MCA'] },
                { key: 'department', label: 'Department' },
                { key: 'totalLoad', label: 'Total Load', type: 'number' },
                { key: 'session', label: 'Session' },
            ],
        }[type];

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCrudModal(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-5 border-b">
                        <h2 className="text-xl font-bold text-gray-800 capitalize">{title}</h2>
                        <button onClick={() => setCrudModal(null)} className="text-gray-400 hover:text-red-500 text-2xl"></button>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                        {fields.map(f => (
                            <div key={f.key} className={f.key === 'subject' || f.key === 'session' || f.key === 'facultyName' || f.key === 'facultySelect' ? 'col-span-2' : ''}>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                                {f.customSelect ? (
                                    <select
                                        value={crudForm.facultyId || ''}
                                        onChange={e => {
                                            const selectedId = e.target.value;
                                            const facObj = facultyList.find(fac => fac.facultyId === selectedId);
                                            setCrudForm(p => ({
                                                ...p,
                                                facultyId: selectedId,
                                                facultyName: facObj ? facObj.name : ''
                                            }));
                                        }}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        <option value="">-- Choose Faculty --</option>
                                        {facultyList.map(fac => (
                                            <option key={fac.facultyId} value={fac.facultyId}>
                                                {fac.name} ({fac.facultyId})
                                            </option>
                                        ))}
                                    </select>
                                ) : f.select ? (
                                    <select
                                        value={crudForm[f.key] || ''}
                                        onChange={e => setCrudForm(p => ({ ...p, [f.key]: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        {f.select.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={f.type || 'text'}
                                        value={crudForm[f.key] ?? ''}
                                        onChange={e => setCrudForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    {crudError && <p className="px-5 pb-2 text-red-600 text-sm">{crudError}</p>}
                    <div className="flex justify-end gap-3 p-5 border-t">
                        <button onClick={() => setCrudModal(null)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold">Cancel</button>
                        <button onClick={handleCrudSubmit} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                            {mode === 'add' ? 'Add' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen p-4 md:p-8 w-full bg-gray-50">
            <h1 className="text-4xl font-extrabold text-blue-900 mb-4 text-center">
                {role === 'facultyAdmin' ? 'Faculty Admin Portal' : 'Main Administration Portal'}
                {viewMode !== 'dashboard' && ' - Timetable Management'}
            </h1>

            <div className="flex justify-center gap-4 mb-8 flex-wrap">
                {role !== 'facultyAdmin' && (
                    <button
                        onClick={() => { setViewMode('dashboard'); setDashView(null); }}
                        className={`px-6 py-2 rounded-lg font-semibold transition ${viewMode === 'dashboard'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                         Dashboard
                    </button>
                )}
                <button
                    onClick={() => setViewMode('create')}
                    className={`px-6 py-2 rounded-lg font-semibold transition ${viewMode === 'create'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    Create Timetable
                </button>
                <button
                    onClick={() => setViewMode('viewAll')}
                    className={`px-6 py-2 rounded-lg font-semibold transition ${viewMode === 'viewAll'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    View All Timetables ({allTimetables.length})
                </button>

                {role !== 'facultyAdmin' && (
                    <>
                        <button
                            onClick={() => setViewMode('manageData')}
                            className={`px-6 py-2 rounded-lg font-semibold transition ${viewMode === 'manageData'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                             Manage Data
                        </button>
                        <button
                            onClick={() => setViewMode('prompt')}
                            className={`px-6 py-2 rounded-lg font-semibold transition ${viewMode === 'prompt'
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md transform hover:scale-105'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                             AI Prompt Generator
                        </button>
                    </>
                )}
            </div>

            {viewMode === 'prompt' && <PromptGenerator />}

            {/* ── CRUD Modal ── */}
            {renderCrudForm()}

            {/* ── Temp Password Modal ── */}
            {tempPasswordInfo && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Account Created Successfully!</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Here is the temporary password for <strong>{tempPasswordInfo.name}</strong> ({tempPasswordInfo.username}).
                            Please copy it now. It will only be shown once.
                        </p>
                        <div className="bg-gray-100 rounded-lg p-3 font-mono text-lg font-bold text-gray-800 flex justify-between items-center mb-6">
                            <span>{tempPasswordInfo.password}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(tempPasswordInfo.password);
                                    alert('Password copied to clipboard!');
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                            >
                                Copy
                            </button>
                        </div>
                        <button
                            onClick={() => setTempPasswordInfo(null)}
                            className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-lg font-semibold text-sm"
                        >
                            I have copied the password
                        </button>
                    </div>
                </div>
            )}

            {/* ── MAIN ADMINISTRATION DASHBOARD ── */}
            {viewMode === 'dashboard' && (() => {
                // Derived stats from live data
                const totalStudents = studentsList.length;
                const totalFaculty = facultyList.length;
                const academicYears = [...new Set(studentsList.map(s => s.academicYear).filter(Boolean))].sort();
                const branches = [...new Set(studentsList.map(s => s.branch).filter(Boolean))].sort();

                // Branch-wise student counts
                const branchCounts = branches.map(br => ({
                    branch: br,
                    count: studentsList.filter(s => s.branch === br).length
                })).sort((a, b) => b.count - a.count);

                // Filtered students for drill-down
                let filteredStudents = studentsList;
                if (dashYearFilter) filteredStudents = filteredStudents.filter(s => s.academicYear === dashYearFilter);
                if (dashBranchFilter) filteredStudents = filteredStudents.filter(s => s.branch === dashBranchFilter);
                if (sRollSearch) {
                    const q = sRollSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.rollNumber || '').toLowerCase().includes(q));
                }
                if (sNameSearch) {
                    const q = sNameSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.name || '').toLowerCase().includes(q));
                }
                if (sBranchSearch) {
                    const q = sBranchSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.branch || '').toLowerCase().includes(q));
                }
                if (sBatchSearch) {
                    const q = sBatchSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.batch || '').toLowerCase().includes(q));
                }
                if (sYearSearch) {
                    const q = sYearSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.academicYear || '').toLowerCase().includes(q));
                }
                if (studentSearch) {
                    const q = studentSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s =>
                        (s.rollNumber || '').toLowerCase().includes(q) ||
                        (s.name || '').toLowerCase().includes(q) ||
                        (s.branch || '').toLowerCase().includes(q) ||
                        (s.batch || '').toLowerCase().includes(q) ||
                        (s.academicYear || '').toLowerCase().includes(q)
                    );
                }

                let filteredFaculty = facultyList;
                if (fIdSearch) {
                    const q = fIdSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => (f.facultyId || '').toLowerCase().includes(q));
                }
                if (fNameSearch) {
                    const q = fNameSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => (f.name || '').toLowerCase().includes(q));
                }
                if (fDeptSearch) {
                    const q = fDeptSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => (f.department || '').toLowerCase().includes(q));
                }
                if (fEmailSearch) {
                    const q = fEmailSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => (f.email || '').toLowerCase().includes(q));
                }
                if (fLoadSearch) {
                    const q = fLoadSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => String(f.maxWeeklyLoad || '').toLowerCase().includes(q));
                }
                if (facultySearch) {
                    const q = facultySearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f =>
                        (f.facultyId || '').toLowerCase().includes(q) ||
                        (f.name || '').toLowerCase().includes(q) ||
                        (f.department || '').toLowerCase().includes(q) ||
                        (f.email || '').toLowerCase().includes(q) ||
                        String(f.maxWeeklyLoad || '').toLowerCase().includes(q)
                    );
                }

                const statCards = [
                    {
                        id: 'students',
                        label: 'Total Students',
                        value: totalStudents,
                        icon: '',
                        gradient: 'from-indigo-500 to-indigo-700',
                        bg: 'bg-indigo-50',
                        border: 'border-indigo-200',
                        text: 'text-indigo-700',
                        desc: 'Enrolled students'
                    },
                    {
                        id: 'faculty',
                        label: 'Total Faculty',
                        value: totalFaculty,
                        icon: '‍',
                        gradient: 'from-emerald-500 to-emerald-700',
                        bg: 'bg-emerald-50',
                        border: 'border-emerald-200',
                        text: 'text-emerald-700',
                        desc: 'Active faculty members'
                    },
                    {
                        id: 'academicYear',
                        label: 'Academic Years',
                        value: academicYears.length,
                        icon: '',
                        gradient: 'from-amber-500 to-orange-600',
                        bg: 'bg-amber-50',
                        border: 'border-amber-200',
                        text: 'text-amber-700',
                        desc: academicYears.join(', ') || 'No years found'
                    },
                    {
                        id: 'branches',
                        label: 'Branches',
                        value: branches.length,
                        icon: '',
                        gradient: 'from-violet-500 to-purple-600',
                        bg: 'bg-violet-50',
                        border: 'border-violet-200',
                        text: 'text-violet-700',
                        desc: `${branches.slice(0, 3).join(', ')}${branches.length > 3 ? ` +${branches.length - 3} more` : ''}`
                    }
                ];

                return (
                    <div className="space-y-6">
                        {/* Stat Cards Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {statCards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => {
                                        setDashView(dashView === card.id ? null : card.id);
                                        setDashSearch('');
                                        setStudentSearch('');
                                        setFacultySearch('');
                                        setDashYearFilter('');
                                        setDashBranchFilter('');
                                    }}
                                    className={`text-left p-5 rounded-2xl border-2 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${card.bg} ${card.border} ${dashView === card.id ? 'ring-2 ring-offset-2 ring-indigo-500 shadow-lg -translate-y-0.5' : ''}`}
                                >
                                    <div className="flex justify-end items-start mb-3">
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${card.bg} ${card.text} border ${card.border}`}>
                                            {dashView === card.id ? 'Viewing ▲' : 'Click to view'}
                                        </span>
                                    </div>
                                    <div className={`text-4xl font-extrabold ${card.text} mb-1`}>{card.value}</div>
                                    <div className="text-sm font-bold text-gray-700">{card.label}</div>
                                    <div className="text-xs text-gray-500 mt-1 truncate">{card.desc}</div>
                                </button>
                            ))}
                        </div>

                        {/* Main Content Row */}
                        <div className={`flex gap-4 ${dashView ? 'items-start' : 'items-stretch'}`}>

                            {/* Left: Drill-down panel */}
                            <div className={`${dashView ? 'flex-1' : 'flex-1'} min-w-0`}>

                                {/* Student List */}
                                {dashView === 'students' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Student List</h2>
                                                <p className="text-indigo-200 text-sm">{filteredStudents.length} of {totalStudents} students</p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setStudentSearch(''); }} className="text-indigo-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Roll No, Name, Branch, Batch or Year..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <select value={dashYearFilter} onChange={e => setDashYearFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Years</option>
                                                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <select value={dashBranchFilter} onChange={e => setDashBranchFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Branches</option>
                                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            {['COLLEGE_ADMIN', 'HOD', 'superAdmin'].includes(role) && (
                                                <select value={dashFacultyFilter} onChange={e => setDashFacultyFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                    <option value="">All Faculty</option>
                                                    {facultyList.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {filteredStudents.length === 0 ? (
                                                <div className="text-center py-16 text-gray-400">
                                                    <div className="text-5xl mb-3"></div>
                                                    <p className="font-medium">No students found</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Roll No</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Branch</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Batch</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Academic Year</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredStudents.map((s, i) => (
                                                            <tr key={s._id} className="border-t border-gray-50 hover:bg-indigo-50/40 transition">
                                                                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                <td className="px-4 py-3 font-mono font-semibold text-indigo-700 text-xs">{s.rollNumber}</td>
                                                                <td className="px-4 py-3 font-semibold text-gray-800">{s.name}</td>
                                                                <td className="px-4 py-3 text-gray-600">{s.branch || '—'}</td>
                                                                <td className="px-4 py-3 text-gray-600">{s.batch || '—'}</td>
                                                                <td className="px-4 py-3 text-gray-600">{s.academicYear || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Faculty List */}
                                {dashView === 'faculty' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Faculty List</h2>
                                                <p className="text-emerald-200 text-sm">{filteredFaculty.length} of {totalFaculty} faculty members</p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setFacultySearch(''); }} className="text-emerald-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by ID, Name, Department, Email or Load..." value={facultySearch} onChange={e => setFacultySearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder=" Email" value={fEmailSearch} onChange={e => setFEmailSearch(e.target.value)} className="w-[180px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder=" Max Load" value={fLoadSearch} onChange={e => setFLoadSearch(e.target.value)} className="w-[110px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {filteredFaculty.length === 0 ? (
                                                <div className="text-center py-16 text-gray-400">
                                                    <div className="text-5xl mb-3">‍</div>
                                                    <p className="font-medium">No faculty found</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Faculty ID</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Max Load</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredFaculty.map((f, i) => (
                                                            <tr key={f._id} className="border-t border-gray-50 hover:bg-emerald-50/40 transition">
                                                                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                <td className="px-4 py-3 font-mono font-semibold text-emerald-700 text-xs">{f.facultyId}</td>
                                                                <td className="px-4 py-3 font-semibold text-gray-800">{f.name}</td>
                                                                <td className="px-4 py-3 text-gray-600">{f.department || '—'}</td>
                                                                <td className="px-4 py-3 text-gray-500 text-xs">{f.email || '—'}</td>
                                                                <td className="px-4 py-3 text-gray-600">{f.maxWeeklyLoad || 20} hrs/wk</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Academic Year → Filter Students */}
                                {dashView === 'academicYear' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Students by Academic Year</h2>
                                                <p className="text-amber-100 text-sm">Filter students by their academic year</p>
                                            </div>
                                            <button onClick={() => setDashView(null)} className="text-amber-100 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Roll No, Name, Branch or Year..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                            <div className="flex gap-1 flex-wrap">
                                                <button onClick={() => setDashYearFilter('')} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${!dashYearFilter ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-100'}`}>All ({studentsList.length})</button>
                                                {academicYears.map(yr => (
                                                    <button key={yr} onClick={() => setDashYearFilter(yr)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${dashYearFilter === yr ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-100'}`}>
                                                        {yr} ({studentsList.filter(s => s.academicYear === yr).length})
                                                    </button>
                                                ))}
                                                {academicYears.length === 0 && <span className="text-[10px] text-gray-400 self-center">No years recorded</span>}
                                            </div>
                                        </div>
                                        <div className="overflow-auto max-h-[440px]">
                                            {filteredStudents.length === 0 ? (
                                                <div className="text-center py-16 text-gray-400">
                                                    <div className="text-5xl mb-3"></div>
                                                    <p className="font-medium">No students for this year</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Roll No</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Branch</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-gray-600">Academic Year</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredStudents.map((s, i) => (
                                                            <tr key={s._id} className="border-t border-gray-50 hover:bg-amber-50/40 transition">
                                                                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                <td className="px-4 py-3 font-mono font-semibold text-amber-700 text-xs">{s.rollNumber}</td>
                                                                <td className="px-4 py-3 font-semibold text-gray-800">{s.name}</td>
                                                                <td className="px-4 py-3 text-gray-600">{s.branch || '—'}</td>
                                                                <td className="px-4 py-3">
                                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                                                                        {s.academicYear || 'Not set'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Branches → Branch-Wise Count */}
                                {dashView === 'branches' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Branch-Wise Student Count</h2>
                                                <p className="text-violet-100 text-sm">{branches.length} branches across {totalStudents} students</p>
                                            </div>
                                            <button onClick={() => setDashView(null)} className="text-violet-100 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-6">
                                            {branchCounts.length === 0 ? (
                                                <div className="text-center py-12 text-gray-400">
                                                    <div className="text-5xl mb-3"></div>
                                                    <p className="font-medium">No branches found</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {branchCounts.map((item, i) => {
                                                        const pct = totalStudents > 0 ? Math.round((item.count / totalStudents) * 100) : 0;
                                                        const hues = ['bg-pink-500', 'bg-rose-500', 'bg-red-500', 'bg-fuchsia-500', 'bg-purple-500', 'bg-violet-500', 'bg-indigo-500'];
                                                        const barColor = hues[i % hues.length];
                                                        return (
                                                            <div key={item.branch} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => { setDashBranchFilter(item.branch); setDashView('students'); }}>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-semibold text-gray-800 text-sm">{item.branch}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-gray-500 text-xs">{pct}%</span>
                                                                        <span className="font-bold text-gray-800 text-sm w-8 text-right">{item.count}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${barColor} rounded-full flex items-center pl-3 transition-all duration-700`}
                                                                        style={{ width: `${Math.max(pct, 3)}%` }}
                                                                    >
                                                                        {pct > 10 && <span className="text-white text-xs font-bold">{item.count} students</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Batches List */}
                                {dashView === 'batches' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Batch List</h2>
                                                <p className="text-amber-100 text-sm">
                                                    {(() => {
                                                        const filtered = batches.filter(b =>
                                                            [b.batchId, b.degree, b.yearLabel, b.department, String(b.semester || ''), b.session]
                                                                .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                        );
                                                        return `${filtered.length} of ${batches.length} batches`;
                                                    })()}
                                                </p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setDashSearch(''); }} className="text-amber-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Batch ID, Degree, Year, Department or Session..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {(() => {
                                                const filtered = batches.filter(b =>
                                                    [b.batchId, b.degree, b.yearLabel, b.department, String(b.semester || ''), b.session]
                                                        .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                );
                                                return filtered.length === 0 ? (
                                                    <div className="text-center py-16 text-gray-400">
                                                        <p className="font-medium">No batches found</p>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Batch ID</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Degree</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Year</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Semester</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Session</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((b, i) => (
                                                                <tr key={b._id} className="border-t border-gray-50 hover:bg-amber-50/40 transition">
                                                                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-amber-700 text-xs">{b.batchId}</td>
                                                                    <td className="px-4 py-3 font-semibold text-gray-800">{b.degree}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{b.yearLabel}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{b.department}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{b.semester}</td>
                                                                    <td className="px-4 py-3 text-gray-500 text-xs">{b.session}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Timetables List */}
                                {dashView === 'timetables' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Generated Timetables</h2>
                                                <p className="text-purple-100 text-sm">
                                                    {(() => {
                                                        const filtered = allTimetables.filter(t =>
                                                            (t.batch || '').toLowerCase().includes(dashSearch.toLowerCase())
                                                        );
                                                        return `${filtered.length} of ${allTimetables.length} timetables`;
                                                    })()}
                                                </p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setDashSearch(''); }} className="text-purple-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Batch/Name..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {(() => {
                                                const filtered = allTimetables.filter(t =>
                                                    (t.batch || '').toLowerCase().includes(dashSearch.toLowerCase())
                                                );
                                                return filtered.length === 0 ? (
                                                    <div className="text-center py-16 text-gray-400">
                                                        <p className="font-medium">No timetables found</p>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Batch Name</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Created At</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((t, i) => (
                                                                <tr key={t._id} className="border-t border-gray-50 hover:bg-purple-50/40 transition">
                                                                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                    <td className="px-4 py-3 font-semibold text-gray-800">{t.batch}</td>
                                                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                                                        {t.createdAt && !isNaN(new Date(t.createdAt)) ? new Date(t.createdAt).toLocaleString() : 'Just now'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <button
                                                                            onClick={() => {
                                                                                setViewMode('viewAll');
                                                                            }}
                                                                            className="text-purple-600 hover:text-purple-800 font-bold text-xs"
                                                                        >
                                                                            View Details →
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Subjects List */}
                                {dashView === 'subjects' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-pink-600 to-pink-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Subject List</h2>
                                                <p className="text-pink-100 text-sm">
                                                    {(() => {
                                                        const filtered = allSubjects.filter(s =>
                                                            [s.name, s.code].some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                        );
                                                        return `${filtered.length} of ${allSubjects.length} subjects`;
                                                    })()}
                                                </p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setDashSearch(''); }} className="text-pink-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Name or Code..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {(() => {
                                                const filtered = allSubjects.filter(s =>
                                                    [s.name, s.code].some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                );
                                                return filtered.length === 0 ? (
                                                    <div className="text-center py-16 text-gray-400">
                                                        <p className="font-medium">No subjects found</p>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject Code</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject Name</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((s, i) => (
                                                                <tr key={s._id || i} className="border-t border-gray-50 hover:bg-pink-50/40 transition">
                                                                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-pink-700 text-xs">{s.code || '—'}</td>
                                                                    <td className="px-4 py-3 font-semibold text-gray-800">{s.name}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Rooms List */}
                                {dashView === 'rooms' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Room List</h2>
                                                <p className="text-red-100 text-sm">
                                                    {(() => {
                                                        const filtered = rooms.filter(r =>
                                                            [r.roomId, r.name, r.type, String(r.capacity || ''), r.sessionYear]
                                                                .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                        );
                                                        return `${filtered.length} of ${rooms.length} rooms`;
                                                    })()}
                                                </p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setDashSearch(''); }} className="text-red-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Name, ID, Type or Session..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {(() => {
                                                const filtered = rooms.filter(r =>
                                                    [r.roomId, r.name, r.type, String(r.capacity || ''), r.sessionYear]
                                                        .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                );
                                                return filtered.length === 0 ? (
                                                    <div className="text-center py-16 text-gray-400">
                                                        <p className="font-medium">No rooms found</p>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Room ID</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Capacity</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Session Year</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((r, i) => (
                                                                <tr key={r._id} className="border-t border-gray-50 hover:bg-red-50/40 transition">
                                                                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-red-700 text-xs">{r.roomId}</td>
                                                                    <td className="px-4 py-3 font-semibold text-gray-800">{r.name}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.type?.toLowerCase().includes('lab') ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {r.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 font-semibold">{r.capacity}</td>
                                                                    <td className="px-4 py-3 text-gray-500 text-xs">{r.sessionYear}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Courses List */}
                                {dashView === 'courses' && (
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-xl font-bold text-white">Course List</h2>
                                                <p className="text-teal-100 text-sm">
                                                    {(() => {
                                                        const filtered = courses.filter(c =>
                                                            [c.courseCode, c.subject, c.type, c.facultyName, c.batch, c.department]
                                                                .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                        );
                                                        return `${filtered.length} of ${courses.length} courses`;
                                                    })()}
                                                </p>
                                            </div>
                                            <button onClick={() => { setDashView(null); setDashSearch(''); }} className="text-teal-200 hover:text-white text-2xl font-bold">×</button>
                                        </div>
                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder=" Search by Course Code, Subject, Faculty, Batch or Department..." value={dashSearch} onChange={e => setDashSearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                                        </div>
                                        <div className="overflow-auto max-h-[500px]">
                                            {(() => {
                                                const filtered = courses.filter(c =>
                                                    [c.courseCode, c.subject, c.type, c.facultyName, c.batch, c.department]
                                                        .some(v => String(v || '').toLowerCase().includes(dashSearch.toLowerCase()))
                                                );
                                                return filtered.length === 0 ? (
                                                    <div className="text-center py-16 text-gray-400">
                                                        <p className="font-medium">No courses found</p>
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Code</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Faculty</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Batch</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Credits</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filtered.map((c, i) => (
                                                                <tr key={c._id} className="border-t border-gray-50 hover:bg-teal-50/40 transition">
                                                                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-teal-700 text-xs">{c.courseCode}</td>
                                                                    <td className="px-4 py-3 font-semibold text-gray-800">{c.subject}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.type === 'Elective' ? 'bg-pink-100 text-pink-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {c.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-600">{c.facultyName}</td>
                                                                    <td className="px-4 py-3 text-gray-600">{c.batch}</td>
                                                                    <td className="px-4 py-3 font-semibold text-center">{c.credits}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Default overview when no drill-down selected */}
                                {!dashView && (
                                    <div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Bar: Students by Batch */}
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                                                     <span>Students by Batch</span>
                                                    <span className="ml-auto text-xs text-gray-400 font-normal">All {batches.length} batches</span>
                                                </h3>
                                                {batches.length === 0 ? (
                                                    <p className="text-gray-400 text-sm text-center py-4">No batches yet</p>
                                                ) : (() => {
                                                    const batchCounts = batches.map(b => {
                                                        const bName = b.name || b.batchId || '';
                                                        return {
                                                            batch: bName.length > 14 ? bName.substring(0, 14) + '..' : bName,
                                                            count: studentsList.filter(s => s.batch === bName || s.batch === b.batchId).length
                                                        };
                                                    }).sort((a, b) => b.count - a.count);
                                                    const barH = Math.max(22, Math.min(28, 500 / batchCounts.length));
                                                    return (
                                                        <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
                                                            <ResponsiveContainer width="100%" height={batchCounts.length * barH + 20}>
                                                                <BarChart data={batchCounts} layout="vertical" margin={{ top: 2, right: 20, left: 0, bottom: 2 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                                    <XAxis type="number" tick={{ fontSize: 9 }} />
                                                                    <YAxis type="category" dataKey="batch" width={100} tick={{ fontSize: 8 }} interval={0} />
                                                                    <Tooltip />
                                                                    <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Line: Academic Year Distribution */}
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                                                     <span>Academic Year</span>
                                                    <span className="ml-auto text-xs text-gray-400 font-normal">Student distribution</span>
                                                </h3>
                                                {academicYears.length === 0 ? (
                                                    <p className="text-gray-400 text-sm text-center py-4">No data yet</p>
                                                ) : (() => {
                                                    const yearData = academicYears.map(y => ({
                                                        year: y,
                                                        count: studentsList.filter(s => s.academicYear === y).length
                                                    }));
                                                    return (
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <LineChart data={yearData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                                                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                                                                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }} />
                                                                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={3} activeDot={{ r: 8 }} dot={{ stroke: '#f59e0b', strokeWidth: 2, r: 4, fill: '#fff' }} name="Students" />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Full-width Analytics Row */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {/* Area: Branch Distribution */}
                                            {branchCounts.length > 0 && (
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                    <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                                        Students by Branch
                                                    </h3>
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <AreaChart data={branchCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id="colorBranch" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                            <XAxis dataKey="branch" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                                                            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }} />
                                                            <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBranch)" name="Students" />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}

                                            {/* Bar: Faculty by Department */}
                                            {facultyList.length > 0 && (() => {
                                                const deptCounts = [...new Set(facultyList.map(f => f.department).filter(Boolean))].map(d => ({
                                                    department: d,
                                                    count: facultyList.filter(f => f.department === d).length
                                                })).sort((a, b) => b.count - a.count);
                                                return (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                                        <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                            Faculty by Department
                                                        </h3>
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <BarChart data={deptCounts} layout="vertical" margin={{ left: 0, right: 30, top: 5, bottom: 5 }}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                                                <YAxis type="category" dataKey="department" width={110} tick={{ fontSize: 12 }} />
                                                                <Tooltip />
                                                                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 12, fontWeight: 'bold', fill: '#374151' }} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}


                            </div>
                        </div>
                    </div>
                );
            })()}

            {viewMode === 'manageData' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-800">Manage Data</h2>
                    <div className="flex gap-3 flex-wrap mb-2">
                        {[
                            { id: 'faculty', label: '‍ Faculty', count: facultyList.length },
                            { id: 'rooms', label: ' Rooms', count: rooms.length },
                            { id: 'batches', label: ' Batches', count: batches.length },
                            { id: 'courses', label: ' Courses', count: courses.length },
                        ].map(t => (
                            <button key={t.id} onClick={() => setDataTab(t.id)}
                                className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${dataTab === t.id ? 'bg-purple-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {t.label} <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-white/30">{t.count}</span>
                            </button>
                        ))}
                    </div>

                    {dataTab === 'faculty' && (() => {
                        const filtered = facultyList.filter(f =>
                            [f.facultyId, f.name, f.department, f.email]
                                .some(v => String(v || '').toLowerCase().includes(facSearch.toLowerCase()))
                        );
                        return (
                            <div className="bg-white rounded-xl shadow p-5">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                                    <h3 className="font-bold text-lg text-gray-700">
                                        Faculty <span className="text-sm font-normal text-gray-400">({filtered.length}/{facultyList.length})</span>
                                    </h3>
                                    <div className="flex gap-3 items-center flex-wrap">
                                        <input type="text" placeholder=" Search by name, ID, dept, email..."
                                            value={facSearch} onChange={e => setFacSearch(e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                        {selectedItems.length > 0 && (
                                            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-sm transition-all animate-in fade-in slide-in-from-right-2"> Delete Selected ({selectedItems.length})</button>
                                        )}
                                        <button onClick={() => openAddModal('faculty')} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">+ Add Faculty</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                        <colgroup>
                                            <col style={{ width: '40px' }} />
                                            <col style={{ width: '140px' }} />
                                            <col style={{ width: '200px' }} />
                                            <col style={{ width: '140px' }} />
                                            <col />
                                            <col style={{ width: '140px' }} />
                                        </colgroup>
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-700">
                                                <th className="px-3 py-2 text-center border-b border-gray-200">
                                                    <input type="checkbox" checked={selectedItems.length === filtered.length && filtered.length > 0} onChange={() => handleSelectAll(filtered)} className="accent-purple-600 cursor-pointer w-4 h-4" />
                                                </th>
                                                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Faculty ID</th>
                                                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Name</th>
                                                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Department</th>
                                                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Email</th>
                                                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan={6} className="text-center py-10 text-gray-400">{facSearch ? 'No matching faculty found.' : 'No faculty records found.'}</td></tr>
                                            ) : filtered.map(f => (
                                                <tr key={f._id} className={`border-b border-gray-100 hover:bg-purple-50 transition ${selectedItems.includes(f._id) ? 'bg-purple-50' : ''}`}>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <input type="checkbox" checked={selectedItems.includes(f._id)} onChange={() => handleSelectItem(f._id)} className="accent-purple-600 cursor-pointer w-4 h-4" />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 font-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.facultyId}>{f.facultyId || '—'}</td>
                                                    <td className="px-3 py-2.5 font-semibold text-gray-800" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name || '—'}</td>
                                                    <td className="px-3 py-2.5 text-gray-600" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.department}>{f.department || '—'}</td>
                                                    <td className="px-3 py-2.5 text-gray-600" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.email}>{f.email || '—'}</td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => openEditModal('faculty', f)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold border border-blue-200"> Edit</button>
                                                            <button onClick={() => handleCrudDelete('faculty', f)} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-semibold border border-red-200"></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}


                    {dataTab === 'rooms' && (() => {
                        const filtered = rooms.filter(r =>
                            [r.roomId, r.name, r.type, String(r.capacity || ''), r.sessionYear]
                                .some(v => String(v || '').toLowerCase().includes(roomSearch.toLowerCase()))
                        );
                        return (
                            <div className="bg-white rounded-xl shadow p-5">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                                    <h3 className="font-bold text-lg text-gray-700">
                                        Rooms <span className="text-sm font-normal text-gray-400">({filtered.length}/{rooms.length})</span>
                                    </h3>
                                    <div className="flex gap-3 items-center flex-wrap">
                                        <input type="text" placeholder=" Search by name, ID, type..."
                                            value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                        {selectedItems.length > 0 && (
                                            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-sm"> Delete Selected ({selectedItems.length})</button>
                                        )}
                                        <button onClick={() => openAddModal('rooms')} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">+ Add Room</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead><tr className="bg-gray-100">
                                            <th className="px-3 py-2 text-left border-b border-gray-200 w-10">
                                                <input type="checkbox" checked={selectedItems.length === filtered.length && filtered.length > 0} onChange={() => handleSelectAll(filtered)} className="accent-purple-600 cursor-pointer" />
                                            </th>
                                            {['Room ID', 'Name', 'Type', 'Capacity', 'Session Year', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold border-b">{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{roomSearch ? 'No matching rooms found.' : 'No records.'}</td></tr>
                                                : filtered.map(r => (
                                                    <tr key={r._id} className={`border-b hover:bg-gray-50 ${selectedItems.includes(r._id) ? 'bg-purple-50' : ''}`}>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={selectedItems.includes(r._id)} onChange={() => handleSelectItem(r._id)} className="accent-purple-600 cursor-pointer" />
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-500 text-xs">{r.roomId}</td>
                                                        <td className="px-3 py-2 font-medium">{r.name}</td>
                                                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.type?.toLowerCase().includes('lab') ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{r.type}</span></td>
                                                        <td className="px-3 py-2 text-center">{r.capacity}</td>
                                                        <td className="px-3 py-2 text-gray-600">{r.sessionYear}</td>
                                                        <td className="px-3 py-2"><div className="flex gap-2">
                                                            <button onClick={() => openEditModal('rooms', r)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold border border-blue-200"> Edit</button>
                                                            <button onClick={() => handleCrudDelete('rooms', r)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-semibold border border-red-200"> Delete</button>
                                                        </div></td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {dataTab === 'batches' && (() => {
                        const filtered = batches.filter(b =>
                            [b.batchId, b.degree, b.yearLabel, b.department, String(b.semester || ''), b.session]
                                .some(v => String(v || '').toLowerCase().includes(batchSearch.toLowerCase()))
                        );
                        return (
                            <div className="bg-white rounded-xl shadow p-5">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                                    <h3 className="font-bold text-lg text-gray-700">
                                        Batches <span className="text-sm font-normal text-gray-400">({filtered.length}/{batches.length})</span>
                                    </h3>
                                    <div className="flex gap-3 items-center flex-wrap">
                                        <input type="text" placeholder=" Search by ID, degree, dept, session..."
                                            value={batchSearch} onChange={e => setBatchSearch(e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                        {selectedItems.length > 0 && (
                                            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-sm"> Delete Selected ({selectedItems.length})</button>
                                        )}
                                        <button onClick={() => openAddModal('batches')} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">+ Add Batch</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead><tr className="bg-gray-100">
                                            <th className="px-3 py-2 text-left border-b border-gray-200 w-10">
                                                <input type="checkbox" checked={selectedItems.length === filtered.length && filtered.length > 0} onChange={() => handleSelectAll(filtered)} className="accent-purple-600 cursor-pointer" />
                                            </th>
                                            {['Batch ID', 'Degree', 'Year', 'Department', 'Semester', 'Session', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold border-b">{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">{batchSearch ? 'No matching batches found.' : 'No records.'}</td></tr>
                                                : filtered.map(b => (
                                                    <tr key={b._id} className={`border-b hover:bg-gray-50 ${selectedItems.includes(b._id) ? 'bg-purple-50' : ''}`}>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={selectedItems.includes(b._id)} onChange={() => handleSelectItem(b._id)} className="accent-purple-600 cursor-pointer" />
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-500 text-xs">{b.batchId}</td>
                                                        <td className="px-3 py-2 font-medium">{b.degree}</td>
                                                        <td className="px-3 py-2 text-gray-600">{b.yearLabel}</td>
                                                        <td className="px-3 py-2 text-gray-600">{b.department}</td>
                                                        <td className="px-3 py-2 text-gray-600">{b.semester}</td>
                                                        <td className="px-3 py-2 text-gray-600">{b.session}</td>
                                                        <td className="px-3 py-2"><div className="flex gap-2">
                                                            <button onClick={() => openEditModal('batches', b)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold border border-blue-200"> Edit</button>
                                                            <button onClick={() => handleCrudDelete('batches', b)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-semibold border border-red-200"> Delete</button>
                                                        </div></td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {dataTab === 'courses' && (() => {
                        const filtered = courses.filter(c =>
                            [c.courseCode, c.subject, c.type, c.facultyName, c.batch, c.department]
                                .some(v => String(v || '').toLowerCase().includes(courseSearch.toLowerCase()))
                        );
                        return (
                            <div className="bg-white rounded-xl shadow p-5">
                                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                                    <h3 className="font-bold text-lg text-gray-700">
                                        Courses <span className="text-sm font-normal text-gray-400">({filtered.length}/{courses.length})</span>
                                    </h3>
                                    <div className="flex gap-3 items-center flex-wrap">
                                        <input type="text" placeholder=" Search by subject, code, faculty, batch..."
                                            value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                        {selectedItems.length > 0 && (
                                            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-sm"> Delete Selected ({selectedItems.length})</button>
                                        )}
                                        <button onClick={() => openAddModal('courses')} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">+ Add Course</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                        <thead><tr className="bg-gray-100">
                                            <th className="px-3 py-2 text-left border-b border-gray-200 w-10">
                                                <input type="checkbox" checked={selectedItems.length === filtered.length && filtered.length > 0} onChange={() => handleSelectAll(filtered)} className="accent-purple-600 cursor-pointer" />
                                            </th>
                                            {['Code', 'Subject', 'Type', 'Faculty', 'Batch', 'L/T/P', 'Credits', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold border-b">{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400">{courseSearch ? 'No matching courses found.' : 'No records.'}</td></tr>
                                                : filtered.map(c => (
                                                    <tr key={c._id} className={`border-b hover:bg-gray-50 ${selectedItems.includes(c._id) ? 'bg-purple-50' : ''}`}>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={selectedItems.includes(c._id)} onChange={() => handleSelectItem(c._id)} className="accent-purple-600 cursor-pointer" />
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-500 text-xs">{c.courseCode}</td>
                                                        <td className="px-3 py-2 font-medium max-w-[160px] truncate" title={c.subject}>{c.subject}</td>
                                                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.type === 'Elective' ? 'bg-pink-100 text-pink-700' : 'bg-green-100 text-green-700'}`}>{c.type}</span></td>
                                                        <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={c.facultyName}>{c.facultyName}</td>
                                                        <td className="px-3 py-2 text-gray-600">{c.batch}</td>
                                                        <td className="px-3 py-2 text-center">{c.courseL}/{c.courseT}/{c.courseP}</td>
                                                        <td className="px-3 py-2 text-center">{c.credits}</td>
                                                        <td className="px-3 py-2"><div className="flex gap-2">
                                                            <button onClick={() => openEditModal('courses', c)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-semibold border border-blue-200"> Edit</button>
                                                            <button onClick={() => handleCrudDelete('courses', c)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-semibold border border-red-200"> Delete</button>
                                                        </div></td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}


                </div>
            )}

            {viewMode === 'viewAll' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">All Generated Timetables <span className="text-gray-400 text-lg font-normal">({allTimetables.length})</span></h2>
                        {allTimetables.length > 0 && (
                            <button
                                onClick={handleDeleteAllTimetables}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition shadow-md flex items-center gap-2 text-sm"
                                title="Delete all timetables for this institution"
                            >
                                🗑️ Delete All ({allTimetables.length})
                            </button>
                        )}
                    </div>
                    {allTimetables.length === 0 ? (
                        <div className="bg-white p-12 rounded-xl shadow-lg text-center">
                            <span className="text-6xl mb-4 block"></span>
                            <p className="text-gray-500">No timetables generated yet. Create your first one!</p>
                        </div>
                    ) : (
                        allTimetables.map((tt) => (
                            <div key={tt._id} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{tt.batch}</h3>
                                        <span className="text-sm text-gray-500">
                                            Created: {tt.createdAt && !isNaN(new Date(tt.createdAt)) ? new Date(tt.createdAt).toLocaleString() : 'Just now'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRegenerateTimetable(tt)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-md flex items-center gap-2"
                                        >
                                            <span></span> Update
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTimetable(tt._id, tt.batch)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition shadow-md flex items-center gap-2"
                                        >
                                            <span></span> Delete
                                        </button>
                                    </div>
                                </div>
                                {renderTimetableTable(tt)}
                                <div className="mt-4 flex gap-4 text-sm flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-green-100 border-l-4 border-green-500"></div> Core Lecture
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-pink-100 border-l-4 border-pink-500"></div> Elective Lecture
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500"></div> Core Lab
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-purple-100 border-l-4 border-purple-500"></div> Elective Lab
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-orange-100 border-l-4 border-orange-500"></div> Training
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-500"></div> Lunch
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-gray-100 border border-gray-300"></div> Free
                                    </div>
                                    <div className="flex items-center gap-2 font-bold text-gray-700 ml-auto bg-gray-100 px-3 py-1 rounded border border-gray-200">
                                        <span>Untaken Slots: {tt.schedule.reduce((acc, d) => acc + d.periods.filter(p => p.type === 'Free').length, 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}



            {viewMode === 'create' && (

                <div className="flex flex-col gap-6 w-full">
                    <div className="flex flex-col xl:flex-row items-start gap-4 w-full">
                        <div className="bg-white p-4 xl:p-6 rounded-xl shadow-lg border border-gray-100 flex-shrink-0 w-full xl:w-[450px] max-h-[calc(100vh-2rem)] overflow-y-auto z-10 sticky top-4 left-0">
                            <h2 className="text-xl font-bold mb-4 text-gray-700">Setup Configuration</h2>

                            {/* ══ BATCH SELECTION – Data-driven Hierarchical ══ */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5 flex-wrap">
                                     Select Batches
                                    {selectedBatches.length > 0 && (
                                        <span style={{ marginLeft: 'auto', fontSize: 11, background: '#2563eb', color: 'white', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>
                                            {selectedBatches.length} selected
                                        </span>
                                    )}
                                </label>

                                {(() => {
                                    // computedYear is always populated by the enriched /batches API
                                    // (falls back to semester-based year: Sem1-2=1st Year, etc.)
                                    const YEAR_ORDER = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+'];
                                    const uniqueYears = [...new Set(batches.map(b => b.computedYear || '').filter(Boolean))]
                                        .sort((a, b) => {
                                            const ai = YEAR_ORDER.indexOf(a);
                                            const bi = YEAR_ORDER.indexOf(b);
                                            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                                        });

                                    // Batches for the selected year
                                    const batchesForYear = batchFilterYear
                                        ? batches.filter(b => (b.computedYear || '') === batchFilterYear)
                                        : [];

                                    // Semesters available within that year
                                    const uniqueSems = [...new Set(
                                        batchesForYear.map(b => String(b.semester || '')).filter(Boolean)
                                    )].sort((a, b) => Number(a) - Number(b));

                                    // Final list after all filters
                                    const filteredBatches = batchesForYear.filter(b =>
                                        (!batchFilterSem || String(b.semester) === batchFilterSem) &&
                                        (b.name || b.batchId || '').toLowerCase().includes(batchStepSearch.toLowerCase())
                                    );

                                    return (
                                        <>
                                            {/* ── STEP 1: Year ── */}
                                            <div style={{ marginBottom: 12 }}>
                                                <p style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                                    Step 1 — Select Year
                                                </p>
                                                {uniqueYears.length === 0 ? (
                                                    <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading batches...</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {uniqueYears.map(yr => {
                                                            const cnt = batches.filter(b => (b.computedYear || '') === yr).length;
                                                            const isActive = batchFilterYear === yr;
                                                            return (
                                                                <button key={yr}
                                                                    onClick={() => { setBatchFilterYear(isActive ? '' : yr); setBatchFilterSem(''); }}
                                                                    style={{
                                                                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                                                        border: `2px solid ${isActive ? '#4f46e5' : '#e5e7eb'}`,
                                                                        background: isActive ? '#4f46e5' : '#f9fafb',
                                                                        color: isActive ? 'white' : '#374151',
                                                                        cursor: 'pointer', transition: 'all 0.15s',
                                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                                        boxShadow: isActive ? '0 2px 8px rgba(79,70,229,0.3)' : 'none'
                                                                    }}>
                                                                    {yr}
                                                                    <span style={{
                                                                        background: isActive ? 'rgba(255,255,255,0.3)' : '#e5e7eb',
                                                                        borderRadius: 10, padding: '1px 6px',
                                                                        fontSize: 10, fontWeight: 700,
                                                                        color: isActive ? 'white' : '#6b7280'
                                                                    }}>{cnt}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {!batchFilterYear && uniqueYears.length > 0 && (
                                                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>↑ Click a year to proceed</p>
                                                )}
                                            </div>

                                            {/* ── STEP 2: Semester ── */}
                                            {batchFilterYear && (
                                                <div style={{ marginBottom: 12 }}>
                                                    <p style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                                        Step 2 — Select Semester
                                                    </p>
                                                    {uniqueSems.length === 0 ? (
                                                        <p style={{ fontSize: 12, color: '#9ca3af' }}>No semesters found for this year.</p>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {uniqueSems.map(s => {
                                                                const cnt = batchesForYear.filter(b => String(b.semester) === s).length;
                                                                const isActive = batchFilterSem === s;
                                                                return (
                                                                    <button key={s}
                                                                        onClick={() => setBatchFilterSem(isActive ? '' : s)}
                                                                        style={{
                                                                            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                                                            border: `2px solid ${isActive ? '#7c3aed' : '#e5e7eb'}`,
                                                                            background: isActive ? '#7c3aed' : '#f9fafb',
                                                                            color: isActive ? 'white' : '#374151',
                                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                                            display: 'flex', alignItems: 'center', gap: 5,
                                                                            boxShadow: isActive ? '0 2px 8px rgba(124,58,237,0.3)' : 'none'
                                                                        }}>
                                                                        Sem {s}
                                                                        <span style={{
                                                                            background: isActive ? 'rgba(255,255,255,0.3)' : '#e5e7eb',
                                                                            borderRadius: 10, padding: '1px 6px',
                                                                            fontSize: 10, fontWeight: 700,
                                                                            color: isActive ? 'white' : '#6b7280'
                                                                        }}>{cnt}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── STEP 3: Pick Batches ── */}
                                            {batchFilterYear && batchFilterSem && (
                                                <div style={{ marginBottom: 10 }}>
                                                    <p style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                                        Step 3 — Select Batches
                                                    </p>
                                                    <input type="text"
                                                        placeholder=" Search batch..."
                                                        value={batchStepSearch}
                                                        onChange={e => setBatchStepSearch(e.target.value)}
                                                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 12, marginBottom: 6, boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                    <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 6, maxHeight: 200, overflowY: 'auto' }}>
                                                        {filteredBatches.length === 0 ? (
                                                            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '14px 0' }}>
                                                                No batches found for {batchFilterYear} Sem {batchFilterSem}
                                                            </p>
                                                        ) : filteredBatches.map(b => {
                                                            const isChecked = selectedBatches.some(x => x._id === b._id);
                                                            return (
                                                                <label key={b._id} style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px',
                                                                    borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                                                                    background: isChecked ? '#eff6ff' : 'white',
                                                                    border: `1.5px solid ${isChecked ? '#93c5fd' : 'transparent'}`,
                                                                    transition: 'all 0.12s'
                                                                }}>
                                                                    <input type="checkbox" checked={isChecked}
                                                                        style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                                                                        onChange={() => {
                                                                            const next = isChecked
                                                                                ? selectedBatches.filter(x => x._id !== b._id)
                                                                                : [...selectedBatches, b];
                                                                            setSelectedBatches(next);
                                                                            if (next.length > 0) handleBatchSelect(next[0]._id);
                                                                            else handleBatchSelect('');
                                                                        }}
                                                                    />
                                                                    <span style={{ flex: 1 }}>
                                                                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{b.name || b.batchId}</span>
                                                                        {b.department && (
                                                                            <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                                                                                {b.department}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    {isChecked && (
                                                                        <span style={{ color: '#2563eb', fontSize: 16, fontWeight: 700 }}></span>
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                    {filteredBatches.length > 1 && (
                                                        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                                                            <button onClick={() => {
                                                                const toAdd = filteredBatches.filter(b => !selectedBatches.some(x => x._id === b._id));
                                                                const next = [...selectedBatches, ...toAdd];
                                                                setSelectedBatches(next);
                                                                if (next.length > 0) handleBatchSelect(next[0]._id);
                                                            }} style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                                                 Select all ({filteredBatches.length})
                                                            </button>
                                                            <span style={{ color: '#d1d5db' }}>|</span>
                                                            <button onClick={() => {
                                                                const ids = new Set(filteredBatches.map(b => b._id));
                                                                const next = selectedBatches.filter(x => !ids.has(x._id));
                                                                setSelectedBatches(next);
                                                                if (next.length > 0) handleBatchSelect(next[0]._id);
                                                                else handleBatchSelect('');
                                                            }} style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                                                 Clear all
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Selected Chips ── */}
                                            {selectedBatches.length > 0 && (
                                                <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
                                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                                                         {selectedBatches.length} Batch{selectedBatches.length > 1 ? 'es' : ''} Selected:
                                                    </p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                                        {selectedBatches.map(b => (
                                                            <span key={b._id} style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                color: '#1d4ed8', fontSize: 11, fontWeight: 700,
                                                                padding: '4px 10px 4px 8px', borderRadius: 20, border: `1.5px solid ${selectedBatch?._id === b._id ? '#1e3a8a' : '#93c5fd'}`, cursor: 'pointer', background: selectedBatch?._id === b._id ? '#bfdbfe' : '#dbeafe'
                                                            }}>
                                                                <span onClick={() => handleBatchSelect(b._id)}> {b.name || b.batchId}</span>
                                                                <button onClick={() => {
                                                                    const next = selectedBatches.filter(x => x._id !== b._id);
                                                                    setSelectedBatches(next);
                                                                    if (next.length > 0) handleBatchSelect(next[0]._id);
                                                                    else handleBatchSelect('');
                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#60a5fa', fontWeight: 700, padding: 0, lineHeight: 1, marginLeft: 2 }}>
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Global Room Selection */}
                            <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5 flex-wrap">
                                     Select Rooms & Labs (Global)
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase">Lectures: ({selectedLectureRooms.length})</h4>
                                        <input className="w-full text-xs px-2 py-1 mt-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
                                            placeholder="Search lectures..." onChange={(e) => setLectureRoomSearchTerm(e.target.value)} />
                                        <div className="bg-white border border-gray-200 mt-1 p-1 h-36 overflow-y-auto overflow-x-hidden rounded-md shadow-inner text-xs space-y-1">
                                            {rooms.filter(isLectureRoom).filter(r => r.name.toLowerCase().includes(lectureRoomSearchTerm.toLowerCase())).map(r => (
                                                <label key={r._id} className="flex gap-2 items-center hover:bg-gray-50 p-1 rounded cursor-pointer transition whitespace-nowrap min-w-0">
                                                    <input type="checkbox" checked={selectedLectureRooms.includes(r.name)} onChange={() => handleRoomToggle(r.name, 'Lecture')} className="text-green-600 rounded flex-shrink-0" />
                                                    <span className="font-medium text-gray-700 truncate flex-1 flex items-center justify-between min-w-0">
                                                        <span className="truncate">{r.name}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1 flex-shrink-0 font-normal">({r.capacity})</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase">Labs: ({selectedLabRooms.length})</h4>
                                        <input className="w-full text-xs px-2 py-1 mt-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                            placeholder="Search labs..." onChange={(e) => setLabRoomSearchTerm(e.target.value)} />
                                        <div className="bg-white border border-gray-200 mt-1 p-1 h-36 overflow-y-auto overflow-x-hidden rounded-md shadow-inner text-xs space-y-1">
                                            {rooms.filter(isLabRoom).filter(r => r.name.toLowerCase().includes(labRoomSearchTerm.toLowerCase())).map(r => (
                                                <label key={r._id} className="flex gap-2 items-center hover:bg-gray-50 p-1 rounded cursor-pointer transition whitespace-nowrap min-w-0">
                                                    <input type="checkbox" checked={selectedLabRooms.includes(r.name)} onChange={() => handleRoomToggle(r.name, 'Lab')} className="text-blue-600 rounded flex-shrink-0" />
                                                    <span className="font-medium text-gray-700 truncate flex-1 flex items-center justify-between min-w-0">
                                                        <span className="truncate">{r.name}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1 flex-shrink-0 font-normal">({r.capacity})</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Multi-batch summary before generate */}
                            {selectedBatches.length > 0 && (
                                <>
                                    {/* HOD Block Time Slots UI */}
                                    {role === 'superAdmin' && (
                                        <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-200">
                                            <h3 className="text-sm font-bold text-red-800 mb-2"> Block Time Slots (Optional)</h3>
                                            <p className="text-xs text-red-600 mb-3">Click on any slot to toggle blocking it. No classes will be generated in blocked slots for the selected batch.</p>

                                            <div className="flex flex-col gap-3">
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {selectedBatches.map(b => (
                                                        <button
                                                            key={b._id}
                                                            onClick={() => setBlockBatchId(b._id)}
                                                            className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${(blockBatchId && selectedBatches.some(sb => sb._id === blockBatchId) ? blockBatchId : selectedBatches[0]._id) === b._id ? 'bg-red-600 text-white shadow-md' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                        >
                                                             {b.name || b.batchId}
                                                        </button>
                                                    ))}
                                                </div>

                                                {(() => {
                                                    const activeBlockBatchId = blockBatchId && selectedBatches.some(sb => sb._id === blockBatchId) ? blockBatchId : selectedBatches[0]._id;
                                                    return activeBlockBatchId && (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full border-collapse border border-red-200 bg-white text-xs">
                                                                <thead>
                                                                    <tr>
                                                                        <th className="p-2 border border-red-200 bg-red-100/50 text-red-900 font-bold w-32">Time / Day</th>
                                                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                                                                            <th key={d} className="p-2 border border-red-200 bg-red-100/50 text-red-900 font-bold w-24 text-center">{d}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {PERIODS.map(p => (
                                                                        <tr key={p.id}>
                                                                            <td className="p-2 border border-red-200 bg-red-50 font-semibold text-center text-gray-700">{p.label}</td>
                                                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => {
                                                                                const slotKey = `${d}#${p.id}`;
                                                                                const isBlocked = blockedSlots[activeBlockBatchId]?.includes(slotKey);
                                                                                return (
                                                                                    <td
                                                                                        key={d}
                                                                                        onClick={() => {
                                                                                            setBlockedSlots(prev => {
                                                                                                const next = { ...prev };
                                                                                                const batchArr = next[activeBlockBatchId] || [];
                                                                                                if (batchArr.includes(slotKey)) {
                                                                                                    next[activeBlockBatchId] = batchArr.filter(x => x !== slotKey);
                                                                                                } else {
                                                                                                    next[activeBlockBatchId] = [...batchArr, slotKey];
                                                                                                }
                                                                                                return next;
                                                                                            });
                                                                                        }}
                                                                                        className={`p-2 border border-red-200 cursor-pointer text-center text-lg transition-colors ${isBlocked ? 'bg-red-500 text-white shadow-inner font-bold' : 'hover:bg-red-50 text-gray-300'}`}
                                                                                    >
                                                                                        {isBlocked ? '' : '•'}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={generateTimetable}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-lg transition shadow-md disabled:bg-gray-400 flex items-center justify-center gap-2 mb-4 mt-6"
                                    >
                                        {loading ? (
                                            <><span className="animate-spin"></span> Generating...</>
                                        ) : selectedBatches.length > 1 ? (
                                            <> Generate {selectedBatches.length} Timetables</>
                                        ) : (
                                            <> Generate Timetable</>
                                        )}
                                    </button>
                                    {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}
                                </>
                            )}
                        </div>

                        {selectedBatches.length > 0 && (
                            <div className="flex overflow-x-auto overflow-y-hidden gap-4 py-2 px-1 pb-4 flex-1 w-full" style={{ minHeight: '600px', scrollbarColor: '#c7d2fe transparent', scrollbarWidth: 'thin' }}>
                                <BatchConfigColumn
                                    key="COMMON"
                                    selectedBatches={selectedBatches}
                                    batch={selectedBatches[0]}
                                    title={`Common Subjects (${selectedBatches.length} Batches)`}
                                    allSubjects={allSubjects}
                                    rooms={rooms}
                                    courses={courses}
                                    batches={batches}
                                    maxWeeklyHours={maxWeeklyHours}
                                    initialConfig={batchConfigsRef.current['COMMON'] || {}}
                                    onConfigUpdate={(batchId, config) => {
                                        batchConfigsRef.current['COMMON'] = config;
                                    }}
                                    onGenerateSingle={null}
                                />
                            </div>
                        )}

                    </div>


                    <div className="w-full bg-white p-6 rounded-xl shadow-lg border border-gray-100 min-h-[600px] overflow-x-auto mt-6">
                        <div className="mb-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-700">Generated Timetable</h2>
                            <button className="text-sm text-blue-500 hover:underline" onClick={() => window.print()}>Print / Save PDF</button>
                        </div>                    {(!timetable && multiTimetables.length === 0) ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <span className="text-6xl mb-4"></span>
                                <p>Configure and generate to view timetable</p>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                {(multiTimetables.length > 0) ? (
                                    multiTimetables.map((tt, idx) => (
                                        <div key={idx} className="bg-gray-50 p-4 rounded-xl shadow-sm border border-gray-100">
                                            <h3 className="text-lg font-bold text-indigo-700 mb-4 border-b pb-2">Timetable – {tt.batch || tt.batchId}</h3>
                                            {renderTimetableTable(tt)}
                                        </div>
                                    ))
                                ) : (
                                    timetable && renderTimetableTable(timetable)
                                )}

                                <div className="mt-4 flex gap-4 text-sm flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-green-100 border-l-4 border-green-500"></div> Core Lecture
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-pink-100 border-l-4 border-pink-500"></div> Elective
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500"></div> Lab
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-orange-100 border-l-4 border-orange-500"></div> Training
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-yellow-100 border-l-4 border-yellow-500"></div> Lunch
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-red-100 border-l-4 border-red-500"></div> Blocked
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-gray-100"></div> Free
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* Edit Period Modal */}
            {
                showEditModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                                {editForm.subject ? 'Edit Period' : 'Add Class to Empty Period'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Subject Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder=" Search subjects..."
                                        value={editModalSubjectSearch}
                                        onChange={(e) => setEditModalSubjectSearch(e.target.value)}
                                        className="w-full p-2 mb-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <select
                                        value={editForm.subject}
                                        onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">-- Select Subject --</option>
                                        {allSubjects
                                            .filter(s => s.name.toLowerCase().includes(editModalSubjectSearch.toLowerCase()))
                                            .map(s => (
                                                <option key={s._id || s.name} value={s.name}>{s.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Faculty Name <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={editForm.faculty}
                                        onChange={(e) => setEditForm({ ...editForm, faculty: e.target.value })}
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">-- Select Faculty --</option>
                                        {facultyList.map(f => {
                                            const isOccupied = occupiedFaculty.includes(f.name);
                                            return (
                                                <option key={f._id} value={f.name}>
                                                    {f.name} {isOccupied ? '  (Busy)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {occupiedFaculty.includes(editForm.faculty) && (
                                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700 font-semibold flex items-center gap-2">
                                            <span></span> Faculty Clash Warning: {editForm.faculty} is already teaching another class during this time slot!
                                        </div>
                                    )}
                                    {occupiedFaculty.length > 0 && !occupiedFaculty.includes(editForm.faculty) && (
                                        <p className="text-xs text-orange-600 mt-1">
                                            ℹ {occupiedFaculty.length} faculty already occupied in this period
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Room/Lab <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={editForm.room}
                                        onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">-- Select Room --</option>
                                        {rooms.map(r => {
                                            const isOccupied = occupiedRooms.includes(r.name);
                                            return (
                                                <option key={r._id} value={r.name}>
                                                    {r.name} ({r.type}) {isOccupied ? '  (Occupied)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {occupiedRooms.includes(editForm.room) && (
                                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-700 font-semibold flex items-center gap-2">
                                            <span></span> Room Conflict Warning: {editForm.room} is already booked for another class during this time slot!
                                        </div>
                                    )}
                                    {occupiedRooms.length > 0 && !occupiedRooms.includes(editForm.room) && (
                                        <p className="text-xs text-orange-600 mt-1">
                                            ℹ {occupiedRooms.length} room(s) already occupied in this period
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Class Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={editForm.type}
                                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="Lecture">Lecture</option>
                                        <option value="Lab">Lab</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleSavePeriod}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-md"
                                >
                                    Save
                                </button>
                                {editingPeriod && editingTimetable?.schedule[editingPeriod.dayIndex]?.periods[editingPeriod.periodIndex]?.type !== 'Free' && (
                                    <button
                                        onClick={handleDeletePeriod}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition shadow-md"
                                    >
                                        Delete
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingTimetable(null);
                                        setEditingPeriod(null);
                                    }}
                                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default AdminPortal;
