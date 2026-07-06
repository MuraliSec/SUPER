import React, { useState, useEffect } from 'react';
import axios from './api/axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ATTENDANCE_EDIT_RESTRICTION_MESSAGE = 'Attendance can only be edited on the same day it was marked.';

const formatLocalDate = (value = new Date()) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    const date = new Date(value);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
};

const isSameLocalDate = (value, comparison = new Date()) => {
    return formatLocalDate(value) === formatLocalDate(comparison);
};

const getAttendanceWeight = (record) => {
    const explicitWeight = Number(record.conductedUnits ?? record.attendanceWeight);
    if (Number.isFinite(explicitWeight) && explicitWeight > 0) return explicitWeight;
    return record.classType === 'Lab' ? 2 : 1;
};

const getAttendanceAttendedUnits = (record) => {
    const explicitUnits = Number(record.attendedUnits);
    if (Number.isFinite(explicitUnits)) return explicitUnits;

    const weight = getAttendanceWeight(record);
    if (record.status === 'Present') return weight;
    return 0;
};

const normalizeStudentAttendanceRecord = (record) => {
    const rawCourse = record.courseId && typeof record.courseId === 'object' ? record.courseId : {};
    const courseName = record.courseName || record.subjectName || rawCourse.subject || rawCourse.title || 'Unknown Subject';
    const courseCode = record.courseCode || rawCourse.courseCode || 'N/A';
    const courseId = rawCourse._id || rawCourse.id || (typeof record.courseId === 'string' ? record.courseId : undefined);
    const classType = record.classType || 'Lecture';
    const conductedUnits = getAttendanceWeight({ ...record, classType });
    const attendedUnits = getAttendanceAttendedUnits({ ...record, classType, conductedUnits });

    return {
        ...record,
        _id: record._id || record.id || `${courseId || courseName}-${record.date}-${record.session || ''}`,
        courseId: {
            ...rawCourse,
            _id: courseId,
            id: rawCourse.id || courseId,
            subject: rawCourse.subject || courseName,
            title: rawCourse.title || courseName,
            courseCode
        },
        courseName,
        subjectName: record.subjectName || courseName,
        courseCode,
        classType,
        session: record.session || '',
        attendanceWeight: conductedUnits,
        attendedUnits,
        conductedUnits
    };
};

