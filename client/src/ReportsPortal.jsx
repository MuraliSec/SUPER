import React, { useState, useEffect } from 'react';
import api from './api/axios';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const PERIOD_LABELS = {
    1: '9:00-10:00', 2: '10:00-11:00', 3: '11:00-12:00', 4: '12:00-1:00',
    5: '1:00-2:00', 6: '2:00-3:00', 7: '3:00-4:00', 8: '4:00-5:00'
};

const TABS = [
    { id: 'faculty', label: '‍ Faculty Report' },
    { id: 'room', label: ' Room Wise' },
    { id: 'course', label: ' Course Wise' },
    { id: 'batch', label: ' Batch Wise' },
    { id: 'slot', label: ' Slot Analysis' },
    { id: 'utilization', label: ' Room Utilization' },
];

/* ─── tiny helpers ─────────────────────────────── */
function Spinner() {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div style={{ width: 38, height: 38, border: '4px solid #e0e7ff', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>;
}
function Card({ children, style = {}, title }) {
    return (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 22, marginBottom: 18, ...style }}>
            {title && <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: '#1e1b4b' }}>{title}</h3>}
            {children}
        </div>
    );
}
function Badge({ color = 'gray', children }) {
    const map = {
        green: '#dcfce7|#16a34a', blue: '#dbeafe|#2563eb', red: '#fee2e2|#dc2626',
        yellow: '#fef9c3|#b45309', purple: '#f3e8ff|#9333ea', gray: '#f3f4f6|#6b7280', indigo: '#e0e7ff|#4338ca'
    };
    const [bg, text] = (map[color] || map.gray).split('|');
    return <span style={{ background: bg, color: text, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}
function CheckList({ items, selected, onToggle, labelKey = 'name', subKey }) {
    return (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.map((item, i) => {
                const val = typeof item === 'string' ? item : item[labelKey];
                const checked = selected.includes(val);
                return (
                    <div key={i} onClick={() => onToggle(val)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                            background: checked ? '#e0e7ff' : 'transparent', marginBottom: 2, transition: 'background 0.15s'
                        }}>
                        <div style={{
                            width: 18, height: 18, borderRadius: 4, border: '2px solid #6366f1', background: checked ? '#6366f1' : 'white',
                            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {checked && <span style={{ color: 'white', fontSize: 11, lineHeight: 1 }}></span>}
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{val}</div>
                            {subKey && item[subKey] && <div style={{ fontSize: 11, color: '#6b7280' }}>{item[subKey]}</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ════════════════════════════════════════════════
   1. FACULTY REPORT – Consolidated free/busy view
   ════════════════════════════════════════════════ */
function FacultyReport() {
    const [allFaculty, setAllFaculty] = useState([]);
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState('');
    const [report, setReport] = useState(null);       // { name: {schedule, weeklyGrid} }
    const [loading, setLoading] = useState(false);

    useEffect(() => { api.get('/faculty').then(r => setAllFaculty(r.data)).catch(console.error); }, []);

    const filtered = allFaculty.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));
    const toggle = (name) => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);

    const generate = async () => {
        if (!selected.length) return;
        setLoading(true);
        try {
            const r = await api.get('/reports/faculty', { params: { facultyNames: selected.join(',') } });
            setReport(r.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    /* Build consolidated slot grid: { day: { period: { free:[names], busy:[{name,subject,room,batch}] } } } */
    const buildGrid = () => {
        if (!report) return null;
        const grid = {};
        DAYS.forEach(d => { grid[d] = {}; PERIODS.forEach(p => { grid[d][p] = { free: [], busy: [] }; }); });
        selected.forEach(name => {
            const data = report[name];
            if (!data) return;
            const busySet = {};
            (data.schedule || []).forEach(s => { busySet[`${s.day}-${s.period}`] = s; });
            DAYS.forEach(d => {
                PERIODS.forEach(p => {
                    const key = `${d}-${p}`;
                    if (busySet[key]) { grid[d][p].busy.push({ name, ...busySet[key] }); }
                    else { grid[d][p].free.push(name); }
                });
            });
        });
        return grid;
    };

    const grid = buildGrid();

    return (
        <div style={{ display: 'grid', gap: '20px' }} className="grid-cols-1 lg:grid-cols-[280px_1fr]">
            {/* Selector */}
            <Card title="Select Faculty">
                <input placeholder=" Search..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '2px solid #e0e7ff', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                <CheckList items={filtered} selected={selected} onToggle={toggle} labelKey="name" subKey="department" />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setSelected(filtered.map(f => f.name))}
                        style={{ flex: 1, padding: 8, background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>All</button>
                    <button onClick={() => setSelected([])}
                        style={{ flex: 1, padding: 8, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Clear</button>
                </div>
                <button onClick={generate} disabled={!selected.length || loading}
                    style={{ width: '100%', marginTop: 10, padding: 10, background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: (!selected.length || loading) ? 0.6 : 1 }}>
                    {loading ? 'Loading...' : selected.length ? `Show Report (${selected.length} faculty)` : 'Select Faculty'}
                </button>
                {selected.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>SELECTED:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {selected.map((n, i) => <Badge key={i} color="indigo">{n.split(' ').slice(-1)[0]}</Badge>)}
                        </div>
                    </div>
                )}
            </Card>

            {/* Consolidated Grid */}
            <div>
                {loading && <Spinner />}
                {grid && !loading && (
                    <Card>
                        <div style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: 4 }}>
                            Consolidated Availability — {selected.length} Faculty Selected
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                            <span style={{ marginRight: 12 }}> Free &nbsp;</span>
                            <span> Busy — shows subject / room / batch</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
                                <thead>
                                    <tr style={{ background: '#e0e7ff' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 95 }}>Time</th>
                                        {DAYS.map(d => <th key={d} style={{ padding: '8px 8px', textAlign: 'center', minWidth: 160 }}>{d}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {PERIODS.map(p => (
                                        <tr key={p} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '6px 10px', fontWeight: 700, color: '#6366f1', fontSize: 11, whiteSpace: 'nowrap' }}>
                                                {PERIOD_LABELS[p]}
                                            </td>
                                            {DAYS.map(d => {
                                                const cell = grid[d][p];
                                                return (
                                                    <td key={d} style={{ padding: 4, verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {/* Busy entries */}
                                                            {cell.busy.map((b, i) => (
                                                                <div key={i} style={{ background: '#fee2e2', borderLeft: '3px solid #ef4444', borderRadius: 6, padding: '4px 7px' }}>
                                                                    <div style={{ fontWeight: 700, color: '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{b.name}</div>
                                                                    <div style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{b.subject}</div>
                                                                    <div style={{ color: '#9333ea', fontSize: 10 }}>{b.batch} · {b.room}</div>
                                                                </div>
                                                            ))}
                                                            {/* Free entries */}
                                                            {cell.free.length > 0 && (
                                                                <div style={{ background: '#f0fdf4', borderLeft: '3px solid #22c55e', borderRadius: 6, padding: '4px 7px', minHeight: 28 }}>
                                                                    <div style={{ fontWeight: 600, color: '#15803d', fontSize: 10, marginBottom: 2 }}> FREE ({cell.free.length})</div>
                                                                    <div style={{ color: '#374151', fontSize: 10, lineHeight: 1.4 }}>
                                                                        {cell.free.map(n => n.split(' ').slice(-1)[0]).join(', ')}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary table */}
                        <div style={{ marginTop: 20 }}>
                            <h4 style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: 10 }}>Individual Summary</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#e0e7ff' }}>
                                    {['Faculty', 'Engaged Hours', 'Free Slots', 'Subjects Taught'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left' }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {selected.map((name, i) => {
                                        const d = report[name];
                                        const engaged = d?.totalHours || 0;
                                        const subjects = [...new Set((d?.schedule || []).map(s => s.subject).filter(Boolean))];
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : 'white' }}>
                                                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e1b4b' }}>{name}</td>
                                                <td style={{ padding: '8px 12px' }}><Badge color="red">{engaged} hrs</Badge></td>
                                                <td style={{ padding: '8px 12px' }}><Badge color="green">{(5 * 8) - engaged} slots</Badge></td>
                                                <td style={{ padding: '8px 12px', color: '#374151', fontSize: 12 }}>{subjects.join(', ') || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {!grid && !loading && (
                    <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
                        <div style={{ fontSize: 64 }}>‍</div>
                        <p style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginTop: 12 }}>Select faculty members and click "Show Report"</p>
                        <p style={{ fontSize: 13, color: '#9ca3af' }}>The consolidated view shows who is free vs busy per time slot</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════
   2. ROOM WISE REPORT
   ════════════════════════════════════════════════ */
function RoomReport() {
    const [rooms, setRooms] = useState([]);
    const [selected, setSelected] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [typeFilter, setTypeFilter] = useState('All');

    useEffect(() => { api.get('/rooms').then(r => setRooms(r.data)).catch(console.error); }, []);

    const types = ['All', ...new Set(rooms.map(r => r.type).filter(Boolean))];
    const filteredRooms = rooms.filter(r => typeFilter === 'All' || r.type === typeFilter);
    const toggle = (name) => setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);

    const generate = async () => {
        if (!selected.length) return;
        setLoading(true);
        try {
            const r = await api.get('/reports/room', { params: { roomNames: selected.join(',') } });
            setReport(r.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    return (
        <div style={{ display: 'grid', gap: '20px' }} className="grid-cols-1 lg:grid-cols-[270px_1fr]">
            <Card title="Select Rooms">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {types.map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                            style={{
                                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11,
                                background: typeFilter === t ? '#6366f1' : '#e0e7ff', color: typeFilter === t ? 'white' : '#4338ca'
                            }}>
                            {t}
                        </button>
                    ))}
                </div>
                <CheckList items={filteredRooms} selected={selected} onToggle={toggle} labelKey="name" subKey="type" />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setSelected(filteredRooms.map(r => r.name))}
                        style={{ flex: 1, padding: 8, background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>All</button>
                    <button onClick={() => setSelected([])}
                        style={{ flex: 1, padding: 8, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Clear</button>
                </div>
                <button onClick={generate} disabled={!selected.length || loading}
                    style={{ width: '100%', marginTop: 10, padding: 10, background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: (!selected.length || loading) ? 0.6 : 1 }}>
                    {loading ? 'Loading...' : selected.length ? `Generate Report (${selected.length})` : 'Select Rooms'}
                </button>
            </Card>

            <div>
                {loading && <Spinner />}
                {report && !loading && Object.entries(report).map(([name, data]) => (
                    <Card key={name} title={` ${name}`}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                            <Badge color="blue">{data.type || '—'}</Badge>
                            {data.capacity && <Badge color="gray">Cap: {data.capacity}</Badge>}
                            <Badge color="red">Used: {data.usedHours}h</Badge>
                            <Badge color="green">Free: {data.totalHours - data.usedHours}h</Badge>
                            <Badge color="purple">{data.utilizationPct}% utilized</Badge>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead><tr style={{ background: '#e0e7ff' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Time</th>
                                    {DAYS.map(d => <th key={d} style={{ padding: '8px 6px', textAlign: 'center', minWidth: 110 }}>{d}</th>)}
                                </tr></thead>
                                <tbody>{PERIODS.map(p => (
                                    <tr key={p} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#6366f1', fontSize: 11, whiteSpace: 'nowrap' }}>{PERIOD_LABELS[p]}</td>
                                        {DAYS.map(d => {
                                            const cell = data.grid[d]?.[p];
                                            const occ = cell?.status === 'Occupied';
                                            return (
                                                <td key={d} style={{ padding: 3 }}>
                                                    {occ ? (
                                                        <div style={{ background: '#dbeafe', borderLeft: '3px solid #2563eb', borderRadius: 6, padding: '4px 7px' }}>
                                                            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100, color: '#1e1b4b' }}>{cell.data.subject}</div>
                                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{cell.data.faculty}</div>
                                                            <div style={{ color: '#9333ea', fontSize: 10 }}>{cell.data.batch}</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ height: 42, background: '#f0fdf4', border: '1px dashed #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ fontSize: 10, color: '#16a34a' }}>Free</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </Card>
                ))}
                {!report && !loading && (
                    <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
                        <div style={{ fontSize: 64 }}></div>
                        <p style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginTop: 12 }}>Select rooms & generate report</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════
   3. COURSE WISE REPORT
   ════════════════════════════════════════════════ */
function CourseReport() {
    const [courses, setCourses] = useState([]);
    const [selected, setSelected] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { api.get('/reports/courses-list').then(r => setCourses(r.data)).catch(console.error); }, []);

    const filtered = courses.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
    const dayOrder = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };

    const pick = async (name) => {
        setSelected(name); setLoading(true);
        try { const r = await api.get('/reports/course', { params: { courseName: name } }); setReport(r.data); }
        catch (e) { console.error(e); }
        setLoading(false);
    };

    return (
        <div style={{ display: 'grid', gap: '20px' }} className="grid-cols-1 lg:grid-cols-[290px_1fr]">
            <Card title="Select Course">
                <input placeholder=" Search..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '2px solid #e0e7ff', borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {filtered.map((c, i) => (
                        <div key={i} onClick={() => pick(c.name)}
                            style={{
                                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                                background: selected === c.name ? '#e0e7ff' : 'transparent',
                                borderLeft: selected === c.name ? '3px solid #6366f1' : '3px solid transparent'
                            }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{c.code} · {c.dept}</div>
                        </div>
                    ))}
                </div>
            </Card>
            <div>
                {loading && <Spinner />}
                {report && !loading && (
                    <Card title={` ${report.courseName}`}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                            <Badge color="indigo">{report.totalEntries} Sessions/Week</Badge>
                            <Badge color="blue">{report.faculties?.length} Faculty</Badge>
                            <Badge color="green">{report.rooms?.length} Rooms</Badge>
                            <Badge color="purple">{report.batches?.length} Batches</Badge>
                        </div>
                        <div style={{ display: 'grid', gap: '14px' }} className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {[['‍ Faculty', '#eff6ff', '#2563eb', report.faculties], [' Rooms', '#f0fdf4', '#16a34a', report.rooms], [' Batches', '#faf5ff', '#9333ea', report.batches]].map(([label, bg, col, items]) => (
                                <div key={label} style={{ background: bg, borderRadius: 10, padding: 14 }}>
                                    <div style={{ fontWeight: 700, color: col, marginBottom: 8, fontSize: 13 }}>{label}</div>
                                    {(items || []).map((x, i) => <div key={i} style={{ fontSize: 12, color: '#1e1b4b', padding: '2px 0' }}>{x}</div>)}
                                </div>
                            ))}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead><tr style={{ background: '#e0e7ff' }}>
                                {['Day', 'Time', 'Faculty', 'Room', 'Batch', 'Type'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left' }}>{h}</th>)}
                            </tr></thead>
                            <tbody>{[...(report.schedule || [])].sort((a, b) => dayOrder[a.day] - dayOrder[b.day] || a.period - b.period).map((s, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : 'white' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#4338ca' }}>{s.day}</td>
                                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.timeLabel}</td>
                                    <td style={{ padding: '8px 12px' }}>{s.faculty}</td>
                                    <td style={{ padding: '8px 12px' }}>{s.room}</td>
                                    <td style={{ padding: '8px 12px' }}><Badge color="purple">{s.batch}</Badge></td>
                                    <td style={{ padding: '8px 12px' }}><Badge color={s.type === 'Lab' ? 'blue' : 'green'}>{s.type}</Badge></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </Card>
                )}
                {!report && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: 64 }}></div><p style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginTop: 12 }}>Select a course to view its schedule</p></div>}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════
   4. BATCH WISE – timetable grid + correct count
   ════════════════════════════════════════════════ */
function BatchReport() {
    const [batches, setBatches] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);

    useEffect(() => { api.get('/reports/batch').then(r => setBatches(r.data)).catch(console.error); }, []);

    const pick = async (b) => {
        setSelected(b); setLoading(true);
        try { const r = await api.get('/reports/batch', { params: { batchId: b.id } }); setReport(r.data); }
        catch (e) { console.error(e); }
        setLoading(false);
    };

    const cellStyle = (p) => {
        if (!p || p.type === 'Free') return { height: 44, background: '#f9fafb', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' };
        if (p.type === 'Lunch') return { background: '#fef9c3', borderRadius: 6, padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: '#b45309', fontSize: 11 };
        const bg = p.type === 'Lab' ? '#dbeafe' : p.type === 'Training' ? '#fef9c3' : '#dcfce7';
        const bc = p.type === 'Lab' ? '#2563eb' : p.type === 'Training' ? '#b45309' : '#16a34a';
        return { background: bg, borderLeft: `3px solid ${bc}`, borderRadius: 6, padding: '4px 6px' };
    };

    return (
        <div style={{ display: 'grid', gap: '20px' }} className="grid-cols-1 lg:grid-cols-[250px_1fr]">
            <Card title="Batches">
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {batches.map((b, i) => (
                        <div key={i} onClick={() => pick(b)}
                            style={{
                                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                                background: selected?.id === b.id ? '#e0e7ff' : 'transparent',
                                borderLeft: selected?.id === b.id ? '3px solid #6366f1' : '3px solid transparent'
                            }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{b.batchName}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{b.totalPeriods} periods · {b.subjects} subjects · {b.faculty} faculty</div>
                        </div>
                    ))}
                    {!batches.length && <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: 20 }}>No timetables yet</p>}
                </div>
            </Card>

            <div>
                {loading && <Spinner />}
                {report && !loading && (
                    <Card title={` ${report.batchName}`}>
                        {/* ── Stats row ── */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                            <Badge color="indigo">{report.totalPeriods} Total Periods</Badge>
                            <Badge color="blue">{report.summary?.subjects?.length} Subjects</Badge>
                            <Badge color="green">{report.summary?.faculty?.length} Faculty</Badge>
                            <Badge color="purple">{report.summary?.rooms?.length} Rooms</Badge>
                        </div>

                        {/* ── Full timetable grid ── */}
                        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead><tr style={{ background: '#e0e7ff' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 90 }}>Time</th>
                                    {DAYS.map(d => <th key={d} style={{ padding: '8px 6px', textAlign: 'center', minWidth: 130 }}>{d}</th>)}
                                </tr></thead>
                                <tbody>{PERIODS.map(p => (
                                    <tr key={p} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#6366f1', fontSize: 11, whiteSpace: 'nowrap' }}>{PERIOD_LABELS[p]}</td>
                                        {DAYS.map(d => {
                                            const cell = report.grid[d]?.[p];
                                            return (
                                                <td key={d} style={{ padding: 3, verticalAlign: 'top' }}>
                                                    <div style={cellStyle(cell)}>
                                                        {cell && cell.type !== 'Free' && cell.type !== 'Lunch' ? (
                                                            <>
                                                                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, color: '#1e1b4b', fontSize: 11 }}>
                                                                    {cell.subject || cell.type}
                                                                </div>
                                                                <div style={{ color: '#6b7280', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{cell.faculty}</div>
                                                                <div style={{ color: '#9333ea', fontSize: 10 }}>{cell.room}</div>
                                                            </>
                                                        ) : cell?.type === 'Lunch' ? ' Lunch' : (<span style={{ color: '#d1d5db', fontSize: 10 }}>Free</span>)}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {!report && !loading && (
                    <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
                        <div style={{ fontSize: 64 }}></div>
                        <p style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginTop: 12 }}>Select a batch to view its complete timetable</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════
   5. SLOT ANALYSIS – Timetable Grid Format
      Rows = Time Slots, Columns = Days
      Shows which faculty/room are busy at each slot
   ════════════════════════════════════════════════ */
function SlotAnalysis() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [day, setDay] = useState('Monday');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'details'

    // Load data for current day
    const load = async (d = day) => {
        setLoading(true);
        try {
            const r = await api.get('/analysis/slots', { params: { day: d, periods: '1,2,3,4,5,6,7,8' } });
            setReport(r.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const changeDay = (d) => { setDay(d); load(d); };

    // Build a room × period grid from the slot data
    const buildRoomGrid = () => {
        if (!report) return { rooms: [], grid: {} };
        const allRooms = new Set();
        const grid = {};
        (report.periods || []).forEach(pData => {
            (pData.busyRooms || []).forEach(r => { allRooms.add(r.name); });
            grid[pData.period] = pData;
        });
        return { rooms: [...allRooms].sort(), grid };
    };

    const { rooms, grid } = buildRoomGrid();

    return (
        <div>
            {/* Controls */}
            <Card>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, fontSize: 13 }}>Day</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {DAYS.map(d => (
                                <button key={d} onClick={() => changeDay(d)}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8, border: `2px solid ${day === d ? '#6366f1' : '#e0e7ff'}`,
                                        background: day === d ? '#6366f1' : 'white', color: day === d ? 'white' : '#374151',
                                        cursor: 'pointer', fontWeight: 600, fontSize: 12
                                    }}>
                                    {d.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, fontSize: 13 }}>View</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[['grid', ' Grid'], ['details', ' Details']].map(([v, l]) => (
                                <button key={v} onClick={() => setViewMode(v)}
                                    style={{
                                        padding: '8px 14px', borderRadius: 8, border: `2px solid ${viewMode === v ? '#6366f1' : '#e0e7ff'}`,
                                        background: viewMode === v ? '#6366f1' : 'white', color: viewMode === v ? 'white' : '#374151',
                                        cursor: 'pointer', fontWeight: 600, fontSize: 12
                                    }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {loading && <Spinner />}

            {report && !loading && (
                viewMode === 'grid' ? (
                    /* ── TIMETABLE GRID VIEW (rows=periods, shows occupancy) ── */
                    <Card title={` ${day} — Timetable View`}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                                <thead>
                                    <tr style={{ background: '#e0e7ff' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 95 }}>Time Slot</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Available Rooms</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Occupied Sessions</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Free Faculty</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Busy Faculty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(report.periods || []).map((pData, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : 'white', verticalAlign: 'top' }}>
                                            <td style={{ padding: '10px 10px', fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>
                                                <div>{PERIOD_LABELS[pData.period]}</div>
                                                <div style={{ fontSize: 10, color: '#9ca3af' }}>Period {pData.period}</div>
                                            </td>
                                            <td style={{ padding: '6px 10px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                    {(pData.freeRooms || []).map((r, j) => (
                                                        <span key={j} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: '#15803d' }}>{r.name}</span>
                                                    ))}
                                                    {!pData.freeRooms?.length && <span style={{ color: '#9ca3af', fontSize: 11 }}>All occupied</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '6px 10px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {(pData.occupancy || []).map((o, j) => (
                                                        <div key={j} style={{ background: '#fee2e2', borderLeft: '3px solid #ef4444', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                                                            <span style={{ fontWeight: 700, color: '#1e1b4b' }}>{o.subject}</span>
                                                            <br />
                                                            <span style={{ color: '#6b7280' }}>{o.faculty} · {o.room}</span>
                                                            <br />
                                                            <span style={{ color: '#9333ea', fontSize: 10 }}>{o.batch}</span>
                                                        </div>
                                                    ))}
                                                    {!pData.occupancy?.length && <span style={{ color: '#9ca3af', fontSize: 11 }}>No classes</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '6px 10px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                    {(pData.freeFaculty || []).slice(0, 8).map((f, j) => (
                                                        <span key={j} style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: '#15803d' }}>{f.name?.split(' ').slice(-1)[0]}</span>
                                                    ))}
                                                    {(pData.freeFaculty || []).length > 8 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{pData.freeFaculty.length - 8} more</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '6px 10px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                    {(pData.busyFaculty || []).map((f, j) => (
                                                        <span key={j} style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: '#dc2626' }}>{f.name?.split(' ').slice(-1)[0]}</span>
                                                    ))}
                                                    {!pData.busyFaculty?.length && <span style={{ color: '#9ca3af', fontSize: 11 }}>All free</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : (
                    /* ── DETAILS VIEW ── */
                    <div>
                        {(report.periods || []).map((pData, i) => (
                            <Card key={i} title={` ${pData.timeLabel} (Period ${pData.period})`}>
                                <div style={{ display: 'grid', gap: '12px' }} className="grid-cols-2 md:grid-cols-4">
                                    {[
                                        [' Free Faculty', pData.freeFaculty, '#dcfce7', '#16a34a', f => f.name],
                                        [' Busy Faculty', pData.busyFaculty, '#fee2e2', '#dc2626', f => `${f.name} → ${f.subject}`],
                                        [' Free Rooms', pData.freeRooms, '#f0fdf4', '#16a34a', r => r.name],
                                        [' Busy Rooms', pData.busyRooms, '#fef2f2', '#dc2626', r => `${r.name} → ${r.batch}`],
                                    ].map(([label, items, bg, col, fmt]) => (
                                        <div key={label} style={{ background: bg, borderRadius: 10, padding: 12 }}>
                                            <div style={{ fontWeight: 700, color: col, marginBottom: 8, fontSize: 12 }}>{label} ({(items || []).length})</div>
                                            <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                                                {(items || []).map((item, j) => <div key={j} style={{ fontSize: 11, color: '#1e1b4b', padding: '2px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{fmt(item)}</div>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

/* ════════════════════════════════════════════════
   6. ROOM UTILIZATION
   ════════════════════════════════════════════════ */
function RoomUtilization() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => { api.get('/analytics/room-utilization').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); }, []);

    const types = ['All', ...new Set(data.map(r => r.type).filter(Boolean))];
    const filtered = data.filter(r => filter === 'All' || r.type === filter);
    const getColor = (p) => p >= 80 ? '#dc2626' : p >= 50 ? '#f59e0b' : p >= 20 ? '#3b82f6' : '#6b7280';
    const avg = filtered.length ? (filtered.reduce((s, r) => s + parseFloat(r.percentage), 0) / filtered.length).toFixed(1) : 0;

    return (
        <div>
            {loading ? <Spinner /> : (
                <>
                    <div style={{ display: 'grid', gap: '12px' }} className="grid-cols-2 md:grid-cols-4">
                        {[{ l: 'Total Rooms', v: filtered.length, c: '#6366f1' }, { l: 'Avg Utilization', v: `${avg}%`, c: '#f59e0b' },
                        { l: 'High (>75%)', v: filtered.filter(r => parseFloat(r.percentage) > 75).length, c: '#dc2626' },
                        { l: 'Low (<25%)', v: filtered.filter(r => parseFloat(r.percentage) < 25).length, c: '#16a34a' }].map((s, i) => (
                            <div key={i} style={{ background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                                <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>
                    <Card>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                            {types.map(t => (
                                <button key={t} onClick={() => setFilter(t)}
                                    style={{
                                        padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                        background: filter === t ? '#6366f1' : '#e0e7ff', color: filter === t ? 'white' : '#4338ca'
                                    }}>{t}</button>
                            ))}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#e0e7ff' }}>
                                    {['Room', 'Type', 'Used Hrs', 'Free Hrs', 'Total Hrs', 'Utilization %'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left' }}>{h}</th>)}
                                </tr></thead>
                                <tbody>{filtered.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : 'white' }}>
                                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e1b4b' }}>{r.room}</td>
                                        <td style={{ padding: '10px 14px' }}><Badge color="blue">{r.type || '—'}</Badge></td>
                                        <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 600 }}>{r.usedHours}</td>
                                        <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 600 }}>{r.freeHours}</td>
                                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.totalHours}</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 4, background: getColor(parseFloat(r.percentage)), width: `${Math.min(100, r.percentage)}%`, transition: 'width 0.5s' }} />
                                                </div>
                                                <span style={{ fontWeight: 700, color: getColor(parseFloat(r.percentage)), minWidth: 42 }}>{r.percentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

/* ════════════════════════════════════════════════
   7. COURSE LOAD (L-T-P)
   ════════════════════════════════════════════════ */
function CourseLoad() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('All');

    useEffect(() => { api.get('/analytics/course-load').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); }, []);

    const depts = ['All', ...new Set(data.map(c => c.department).filter(Boolean))];
    const filtered = data.filter(c => {
        const ms = dept === 'All' || c.department === dept;
        const mq = !search || c.courseName?.toLowerCase().includes(search.toLowerCase()) || c.courseCode?.toLowerCase().includes(search.toLowerCase());
        return ms && mq;
    });

    return (
        <div>
            {loading ? <Spinner /> : (
                <>
                    <div style={{ display: 'grid', gap: '12px' }} className="grid-cols-2 md:grid-cols-4">
                        {[{ l: 'Courses', v: filtered.length, c: '#6366f1' }, { l: 'Total L Hrs', v: filtered.reduce((s, c) => s + c.L, 0), c: '#2563eb' },
                        { l: 'Total T Hrs', v: filtered.reduce((s, c) => s + c.T, 0), c: '#f59e0b' }, { l: 'Total P Hrs', v: filtered.reduce((s, c) => s + c.P, 0), c: '#16a34a' }].map((s, i) => (
                            <div key={i} style={{ background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                                <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{s.l}</div>
                            </div>
                        ))}
                    </div>
                    <Card>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                            <input placeholder=" Search..." value={search} onChange={e => setSearch(e.target.value)}
                                style={{ padding: '8px 14px', border: '2px solid #e0e7ff', borderRadius: 8, fontSize: 13, minWidth: 200 }} />
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {depts.map(d => (
                                    <button key={d} onClick={() => setDept(d)}
                                        style={{
                                            padding: '5px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11,
                                            background: dept === d ? '#6366f1' : '#e0e7ff', color: dept === d ? 'white' : '#4338ca'
                                        }}>{d}</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead><tr style={{ background: '#e0e7ff' }}>
                                    {['Course Name', 'Code', 'Dept', 'Faculty Count', 'L', 'T', 'P', 'Total', 'Credits'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left' }}>{h}</th>)}
                                </tr></thead>
                                <tbody>{filtered.map((c, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : 'white' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e1b4b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.courseName}>{c.courseName}</td>
                                        <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11 }}>{c.courseCode}</td>
                                        <td style={{ padding: '8px 12px' }}><Badge color="blue">{c.department || '—'}</Badge></td>
                                        <td style={{ padding: '8px 12px', color: '#374151' }}>{c.noOfFaculty}</td>
                                        <td style={{ padding: '8px 12px', color: '#2563eb', fontWeight: 700 }}>{c.L}</td>
                                        <td style={{ padding: '8px 12px', color: '#b45309', fontWeight: 700 }}>{c.T}</td>
                                        <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 700 }}>{c.P}</td>
                                        <td style={{ padding: '8px 12px', fontWeight: 800, color: '#6366f1' }}>{c.total}</td>
                                        <td style={{ padding: '8px 12px' }}><Badge color="purple">{c.credits}</Badge></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

/* ════════════════════════════════════════════════
   MAIN PORTAL
   ════════════════════════════════════════════════ */
export default function ReportsPortal() {
    const [tab, setTab] = useState('faculty');

    const components = {
        faculty: <FacultyReport />, room: <RoomReport />, course: <CourseReport />,
        batch: <BatchReport />, slot: <SlotAnalysis />, utilization: <RoomUtilization />
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8faff', padding: 24 }}>
            <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ fontSize: 30, fontWeight: 800, color: '#1e1b4b', margin: 0 }}> Reports & Analytics</h1>
                    <p style={{ color: '#6b7280', marginTop: 4, fontSize: 13 }}>Comprehensive institutional scheduling insights</p>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22, background: 'white', borderRadius: 14, padding: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            background: tab === t.id ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'transparent',
                            color: tab === t.id ? 'white' : '#6b7280', transition: 'all 0.2s',
                            boxShadow: tab === t.id ? '0 4px 12px rgba(102,126,234,0.35)' : 'none'
                        }}>{t.label}</button>
                    ))}
                </div>

                {components[tab]}
            </div>
        </div>
    );
}
