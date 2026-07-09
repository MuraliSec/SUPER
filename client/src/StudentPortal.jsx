import React, { useState, useEffect } from 'react';
import api from './api/axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function StudentPortal({ user, viewingAs }) {
    const [batches, setBatches] = useState([]);
    const [allTimetables, setAllTimetables] = useState([]);

    const [selectedDegree, setSelectedDegree] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');

    const [timetable, setTimetable] = useState(null);
    const [loading, setLoading] = useState(false);

    // Student self-service and admin preview
    const isLoggedInStudent = user && user.role === 'STUDENT';
    const isPreviewMode = viewingAs === 'student' && user?.role !== 'STUDENT';
    const isStudentMode = isLoggedInStudent || isPreviewMode;
    const [myProfile, setMyProfile] = useState(null);
    const [mySubjects, setMySubjects] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [previewStudents, setPreviewStudents] = useState([]);
    const [previewRollNumber, setPreviewRollNumber] = useState('');

    // Dashboard states
    const [dashboardData, setDashboardData] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardError, setDashboardError] = useState('');
    const [activeModal, setActiveModal] = useState(null); // 'courses', 'classes', 'present', 'absent' or null
    const [dashSearch, setDashSearch] = useState('');

    const normalizeSubjectValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const hasStudentSubjectFilter = React.useMemo(() => {
        return Array.isArray(mySubjects) && mySubjects.some(subject =>
            normalizeSubjectValue(subject.subjectName) ||
            normalizeSubjectValue(subject.subjectCode) ||
            subject.subjectId
        );
    }, [mySubjects]);

    const subjectMatchesPeriod = (subject, periodData) => {
        const selectedName = normalizeSubjectValue(subject.subjectName);
        const selectedCode = normalizeSubjectValue(subject.subjectCode);
        const periodName = normalizeSubjectValue(periodData.subject);
        const periodCode = normalizeSubjectValue(periodData.subjectCode);

        return (
            (selectedName && periodName && selectedName === periodName) ||
            (selectedCode && periodCode && selectedCode === periodCode) ||
            (subject.subjectId && periodData.subjectId && subject.subjectId === periodData.subjectId)
        );
    };

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

    const years = [1, 2, 3, 4];

    const [searchTerm, setSearchTerm] = useState('');

    const degrees = React.useMemo(() => {
        if (!batches || batches.length === 0) return [];
        const unique = [...new Set(batches.flatMap(b => {
            const terms = [];
            if (b.degree) terms.push(String(b.degree).trim());
            if (b.department) terms.push(String(b.department).trim());
            if (b.branch) terms.push(String(b.branch).trim());
            return terms;
        }).filter(Boolean))].sort();
        return unique;
    }, [batches]);

    const hasDegreeMetadata = React.useMemo(() => degrees.length > 0, [degrees]);

    const parseSemesterNumber = (semester) => {
        if (semester === null || semester === undefined) return null;
        const raw = String(semester).trim().toUpperCase();
        const romanMap = {
            I: 1, II: 2, III: 3, IV: 4,
            V: 5, VI: 6, VII: 7, VIII: 8,
        };
        if (romanMap[raw]) return romanMap[raw];
        const numeric = Number.parseInt(raw, 10);
        return Number.isFinite(numeric) ? numeric : null;
    };

    const getBatchYearNumber = (batch) => {
        const numericYearCandidates = [batch?.yearNumber, batch?.year];
        for (const candidate of numericYearCandidates) {
            const parsed = Number.parseInt(candidate, 10);
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) return parsed;
        }

        const text = [
            batch?.computedYear,
            batch?.yearLabel,
            batch?.name,
            batch?.batchId,
        ].map(v => String(v || '').toLowerCase()).join(' ');

        if (/(^|\s)(first|1st|year\s*1|1\s*year)(\s|$)/.test(text)) return 1;
        if (/(^|\s)(second|2nd|year\s*2|2\s*year)(\s|$)/.test(text)) return 2;
        if (/(^|\s)(third|3rd|year\s*3|3\s*year)(\s|$)/.test(text)) return 3;
        if (/(^|\s)(fourth|4th|year\s*4|4\s*year)(\s|$)/.test(text)) return 4;

        const semesterNumber = parseSemesterNumber(batch?.semester);
        if (semesterNumber && semesterNumber > 0) return Math.ceil(semesterNumber / 2);
        return null;
    };

    const filteredBatches = React.useMemo(() => {
        if (!batches || batches.length === 0) return [];

        let filtered = [...batches];

        if (selectedDegree && hasDegreeMetadata) {
            const d = String(selectedDegree).toLowerCase().replace(/[-\s]/g, "");
            filtered = filtered.filter(b => {
                const dep = String(b.department || "").toLowerCase().replace(/[-\s]/g, "");
                const deg = String(b.degree || "").toLowerCase().replace(/[-\s]/g, "");
                const bra = String(b.branch || "").toLowerCase().replace(/[-\s]/g, "");
                const nam = String(b.name || "").toLowerCase().replace(/[-\s]/g, "");
                const bid = String(b.batchId || "").toLowerCase().replace(/[-\s]/g, "");
                return dep.includes(d) || deg.includes(d) || bra.includes(d) || nam.includes(d) || bid.includes(d);
            });
        }

        if (selectedYear) {
            const selYearNum = parseInt(selectedYear);
            if (!isNaN(selYearNum)) {
                filtered = filtered.filter(b => getBatchYearNumber(b) === selYearNum);
            }
        }

        if (searchTerm) {
            const s = String(searchTerm).toLowerCase().trim();
            filtered = filtered.filter(b =>
                String(b.name || "").toLowerCase().includes(s)
            );
        }

        // Deduplicate batches by name to prevent duplicate options in the dropdown
        const uniqueFiltered = [];
        const seenNames = new Set();
        for (const b of filtered) {
            const trimmedName = String(b.name || '').trim();
            if (trimmedName && !seenNames.has(trimmedName)) {
                seenNames.add(trimmedName);
                uniqueFiltered.push(b);
            }
        }

        return uniqueFiltered;
    }, [batches, selectedDegree, selectedYear, searchTerm, hasDegreeMetadata]);

    useEffect(() => {
        fetchBatches();
        fetchAllTimetables();
        if (isLoggedInStudent) {
            fetchMyProfile(user.username);
        } else if (isPreviewMode) {
            fetchPreviewStudents();
        }
    }, [isLoggedInStudent, isPreviewMode, user.username]);

    useEffect(() => {
        if (isPreviewMode && previewRollNumber) {
            fetchMyProfile(previewRollNumber);
        }
    }, [isPreviewMode, previewRollNumber]);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/batches');
            setBatches(res.data);
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

    const fetchPreviewStudents = async () => {
        try {
            const res = await api.get('/students');
            const students = res.data || [];
            setPreviewStudents(students);
            if (students.length > 0) {
                setPreviewRollNumber(students[0].rollNumber);
            } else {
                setDashboardData(null);
            }
        } catch (err) {
            console.error('Could not load students for preview:', err);
            setDashboardError(err.response?.data?.error || 'Failed to load student profiles.');
        }
    };

    const fetchMyProfile = async (username = user.username) => {
        if (!username) return;
        try {
            const res = await api.get('/students/me', {
                params: { username },
                headers: { 'x-username': username }
            });
            setMyProfile(res.data);
            setMySubjects(res.data.subjects || []);
        } catch (err) { console.error('Could not load student profile:', err); }
    };

    const fetchDashboardData = async (username = user.username) => {
        if (!username) return;
        setDashboardLoading(true);
        setDashboardError('');
        try {
            const res = await api.get('/students/my-attendance', {
                params: { username },
                headers: { 'x-username': username }
            });
            setDashboardData(res.data);
            if (res.data.student) {
                setMyProfile(res.data.student);
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setDashboardError(err.response?.data?.error || 'Failed to load dashboard data');
        } finally {
            setDashboardLoading(false);
        }
    };

    useEffect(() => {
        const username = isPreviewMode ? previewRollNumber : user.username;
        if (isStudentMode && activeTab === 'dashboard' && username) {
            fetchDashboardData(username);
        }
    }, [activeTab, isStudentMode, isPreviewMode, previewRollNumber, user.username]);

    const handleSearch = () => {
        if (!selectedBatch) {
            alert('Please select a batch from the dropdown');
            return;
        }

        setLoading(true);

        // Find timetable for selected batch
        const foundTimetable = allTimetables.find(tt => tt.batch === selectedBatch);

        if (foundTimetable) {
            setTimetable(foundTimetable);
        } else {
            alert('No timetable found for this batch. Please contact admin.');
            setTimetable(null);
        }

        setLoading(false);
    };

    const getCellStyle = (period) => {
        if (period.type === 'Lunch') return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 flex items-center justify-center font-bold tracking-wider';
        if (period.type === 'Free') return 'bg-gray-100 text-gray-400';

        if (period.type === 'Lab') {
            if (period.subjectType === 'Elective') {
                return 'bg-purple-100 text-purple-800 border-l-4 border-purple-500';
            }
            if (period.subjectType === 'Training' || period.type === 'Training') {
                return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
            }
            return 'bg-blue-100 text-blue-800 border-l-4 border-blue-500';
        }

        if (period.type === 'Training' || period.subjectType === 'Training') {
            return 'bg-orange-100 text-orange-800 border-l-4 border-orange-500';
        }

        // Differentiate Core vs Elective
        if (period.subjectType === 'Elective') {
            return 'bg-pink-100 text-pink-800 border-l-4 border-pink-500';
        }
        // Default to Core (Green)
        return 'bg-green-100 text-green-800 border-l-4 border-green-500';
    };

    const getFilteredPeriodData = (periodData) => {
        if (!periodData) return null;
        if (!isStudentMode) return periodData;
        if (periodData.type === 'Lunch' || periodData.type === 'Free') return periodData;
        if (!hasStudentSubjectFilter) return periodData;

        // If it's an elective
        if (periodData.isElective) {
            if (!Array.isArray(periodData.electiveAllocations)) {
                return { ...periodData, type: 'Free' };
            }
            // Filter electiveAllocations based on mySubjects
            const filteredAllocations = periodData.electiveAllocations.filter(alloc => {
                return mySubjects.some(s => 
                    (normalizeSubjectValue(s.subjectName) && normalizeSubjectValue(alloc.subject) && normalizeSubjectValue(s.subjectName) === normalizeSubjectValue(alloc.subject)) ||
                    (normalizeSubjectValue(s.subjectCode) && normalizeSubjectValue(alloc.subjectCode) && normalizeSubjectValue(s.subjectCode) === normalizeSubjectValue(alloc.subjectCode)) ||
                    (s.subjectId && alloc.subjectId && s.subjectId === alloc.subjectId)
                );
            });

            if (filteredAllocations.length === 0) {
                return { ...periodData, type: 'Free' };
            }
            return {
                ...periodData,
                electiveAllocations: filteredAllocations
            };
        }

        // Core periods belong to the selected batch and should remain visible.
        if (periodData.subjectType !== 'Elective') {
            return periodData;
        }

        const isSubjectMatched = mySubjects.some(s => subjectMatchesPeriod(s, periodData));
        if (!isSubjectMatched) {
            return { ...periodData, type: 'Free' };
        }

        return periodData;
    };

    const renderPeriodDetails = (periodData) => {
        if (periodData?.isElective && Array.isArray(periodData.electiveAllocations) && periodData.electiveAllocations.length > 0) {
            return (
                <div className="space-y-1">
                    {periodData.electiveAllocations.map((alloc, idx) => (
                        <div key={`${alloc.subject}-${idx}`} className="text-[11px] leading-tight bg-pink-50/70 border border-pink-200 rounded px-1.5 py-1">
                            <div className="font-semibold text-gray-800">
                                {alloc.subject} ({alloc.mode || 'L'}){alloc.subjectCode ? ` (${alloc.subjectCode})` : ''}
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

        return (
            <div className="space-y-0.5 font-medium">
                <div>Faculty: {periodData.faculty}</div>
                <div>Room: {periodData.room}</div>
                {periodData.batches && periodData.batches.length > 0 && (
                    <div className="text-[10px] text-indigo-700 bg-indigo-50/50 rounded px-1 border border-indigo-100/50 inline-block mt-1">
                        Batches: {periodData.batches.join(', ')}
                    </div>
                )}
            </div>
        );
    };

    const renderDashboardView = () => {
        if (dashboardLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                </div>
            );
        }

        if (isPreviewMode && previewStudents.length === 0) {
            return (
                <div className="bg-white border border-gray-200 text-gray-700 text-sm p-8 rounded-xl max-w-lg mx-auto text-center shadow-sm">
                    <p className="font-bold mb-1 text-base text-gray-800">No Student Profiles</p>
                    <p className="text-gray-500">There are no student profiles registered in this institution yet. Add student profiles to configure timetables and view dashboards.</p>
                </div>
            );
        }

        if (dashboardError) {
            return (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl max-w-lg mx-auto text-center shadow-sm">
                    <p className="font-bold mb-1"> Error Loading Dashboard</p>
                    <p>{dashboardError}</p>
                    <button 
                        onClick={() => fetchDashboardData(isPreviewMode ? previewRollNumber : user.username)} 
                        className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg font-semibold text-xs hover:bg-red-700 transition"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        if (!dashboardData) return null;

        const { student, overallAttendance, quickStats, courses: courseList, recentActivity } = dashboardData;

        // Progress bar color selector
        const getProgressBarColor = (percentage) => {
            if (percentage >= 75) return 'bg-green-500';
            if (percentage >= 60) return 'bg-yellow-500';
            return 'bg-red-500';
        };

        // Text color/bg for status badges
        const getBadgeStyle = (badgeText) => {
            if (badgeText.includes('Excellent') || badgeText.includes('')) return 'bg-green-100 text-green-800 border border-green-200';
            if (badgeText.includes('Good') || badgeText.includes('')) return 'bg-blue-100 text-blue-800 border border-blue-200';
            if (badgeText.includes('Safe') || badgeText.includes('')) return 'bg-teal-100 text-teal-800 border border-teal-200';
            if (badgeText.includes('Warning') || badgeText.includes('')) return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
            return 'bg-red-100 text-red-800 border border-red-200';
        };

        return (
            <div className="space-y-8">
                {/* Profile Header & Overall Attendance Card (Side by Side on desktop) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Header Card */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-150 p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                {student.profilePhoto ? (
                                    <img src={student.profilePhoto} alt="Student" className="w-12 h-12 rounded-full object-cover border border-indigo-200" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl">
                                        {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800">{student.name}</h2>
                                    <p className="text-gray-500 text-sm font-medium">Student Profile</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Roll Number</span>
                                    <span className="text-sm font-black text-gray-700">{student.rollNumber}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Batch</span>
                                    <span className="text-sm font-black text-gray-700">{student.batch || 'N/A'}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Branch / Department</span>
                                    <span className="text-sm font-black text-gray-700">{student.branch || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Overall Attendance Card */}
                    <div className="bg-white rounded-2xl shadow-md border border-gray-150 p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Overall Attendance</h3>
                            <div className="flex flex-col gap-1 mb-3">
                                <div className={`text-xl font-bold ${overallAttendance.percentage >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                                    Attended Units: <strong>{overallAttendance.attendedUnits || 0}</strong>
                                </div>
                                <div className={`text-xl font-bold ${overallAttendance.percentage >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                                    Conducted Units: <strong>{overallAttendance.conductedUnits || 0}</strong>
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 h-3 rounded-full mb-4">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(overallAttendance.percentage)}`}
                                    style={{ width: `${Math.min(100, overallAttendance.percentage)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 font-bold bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <span>Attended Units: {overallAttendance.attendedUnits || 0}</span>
                                <span>Conducted Units: {overallAttendance.conductedUnits || 0}</span>
                            </div>
                        </div>

                        {/* Overall Shortage Warning */}
                        {false && overallAttendance.attendanceShortage && overallAttendance.total > 0 && (
                            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex flex-col gap-1">
                                <span className="font-bold text-sm flex items-center gap-1.5">
                                     Attendance Shortage
                                </span>
                                <span className="text-xs font-semibold leading-relaxed">
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Stats KPI Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800">Quick Statistics</h3>
                        <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 flex items-center gap-1 select-none">
                             Click cards for detailed records
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div 
                            onClick={() => setActiveModal('courses')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transform transition-all duration-200 active:scale-95 select-none"
                        >
                            <span className="block text-xs font-bold text-gray-400 uppercase">Total Courses</span>
                            <span className="block text-3xl font-black text-indigo-700 mt-1">{quickStats.totalCourses}</span>
                        </div>
                        <div 
                            onClick={() => setActiveModal('classes')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transform transition-all duration-200 active:scale-95 select-none"
                        >
                            <span className="block text-xs font-bold text-gray-400 uppercase">Total Classes</span>
                            <span className="block text-3xl font-black text-gray-700 mt-1">{quickStats.totalClasses}</span>
                        </div>
                        <div 
                            onClick={() => setActiveModal('present')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transform transition-all duration-200 active:scale-95 select-none"
                        >
                            <span className="block text-xs font-bold text-gray-400 uppercase">Present Classes</span>
                            <span className="block text-3xl font-black text-green-600 mt-1">{quickStats.presentClasses}</span>
                        </div>
                        <div 
                            onClick={() => setActiveModal('absent')}
                            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-150 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transform transition-all duration-200 active:scale-95 select-none"
                        >
                            <span className="block text-xs font-bold text-gray-400 uppercase">Absent Classes</span>
                            <span className="block text-3xl font-black text-red-500 mt-1">{quickStats.absentClasses}</span>
                        </div>
                    </div>
                </div>

                {/* ── Charts & Analytics ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pie: Overall Attendance */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            Overall Attendance
                        </h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={[
                                    { name: 'Present', value: quickStats.presentClasses, color: '#10b981' },
                                    { name: 'Absent', value: quickStats.absentClasses, color: '#ef4444' }
                                ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45} paddingAngle={4}>
                                    {[
                                        { name: 'Present', value: quickStats.presentClasses, color: '#10b981' },
                                        { name: 'Absent', value: quickStats.absentClasses, color: '#ef4444' }
                                    ].filter(d => d.value > 0).map((d, i) => (
                                        <Cell key={i} fill={d.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-1 flex items-center justify-center gap-4 text-sm font-bold">
                            <span className="text-indigo-700">
                                Conducted Classes: <strong>{quickStats.totalClasses || 0}</strong>
                            </span>
                            <span className="text-green-600">
                                Attended Classes: <strong>{quickStats.presentClasses || 0}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Stacked Bar: Present vs Absent by Subject */}
                    {courseList.length > 0 && (() => {
                        const trendData = [...courseList].reverse().map(c => ({
                            name: (c.subjectName || '').length > 8 ? (c.subjectName || '').substring(0, 8) + '..' : (c.subjectName || ''),
                            present: c.presentClasses || 0,
                            absent: c.absentClasses || 0
                        }));
                        return (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                            <h3 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                Present vs Absent by Subject
                            </h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} stackOffset="sign">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    <Bar dataKey="present" stackId="a" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        );
                    })()}
                </div>

                {/* Course Attendance Grid (Horizontal Scrollable Carousel) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-800">Course Attendance</h3>
                        <input
                            type="text"
                            placeholder=" Search courses..."
                            value={dashSearch}
                            onChange={e => setDashSearch(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-56 outline-none focus:border-indigo-300"
                        />
                    </div>
                    {(() => {
                        const filteredList = dashSearch.trim()
                            ? courseList.filter(c =>
                                (c.subjectName || '').toLowerCase().includes(dashSearch.toLowerCase()) ||
                                (c.subjectCode || '').toLowerCase().includes(dashSearch.toLowerCase())
                              )
                            : courseList;
                        if (filteredList.length === 0) {
                            return (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
                                    <div className="text-5xl mb-2"></div>
                                    <p className="font-semibold text-sm">No courses match your search.</p>
                                    <p className="text-xs mt-1">Try a different search term.</p>
                                </div>
                            );
                        }
                        return (
                        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                            {filteredList.map((c, idx) => (
                                <div 
                                    key={idx} 
                                    className="min-w-[280px] max-w-[280px] bg-white rounded-2xl shadow-sm border border-gray-150 p-5 snap-start flex flex-col justify-between hover:shadow-md hover:border-indigo-100 transition duration-200"
                                >
                                    <div>
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-0.5">{c.subjectCode}</div>
                                        <h4 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2 h-10" title={c.subjectName}>
                                            {c.subjectName}
                                        </h4>
                                        
                                        {/* Status Badge */}
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-sm font-bold text-gray-700">Attended Units: {c.attendedUnits || 0}</span>
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getBadgeStyle(c.statusBadge)}`}>
                                                {c.statusBadge}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-gray-100 h-2 rounded-full mt-2.5 mb-3.5">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(c.attendancePercentage)}`}
                                                style={{ width: `${Math.min(100, c.attendancePercentage)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-gray-500 font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex justify-between">
                                            <span>Attended Units: <strong>{c.attendedUnits || 0}</strong></span>
                                            <span>Conducted Units: <strong>{c.conductedUnits || 0}</strong></span>
                                        </div>

                                        {/* Course Shortage Warning */}
                                        {false && c.attendanceShortage && c.totalClasses > 0 && (
                                            <div className="mt-3 bg-red-50 border border-red-100 text-red-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold">
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                    })()}
                </div>

                {/* Recent Attendance Activity Section */}
                <div className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-800">Recent Attendance Activity</h3>
                    {overallAttendance.total === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-8 text-center text-gray-400">
                            <div className="text-4xl mb-2"></div>
                            <p className="font-semibold text-sm">Attendance records are not available yet.</p>
                            <p className="text-xs mt-1">Once class attendance is marked by faculty, your logs will appear here.</p>
                        </div>
                    ) : recentActivity.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 text-center text-gray-400 font-semibold text-sm">
                            No attendance activity for today.
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-150 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            <th className="p-4 pl-6">Subject / Course</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4 pr-6">Session</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {recentActivity.map((act, index) => (
                                            <tr key={index} className="hover:bg-gray-50/50 transition">
                                                <td className="p-4 pl-6 font-bold text-gray-700">{act.subjectName}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                        act.status === 'Present' ? 'bg-green-100 text-green-800' :
                                                        act.status === 'Absent' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {act.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-500 font-medium">
                                                    {new Date(act.date).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 pr-6 text-gray-500 font-bold">{act.session || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* KPI Details Modal Dialog */}
                {activeModal && (() => {
                    let title = '';
                    let headers = [];
                    let rows = [];

                    const enrolledSubjects = dashboardData.courses || [];
                    const allActivity = dashboardData.allActivity || [];

                    if (activeModal === 'courses') {
                        title = 'Enrolled Courses Details';
                        headers = ['Course Code', 'Course Name', 'Attended / Conducted', 'Status'];
                        rows = enrolledSubjects.map(c => [
                            c.subjectCode || 'N/A',
                            c.subjectName,
                            `${c.presentClasses} / ${c.totalClasses} Classes`,
                            c.statusBadge
                        ]);
                    } else if (activeModal === 'classes') {
                        title = 'All Conducted Classes';
                        headers = ['Subject / Course', 'Date', 'Session', 'Status'];
                        rows = allActivity.map(act => [
                            act.subjectName,
                            new Date(act.date).toLocaleDateString(),
                            act.session || '—',
                            act.status
                        ]);
                    } else if (activeModal === 'present') {
                        title = 'Present Classes Details';
                        headers = ['Subject / Course', 'Date', 'Session', 'Status'];
                        rows = allActivity
                            .filter(act => act.status === 'Present')
                            .map(act => [
                                act.subjectName,
                                new Date(act.date).toLocaleDateString(),
                                act.session || '—',
                                act.status
                            ]);
                    } else if (activeModal === 'absent') {
                        title = 'Absent Classes Details';
                        headers = ['Subject / Course', 'Date', 'Session', 'Status'];
                        rows = allActivity
                            .filter(act => act.status === 'Absent')
                            .map(act => [
                                act.subjectName,
                                new Date(act.date).toLocaleDateString(),
                                act.session || '—',
                                act.status
                            ]);
                    }

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300">
                            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {/* Header */}
                                <div className="p-6 border-b border-gray-150 flex justify-between items-center bg-gray-50">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                                        <p className="text-xs text-gray-500 font-medium mt-1">Showing {rows.length} entries</p>
                                    </div>
                                    <button 
                                        onClick={() => setActiveModal(null)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 overflow-y-auto flex-1">
                                    {rows.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400 font-semibold text-sm">
                                            No records found.
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-gray-150 overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-50 border-b border-gray-150 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                            {headers.map((h, i) => (
                                                                <th key={i} className={`p-3.5 ${i === 0 ? 'pl-5' : ''} ${i === headers.length - 1 ? 'pr-5' : ''}`}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 text-sm">
                                                        {rows.map((row, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50/50 transition">
                                                                {row.map((cell, cIdx) => {
                                                                    const isFirst = cIdx === 0;
                                                                    const isLast = cIdx === row.length - 1;
                                                                    
                                                                    if (activeModal === 'courses' && cIdx === 5) {
                                                                        return (
                                                                            <td key={cIdx} className="p-3.5 pr-5">
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getBadgeStyle(cell)}`}>
                                                                                    {cell}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    }
                                                                    
                                                                    if (activeModal === 'courses' && cIdx === 2) {
                                                                        return (
                                                                            <td key={cIdx} className="p-3.5 font-bold text-indigo-700">{cell}</td>
                                                                        );
                                                                    }

                                                                    if ((activeModal === 'classes' || activeModal === 'present' || activeModal === 'absent') && cIdx === 3) {
                                                                        return (
                                                                            <td key={cIdx} className="p-3.5 pr-5">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                                    cell === 'Present' ? 'bg-green-100 text-green-800' :
                                                                                    cell === 'Absent' ? 'bg-red-100 text-red-800' :
                                                                                    'bg-yellow-100 text-yellow-800'
                                                                                }`}>
                                                                                    {cell}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <td key={cIdx} className={`p-3.5 ${isFirst ? 'pl-5 font-bold text-gray-700' : 'text-gray-500 font-medium'} ${isLast ? 'pr-5' : ''}`}>
                                                                            {cell}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 bg-gray-50 border-t border-gray-150 flex justify-end">
                                    <button 
                                        onClick={() => setActiveModal(null)}
                                        className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-sm border border-gray-200 transition shadow-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-extrabold text-indigo-900 mb-2">
                         Student Portal
                    </h1>
                    {isStudentMode && myProfile && (
                        <p className="text-gray-600 text-lg">
                            Welcome, <strong>{myProfile.name}</strong> &middot; {myProfile.rollNumber} &middot; {myProfile.branch}
                        </p>
                    )}
                    {!isStudentMode && <p className="text-gray-600 text-lg">View Your Class Timetable</p>}
                </div>

                {isPreviewMode && previewStudents.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 flex items-center justify-center gap-3 flex-wrap">
                        <span className="text-sm font-extrabold text-gray-600">Preview Student</span>
                        <select
                            value={previewRollNumber}
                            onChange={(e) => setPreviewRollNumber(e.target.value)}
                            className="min-w-[260px] p-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {previewStudents.map(student => (
                                <option key={student._id || student.id} value={student.rollNumber}>
                                    {student.name} ({student.rollNumber})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Tab Navigation - student login and admin preview */}
                {isStudentMode && (
                    <div className="flex gap-2 mb-6 bg-white rounded-xl shadow-sm p-1.5 w-fit mx-auto">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                             Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('timetable')}
                            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition ${activeTab === 'timetable' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                             Timetable
                        </button>

                    </div>
                )}


                {/* DASHBOARD TAB */}
                {isStudentMode && activeTab === 'dashboard' && renderDashboardView()}

                {/* TIMETABLE TAB */}
                {(!isStudentMode || activeTab === 'timetable') && (
                <>
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                        <span className="text-3xl mr-3"></span>
                        Find Your Timetable
                    </h2>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <input
                            type="text"
                            placeholder=" Search for your batch (e.g., 'CSE 3rd Year', 'Batch A')..."
                            className="w-full p-4 border-2 border-indigo-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-lg shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* Degree Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Filter by Degree
                            </label>
                            <select
                                value={selectedDegree}
                                onChange={(e) => {
                                    setSelectedDegree(e.target.value);
                                    setSelectedBatch('');
                                }}
                                disabled={!hasDegreeMetadata}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">All Degrees</option>
                                {degrees.map(deg => (
                                    <option key={deg} value={deg}>{deg}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Filter by Year
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => {
                                    setSelectedYear(e.target.value);
                                    setSelectedBatch('');
                                }}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">All Years</option>
                                {years.map(year => (
                                    <option key={year} value={year}>
                                        {year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : '4th Year'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Batch Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Select Batch <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedBatch}
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            >
                                <option value="">-- Select Batch --</option>
                                {filteredBatches.map(batch => (
                                    <option key={batch._id} value={batch.name}>{batch.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* View Timetable Button */}
                        <div className="flex items-end">
                            <button
                                onClick={handleSearch}
                                disabled={!selectedBatch || loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Loading...' : 'View Timetable'}
                            </button>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-blue-800">
                        <p>
                            <strong>Tip:</strong> Use the search bar for quick access, or filter by degree and year to find your batch.
                        </p>
                    </div>
                </div>

                {/* Timetable Display */}
                {timetable ? (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-800">{timetable.batch}</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    Generated on: {new Date(timetable.createdAt).toLocaleDateString('en-US', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => window.print()}
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition shadow-md"
                            >
                                 Print
                            </button>
                        </div>


                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-gray-800">
                                <thead>
                                    <tr>
                                        <th className="p-3 border-2 border-gray-800 bg-indigo-100 text-left text-sm font-bold text-indigo-900 w-32">
                                            Time / Day
                                        </th>
                                        {getScheduleDays(timetable.schedule).map(day => (
                                            <th key={day} className="p-3 border-2 border-gray-800 bg-indigo-100 text-center text-sm font-bold text-indigo-900">
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSchedulePeriods(timetable.schedule).map(period => {
                                        return (
                                            <tr key={period.id}>
                                                <td className="p-3 border-2 border-gray-800 bg-indigo-50 font-semibold text-indigo-900 text-xs align-top">
                                                    <div className="text-center">
                                                        <div className="font-bold">{period.label}</div>
                                                    </div>
                                                </td>
                                                {getScheduleDays(timetable.schedule).map(day => {
                                                    const daySchedule = timetable.schedule.find(d => d.day === day);
                                                    const rawPeriod = daySchedule?.periods.find(p => p.period === period.id);
                                                    const periodData = getFilteredPeriodData(rawPeriod);

                                                    return (
                                                        <td key={day} className="p-2 border-2 border-gray-800 align-top min-h-[80px]">
                                                            {periodData?.type === 'Lunch' ? (
                                                                <div className="bg-yellow-100 p-3 rounded text-center font-bold text-yellow-800">
                                                                     LUNCH
                                                                </div>
                                                            ) : periodData?.type !== 'Free' ? (
                                                                <div className={`p-2 min-h-[70px] ${getCellStyle(periodData)}`}>
                                                                    <div className="text-xs">
                                                                        <div className="font-bold mb-1">
                                                                            {periodData.subject} ({periodData.classType || periodData.type})
                                                                        </div>
                                                                        {renderPeriodDetails(periodData)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-gray-50 p-3 min-h-[70px] flex items-center justify-center">
                                                                    <span className="text-gray-400 italic text-xs">Free</span>
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

                        {/* Legend */}
                        <div className="mt-6 flex gap-6 text-sm justify-center flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-green-100 border-l-4 border-green-500 rounded"></div>
                                <span className="font-medium">Core Lecture</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-pink-100 border-l-4 border-pink-500 rounded"></div>
                                <span className="font-medium">Elective Lecture</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-100 border-l-4 border-blue-500 rounded"></div>
                                <span className="font-medium">Core Lab</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-purple-100 border-l-4 border-purple-500 rounded"></div>
                                <span className="font-medium">Elective Lab</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-orange-100 border-l-4 border-orange-500 rounded"></div>
                                <span className="font-medium">Training</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-yellow-100 border-l-4 border-yellow-500 rounded"></div>
                                <span className="font-medium">Lunch</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded"></div>
                                <span className="font-medium">Free Period</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
                        <div className="text-8xl mb-4"></div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-2">No Timetable Selected</h3>
                        <p className="text-gray-500">Please select your degree, year, and batch above to view your timetable.</p>
                    </div>
                )}
                </>
                )}
            </div>
        </div>
    );
}

export default StudentPortal;
