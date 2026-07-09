import React, { useState, useEffect } from 'react';
import api from './api/axios';

const DEFAULT_LUNCH = {
    enabled: true,
    dayConfigs: {
        'Monday': { enabled: true, startTime: '12:00', endTime: '13:00' },
        'Tuesday': { enabled: true, startTime: '12:00', endTime: '13:00' },
        'Wednesday': { enabled: true, startTime: '12:00', endTime: '13:00' },
        'Thursday': { enabled: true, startTime: '12:00', endTime: '13:00' },
        'Friday': { enabled: true, startTime: '12:00', endTime: '13:00' },
        'Saturday': { enabled: true, startTime: '12:00', endTime: '13:00' }
    }
};

const BatchConfigColumn = ({ batch, title, selectedBatches, allSubjects, rooms, courses, batches, maxWeeklyHours, initialConfig, onConfigUpdate, onGenerateSingle }) => {
    const [subjectConfig, setSubjectConfig] = useState(initialConfig?.subjectConfig || {});

    // ── Lunch config: one entry per batch ──
    const isMultiBatch = selectedBatches && selectedBatches.length > 1;
    const batchList = isMultiBatch ? selectedBatches : [batch];

    const buildInitialLunch = () => {
        const map = {};
        batchList.forEach(b => {
            map[b._id] = initialConfig?.lunchConfigs?.[b._id] || { ...DEFAULT_LUNCH, dayConfigs: { ...DEFAULT_LUNCH.dayConfigs } };
        });
        return map;
    };

    const [lunchConfigs, setLunchConfigs] = useState(buildInitialLunch);
    const [activeLunchBatchTab, setActiveLunchBatchTab] = useState(batchList[0]?._id);

    const updateLunchDay = (batchId, day, field, value) => {
        setLunchConfigs(prev => ({
            ...prev,
            [batchId]: {
                ...prev[batchId],
                dayConfigs: {
                    ...prev[batchId]?.dayConfigs,
                    [day]: {
                        ...prev[batchId]?.dayConfigs?.[day],
                        [field]: value
                    }
                }
            }
        }));
    };

    const [activeSubjectTab, setActiveSubjectTab] = useState('Core');
    const [subjectSearchTerm, setSubjectSearchTerm] = useState('');
    const [facultySearchTerms, setFacultySearchTerms] = useState({});
    // activeFacultyBatchTab: tracks which batch tab is shown for faculty per subject
    const [activeFacultyBatchTab, setActiveFacultyBatchTab] = useState({});
    const [categorizedSubjects, setCategorizedSubjects] = useState({ Core: [], Elective: [], Training: [] });
    const [slotSummary, setSlotSummary] = useState(null);
    const [facultyList, setFacultyList] = useState([]);

    useEffect(() => {
        api.get('/faculty').then(res => setFacultyList(res.data)).catch(console.error);
    }, []);

    useEffect(() => {
        const normalizeBatchName = (name) => {
            if (!name) return "";
            return name.trim().replace(/^(\d{4})\s*-\s*(\d{2})$/, (match, p1, p2) => `${p1}-20${p2}`).toLowerCase();
        };

        const targetBatchName = normalizeBatchName(batch.name);
        const targetBatchId = normalizeBatchName(batch.batchId);

        const strategy1Courses = (courses || []).filter(c => {
            const courseBatch = normalizeBatchName(c.batch);
            return courseBatch === targetBatchName || courseBatch === targetBatchId || (targetBatchId && courseBatch === targetBatchId);
        });

        const strategy2Courses = (courses || []).filter(c => {
            if (parseInt(c.semester) !== parseInt(batch.semester)) return false;
            const batchDept = (batch.department || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const courseDept = (c.department || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!batchDept || !courseDept) return false;
            return batchDept.includes(courseDept) || courseDept.includes(batchDept);
        });

        const uniqueCourses = new Map();
        [...strategy1Courses, ...strategy2Courses].forEach(c => uniqueCourses.set(c.subject, c));
        const batchCourses = Array.from(uniqueCourses.values());

        const core = new Set();
        const elective = new Set();
        const training = new Set();

        batchCourses.forEach(c => {
            const type = (c.type || "").toLowerCase();
            if (type === 'elective') elective.add(c.subject);
            else if (type === 'training') training.add(c.subject);
            else core.add(c.subject);
        });

        if (batchCourses.length === 0 && batch.subjects) batch.subjects.forEach(s => core.add(s));

        let newCategorized = { Core: Array.from(core).sort(), Elective: Array.from(elective).sort(), Training: Array.from(training).sort() };

        const allRelevant = [...newCategorized.Core, ...newCategorized.Elective];
        if (allRelevant.length === 0) {
            newCategorized.Core = [...new Set((allSubjects || []).map(s => s.name))].sort();
        }
        setCategorizedSubjects(newCategorized);
    }, [batch, courses, allSubjects]);

    useEffect(() => {
        onConfigUpdate(batch._id, { subjectConfig, lunchConfigs });
    }, [subjectConfig, lunchConfigs]);

    useEffect(() => {
        const fetchSlotSummary = async () => {
            try {
                const processedConfig = { ...subjectConfig };
                Object.keys(processedConfig).forEach(sub => {
                    const isElective = categorizedSubjects.Elective.includes(sub);
                    const isTraining = categorizedSubjects.Training.includes(sub);
                    processedConfig[sub].subjectType = isTraining ? 'Training' : (isElective ? 'Elective' : 'Core');
                });
                const res = await api.post('/stats/preview', { batchId: batch._id, subjectConfig: processedConfig });
                setSlotSummary(res.data);
            } catch (err) { }
        };
        const timeoutId = setTimeout(() => fetchSlotSummary(), 300);
        return () => clearTimeout(timeoutId);
    }, [subjectConfig, batch, categorizedSubjects]);

    const handleConfigChange = (sub, field, value) => {
        setSubjectConfig(prev => ({
            ...prev,
            [sub]: { ...prev[sub], [field]: (field === 'lectureHours' || field === 'labHours' ? Number(value) : value) }
        }));
    };

    // Faculty map helpers (multi-batch mode)
    const getFacultyForBatch = (subName, type, bId) => {
        const mapKey = type === 'lecture' ? 'lectureFacultyMap' : 'labFacultyMap';
        return (subjectConfig[subName]?.[mapKey]?.[bId]) || [];
    };

    const setFacultyForBatch = (subName, type, bId, next) => {
        const mapKey = type === 'lecture' ? 'lectureFacultyMap' : 'labFacultyMap';
        setSubjectConfig(prev => ({
            ...prev,
            [subName]: {
                ...prev[subName],
                [mapKey]: {
                    ...(prev[subName]?.[mapKey] || {}),
                    [bId]: next
                }
            }
        }));
    };

    const getActiveFacultyBatch = (subName) => {
        return activeFacultyBatchTab[subName] || (batchList[0]?._id);
    };

    const renderFacultySection = (subName) => {
        if (!isMultiBatch) {
            // Single batch: simple faculty pickers
            return (
                <div className="mt-2 space-y-2">
                    <div className="bg-white p-1.5 rounded border shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1 tracking-wider">‍ Lecture Faculty</p>
                        <input placeholder=" find lecture faculty" className="w-full p-1.5 text-xs border rounded bg-gray-50 mb-1" onChange={e => setFacultySearchTerms(p => ({ ...p, [subName + '_lec']: e.target.value }))} />
                        <div className="max-h-24 overflow-y-auto pl-1 pr-1 custom-scroll space-y-1">
                            {(() => {
                                const term = facultySearchTerms[subName + '_lec'] || "";
                                return (facultyList || []).filter(f => f.name.toLowerCase().includes(term.toLowerCase())).map(f => (
                                    <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer transition">
                                        <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600 rounded"
                                            checked={(subjectConfig[subName]?.lectureFaculty || []).includes(f.name)}
                                            onChange={(e) => {
                                                const current = subjectConfig[subName]?.lectureFaculty || [];
                                                const next = e.target.checked ? [...current, f.name] : current.filter(n => n !== f.name);
                                                handleConfigChange(subName, 'lectureFaculty', next);
                                            }}
                                        />
                                        <span className="text-[11px] font-semibold text-gray-700 truncate">{f.name}</span>
                                    </label>
                                ));
                            })()}
                        </div>
                    </div>

                    <div className="bg-white p-1.5 rounded border shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1 tracking-wider"> Lab Faculty</p>
                        <input placeholder=" find lab faculty" className="w-full p-1.5 text-xs border rounded bg-gray-50 mb-1" onChange={e => setFacultySearchTerms(p => ({ ...p, [subName + '_lab']: e.target.value }))} />
                        <div className="max-h-24 overflow-y-auto pl-1 pr-1 custom-scroll space-y-1">
                            {(() => {
                                const term = facultySearchTerms[subName + '_lab'] || "";
                                return (facultyList || []).filter(f => f.name.toLowerCase().includes(term.toLowerCase())).map(f => (
                                    <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer transition">
                                        <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600 rounded"
                                            checked={(subjectConfig[subName]?.labFaculty || []).includes(f.name)}
                                            onChange={(e) => {
                                                const current = subjectConfig[subName]?.labFaculty || [];
                                                const next = e.target.checked ? [...current, f.name] : current.filter(n => n !== f.name);
                                                handleConfigChange(subName, 'labFaculty', next);
                                            }}
                                        />
                                        <span className="text-[11px] font-semibold text-gray-700 truncate">{f.name}</span>
                                    </label>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            );
        }

        // Multi-batch mode: tabbed per-batch faculty selection
        const activeBatchId = getActiveFacultyBatch(subName);

        return (
            <div className="mt-2 bg-white rounded border shadow-sm overflow-hidden">
                {/* Batch tabs */}
                <div className="flex overflow-x-auto bg-gray-50 border-b" style={{ scrollbarWidth: 'none' }}>
                    {batchList.map(b => {
                        const lecFacCount = getFacultyForBatch(subName, 'lecture', b._id).length;
                        const labFacCount = getFacultyForBatch(subName, 'lab', b._id).length;
                        const hasAny = lecFacCount > 0 || labFacCount > 0;
                        return (
                            <button
                                key={b._id}
                                onClick={() => setActiveFacultyBatchTab(prev => ({ ...prev, [subName]: b._id }))}
                                className={`shrink-0 px-2 py-1.5 text-[9px] font-bold border-b-2 transition whitespace-nowrap ${activeBatchId === b._id ? 'border-indigo-500 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {b.name || b.batchId}
                                {hasAny && <span className="ml-1 bg-indigo-100 text-indigo-700 rounded-full px-1 text-[8px]">{lecFacCount + labFacCount}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Faculty pickers for active batch tab */}
                <div className="p-1.5 space-y-2">
                    {/* Lecture Faculty */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">‍ Lecture</p>
                            {getFacultyForBatch(subName, 'lecture', activeBatchId).length > 0 && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold truncate max-w-[150px]">
                                    {getFacultyForBatch(subName, 'lecture', activeBatchId).join(', ')}
                                </span>
                            )}
                        </div>
                        <input
                            placeholder=" search..."
                            className="w-full p-1 text-xs border rounded bg-gray-50 mb-1"
                            onChange={e => setFacultySearchTerms(p => ({ ...p, [subName + '_lec_' + activeBatchId]: e.target.value }))}
                        />
                        <div className="max-h-20 overflow-y-auto custom-scroll space-y-0.5">
                            {(facultyList || []).filter(f => f.name.toLowerCase().includes((facultySearchTerms[subName + '_lec_' + activeBatchId] || '').toLowerCase())).map(f => (
                                <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-indigo-50 rounded cursor-pointer transition">
                                    <input type="checkbox" className="w-3 h-3 accent-indigo-600"
                                        checked={getFacultyForBatch(subName, 'lecture', activeBatchId).includes(f.name)}
                                        onChange={(e) => {
                                            const current = getFacultyForBatch(subName, 'lecture', activeBatchId);
                                            const next = e.target.checked ? [...current, f.name] : current.filter(n => n !== f.name);
                                            setFacultyForBatch(subName, 'lecture', activeBatchId, next);
                                        }}
                                    />
                                    <span className="text-[11px] text-gray-700 truncate">{f.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Lab Faculty */}
                    <div className="border-t pt-1.5">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider"> Lab</p>
                            {getFacultyForBatch(subName, 'lab', activeBatchId).length > 0 && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold truncate max-w-[150px]">
                                    {getFacultyForBatch(subName, 'lab', activeBatchId).join(', ')}
                                </span>
                            )}
                        </div>
                        <input
                            placeholder=" search..."
                            className="w-full p-1 text-xs border rounded bg-gray-50 mb-1"
                            onChange={e => setFacultySearchTerms(p => ({ ...p, [subName + '_lab_' + activeBatchId]: e.target.value }))}
                        />
                        <div className="max-h-20 overflow-y-auto custom-scroll space-y-0.5">
                            {(facultyList || []).filter(f => f.name.toLowerCase().includes((facultySearchTerms[subName + '_lab_' + activeBatchId] || '').toLowerCase())).map(f => (
                                <label key={f._id} className="flex items-center gap-2 p-1 hover:bg-blue-50 rounded cursor-pointer transition">
                                    <input type="checkbox" className="w-3 h-3 accent-blue-600"
                                        checked={getFacultyForBatch(subName, 'lab', activeBatchId).includes(f.name)}
                                        onChange={(e) => {
                                            const current = getFacultyForBatch(subName, 'lab', activeBatchId);
                                            const next = e.target.checked ? [...current, f.name] : current.filter(n => n !== f.name);
                                            setFacultyForBatch(subName, 'lab', activeBatchId, next);
                                        }}
                                    />
                                    <span className="text-[11px] text-gray-700 truncate">{f.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 w-[420px] bg-white border border-gray-200 shadow-md rounded-xl p-4 mr-4 shrink-0 flex flex-col max-h-[1000px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <h2 className="text-xl font-bold text-indigo-800 text-center mb-2 border-b pb-2 sticky top-0 bg-white z-20">
                {title || batch.name || batch.batchId}
            </h2>

            {isMultiBatch && (
                <div className="mb-2 bg-indigo-50 rounded-lg p-2 border border-indigo-100 text-[10px] text-indigo-700 font-semibold flex items-center gap-1.5">
                    <span></span>
                    <span>Subjects are shared across all batches. Click a subject to expand, then switch batch tabs to assign different faculty per batch.</span>
                </div>
            )}

            {/* ── Lunch Configuration ── */}
            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-yellow-800 flex items-center gap-1"> Lunch Configuration</p>
                    {isMultiBatch && (
                        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                            {batchList.map(b => (
                                <button key={b._id}
                                    onClick={() => setActiveLunchBatchTab(b._id)}
                                    className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border transition ${activeLunchBatchTab === b._id ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-100'}`}>
                                    {b.name || b.batchId}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {batchList.filter(b => !isMultiBatch || b._id === activeLunchBatchTab).map(b => {
                    const cfg = lunchConfigs[b._id] || DEFAULT_LUNCH;
                    return (
                        <div key={b._id}>
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-yellow-800 text-xs mb-1.5 w-full">
                                <input type="checkbox" className="w-3.5 h-3.5 accent-yellow-600"
                                    checked={cfg.enabled}
                                    onChange={e => setLunchConfigs(prev => ({ ...prev, [b._id]: { ...prev[b._id], enabled: e.target.checked } }))}
                                />
                                Enable Lunch Breaks
                            </label>
                            {cfg.enabled && (
                                <div className="space-y-1 overflow-y-auto max-h-[160px] pr-1 custom-scroll">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                        <div key={day} className="bg-white p-1.5 rounded border border-yellow-100 flex flex-col gap-1 hover:border-yellow-300 transition">
                                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700 text-[11px]">
                                                <input type="checkbox" className="w-3 h-3 accent-yellow-500"
                                                    checked={cfg.dayConfigs?.[day]?.enabled}
                                                    onChange={e => updateLunchDay(b._id, day, 'enabled', e.target.checked)}
                                                />
                                                {day}
                                            </label>
                                            {cfg.dayConfigs?.[day]?.enabled && (
                                                <div className="flex items-center gap-1 pl-5">
                                                    <select className="py-0.5 px-0.5 border border-gray-300 rounded text-[10px] bg-gray-50 w-16"
                                                        value={cfg.dayConfigs?.[day]?.startTime}
                                                        onChange={e => updateLunchDay(b._id, day, 'startTime', e.target.value)}>
                                                        <option value="11:00">11:00 AM</option>
                                                        <option value="12:00">12:00 PM</option>
                                                        <option value="13:00">1:00 PM</option>
                                                        <option value="14:00">2:00 PM</option>
                                                    </select>
                                                    <span className="text-gray-400 text-[10px]">→</span>
                                                    <select className="py-0.5 px-0.5 border border-gray-300 rounded text-[10px] bg-gray-50 w-16"
                                                        value={cfg.dayConfigs?.[day]?.endTime}
                                                        onChange={e => updateLunchDay(b._id, day, 'endTime', e.target.value)}>
                                                        <option value="12:00">12:00 PM</option>
                                                        <option value="13:00">1:00 PM</option>
                                                        <option value="14:00">2:00 PM</option>
                                                        <option value="15:00">3:00 PM</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mb-4 flex-1 flex flex-col min-h-[500px]">
                <h3 className="font-semibold text-gray-700 mb-2">Subject Configuration</h3>
                <div className="flex gap-1 mb-2 shrink-0">
                    <button onClick={() => setActiveSubjectTab('Core')} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition ${activeSubjectTab === 'Core' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>Core</button>
                    <button onClick={() => setActiveSubjectTab('Elective')} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition ${activeSubjectTab === 'Elective' ? 'bg-pink-600 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>Electives</button>
                    <button onClick={() => setActiveSubjectTab('Training')} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition ${activeSubjectTab === 'Training' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>Training</button>
                </div>

                <input placeholder={` Search ${activeSubjectTab} subjects...`} className="w-full text-sm p-1.5 border rounded mb-2 shrink-0 bg-gray-50 focus:bg-white focus:ring-1" value={subjectSearchTerm} onChange={e => setSubjectSearchTerm(e.target.value)} />

                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                const categorySubjects = categorizedSubjects[activeSubjectTab];
                                setSubjectConfig(p => {
                                    const next = { ...p };
                                    categorySubjects.forEach(subName => {
                                        if (!next[subName]) {
                                            const isTr = activeSubjectTab === 'Training';
                                            const isEl = activeSubjectTab === 'Elective';
                                            next[subName] = { 
                                                lectureHours: isTr ? 0 : 3, 
                                                labHours: isEl ? 0 : (isTr ? 2 : 2), 
                                                lectureFaculty: [], 
                                                labFaculty: [], 
                                                lectureFacultyMap: {}, 
                                                labFacultyMap: {}, 
                                                slotGroup: isEl ? "" : "Independent", 
                                                subjectType: isTr ? 'Training' : (isEl ? 'Elective' : 'Core') 
                                            };
                                        }
                                    });
                                    return next;
                                });
                            }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter cursor-pointer"
                        >
                            Select All
                        </button>
                        <button 
                            onClick={() => {
                                const categorySubjects = categorizedSubjects[activeSubjectTab];
                                setSubjectConfig(p => {
                                    const next = { ...p };
                                    categorySubjects.forEach(subName => delete next[subName]);
                                    return next;
                                });
                            }}
                            className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase tracking-tighter cursor-pointer"
                        >
                            Clear All
                        </button>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400">
                        {categorizedSubjects[activeSubjectTab].filter(s => !!subjectConfig[s]).length} / {categorizedSubjects[activeSubjectTab].length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto mb-2 pr-1 space-y-2 bg-gray-50 p-2 rounded-lg border h-[350px]">
                    {categorizedSubjects[activeSubjectTab].length === 0 ? (
                        <p className="text-center text-xs text-gray-400 mt-10 italic">No {activeSubjectTab} subjects found</p>
                    ) : categorizedSubjects[activeSubjectTab].filter(s => s.toLowerCase().includes(subjectSearchTerm.toLowerCase())).length === 0 ? (
                        <p className="text-center text-xs text-gray-400 mt-10 italic">No subjects matching filter</p>
                    ) : categorizedSubjects[activeSubjectTab].filter(s => s.toLowerCase().includes(subjectSearchTerm.toLowerCase())).map(subName => {
                        return (
                            <div key={subName} className="bg-white border rounded p-2 text-sm shadow-sm hover:border-indigo-300">
                                <label className="flex gap-2 font-bold text-gray-800 break-words mb-1 cursor-pointer">
                                    <input type="checkbox" className="mt-1 w-4 h-4" checked={!!subjectConfig[subName]} onChange={e => {
                                        if (e.target.checked) {
                                            const isTr = activeSubjectTab === 'Training';
                                            const isEl = activeSubjectTab === 'Elective';
                                            setSubjectConfig(p => ({ ...p, [subName]: { lectureHours: isTr ? 0 : 3, labHours: isEl ? 0 : (isTr ? 2 : 2), lectureFaculty: [], labFaculty: [], lectureFacultyMap: {}, labFacultyMap: {}, slotGroup: "", subjectType: isTr ? 'Training' : (isEl ? 'Elective' : 'Core') } }));
                                        } else {
                                            setSubjectConfig(p => { const nc = { ...p }; delete nc[subName]; return nc; });
                                        }
                                    }} />
                                    {subName}
                                </label>

                                {subjectConfig[subName] && (
                                    <div className="ml-6 mt-2 bg-indigo-50/50 p-2 rounded border border-indigo-100/50 space-y-2">
                                        <div className="grid grid-cols-2 gap-2 text-center text-gray-600 bg-white p-1 rounded border shadow-sm">
                                            <div><span className="text-[10px] block uppercase font-bold text-gray-400" title="Lecture Hours (1 period each)">Lectures</span><input type="number" min="0" max="6" className="w-full text-center border mt-0.5 rounded shadow-inner p-1 font-bold text-indigo-700" value={subjectConfig[subName]?.lectureHours || 0} onChange={e => handleConfigChange(subName, 'lectureHours', e.target.value)} /></div>
                                            <div><span className="text-[10px] block uppercase font-bold text-gray-400" title="Lab Hours (2 consecutive periods per session)">Lab Hours</span><input type="number" min="0" max="6" className="w-full text-center border mt-0.5 rounded shadow-inner p-1 font-bold text-blue-700" value={subjectConfig[subName]?.labHours || 0} onChange={e => handleConfigChange(subName, 'labHours', e.target.value)} /></div>
                                        </div>
                                        <div className="text-[9px] text-gray-500 font-semibold text-center mt-1">
                                            *(Note: 2 Lab Hours = 1 Lab session of 2 periods)
                                        </div>


                                        {activeSubjectTab === 'Elective' && (() => {
                                            const officialSlotObj = (allSubjects || []).find(s => s.name === subName);
                                            const officialSlot = (officialSlotObj && officialSlotObj.slotGroup) ? officialSlotObj.slotGroup : "Independent";
                                            const selectedSlot = subjectConfig[subName]?.slotGroup || "";
                                            const isSlotEmpty = selectedSlot === "";
                                            const isSlotValid = selectedSlot === officialSlot;
                                            let selectClass = "w-full p-1.5 border rounded text-xs font-bold transition-colors ";
                                            let messageClass = "", messageText = "";
                                            if (isSlotEmpty) { selectClass += "bg-red-50 text-red-900 border-red-300 ring-1 ring-red-500"; messageClass = "text-red-600"; messageText = ` Required: Must select ${officialSlot === 'Independent' ? 'Independent' : 'Slot ' + officialSlot}`; }
                                            else if (!isSlotValid) { selectClass += "bg-red-50 text-red-900 border-red-300 ring-1 ring-red-500"; messageClass = "text-red-600"; messageText = ` Incorrect: Please select ${officialSlot === 'Independent' ? 'Independent' : 'Slot ' + officialSlot}`; }
                                            else { selectClass += "bg-green-50 text-green-900 border-green-300 ring-1 ring-green-500"; messageClass = "text-green-700"; messageText = " Correct Slot Assigned"; }
                                            return (
                                                <div className="mt-2 text-left">
                                                    <select className={selectClass} value={selectedSlot} onChange={e => handleConfigChange(subName, 'slotGroup', e.target.value)}>
                                                        <option value=""> Please Select a Slot Group</option>
                                                        <option value="Independent">Independent (No Group)</option>
                                                        <option value="A">Slot A</option>
                                                        <option value="B">Slot B</option>
                                                        <option value="C">Slot C</option>
                                                        <option value="D">Slot D</option>
                                                        <option value="E">Slot E</option>
                                                        <option value="F">Slot F</option>
                                                    </select>
                                                    <p className={`text-[10px] mt-1 px-1 font-semibold flex items-center gap-1 ${messageClass}`}>{messageText}</p>
                                                </div>
                                            );
                                        })()}

                                        {renderFacultySection(subName)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`shrink-0 p-3 rounded-lg mt-auto transition-colors duration-200 ${slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) ? 'bg-red-50 border border-red-200' : 'bg-blue-50/80 border border-blue-100'}`}>
                <div className="flex justify-between font-bold text-xs mb-1">
                    <span className={slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) ? 'text-red-800' : 'text-blue-900'}>Slots Allocated:</span>
                    <span className={slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) ? 'text-red-600 font-extrabold animate-pulse' : 'text-blue-900'}>
                        {slotSummary?.allocatedSlots || 0}/{slotSummary?.totalSlots || maxWeeklyHours}
                        {slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) && ' ⚠️ OVERFLOW'}
                    </span>
                </div>
                <div className={`w-full h-1.5 rounded-full mb-3 ${slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) ? 'bg-red-200' : 'bg-blue-200'}`}>
                    <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${slotSummary?.allocatedSlots > (slotSummary?.totalSlots || maxWeeklyHours) ? 'bg-red-600' : 'bg-blue-600'}`} 
                        style={{ width: `${Math.min(((slotSummary?.allocatedSlots || 0) / (slotSummary?.totalSlots || maxWeeklyHours)) * 100, 100)}%` }} 
                    />
                </div>


                {onGenerateSingle && (
                    <button
                        onClick={() => onGenerateSingle(batch._id)}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 rounded-lg shadow-md transition-all text-xs flex items-center justify-center gap-2 transform active:scale-95"
                    >
                        <span></span> Generate Timetable
                    </button>
                )}
            </div>
        </div>
    );
};

export default BatchConfigColumn;
