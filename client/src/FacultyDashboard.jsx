import React, { useState, useEffect } from 'react';
import api from './api/axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

const PERIOD_LABELS = {
    1: '9:00-10:00', 2: '10:00-11:00', 3: '11:00-12:00', 4: '12:00-1:00',
    5: '1:00-2:00', 6: '2:00-3:00', 7: '3:00-4:00', 8: '4:00-5:00'
};
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

/* ─── tiny helpers ─────────────────────────────────── */
const getTypeColor = (type) => {
    if (!type) return { bg: '#e6fffa', text: '#234e52', border: '#81e6d9' };
    const t = type.toLowerCase();
    if (t.includes('lab'))   return { bg: '#ebf4ff', text: '#2a4365', border: '#90cdf4' };
    if (t.includes('elect')) return { bg: '#faf5ff', text: '#44337a', border: '#d6bcfa' };
    if (t.includes('train')) return { bg: '#fffaf0', text: '#744210', border: '#fbd38d' };
    return { bg: '#f0fff4', text: '#276749', border: '#9ae6b4' };
};

/* ─── Modal helper ──────────────────────────────────── */
function Modal({ title, subtitle, onClose, children }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: '20px', maxWidth: '700px', width: '100%',
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '22px 28px', borderBottom: '1px solid #edf2f7',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    background: 'linear-gradient(135deg,#4c51bf 0%,#667eea 100%)', color: 'white'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontWeight: '800', fontSize: '18px' }}>{title}</h3>
                        {subtitle && <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '13px' }}>{subtitle}</p>}
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                        width: '32px', height: '32px', borderRadius: '50%',
                        cursor: 'pointer', fontSize: '18px', fontWeight: '700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>×</button>
                </div>
                <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