const AttendancePortal = ({ user, viewingAs }) => {
    const [view, setView] = useState(viewingAs || 'student'); // 'student', 'faculty', 'admin'
    const [reportType, setReportType] = useState('overall'); // 'course', 'day', 'month', 'overall', 'history'
    const [stats, setStats] = useState([]);
    const [history, setHistory] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [students, setStudents] = useState([]);
    const [markingDate, setMarkingDate] = useState(formatLocalDate());
    const [markingSession, setMarkingSession] = useState('FN'); // 'FN', 'AN', 'Session 1', etc.
    const [loading, setLoading] = useState(false);
    const [attendanceData, setAttendanceData] = useState({}); // {studentId: 'Present/Absent'}
    const [isEditingFromList, setIsEditingFromList] = useState(false);
    const [rawBatches, setRawBatches] = useState([]);
    
    // Edit mode
    const [isEditMode, setIsEditMode] = useState(false);
    const [editRestrictionMessage, setEditRestrictionMessage] = useState('');
    const [historySessions, setHistorySessions] = useState([]);
    const [historyFilters, setHistoryFilters] = useState({
        courseId: '',
        batch: '',
        startDate: '',
        endDate: ''
    });
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    
    // Filter states
    const [filters, setFilters] = useState({
        batch: '',
        subject: ''
    });
    const [classType, setClassType] = useState('Lecture');
    const [reportClassTypeFilter, setReportClassTypeFilter] = useState('Both');
    const [availableFilters, setAvailableFilters] = useState({
        batches: [],
        subjects: []
    });
    const [batchSearch, setBatchSearch] = useState('');
    const [subjectSearch, setSubjectSearch] = useState('');
    const isFacultyUser = user?.role === 'FACULTY';

    useEffect(() => {
        setView(viewingAs);
        if (viewingAs === 'student') {
            fetchStudentStats();
        } else {
            // Both Faculty and Admin/HOD need courses to mark attendance or filter reports
            fetchCourses();
            // Fetch history for non-student views
            fetchHistory();
            // If HOD, fetch reports immediately. Faculty can switch to them.
            if (viewingAs === 'hod' || user.role === 'FACULTY') fetchAdminReports();
        }
    }, [viewingAs]);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            // Fetch from primary data tables to ensure consistency with uploads
            const [batchesRes, coursesRes] = await Promise.all([
                axios.get('/batches'),
                axios.get('/attendance/courses')
            ]);
            
            setRawBatches(batchesRes.data);
            setCourses(coursesRes.data);
            
            // Collect all unique batch identifiers from both the Batches and Courses tables
            const batchesFromBatches = batchesRes.data.map(b => b.name || b.batchId);
            const batchesFromCourses = coursesRes.data.map(c => c.batch);
            const allBatches = [...new Set([...batchesFromBatches, ...batchesFromCourses])]
                .filter(Boolean)
                .sort();
            
            // Initialize subjects based on all courses (deduplicated by name)
            const initialSubjects = [];
            const seenInitial = new Set();
            coursesRes.data.forEach(c => {
                const subName = String(c.subject || '').trim();
                if (subName && !seenInitial.has(subName)) {
                    seenInitial.add(subName);
                    initialSubjects.push({ id: c._id, name: c.subject, batch: c.batch });
                }
            });
            
            setAvailableFilters({
                batches: allBatches,
                subjects: initialSubjects
            });
        } catch (err) {
            console.error('Data Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentStats = async () => {
        try {
            setLoading(true);
            const username = user?.username || user?.rollNumber;
            const res = await axios.get('/students/my-attendance', {
                params: username ? { username } : {},
                headers: username ? { 'x-username': username } : {}
            });
            const records = (res.data.records || res.data.allActivity || []).map(normalizeStudentAttendanceRecord);
            const courseStats = (res.data.courses || []).map(course => ({
                courseTitle: course.subjectName || 'Unknown Course',
                courseCode: course.subjectCode || 'N/A',
                present: course.presentClasses || 0,
                absent: course.absentClasses || 0,
                total: course.totalClasses || 0,
                attendedUnits: course.attendedUnits || 0,
                conductedUnits: course.conductedUnits || 0,
                percentage: Number(course.attendancePercentage || 0).toFixed(2)
            }));
            setStats(courseStats);
            setHistory(records);
        } catch (err) {
            console.error(err);
            setStats([]);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (filters.batch) {
            const selectedBatchStr = filters.batch;
            
            // Asynchronously fetch courses (formal + virtual) for the selected batch
            const fetchBatchSubjects = async () => {
                try {
                    setLoading(true);
                    const res = await axios.get(`/attendance/courses?batch=${encodeURIComponent(selectedBatchStr)}`);
                    const batchCourses = res.data || [];
                    
                    // Update courses list so courses.find works for virtual/new courses
                    setCourses(prev => {
                        const courseMap = new Map(prev.map(c => [c._id, c]));
                        batchCourses.forEach(c => courseMap.set(c._id, c));
                        return Array.from(courseMap.values());
                    });

                    // Build subjects dropdown directly from batchCourses
                    const uniqueCourses = new Map();
                    batchCourses.forEach(c => {
                        uniqueCourses.set(c.subject, c);
                    });

                    const specificSubjects = Array.from(uniqueCourses.values()).map(c => ({
                        id: c._id,
                        name: c.subject
                    }));

                    setAvailableFilters(prev => ({
                        ...prev,
                        subjects: specificSubjects.sort((a,b) => a.name.localeCompare(b.name))
                    }));
                } catch (err) {
                    console.error('Error fetching batch subjects:', err);
                } finally {
                    setLoading(false);
                }
            };
            
            fetchBatchSubjects();
        }
    }, [filters.batch]);

    const loadExistingAttendance = async (courseId, date, session, initialData = null) => {
        try {
            const res = await axios.get(`/attendance/records?courseId=${courseId}&date=${date}&session=${session}`);
            
            const existing = {};
            if (res.data && res.data.length > 0) {
                res.data.forEach(rec => {
                    if(rec.studentId) existing[rec.studentId] = rec.status === 'Present' ? 'Present' : 'Absent';
                });
                setClassType(res.data[0].classType || 'Lecture');
                setIsEditMode(true);
                const canEdit = !isFacultyUser || (res.data[0].canEdit ?? isSameLocalDate(date));
                setEditRestrictionMessage(canEdit ? '' : ATTENDANCE_EDIT_RESTRICTION_MESSAGE);
            } else {
                setIsEditMode(false);
                setEditRestrictionMessage('');
            }
    
            if (initialData) {
                // This is a fresh load for a new course. Overwrite state completely.
                setAttendanceData({ ...initialData, ...existing });
            } else {
                // This is just a date/session change. Merge with previous state.
                setAttendanceData(prev => ({ ...prev, ...existing }));
            }
    
            return true; // Keep the return value consistent
        } catch (err) {
            console.error('Error loading existing records:', err);
            setIsEditMode(false);
            setEditRestrictionMessage('');
            if (initialData) {
                setAttendanceData(initialData); // On error, at least set the initial data
            }
            return false;
        }
    };

    const fetchStudentsForCourse = async (courseId, dateOverride, sessionOverride) => {
        try {
            setLoading(true);
            setIsEditMode(false);
            
            let course = courses.find(c => c._id === courseId);
            if (!course && String(courseId).startsWith('virtual_')) {
                const subjectName = availableFilters.subjects.find(s => s.id === courseId)?.name || 'Virtual Course';
                course = {
                    _id: courseId,
                    subject: subjectName,
                    courseCode: courseId.replace(/^virtual_/, ''),
                    code: courseId.replace(/^virtual_/, ''),
                    batch: filters.batch || '',
                    isVirtual: true
                };
            }
            
            setSelectedCourse(course);

            const queryParams = filters.batch ? `?batch=${encodeURIComponent(filters.batch)}` : '';
            const res = await axios.get(`/attendance/students/${courseId}${queryParams}`);
            const studentList = res.data || [];
            setStudents(studentList);
            
            // Initialize with 'Present' first
            const initial = {};
            studentList.forEach(s => {
                if (s._id) initial[s._id] = 'Present';
            });

            // Use passed date/session if provided (for edit mode), else fallback to state
            const targetDate = dateOverride || markingDate;
            const targetSession = sessionOverride || markingSession;
            await loadExistingAttendance(courseId, targetDate, targetSession, initial);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Re-load attendance when date or session changes
    useEffect(() => {
        if (selectedCourse) {
            loadExistingAttendance(selectedCourse._id, markingDate, markingSession);
        }
    }, [markingDate, markingSession]);

    const fetchAdminReports = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/attendance/admin/report');
            setHistory(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const params = new URLSearchParams();
            if (historyFilters.courseId) params.append('courseId', historyFilters.courseId);
            if (historyFilters.batch) params.append('batch', historyFilters.batch);
            if (historyFilters.startDate) params.append('startDate', historyFilters.startDate);
            if (historyFilters.endDate) params.append('endDate', historyFilters.endDate);
            const res = await axios.get(`/attendance/history?${params.toString()}`);
            setHistorySessions(res.data || []);
        } catch (err) {
            console.error('Error fetching attendance history:', err);
        }
    };

    const submitAttendance = async () => {
        try {
            if (isEditMode && editRestrictionMessage) {
                alert(editRestrictionMessage);
                return;
            }

            const data = Object.keys(attendanceData)
                .filter(sid => sid && sid !== 'undefined')
                .map(sid => ({
                    studentId: sid,
                    status: attendanceData[sid]
                }));

            if (data.length === 0) {
                alert('No students selected to mark attendance.');
                return;
            }

            const res = await axios.post('/attendance/mark', {
                courseId: selectedCourse._id,
                date: markingDate,
                session: markingSession,
                classType: classType,
                attendanceData: data,
                // Pass these for virtual course auto-creation
                batch: filters.batch || selectedCourse?.batch || '',
                courseCode: selectedCourse?.courseCode || selectedCourse?.code || '',
                subject: selectedCourse?.subject || ''
            });
            const savedRecords = Array.isArray(res.data) ? res.data : [];
            const savedCourseId = savedRecords[0]?.courseId;
            const resolvedCourseId = savedCourseId || selectedCourse._id;
            if (savedCourseId && savedCourseId !== selectedCourse._id) {
                const resolvedCourse = { ...selectedCourse, _id: savedCourseId, id: savedCourseId, isVirtual: false };
                setSelectedCourse(resolvedCourse);
                setCourses(prev => {
                    const next = new Map(prev.map(c => [c._id || c.id, c]));
                    next.set(savedCourseId, resolvedCourse);
                    return Array.from(next.values());
                });
            }
            alert('Attendance marked successfully!');
            // Don't clear selectedCourse, let them see the submitted list
            await loadExistingAttendance(resolvedCourseId, markingDate, markingSession);
            await fetchAdminReports();
            await fetchHistory();
        } catch (err) {
            alert(err.response?.data?.error || 'Error marking attendance');
        }
    };

    const markAll = (status) => {
        if (isEditMode && editRestrictionMessage) {
            alert(editRestrictionMessage);
            return;
        }
        const updated = { ...attendanceData };
        Object.keys(updated).forEach(id => updated[id] = status);
        setAttendanceData(updated);
    };

    const getOverallStats = (records) => {
        if(!records || records.length === 0) return null;
        let attendedUnits = 0;
        let conductedUnits = 0;
        let present = 0;
        let absent = 0;

        records.forEach(r => {
            const weight = r.attendanceWeight || (r.classType === 'Lab' ? 2 : 1);
            conductedUnits += weight;
            if (r.status === 'Present') {
                present++;
                attendedUnits += weight;
            } else if (r.status === 'Absent') {
                absent++;
            }
        });

        return { 
            present, absent, total: records.length, 
            attendedUnits, conductedUnits,
            percentage: conductedUnits > 0 ? ((attendedUnits / conductedUnits) * 100).toFixed(2) : '0.00'
        };
    };

    const getGroupedStats = (records, groupBy) => {
        const groups = {};
        records.forEach(r => {
            let key;
            if (groupBy === 'day') {
                key = new Date(r.date).toLocaleDateString();
            } else if (groupBy === 'month') {
                const d = new Date(r.date);
                key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
            } else if (groupBy === 'course') {
                key = r.courseId?.subject || r.courseId?.title || 'Unknown Course';
            }
            if(!groups[key]) {
                groups[key] = { present: 0, absent: 0, total: 0, attendedUnits: 0, conductedUnits: 0 };
            }
            const weight = r.attendanceWeight || (r.classType === 'Lab' ? 2 : 1);
            groups[key].total++;
            groups[key].conductedUnits += weight;

            if (r.status === 'Present') {
                groups[key].present++;
                groups[key].attendedUnits += weight;
            } else {
                groups[key].absent++;
            }
        });
        return Object.entries(groups).map(([label, counts]) => ({ 
            label, ...counts, 
            percentage: counts.conductedUnits > 0 ? ((counts.attendedUnits / counts.conductedUnits) * 100).toFixed(2) : '0.00' 
        })).sort((a,b) => b.label.localeCompare(a.label));
    };

    const getGroupedSessions = (records) => {
        const sessions = {};
        records.forEach(r => {
            const dateStr = new Date(r.date).toISOString().split('T')[0];
            const key = `${r.courseId?._id}_${dateStr}_${r.session}`;
            if (!sessions[key]) {
                sessions[key] = {
                    courseId: r.courseId?._id,
                    courseName: r.courseId?.subject || r.courseId?.title || 'Unknown',
                    date: dateStr,
                    session: r.session || 'Current',
                    count: 0,
                    batch: r.courseId?.batch || 'N/A'
                };
            }
            sessions[key].count++;
        });
        return Object.values(sessions).sort((a,b) => b.date.localeCompare(a.date));
    };

    const renderStatGrid = (data, emptyMessage = 'No attendance records found yet.') => {
        if(data.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>{emptyMessage}</div>;
        return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {data.map(stat => (
                <div key={stat.label || stat.courseTitle} style={{ 
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
                            {stat.label && /^\d{4}-\d{2}$/.test(stat.label) ? (() => {
                                const [year, monthStr] = stat.label.split('-');
                                const d = new Date(parseInt(year), parseInt(monthStr) - 1, 1);
                                return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                            })() : (stat.label || stat.courseTitle)}
                        </h3>
                        {stat.courseCode && <span style={{ fontSize: '12px', background: '#edf2f7', padding: '4px 8px', borderRadius: '6px' }}>{stat.courseCode}</span>}
                    </div>
                    <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#4c51bf' }}>
                            Conducted Classes: {stat.total || 0}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#38a169' }}>
                            Attended Classes: {stat.present || 0}
                        </div>
                    </div>
                    {false && parseFloat(stat.percentage) < 75 && (
                        <div style={{ color: '#e53e3e', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                             Attendance Shortage<br />
                        </div>
                    )}
                </div>
            ))}
        </div>
        );
    };

    const renderHistoryTable = (records, emptyMessage = 'No attendance records found yet.') => {
        if (!records || records.length === 0) {
            return <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>{emptyMessage}</div>;
        }

        return (
        <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', background: '#f7fafc', borderBottom: '2px solid #edf2f7' }}>
                        <th style={{ padding: '15px' }}>Date</th>
                        <th style={{ padding: '15px' }}>Session</th>
                        {view === 'hod' && <th style={{ padding: '15px' }}>Student</th>}
                        <th style={{ padding: '15px' }}>Course</th>
                        <th style={{ padding: '15px' }}>Class Type</th>
                        <th style={{ padding: '15px' }}>Status</th>
                        <th style={{ padding: '15px' }}>Attended Units</th>
                        <th style={{ padding: '15px' }}>Conducted Units</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map(h => (
                        <tr key={h._id || h.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '15px' }}>{new Date(h.date).toLocaleDateString()}</td>
                            <td style={{ padding: '15px' }}>{h.session || '-'}</td>
                            {view === 'hod' && <td style={{ padding: '15px' }}>{h.studentId?.name || 'N/A'}</td>}
                            <td style={{ padding: '15px' }}>{h.courseId?.subject || h.courseId?.title || h.courseName}</td>
                            <td style={{ padding: '15px', fontWeight: '600', color: h.classType === 'Lab' ? '#2b6cb0' : '#4a5568' }}>{h.classType || 'Lecture'}</td>
                            <td style={{ padding: '15px' }}>
                                <span style={{ 
                                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                                    background: h.status === 'Present' ? '#c6f6d5' : (h.status === 'Absent' ? '#fed7d7' : '#feebc8'),
                                    color: h.status === 'Present' ? '#22543d' : (h.status === 'Absent' ? '#822727' : '#744210')
                                }}>{h.status}</span>
                            </td>
                            <td style={{ padding: '15px', fontWeight: '700', color: '#2f855a' }}>{h.attendedUnits ?? getAttendanceAttendedUnits(h)}</td>
                            <td style={{ padding: '15px', fontWeight: '700', color: '#4c51bf' }}>{h.conductedUnits ?? getAttendanceWeight(h)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        );
    };

    const renderReportControls = () => (
        <div style={{ marginBottom: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {['overall', 'course', 'month', 'day', 'history'].map(rt => (
                    <button 
                        key={rt}
                        onClick={() => setReportType(rt)} 
                        style={{ 
                            padding: '10px 20px', 
                            background: reportType === rt ? '#4c51bf' : 'white', 
                            color: reportType === rt ? 'white' : '#4a5568', 
                            border: '1px solid #cbd5e0', 
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        {rt === 'history' && 'Detailed History'}
                        {rt === 'overall' && 'Overall Report'}
                        {rt === 'course' && 'Course Wise'}
                        {rt === 'month' && 'Month Wise'}
                        {rt === 'day' && 'Day Wise'}
                    </button>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4a5568' }}>Filter Class Type:</span>
                <select
                    value={reportClassTypeFilter}
                    onChange={(e) => setReportClassTypeFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', fontSize: '13px', fontWeight: 'bold', outline: 'none' }}
                >
                    <option value="Both">Both (Lecture + Lab)</option>
                    <option value="Lecture">Lecture Only</option>
                    <option value="Lab">Lab Only</option>
                </select>
            </div>
        </div>
    );

    const renderStudentView = () => {
        const filteredReportRecords = history.filter(r => {
            if (reportClassTypeFilter === 'Both') return true;
            return (r.classType || 'Lecture') === reportClassTypeFilter;
        });

        const hasAnyAttendance = history.length > 0;
        const emptyMessage = hasAnyAttendance ? 'No attendance records match the selected filter.' : 'No attendance records found yet.';
        const overall = getOverallStats(filteredReportRecords);
        const stats = getGroupedStats(filteredReportRecords, 'course');
        const groupedData = reportType === 'day' ? getGroupedStats(filteredReportRecords, 'day') : reportType === 'month' ? getGroupedStats(filteredReportRecords, 'month') : [];
        const recentRecords = filteredReportRecords.slice(0, 5); // Get last 5 filtered records

        return (
            <div style={{ padding: '20px' }}>
                <h2 style={{ marginBottom: '20px', color: '#2d3748' }}>My Attendance Report</h2>
                {renderReportControls()}

                {reportType === 'overall' && (
                    <>
                        {overall ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <h3 style={{ fontSize: '24px', marginBottom: '15px', color: '#4a5568' }}>Total Attendance</h3>
                                    <div style={{ fontSize: '32px', fontWeight: '900', color: parseFloat(overall.percentage) < 75 ? '#e53e3e' : '#38a169', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div>Attended Units: {overall.attendedUnits || 0}</div>
                                        <div>Conducted Units: {overall.conductedUnits || 0}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '18px', color: '#718096', fontWeight: 'bold' }}>
                                        <div>Attended Units: <span style={{color: '#38a169'}}>{overall.attendedUnits || 0}</span></div>
                                        <div>Conducted Units: <span style={{color: '#4c51bf'}}>{overall.conductedUnits || 0}</span></div>
                                        <div>Total Sessions: {overall.total}</div>
                                    </div>
                                </div>

                                {(() => {
                                    const dayStats = [...getGroupedStats(filteredReportRecords, 'day')].reverse();
                                    if (dayStats.length === 0) return null;
                                    const chartData = dayStats.map(item => ({
                                        ...item,
                                        attendanceRate: parseFloat(item.percentage)
                                    }));
                                    return (
                                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#4a5568', marginBottom: '15px', textAlign: 'left' }}>
                                                Attendance Rate Trend (Day Wise)
                                            </h3>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorStudentAttendance" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#4c51bf" stopOpacity={0.8}/>
                                                            <stop offset="95%" stopColor="#4c51bf" stopOpacity={0.1}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
                                                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }} />
                                                    <Area type="monotone" dataKey="attendanceRate" stroke="#4c51bf" strokeWidth={2.5} fillOpacity={1} fill="url(#colorStudentAttendance)" name="Attendance Rate" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '12px', border: '1px dashed #cbd5e0', color: '#718096' }}>
                                <div style={{ fontSize: '48px', marginBottom: '15px' }}></div>
                                <h3>{emptyMessage}</h3>
                                <p>{hasAnyAttendance ? 'Try changing the class type filter.' : 'Your attendance has not been marked yet for this semester.'}</p>
                            </div>
                        )}

                        {recentRecords.length > 0 && (
                            <div style={{ marginTop: '30px' }}>
                                <h3 style={{ marginBottom: '15px', color: '#4a5568' }}>Recent Activity</h3>
                                {renderHistoryTable(recentRecords)}
                            </div>
                        )}
                    </>
                )}
                
                {reportType === 'course' && renderStatGrid(stats, emptyMessage)}
                {(reportType === 'month' || reportType === 'day') && renderStatGrid(groupedData, emptyMessage)}
                {reportType === 'history' && renderHistoryTable(filteredReportRecords, emptyMessage)}
            </div>
        );
    };

    const renderFacultyView = () => {
        const studentCount = students.length;
        const presentCount = Object.values(attendanceData).filter(status => status === 'Present').length;
        const absentCount = Object.values(attendanceData).filter(status => status === 'Absent').length;
        const isAttendanceEditLocked = isEditMode && !!editRestrictionMessage;
        const canModifyAttendance = !isAttendanceEditLocked;

        return (
            <div style={{ display: 'flex', gap: '20px', minHeight: 'calc(100vh - 120px)', padding: '10px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {/* Left Pane: Selection & Settings */}
                <div style={{ flex: '0 0 300px', background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a202c', margin: '0 0 5px 0' }}>Mark Attendance</h3>
                    
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '6px' }}>Select Batch</label>
                        <input
                            type="text"
                            placeholder=" Search batches..."
                            value={batchSearch}
                            onChange={e => setBatchSearch(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none', marginBottom: '6px' }}
                        />
                        <select 
                            value={filters.batch} 
                            onChange={(e) => {
                                setFilters({...filters, batch: e.target.value, subject: ''});
                                setSelectedCourse(null);
                                setStudents([]);
                            }}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', fontSize: '14px', outline: 'none' }}
                        >
                            <option value="">-- Choose Batch --</option>
                            {availableFilters.batches.filter(b => !batchSearch || b.toLowerCase().includes(batchSearch.toLowerCase())).map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '6px' }}>Select Subject / Course</label>
                        <input
                            type="text"
                            placeholder=" Search subjects..."
                            value={subjectSearch}
                            onChange={e => setSubjectSearch(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none', marginBottom: '6px' }}
                        />
                        <select 
                            value={filters.subject} 
                            onChange={(e) => {
                                setFilters({...filters, subject: e.target.value});
                                setSelectedCourse(null);
                                setStudents([]);
                            }}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', fontSize: '14px', outline: 'none' }}
                            disabled={!filters.batch}
                        >
                            <option value="">-- Choose Subject --</option>
                            {availableFilters.subjects.filter(s => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '6px' }}>Class Type *</label>
                        <select 
                            value={classType} 
                            onChange={(e) => setClassType(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', fontSize: '14px', outline: 'none' }}
                            disabled={isAttendanceEditLocked}
                            required
                        >
                            <option value="Lecture">Lecture</option>
                            <option value="Lab">Lab</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '6px' }}>Marking Date</label>
                        <input 
                            type="date" 
                            value={markingDate} 
                            onChange={(e) => setMarkingDate(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '14px', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4a5568', marginBottom: '6px' }}>Marking Session</label>
                        <select 
                            value={markingSession}
                            onChange={(e) => setMarkingSession(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', fontSize: '14px', outline: 'none' }}
                        >
                            <option value="FN">Forenoon (FN)</option>
                            <option value="AN">Afternoon (AN)</option>
                            <option value="S1">Session 1</option>
                            <option value="S2">Session 2</option>
                            <option value="S3">Session 3</option>
                            <option value="S4">Session 4</option>
                            <option value="S5">Session 5</option>
                            <option value="S6">Session 6</option>
                            <option value="S7">Session 7</option>
                            <option value="S8">Session 8</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => filters.subject && fetchStudentsForCourse(filters.subject)}
                        disabled={!filters.subject}
                        style={{ 
                            width: '100%', padding: '12px', background: filters.subject ? '#4f46e5' : '#e2e8f0', 
                            color: filters.subject ? 'white' : '#a0aec0', border: 'none', borderRadius: '8px', cursor: filters.subject ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s', marginTop: '10px',
                            boxShadow: filters.subject ? '0 4px 6px -1px rgba(79, 70, 229, 0.2)' : 'none'
                        }}
                    >
                         Fetch Students
                    </button>
                </div>

                {/* Center Pane: Student list table */}
                <div style={{ flex: 1, background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                    {!selectedCourse ? (
                        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', padding: '40px' }}>
                            <span style={{ fontSize: '48px', marginBottom: '15px' }}></span>
                            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#4a5568', margin: 0 }}>No Class Loaded</h4>
                            <p style={{ fontSize: '13px', color: '#718096', marginTop: '5px', textAlign: 'center' }}>Select a Batch and Subject in the left pane, then click "Fetch Students".</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px' }}>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a202c', margin: 0 }}>{selectedCourse.subject}</h2>
                                    <p style={{ fontSize: '13px', color: '#718096', margin: '2px 0 0 0' }}>Batch: <strong>{filters.batch || selectedCourse.batch}</strong></p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        onClick={() => markAll('Present')} 
                                        disabled={!canModifyAttendance}
                                        style={{ padding: '6px 12px', background: canModifyAttendance ? '#ecfdf5' : '#f1f5f9', color: canModifyAttendance ? '#047857' : '#94a3b8', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: canModifyAttendance ? 'pointer' : 'not-allowed', transition: 'all 0.1s' }}
                                    >
                                         All Present
                                    </button>
                                    <button 
                                        onClick={() => markAll('Absent')} 
                                        disabled={!canModifyAttendance}
                                        style={{ padding: '6px 12px', background: canModifyAttendance ? '#fef2f2' : '#f1f5f9', color: canModifyAttendance ? '#b91c1c' : '#94a3b8', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: canModifyAttendance ? 'pointer' : 'not-allowed', transition: 'all 0.1s' }}
                                    >
                                         All Absent
                                    </button>
                                </div>
                            </div>

                            {isEditMode && (
                                <div style={{ background: isAttendanceEditLocked ? '#fff5f5' : '#fffbeb', border: isAttendanceEditLocked ? '1px solid #feb2b2' : '1px solid #fbbf24', borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: isAttendanceEditLocked ? '#c53030' : '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span></span>
                                    <span>{isAttendanceEditLocked ? editRestrictionMessage : <>Existing Attendance Found — <strong>Edit Mode</strong>. Modify records and click "Update Attendance".</>}</span>
                                </div>
                            )}

                            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '60vh' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #edf2f7', color: '#718096', fontSize: '12px', fontWeight: '600' }}>
                                            <th style={{ padding: '10px 12px' }}>Roll Number</th>
                                            <th style={{ padding: '10px 12px' }}>Student Name</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Attendance (Present)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
                                                     No students registered under batch <strong>{filters.batch || selectedCourse.batch}</strong>.
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map(student => {
                                                const recStatus = attendanceData[student._id];
                                                const isPresent = recStatus === 'Present';
                                                return (
                                                    <tr key={student._id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                                                        <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4a5568' }}>{student.username}</td>
                                                        <td style={{ padding: '12px', fontWeight: '600', color: '#2d3748' }}>{student.name}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={isPresent}
                                                                    disabled={!canModifyAttendance}
                                                                    onChange={(e) => {
                                                                        const nextStatus = e.target.checked ? 'Present' : 'Absent';
                                                                        setAttendanceData({...attendanceData, [student._id]: nextStatus});
                                                                    }}
                                                                    style={{ width: '18px', height: '18px', cursor: canModifyAttendance ? 'pointer' : 'not-allowed', accentColor: '#4f46e5' }}
                                                                />
                                                                <select 
                                                                    value={recStatus || 'Absent'}
                                                                    disabled={!canModifyAttendance}
                                                                    onChange={(e) => setAttendanceData({...attendanceData, [student._id]: e.target.value})}
                                                                    style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: '600', color: isPresent ? '#047857' : '#b91c1c', background: isPresent ? '#ecfdf5' : '#fef2f2', cursor: canModifyAttendance ? 'pointer' : 'not-allowed' }}
                                                                >
                                                                    <option value="Present">Present</option>
                                                                    <option value="Absent">Absent</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Pane: Summary & Save */}
                <div style={{ flex: '0 0 260px', background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a202c', margin: 0, borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                        {isEditMode ? ' Edit Mode' : 'Summary'}
                    </h3>
                    
                    {isEditMode && (
                        <div style={{ background: isAttendanceEditLocked ? '#fff5f5' : '#fffbeb', border: isAttendanceEditLocked ? '1px solid #feb2b2' : '1px solid #fbbf24', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: isAttendanceEditLocked ? '#c53030' : '#92400e' }}>
                            {isAttendanceEditLocked ? editRestrictionMessage : 'Existing Attendance Found - Edit Mode'}
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px' }}>
                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Total Students</span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>{studentCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1fae5' }}>
                            <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>Present</span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#14532d' }}>{presentCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '10px 14px', borderRadius: '10px', border: '1px solid #fee2e2' }}>
                            <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>Absent</span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#7f1d1d' }}>{absentCount}</span>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                            onClick={submitAttendance}
                            disabled={!selectedCourse || studentCount === 0 || isAttendanceEditLocked}
                            style={{ 
                                width: '100%', padding: '14px', 
                                background: (selectedCourse && studentCount > 0 && !isAttendanceEditLocked) ? '#4f46e5' : '#cbd5e1', 
                                color: (selectedCourse && studentCount > 0 && !isAttendanceEditLocked) ? 'white' : '#94a3b8', 
                                border: 'none', borderRadius: '10px', 
                                cursor: (selectedCourse && studentCount > 0 && !isAttendanceEditLocked) ? 'pointer' : 'not-allowed', 
                                fontWeight: 'bold', fontSize: '15px', transition: 'all 0.2s',
                                boxShadow: (selectedCourse && studentCount > 0 && !isAttendanceEditLocked) ? '0 4px 6px -1px rgba(79, 70, 229, 0.3)' : 'none'
                            }}
                        >
                            {isEditMode ? ' Update Attendance' : ' Save Attendance'}
                        </button>
                        <button 
                            onClick={() => { fetchHistory(); setShowHistoryPanel(!showHistoryPanel); }}
                            style={{ 
                                width: '100%', padding: '10px', 
                                background: showHistoryPanel ? '#eef2ff' : 'white', 
                                color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '10px', 
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s'
                            }}
                        >
                            {showHistoryPanel ? ' Hide History' : ' View History'}
                        </button>
                    </div>

                    {/* History Panel */}
                    {showHistoryPanel && (
                        <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#4a5568', margin: '0 0 10px 0' }}> Attendance History</h4>
                            
                            {/* Filters */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                <select 
                                    value={historyFilters.batch}
                                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, batch: e.target.value }))}
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                >
                                    <option value="">All Batches</option>
                                    {availableFilters.batches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <input 
                                        type="date" 
                                        value={historyFilters.startDate} 
                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                        placeholder="From"
                                        style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                                    />
                                    <input 
                                        type="date" 
                                        value={historyFilters.endDate} 
                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                        placeholder="To"
                                        style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                                    />
                                </div>
                                <button
                                    onClick={fetchHistory}
                                    style={{ padding: '6px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
                                >
                                     Search
                                </button>
                            </div>

                            {/* Sessions List */}
                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {historySessions.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#a0aec0', fontSize: '12px', fontWeight: '600' }}>
                                        No sessions found.
                                    </div>
                                ) : (
                                    historySessions.map((s, idx) => (
                                        <div key={idx} onClick={() => {
                                            if (isFacultyUser && !isSameLocalDate(s.date)) {
                                                alert(ATTENDANCE_EDIT_RESTRICTION_MESSAGE);
                                                return;
                                            }
                                            const course = courses.find(c => c._id === s.courseId);
                                            if (course) {
                                                const dateStr = formatLocalDate(s.date);
                                                setSelectedCourse(course);
                                                setFilters(prev => ({ ...prev, subject: course._id }));
                                                setMarkingDate(dateStr);
                                                setMarkingSession(s.session);
                                                setView(markView);
                                                fetchStudentsForCourse(course._id, dateStr, s.session);
                                                setShowHistoryPanel(false);
                                            }
                                        }} style={{
                                            padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                            background: isFacultyUser && !isSameLocalDate(s.date) ? '#f8fafc' : '#fafafa',
                                            cursor: isFacultyUser && !isSameLocalDate(s.date) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s',
                                            opacity: isFacultyUser && !isSameLocalDate(s.date) ? 0.75 : 1
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#2d3748' }}>{s.courseName}</div>
                                            <div style={{ fontSize: '10px', color: '#718096', marginTop: '2px' }}>
                                                 {new Date(s.date).toLocaleDateString()} ·  {s.session}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#718096' }}> Batch: {s.batch}</div>
                                            <div style={{ fontSize: '10px', color: '#718096' }}> Faculty: {s.facultyName}</div>
                                            {isFacultyUser && !isSameLocalDate(s.date) && (
                                                <div style={{ fontSize: '10px', color: '#c53030', fontWeight: '700', marginTop: '4px' }}>
                                                    {ATTENDANCE_EDIT_RESTRICTION_MESSAGE}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '10px', fontWeight: '700' }}>
                                                <span style={{ color: '#166534' }}> {s.presentCount}</span>
                                                <span style={{ color: '#991b1b' }}> {s.absentCount}</span>
                                                <span style={{ color: '#64748b' }}> {s.totalStudents}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderAdminView = () => {
        const filteredReportRecords = history.filter(r => {
            if (reportClassTypeFilter === 'Both') return true;
            return (r.classType || 'Lecture') === reportClassTypeFilter;
        });

        const overall = getOverallStats(filteredReportRecords);
        const groupedData = reportType === 'day' ? getGroupedStats(filteredReportRecords, 'day') 
                          : reportType === 'month' ? getGroupedStats(filteredReportRecords, 'month') 
                          : reportType === 'course' ? getGroupedStats(filteredReportRecords, 'course') : [];

        return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Institution Attendance Report</h2>
                <button 
                    onClick={() => {
                        const csv = filteredReportRecords.map(h => `${new Date(h.date).toLocaleDateString()},${h.studentId?.name || 'N/A'},${h.courseId?.subject || h.courseId?.title || h.courseName},${h.classType || 'Lecture'},${h.status}`).join('\n');
                        const blob = new Blob([`Date,Student,Course,Class Type,Status\n${csv}`], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'attendance_report.csv';
                        a.click();
                    }}
                    style={{ background: '#3182ce', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                     Export CSV
                </button>
            </div>

            {renderReportControls()}

            {reportType === 'overall' && overall && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center', width: '100%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '24px', marginBottom: '15px', color: '#4a5568' }}>Total Institution Attendance</h3>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: parseFloat(overall.percentage) < 75 ? '#e53e3e' : '#38a169', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>Attended Units: {overall.attendedUnits || 0}</div>
                            <div>Conducted Units: {overall.conductedUnits || 0}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '18px', color: '#718096', fontWeight: 'bold' }}>
                            <div>Attended Units: <span style={{color: '#38a169'}}>{overall.attendedUnits || 0}</span></div>
                            <div>Conducted Units: <span style={{color: '#4c51bf'}}>{overall.conductedUnits || 0}</span></div>
                            <div>Total Sessions: {overall.total}</div>
                        </div>
                    </div>

                    {/* Spline Area Chart for Overall Institution Attendance Trend */}
                    {(() => {
                        const dayStats = [...getGroupedStats(filteredReportRecords, 'day')].reverse();
                        if (dayStats.length === 0) return null;
                        const chartData = dayStats.map(item => ({
                            ...item,
                            attendanceRate: parseFloat(item.percentage)
                        }));
                        return (
                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#4a5568', marginBottom: '15px', textAlign: 'left' }}>
                                    Institution Attendance Rate Trend (Day Wise)
                                </h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorInstAttendance" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4c51bf" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#4c51bf" stopOpacity={0.1}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
                                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }} />
                                        <Area type="monotone" dataKey="attendanceRate" stroke="#4c51bf" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInstAttendance)" name="Attendance Rate" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        );
                    })()}
                </div>
            )}

            {(reportType === 'course' || reportType === 'month' || reportType === 'day') && renderStatGrid(groupedData)}
            {reportType === 'history' && renderHistoryTable(filteredReportRecords)}

            {filteredReportRecords.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No attendance records found for institution.</div>}
        </div>
        );
    };

    const canViewReports = ['COLLEGE_ADMIN', 'HOD', 'FACULTY'].includes(user.role);
    const markView = user.role === 'FACULTY' ? 'faculty' : 'hod-mark';

    return (
        <div style={{ minHeight: '80vh' }}>
            {canViewReports && (
                <div style={{ padding: '20px 20px 0 20px' }}>
                    <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                        <button 
                            onClick={() => setView(markView)} 
                            style={{ 
                                padding: '10px 20px', background: 'transparent', border: 'none', 
                                color: view === markView ? '#4c51bf' : '#718096', 
                                fontWeight: 'bold', cursor: 'pointer',
                                borderBottom: view === markView ? '3px solid #4c51bf' : 'none'
                            }}
                        >
                             Mark Attendance
                        </button>
                        <button 
                            onClick={() => { setView('edit-list'); fetchAdminReports(); }} 
                            style={{ 
                                padding: '10px 20px', background: 'transparent', border: 'none', 
                                color: view === 'edit-list' ? '#4c51bf' : '#718096', 
                                fontWeight: 'bold', cursor: 'pointer',
                                borderBottom: view === 'edit-list' ? '3px solid #4c51bf' : 'none'
                            }}
                        >
                             Edit Attendance
                        </button>
                        <button 
                            onClick={() => { setView('hod'); fetchAdminReports(); }} 
                            style={{ 
                                padding: '10px 20px', background: 'transparent', border: 'none', 
                                color: view === 'hod' ? '#4c51bf' : '#718096', 
                                fontWeight: 'bold', cursor: 'pointer',
                                borderBottom: view === 'hod' ? '3px solid #4c51bf' : 'none'
                            }}
                        >
                             View Reports
                        </button>
                    </div>
                </div>
            )}
            {view === 'student' && renderStudentView()}
            {(view === 'faculty' || view === 'hod-mark') && renderFacultyView()}
            {view === 'edit-list' && (
                <div style={{ padding: '20px' }}>
                    <h2 style={{ marginBottom: '20px' }}>Previous Attendance Sessions</h2>
                    <p style={{ color: '#718096', marginBottom: '20px' }}>Select a session below to modify the attendance records.</p>
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {getGroupedSessions(history).map((session, idx) => (
                            <div key={idx} style={{ 
                                background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <div>
                                    <h3 style={{ margin: '0 0 5px 0' }}>{session.courseName}</h3>
                                    <div style={{ fontSize: '14px', color: '#718096' }}>
                                        <span> {new Date(session.date).toLocaleDateString()}</span>
                                        <span style={{ marginLeft: '15px' }}> Session: {session.session}</span>
                                        <span style={{ marginLeft: '15px' }}> Students: {session.count}</span>
                                    </div>
                                    {isFacultyUser && !isSameLocalDate(session.date) && (
                                        <div style={{ marginTop: '8px', color: '#c53030', fontSize: '13px', fontWeight: '700' }}>
                                            {ATTENDANCE_EDIT_RESTRICTION_MESSAGE}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => {
                                        if (isFacultyUser && !isSameLocalDate(session.date)) {
                                            alert(ATTENDANCE_EDIT_RESTRICTION_MESSAGE);
                                            return;
                                        }
                                        const course = courses.find(c => c._id === session.courseId);
                                        const markView = user.role === 'FACULTY' ? 'faculty' : 'hod-mark';
                                        if (course) {
                                            setSelectedCourse(course);
                                            setMarkingDate(formatLocalDate(session.date));
                                            setMarkingSession(session.session);
                                            setIsEditingFromList(true);
                                            setView(markView);
                                            // Pass date/session directly to avoid stale state
                                            setFilters({ batch: session.batch, subject: course._id });
                                            fetchStudentsForCourse(course._id, formatLocalDate(session.date), session.session);
                                        } else {
                                            alert('Course details not found. Please try again.');
                                        }
                                    }}
                                    disabled={isFacultyUser && !isSameLocalDate(session.date)}
                                    style={{ 
                                        padding: '10px 20px',
                                        background: isFacultyUser && !isSameLocalDate(session.date) ? '#f1f5f9' : '#edf2f7',
                                        color: isFacultyUser && !isSameLocalDate(session.date) ? '#94a3b8' : '#4c51bf', 
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isFacultyUser && !isSameLocalDate(session.date) ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isFacultyUser && !isSameLocalDate(session.date) ? 'Edit Disabled' : 'Edit Records'}
                                </button>
                            </div>
                        ))}
                        {history.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>No previous sessions found.</div>}
                    </div>
                </div>
            )}
            {view === 'hod' && renderAdminView()}
            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="spinner">Loading...</div>
                </div>
            )}
        </div>
    );
};

export default AttendancePortal;