/* ─── Setup Wizard ──────────────────────────────────── */
function SetupWizard({ user, onComplete }) {
    const [step, setStep] = useState(1); // 1 = subjects, 2 = batches
    const [allSubjects, setAllSubjects] = useState([]);
    const [allBatches, setAllBatches]   = useState([]);
    const [selSubjects, setSelSubjects] = useState([]);
    const [selBatches,  setSelBatches]  = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [sRes, bRes] = await Promise.all([
                    api.get('/subjects'),
                    api.get('/batches')
                ]);
                setAllSubjects(sRes.data || []);
                setAllBatches(bRes.data || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchOptions();
    }, []);

    const toggleSubject = (s) => {
        setSelSubjects(prev =>
            prev.find(x => x._id === s._id) ? prev.filter(x => x._id !== s._id) : [...prev, s]
        );
    };
    const toggleBatch = (b) => {
        const key = b.name || b._id;
        setSelBatches(prev =>
            prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save assigned subjects & batches to the faculty profile via API
            await api.put('/faculty/my-profile', {
                username: user.username,
                assignedSubjects: selSubjects.map(s => s.name),
                assignedBatches: selBatches
            }, { headers: { 'x-username': user.username } });
            onComplete();
        } catch (err) {
            console.error(err);
            // Even on error, proceed so they're not blocked
            onComplete();
        } finally { setSaving(false); }
    };

    const styles = {
        card: (selected) => ({
            padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
            border: selected ? '2px solid #4c51bf' : '2px solid #e2e8f0',
            background: selected ? '#ebf4ff' : 'white',
            transition: 'all 0.15s', userSelect: 'none',
            display: 'flex', alignItems: 'center', gap: '12px'
        }),
        check: (selected) => ({
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
            border: `2px solid ${selected ? '#4c51bf' : '#cbd5e0'}`,
            background: selected ? '#4c51bf' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: '900', transition: 'all 0.15s'
        })
    };

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg,#4c51bf 0%,#667eea 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
            <div style={{
                background: 'white', borderRadius: '24px', maxWidth: '680px', width: '100%',
                boxShadow: '0 30px 80px rgba(0,0,0,0.25)', overflow: 'hidden'
            }}>
                {/* Top Banner */}
                <div style={{
                    background: 'linear-gradient(135deg,#4c51bf 0%,#667eea 100%)',
                    padding: '32px 36px', color: 'white'
                }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                        {step === 1 ? '' : ''}
                    </div>
                    <h2 style={{ margin: 0, fontWeight: '900', fontSize: '24px' }}>
                        {step === 1 ? 'Select Your Subjects' : 'Select Your Batches'}
                    </h2>
                    <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '14px' }}>
                        {step === 1
                            ? 'Choose the subjects you are assigned to teach.'
                            : 'Choose the batches you are handling this semester.'}
                    </p>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        {[1, 2].map(n => (
                            <div key={n} style={{
                                height: '6px', flex: 1, borderRadius: '6px',
                                background: n <= step ? 'white' : 'rgba(255,255,255,0.35)',
                                transition: 'background 0.3s'
                            }} />
                        ))}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.75, fontWeight: '600' }}>
                        Step {step} of 2
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '28px 36px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}></div>
                            <p style={{ fontWeight: '600' }}>Loading options...</p>
                        </div>
                    ) : step === 1 ? (
                        <>
                            <div style={{ marginBottom: '12px', color: '#718096', fontSize: '13px', fontWeight: '600' }}>
                                {selSubjects.length} subject{selSubjects.length !== 1 ? 's' : ''} selected
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                                {allSubjects.map(s => {
                                    const sel = !!selSubjects.find(x => x._id === s._id);
                                    return (
                                        <div key={s._id} style={styles.card(sel)} onClick={() => toggleSubject(s)}>
                                            <div style={styles.check(sel)}>{sel && ''}</div>
                                            <div>
                                                {s.code && <div style={{ fontSize: '10px', fontWeight: '800', color: '#4c51bf', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.code}</div>}
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a202c', lineHeight: 1.3 }}>{s.name}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {allSubjects.length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#a0aec0', padding: '30px', fontWeight: '600' }}>
                                        No subjects found in the system.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: '12px', color: '#718096', fontSize: '13px', fontWeight: '600' }}>
                                {selBatches.length} batch{selBatches.length !== 1 ? 'es' : ''} selected
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                                {allBatches.map(b => {
                                    const key = b.name || b._id;
                                    const sel = selBatches.includes(key);
                                    return (
                                        <div key={b._id} style={styles.card(sel)} onClick={() => toggleBatch(b)}>
                                            <div style={styles.check(sel)}>{sel && ''}</div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a202c' }}>{b.name}</div>
                                                {(b.department || b.semester) && (
                                                    <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', marginTop: '2px' }}>
                                                        {[b.department, b.semester ? `Sem ${b.semester}` : ''].filter(Boolean).join(' · ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {allBatches.length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#a0aec0', padding: '30px', fontWeight: '600' }}>
                                        No batches found in the system.
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Navigation buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
                        {step === 2 ? (
                            <button onClick={() => setStep(1)} style={{
                                padding: '12px 24px', borderRadius: '12px', border: '2px solid #e2e8f0',
                                background: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                                color: '#4a5568'
                            }}>← Back</button>
                        ) : (
                            <button onClick={onComplete} style={{
                                padding: '12px 24px', borderRadius: '12px', border: '2px solid #e2e8f0',
                                background: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                                color: '#a0aec0'
                            }}>Skip for now</button>
                        )}
                        <button
                            onClick={step === 1 ? () => setStep(2) : handleSave}
                            disabled={saving}
                            style={{
                                padding: '12px 36px', borderRadius: '12px', border: 'none',
                                background: 'linear-gradient(135deg,#4c51bf 0%,#667eea 100%)',
                                color: 'white', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(76,81,191,0.4)', opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? ' Saving…' : step === 1 ? 'Next: Batches →' : ' Save & Open Dashboard'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Dashboard ────────────────────────────────── */
function FacultyDashboard({ user, viewingAs }) {
    const [showSetup, setShowSetup]   = useState(false);
    const [dashData,  setDashData]    = useState(null);
    const [loading,   setLoading]     = useState(true);
    const [error,     setError]       = useState('');
    const [activeTab, setActiveTab]   = useState('overview');
    const [modal,     setModal]       = useState(null); // { type: 'subjects'|'batches'|'periods'|'today' }
    const isPreviewMode = viewingAs === 'faculty' && user?.role !== 'FACULTY';
    const [previewFaculties, setPreviewFaculties] = useState([]);
    const [previewFacultyId, setPreviewFacultyId] = useState('');

    useEffect(() => {
        if (isPreviewMode) {
            fetchPreviewFaculties();
        } else {
            fetchDashboard(user.username);
        }
    }, [isPreviewMode, user.username]);

    useEffect(() => {
        if (isPreviewMode && previewFacultyId) {
            fetchDashboard(previewFacultyId);
        }
    }, [isPreviewMode, previewFacultyId]);

    const fetchPreviewFaculties = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/faculty');
            const faculty = res.data || [];
            setPreviewFaculties(faculty);
            if (faculty.length > 0) {
                setPreviewFacultyId(faculty[0].facultyId);
            } else {
                setDashData(null);
            }
        } catch (err) {
            console.error('Faculty preview load error:', err);
            setError(err.response?.data?.error || 'Failed to load faculty profiles.');
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboard = async (username = user.username) => {
        if (!username) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/faculty/my-dashboard', {
                params: { username },
                headers: { 'x-username': username }
            });
            setDashData(res.data);
        } catch (err) {
            console.error('Faculty dashboard error:', err);
            setError(err.response?.data?.error || 'Failed to load dashboard. Make sure your faculty profile is set up.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetupComplete = () => {
        localStorage.setItem(`faculty_setup_done_${user.username}`, '1');
        setShowSetup(false);
        fetchDashboard(isPreviewMode ? previewFacultyId : user.username);
    };

    /* ── Loading / Error / Setup ─────────── */
    if (showSetup) return <SetupWizard user={user} onComplete={handleSetupComplete} />;

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#4c51bf', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#718096', fontWeight: '600', fontSize: '14px' }}>Loading Dashboard...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (isPreviewMode && previewFaculties.length === 0) return (
        <div className="responsive-padding" style={{ fontFamily: "'Inter', sans-serif", background: '#f7fafc', minHeight: '100vh' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '40px 24px', borderRadius: '16px', maxWidth: '500px', margin: '40px auto', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <p style={{ fontWeight: '800', marginBottom: '8px', fontSize: '18px', color: '#4a5568' }}>No Faculty Profiles</p>
                <p style={{ fontSize: '14px', color: '#718096', lineHeight: 1.5 }}>There are no faculty profiles registered in this institution yet. Add faculty members to configure timetables and view dashboards.</p>
            </div>
        </div>
    );

    if (error) return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '24px', borderRadius: '16px', maxWidth: '500px', margin: '0 auto' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}></div>
                <p style={{ fontWeight: '700', marginBottom: '8px', fontSize: '16px' }}>Dashboard Error</p>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>{error}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={() => isPreviewMode ? fetchPreviewFaculties() : fetchDashboard(user.username)} style={{ padding: '10px 24px', background: '#c53030', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                        Retry
                    </button>
                    {/* Re-run setup removed */}
                </div>
            </div>
        </div>
    );

    if (!dashData) return null;

    const { faculty, stats, todayDay, todaySchedule, weeklySchedule, assignedCourses, assignedBatches, assignedSubjects } = dashData;
    const scheduleDays = Array.isArray(dashData.scheduleDays) && dashData.scheduleDays.length > 0 ? dashData.scheduleDays : DAYS;

    /* ── KPI card config (2 cards only) ─── */
    const kpiCards = [
        {
            id: 'periods',
            label: 'Weekly Periods',
            value: stats.totalWeeklyPeriods,
            icon: '',
            color: '#6b46c1',
            bg: '#faf5ff',
            border: '#d6bcfa',
            modalTitle: 'Weekly Schedule Summary',
            modalSubtitle: `${stats.totalWeeklyPeriods} periods per week`
        },
        {
            id: 'today',
            label: "Today's Classes",
            value: stats.todayClassCount,
            icon: '',
            color: '#702459',
            bg: '#fff5f7',
            border: '#fed7e2',
            modalTitle: `Today's Schedule — ${todayDay}`,
            modalSubtitle: `${stats.todayClassCount} class${stats.todayClassCount !== 1 ? 'es' : ''} scheduled`
        },
    ];

    /* ── Modal content renderer ─────────── */
    const renderModalContent = () => {
        if (!modal) return null;
        const card = kpiCards.find(c => c.id === modal);

        if (modal === 'subjects') {
            return (
                <Modal title={card.modalTitle} subtitle={card.modalSubtitle} onClose={() => setModal(null)}>
                    {assignedSubjects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}></div>
                            <p style={{ fontWeight: '700', fontSize: '15px' }}>No subjects assigned yet.</p>
                            <p style={{ fontSize: '13px', marginTop: '4px' }}>Contact the Main Administration System to get courses assigned.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {assignedCourses.map((course, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    padding: '14px 16px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', background: '#fafafa'
                                }}>
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                                        background: 'linear-gradient(135deg,#4c51bf,#667eea)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: '900', fontSize: '16px'
                                    }}>
                                        {(idx + 1)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {course.courseCode && (
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#4c51bf', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                                                {course.courseCode}
                                            </div>
                                        )}
                                        <div style={{ fontWeight: '800', fontSize: '14px', color: '#1a202c' }}>{course.subject}</div>
                                        <div style={{ fontSize: '12px', color: '#718096', fontWeight: '600', marginTop: '2px' }}>
                                             Batch: {course.batch}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '11px', color: '#718096', fontWeight: '600' }}>
                                        <div>Lecture Hours: <strong style={{ color: '#4c51bf' }}>{course.lectureHours ?? course.lectureSessions ?? 0}</strong></div>
                                        <div>Lab Hours: <strong style={{ color: '#4c51bf' }}>{course.labHours ?? course.labSessions ?? 0}</strong></div>
                                        <div style={{ marginTop: '2px', fontSize: '12px', color: '#1a202c' }}>Units: <strong style={{ color: '#2f855a' }}>{course.totalUnitsConducted || 0}</strong></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            );
        }

        if (modal === 'batches') {
            return (
                <Modal title={card.modalTitle} subtitle={card.modalSubtitle} onClose={() => setModal(null)}>
                    {assignedBatches.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}></div>
                            <p style={{ fontWeight: '700', fontSize: '15px' }}>No batches assigned yet.</p>
                        </div>
                    ) : (
                        <div className="responsive-grid-2" style={{ gap: '10px' }}>
                            {assignedBatches.map((batch, idx) => {
                                const batchCourses = assignedCourses.filter(c => c.batch === batch);
                                return (
                                    <div key={idx} style={{
                                        padding: '18px', borderRadius: '14px',
                                        border: '1px solid #bee3f8', background: '#ebf4ff'
                                    }}>
                                        <div style={{ fontSize: '28px', marginBottom: '6px' }}></div>
                                        <div style={{ fontWeight: '900', fontSize: '15px', color: '#1a202c', marginBottom: '4px' }}>{batch}</div>
                                        <div style={{ fontSize: '12px', color: '#4c51bf', fontWeight: '700' }}>
                                            {batchCourses.length} course{batchCourses.length !== 1 ? 's' : ''} assigned
                                        </div>
                                        {batchCourses.length > 0 && (
                                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {batchCourses.map((c, i) => (
                                                    <div key={i} style={{
                                                        background: 'white', borderRadius: '8px', padding: '6px 10px',
                                                        fontSize: '11px', fontWeight: '700', color: '#2d3748', border: '1px solid #e2e8f0'
                                                    }}>
                                                         {c.subject}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal>
            );
        }

        if (modal === 'periods') {
            // Count per day
            const dayCounts = scheduleDays.map(day => ({
                day,
                count: Object.keys(weeklySchedule[day] || {}).length
            }));
            return (
                <Modal title={card.modalTitle} subtitle={card.modalSubtitle} onClose={() => setModal(null)}>
                    <div className="responsive-grid-2" style={{ gap: '10px', marginBottom: '20px' }}>
                        {dayCounts.map(({ day, count }) => (
                            <div key={day} style={{
                                padding: '16px', borderRadius: '12px',
                                border: day === todayDay ? '2px solid #4c51bf' : '1px solid #e2e8f0',
                                background: day === todayDay ? '#ebf4ff' : 'white',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    {day === todayDay && <div style={{ fontSize: '10px', color: '#4c51bf', fontWeight: '800', marginBottom: '2px' }}>TODAY</div>}
                                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#1a202c' }}>{day}</div>
                                </div>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: count > 0 ? 'linear-gradient(135deg,#4c51bf,#667eea)' : '#edf2f7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '900', fontSize: '20px', color: count > 0 ? 'white' : '#a0aec0'
                                }}>
                                    {count}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ background: '#f7fafc', borderRadius: '12px', padding: '16px', border: '1px solid #edf2f7', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#a0aec0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Weekly Periods</div>
                        <div style={{ fontSize: '40px', fontWeight: '900', color: '#4c51bf', lineHeight: 1.2 }}>{stats.totalWeeklyPeriods}</div>
                        <div style={{ fontSize: '12px', color: '#718096', fontWeight: '600' }}>out of {faculty.maxWeeklyLoad} max load</div>
                    </div>
                </Modal>
            );
        }

        if (modal === 'today') {
            return (
                <Modal title={card.modalTitle} subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} onClose={() => setModal(null)}>
                    {todaySchedule.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>
                            <div style={{ fontSize: '56px', marginBottom: '12px' }}></div>
                            <p style={{ fontWeight: '800', fontSize: '16px', color: '#4a5568' }}>No Classes Today!</p>
                            <p style={{ fontSize: '13px', marginTop: '4px' }}>Enjoy your free day.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {PERIODS.map(period => {
                                const cls = todaySchedule.find(c => c.period === period);
                                const colors = cls ? getTypeColor(cls.type) : null;
                                return (
                                    <div key={period} style={{
                                        display: 'flex', alignItems: 'stretch', borderRadius: '12px',
                                        border: `1px solid ${cls ? colors.border : '#edf2f7'}`,
                                        background: cls ? colors.bg : '#fafafa', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            minWidth: '80px', padding: '14px 12px', textAlign: 'center',
                                            background: cls ? colors.border : '#edf2f7',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <div style={{ fontWeight: '900', fontSize: '18px', color: cls ? colors.text : '#a0aec0' }}>P{period}</div>
                                            <div style={{ fontSize: '9px', fontWeight: '700', color: cls ? colors.text : '#a0aec0', textAlign: 'center' }}>{PERIOD_LABELS[period]}</div>
                                        </div>
                                        <div style={{ padding: '14px 16px', flex: 1 }}>
                                            {cls ? (
                                                <>
                                                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#1a202c', marginBottom: '4px' }}>{cls.subject}</div>
                                                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#718096', fontWeight: '600' }}>
                                                        <span> {cls.batch}</span>
                                                        <span> {cls.room}</span>
                                                        <span style={{ background: colors.border, color: colors.text, padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>{cls.type || 'Lecture'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ color: '#cbd5e0', fontWeight: '600', fontSize: '13px', lineHeight: '42px' }}>— Free Period —</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal>
            );
        }
        return null;
    };

    /* ─── Render ─────────────────────────────────────── */
    return (
        <div className="responsive-padding" style={{ fontFamily: "'Inter', sans-serif", background: '#f7fafc', minHeight: '100vh' }}>

            {/* Modals */}
            {modal && renderModalContent()}

            {isPreviewMode && previewFaculties.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', border: '1px solid #edf2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#4a5568' }}>Preview Faculty</span>
                    <select
                        value={previewFacultyId}
                        onChange={(e) => setPreviewFacultyId(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontWeight: '700', color: '#2d3748', minWidth: '240px' }}
                    >
                        {previewFaculties.map(f => (
                            <option key={f._id || f.id} value={f.facultyId}>
                                {f.name} ({f.facultyId})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Header ───────────────────── */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {faculty.profilePhoto ? (
                        <img src={faculty.profilePhoto} alt="Faculty" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4c51bf', boxShadow: '0 4px 15px rgba(76,81,191,0.35)', flexShrink: 0 }} />
                    ) : (
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '30px', fontWeight: '900', color: 'white',
                            boxShadow: '0 4px 15px rgba(76,81,191,0.35)', flexShrink: 0
                        }}>
                            {faculty.name ? faculty.name.charAt(0).toUpperCase() : 'F'}
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#1a202c', margin: 0 }}>
                            Welcome, {faculty.name} 
                        </h1>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
                            <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}>🪪 {faculty.facultyId}</span>
                            <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}> {faculty.department}</span>
                            {faculty.branch && <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}> {faculty.branch}</span>}
                            {faculty.email && <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}> {faculty.email}</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
                            color: 'white', padding: '10px 20px', borderRadius: '12px',
                            textAlign: 'center', boxShadow: '0 4px 12px rgba(76,81,191,0.3)'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekly Load</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', lineHeight: 1.2 }}>
                                {stats.totalWeeklyPeriods}<span style={{ fontSize: '14px', fontWeight: '700', opacity: 0.8 }}>/{faculty.maxWeeklyLoad}</span>
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: '600', opacity: 0.75 }}>Periods / Week</div>
                            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.9, marginTop: '4px' }}>
                                L {stats.weeklyLectureHours || 0} | Lab {stats.weeklyLabHours || 0}
                            </div>
                        </div>
                        {/* Setup wizard button removed */}
                    </div>
                </div>
            </div>

            {/* ── Tab Navigation ───────────── */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', background: 'white', padding: '6px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '24px', width: 'fit-content', maxWidth: '100%' }}>
                {[
                    { id: 'overview', label: ' Overview' },
                    { id: 'today',    label: ` Today (${todayDay})` },
                    { id: 'weekly',   label: ' Weekly Timetable' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none',
                        fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === tab.id ? 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)' : 'transparent',
                        color: activeTab === tab.id ? 'white' : '#718096',
                        boxShadow: activeTab === tab.id ? '0 2px 8px rgba(76,81,191,0.3)' : 'none'
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW TAB ─────────────── */}
            {activeTab === 'overview' && (
                <div>
                    {/* 2 Clickable KPI Cards */}
                    <div className="responsive-grid-2" style={{ marginBottom: '28px' }}>
                        {kpiCards.map((card) => (
                            <div key={card.id}
                                onClick={() => setModal(card.id)}
                                style={{
                                    background: 'white', borderRadius: '16px', padding: '22px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${card.border}`,
                                    cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s',
                                    position: 'relative'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                            >
                                {/* "Click to view" hint */}
                                <div style={{
                                    position: 'absolute', top: '10px', right: '12px',
                                    fontSize: '10px', color: '#a0aec0', fontWeight: '700',
                                    background: card.bg, padding: '2px 8px', borderRadius: '20px',
                                    border: `1px solid ${card.border}`
                                }}>
                                    View →
                                </div>
                                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{card.icon}</div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                    {card.label}
                                </div>
                                <div style={{ fontSize: '36px', fontWeight: '900', color: card.color, lineHeight: 1 }}>
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Profile + Assignments row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
                        {/* Profile Details */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #edf2f7' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1a202c', marginBottom: '16px' }}> Faculty Profile</h3>
                            {[
                                ['Faculty ID',      faculty.facultyId],
                                ['Department',      faculty.department],
                                ['Branch',          faculty.branch || 'N/A'],
                                ['Qualification',   faculty.qualification || 'N/A'],
                                ['Email',           faculty.email],
                                ['Max Weekly Load', `${faculty.maxWeeklyLoad} periods`],
                            ].map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f7fafc' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#2d3748' }}>{value}</span>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* Today quick preview */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #edf2f7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1a202c', margin: 0 }}>
                                 Today's Schedule — <span style={{ color: '#4c51bf' }}>{todayDay}</span>
                            </h3>
                            <button onClick={() => setActiveTab('today')} style={{ fontSize: '12px', fontWeight: '700', color: '#4c51bf', background: '#ebf4ff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                                View Full →
                            </button>
                        </div>
                        {todaySchedule.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#a0aec0' }}>
                                <div style={{ fontSize: '36px', marginBottom: '6px' }}></div>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>No classes today. Enjoy your free day!</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                                {todaySchedule.map((cls, idx) => {
                                    const colors = getTypeColor(cls.type);
                                    return (
                                        <div key={idx} style={{ minWidth: '160px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                                                Period {cls.period} • {cls.timeLabel}
                                            </div>
                                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#1a202c', marginBottom: '4px', lineHeight: 1.3 }}>{cls.subject} ({cls.classType || cls.type || 'Lecture'})</div>
                                            <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600' }}> {cls.batch}</div>
                                            <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600' }}> {cls.room}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── TODAY TAB ─────────────────── */}
            {activeTab === 'today' && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #edf2f7' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a202c', marginBottom: '6px' }}> Today's Schedule</h2>
                    <p style={{ color: '#718096', fontSize: '14px', fontWeight: '600', marginBottom: '24px' }}>
                        {todayDay} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    {todaySchedule.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a0aec0' }}>
                            <div style={{ fontSize: '64px', marginBottom: '16px' }}></div>
                            <h3 style={{ fontWeight: '800', fontSize: '20px', color: '#4a5568' }}>No Classes Today!</h3>
                            <p style={{ fontSize: '14px', marginTop: '8px' }}>Check your weekly schedule for upcoming classes.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {PERIODS.map(period => {
                                const cls = todaySchedule.find(c => c.period === period);
                                const colors = cls ? getTypeColor(cls.type) : null;
                                return (
                                    <div key={period} style={{ display: 'flex', alignItems: 'stretch', background: cls ? colors.bg : '#f7fafc', border: `1px solid ${cls ? colors.border : '#edf2f7'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                        <div style={{ padding: '16px 20px', background: cls ? colors.border : '#edf2f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '90px' }}>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: cls ? colors.text : '#a0aec0' }}>P{period}</div>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: cls ? colors.text : '#a0aec0', textAlign: 'center', marginTop: '2px' }}>{PERIOD_LABELS[period]}</div>
                                        </div>
                                        <div style={{ padding: '16px', flex: 1 }}>
                                            {cls ? (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <h4 style={{ fontWeight: '800', fontSize: '15px', color: '#1a202c', margin: '0 0 4px 0' }}>{cls.subject}</h4>
                                                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#718096', fontWeight: '600' }}>
                                                            <span> Batch: <strong>{cls.batch}</strong></span>
                                                            <span> Room: <strong>{cls.room}</strong></span>
                                                        </div>
                                                    </div>
                                                    <span style={{ background: colors.border, color: colors.text, padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                                                        {cls.classType || cls.type || 'Lecture'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#cbd5e0', fontWeight: '600', fontSize: '13px', lineHeight: '44px' }}>— Free Period —</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── WEEKLY TAB ───────────────── */}
            {activeTab === 'weekly' && (
                <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #edf2f7' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a202c', marginBottom: '20px' }}> Weekly Teaching Schedule</h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '12px 16px', background: '#f7fafc', borderBottom: '2px solid #edf2f7', fontSize: '11px', fontWeight: '800', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', minWidth: '100px' }}>
                                        Day / Period
                                    </th>
                                    {PERIODS.map(p => (
                                        <th key={p} style={{ padding: '12px 10px', background: '#f7fafc', borderBottom: '2px solid #edf2f7', fontSize: '10px', fontWeight: '800', color: '#718096', textTransform: 'uppercase', textAlign: 'center', minWidth: '100px' }}>
                                            P{p}<br /><span style={{ fontWeight: '600', letterSpacing: 0 }}>{PERIOD_LABELS[p]}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scheduleDays.map((day, di) => (
                                    <tr key={day} style={{ background: day === todayDay ? '#f0fff4' : (di % 2 === 0 ? 'white' : '#fafafa') }}>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #edf2f7', fontWeight: '800', fontSize: '13px', color: day === todayDay ? '#276749' : '#2d3748' }}>
                                            {day === todayDay && <span style={{ marginRight: '6px' }}></span>}{day}
                                        </td>
                                        {PERIODS.map(period => {
                                            const cls = weeklySchedule[day]?.[period];
                                            const colors = cls ? getTypeColor(cls.type) : null;
                                            return (
                                                <td key={period} style={{ padding: '6px', borderBottom: '1px solid #edf2f7', borderLeft: '1px solid #edf2f7' }}>
                                                    {cls ? (
                                                        <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: '800', color: colors.text, lineHeight: 1.2 }}>{cls.subject} ({cls.classType || cls.type || 'Lecture'})</div>
                                                            <div style={{ fontSize: '10px', color: '#718096', fontWeight: '600', marginTop: '3px' }}>{cls.batch}</div>
                                                            <div style={{ fontSize: '10px', color: '#a0aec0', fontWeight: '600' }}>{cls.room}</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ color: '#e2e8f0', fontSize: '16px' }}>—</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Lecture',  color: getTypeColor('lecture')  },
                            { label: 'Lab',      color: getTypeColor('lab')      },
                            { label: 'Elective', color: getTypeColor('elective') },
                            { label: 'Training', color: getTypeColor('training') },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color.bg, border: `1px solid ${item.color.border}` }} />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#718096' }}>{item.label}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f0fff4', border: '1px solid #9ae6b4' }} />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#276749' }}> Today</span>
                        </div>
                    </div>

                    {/* ── Charts & Analytics ── */}
                    <div style={{ marginTop: '24px' }}>
                        {/* Area: Weekly Load Distribution */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #edf2f7' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1a202c', marginBottom: '12px' }}> Weekly Load Distribution</h3>
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={(() => {
                                    return scheduleDays.map(d => ({
                                        day: d.substring(0, 3),
                                        periods: Object.keys(weeklySchedule[d] || {}).length,
                                        classes: (todayDay === d ? todaySchedule.length : 0)
                                    }));
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="periods" stroke="#4c51bf" fill="#c3dafe" strokeWidth={2} name="Periods" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default FacultyDashboard;
