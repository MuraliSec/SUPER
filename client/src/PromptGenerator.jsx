import React, { useState } from 'react';
import api from './api/axios';

export default function PromptGenerator() {
    const [promptText, setPromptText] = useState("");
    const [loading, setLoading] = useState(false);
    const [timetables, setTimetables] = useState([]);
    const [error, setError] = useState('');
    const [parsedPreview, setParsedPreview] = useState(null);

    const parsePrompt = (text) => {
        const textLines = text.split('\n').map(l => l.trim()).filter(l => l);

        let currentSection = null;
        const parsedContext = {
            batches: [],
            lectureRooms: [],
            labRooms: [],
            coreSubjects: [],
            electiveSubjects: [],
            labSubjects: [],
            trainingSubjects: [],
            subjectHours: {}
        };

        const tryMatchSection = (line) => {
            const l = line.toLowerCase();
            if (l.startsWith('batch')) return 'batches_header';
            if (l.startsWith('lecture rooms:')) return 'lecture_rooms';
            if (l.startsWith('lab rooms:')) return 'lab_rooms';
            if (l.startsWith('core subjects')) return 'core_subjects';
            if (l.startsWith('elective subjects')) return 'elective_subjects';
            if (l.startsWith('lab subjects weekly hours')) return 'lab_hours';
            if (l.startsWith('lab subjects')) return 'lab_subjects';
            if (l.startsWith('lecture subjects weekly hours')) return 'lecture_hours';
            if (l.startsWith('training')) return 'training';
            return null;
        };

        for (const line of textLines) {
            const nextSection = tryMatchSection(line);

            if (nextSection === 'batches_header') {
                const bText = line.split(':')[1]?.trim();
                if (bText && !bText.includes('[')) {
                    parsedContext.batches = bText.split(',').map(s => s.trim());
                }
                currentSection = null; // we extracted on the same line if possible
                continue;
            } else if (nextSection) {
                currentSection = nextSection;
                continue;
            }

            if (line.toLowerCase().startsWith('example') || line.toLowerCase().startsWith('rules') || line.startsWith('[')) {
                if (line.toLowerCase().startsWith('example') || line.toLowerCase().startsWith('rules')) {
                    currentSection = null;
                }
                continue;
            }

            if (!currentSection) continue;

            if (currentSection === 'lecture_rooms') {
                parsedContext.lectureRooms.push(line);
            } else if (currentSection === 'lab_rooms') {
                parsedContext.labRooms.push(line);
            } else if (currentSection === 'core_subjects') {
                const parts = line.split(/[–-]/);
                if (parts.length >= 2) parsedContext.coreSubjects.push({ name: parts[0].trim(), faculty: parts[1].trim() });
            } else if (currentSection === 'elective_subjects') {
                const parts = line.split(/[–-]/);
                if (parts.length >= 2) parsedContext.electiveSubjects.push({ name: parts[0].trim(), faculty: parts[1].trim() });
            } else if (currentSection === 'lab_subjects') {
                const parts = line.split(/[–-]/);
                if (parts.length >= 2) parsedContext.labSubjects.push({ name: parts[0].trim(), faculty: parts[1].trim() });
            } else if (currentSection === 'training') {
                const parts = line.split(/[–-]/);
                if (parts.length >= 2) parsedContext.trainingSubjects.push({ name: parts[0].trim(), faculty: parts[1].trim() });
            } else if (currentSection === 'lecture_hours' || currentSection === 'lab_hours') {
                const parts = line.split(/[–-]/);
                if (parts.length >= 2) {
                    const hoursMatch = parts[1].match(/(\d+)/);
                    if (hoursMatch) parsedContext.subjectHours[parts[0].trim()] = parseInt(hoursMatch[1]);
                }
            }
        }

        const finalSubjectConfig = {};

        parsedContext.coreSubjects.forEach(s => {
            finalSubjectConfig[s.name] = {
                faculty: s.faculty, subjectType: 'Core', labHours: 0,
                lectureHours: parsedContext.subjectHours[s.name] || 4
            };
        });

        parsedContext.electiveSubjects.forEach(s => {
            finalSubjectConfig[s.name] = {
                faculty: s.faculty, subjectType: 'Elective', labHours: 0,
                lectureHours: parsedContext.subjectHours[s.name] || 3
            };
        });

        parsedContext.labSubjects.forEach(s => {
            finalSubjectConfig[s.name] = {
                faculty: s.faculty, subjectType: 'Lab', lectureHours: 0,
                labHours: parsedContext.subjectHours[s.name] || 2
            };
        });

        parsedContext.trainingSubjects.forEach(s => {
            finalSubjectConfig[s.name] = {
                faculty: s.faculty, subjectType: 'Core', lectureHours: parsedContext.subjectHours[s.name] || 3, labHours: 0
            };
        });

        return {
            batches: parsedContext.batches,
            lectureRooms: parsedContext.lectureRooms,
            labRooms: parsedContext.labRooms,
            subjectConfig: finalSubjectConfig
        };
    };

    const handleTextChange = (e) => {
        const val = e.target.value;
        setPromptText(val);
        setParsedPreview(parsePrompt(val));
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setTimetables([]);

        try {
            const parsed = parsePrompt(promptText);

            if (!parsed.subjectConfig || Object.keys(parsed.subjectConfig).length === 0) {
                throw new Error("Could not find any subjects in your prompt. Ensure you use sections like 'Core Subjects' and format as 'Subject - Faculty'.");
            }
            if (parsed.lectureRooms.length === 0 && parsed.labRooms.length === 0) {
                throw new Error("Could not find any rooms in your prompt. Please ensure you specified rooms under 'Lecture Rooms:' or 'Lab Rooms:'.");
            }

            const payload = {
                isParsedData: true,
                batches: parsed.batches,
                lectureRooms: parsed.lectureRooms,
                labRooms: parsed.labRooms,
                subjectConfig: parsed.subjectConfig
            };

            const res = await api.post('/generate-from-prompts', payload);
            setTimetables(res.data.timetables || []);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-600">
                Text Prompt Timetable Generator
            </h2>
            <p className="text-gray-600 mb-8">
                Type your requirements in plain text below, and our internal parser will extract the constraints to generate your timetable automatically.
            </p>

            <form onSubmit={handleGenerate} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8 space-y-6">

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prompt Input</label>
                    <textarea
                        value={promptText}
                        onChange={handleTextChange}
                        placeholder="e.g. Generate a timetable for 2 batches. The core subjects are Math, Physics and elective subjects are Music, Art. Faculty are John, Jane. Lecture rooms are R1, R2 and lab rooms are L1. Assign 3 lecture hours and 1 lab hour."
                        className="w-full h-40 border-gray-300 rounded-lg p-4 bg-gray-50 focus:ring-2 focus:ring-purple-500 transition-all border outline-none resize-none leading-relaxed text-gray-700"
                        required
                    />
                </div>

                {parsedPreview && promptText && (
                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg overflow-hidden">
                        <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-3">Academic Prompt Extraction</h4>
                        <div className="flex flex-col gap-4 text-sm text-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><span className="font-semibold block mb-1">Batches:</span> {parsedPreview.batches?.length > 0 ? parsedPreview.batches.join(', ') : <span className="text-gray-400 italic">Default</span>}</div>
                                <div><span className="font-semibold block mb-1">Lecture Rooms:</span> <span className="text-purple-600">{parsedPreview.lectureRooms?.length > 0 ? parsedPreview.lectureRooms.join(', ') : <span className="text-gray-400 italic">None</span>}</span></div>
                                <div><span className="font-semibold block mb-1">Lab Rooms:</span> <span className="text-purple-600">{parsedPreview.labRooms?.length > 0 ? parsedPreview.labRooms.join(', ') : <span className="text-gray-400 italic">None</span>}</span></div>
                            </div>

                            <hr className="border-purple-200" />

                            <div>
                                <span className="font-semibold block mb-2">Subject Mapping Overview:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                    {Object.entries(parsedPreview.subjectConfig || {}).map(([sub, data]) => (
                                        <div key={sub} className="bg-white p-2.5 rounded shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-purple-100">
                                            <div className="font-bold text-purple-700 truncate mb-1" title={sub}>{sub}</div>
                                            <div className="flex justify-between items-center text-gray-600">
                                                <span className="truncate flex-1" title={data.faculty}>‍ {data.faculty}</span>
                                                <span className="font-mono bg-purple-50 px-1 py-0.5 rounded ml-1 whitespace-nowrap">
                                                    {data.lectureHours > 0 && `Lec ${data.lectureHours}`}
                                                    {data.lectureHours > 0 && data.labHours > 0 && ' '}
                                                    {data.labHours > 0 && `Lab ${data.labHours}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(parsedPreview.subjectConfig || {}).length === 0 && <span className="text-gray-400 italic w-full">No subject mapping correctly extracted. Check formatting.</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">{error}</div>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                    {loading ? 'Generating...' : 'Generate Timetable from Prompt'}
                </button>
            </form>

            <div className="space-y-8">
                {timetables.map((tt, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 font-semibold text-gray-800 border-b">
                            {tt.batchName || `Batch ${idx + 1}`}
                        </div>
                        <div className="p-6 overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border border-gray-300 text-sm font-bold w-24">Time / Day</th>
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                                            <th key={d} className="p-2 border border-gray-300 text-sm font-bold">{d}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5, 6, 7].map(period => {
                                        // Specific time labels based directly on user prompt request!
                                        const timeLabels = {
                                            1: "09:00 - 10:00", 2: "10:00 - 11:00", 3: "11:00 - 12:00",
                                            4: "12:00 - 01:00", 5: "01:00 - 02:00", 6: "02:00 - 03:00", 7: "03:00 - 04:00"
                                        };
                                        return (
                                            <tr key={period}>
                                                <td className="p-2 border border-gray-300 bg-gray-50 text-xs font-semibold text-center whitespace-nowrap">
                                                    <div className="mb-1 text-purple-700">{period === 4 ? '' : `P ${period > 4 ? period - 1 : period}`}</div>
                                                    <div className="text-[10px] text-gray-500 font-normal">{timeLabels[period]}</div>
                                                </td>
                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                                                    const daySchedule = tt.schedule.find(d => d.day === day);
                                                    const pData = daySchedule?.periods.find(p => p.period === period);
                                                    return (
                                                        <td key={day} className={`p-2 border border-gray-300 min-w-[120px] ${pData?.type === 'Free' ? 'bg-gray-50' : pData?.type === 'Lunch' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                                                            {pData?.type === 'Lunch' ? (
                                                                <div className="text-center font-bold text-yellow-800 text-xs"> LUNCH BREAK</div>
                                                            ) : pData?.type !== 'Free' ? (
                                                                <div className="text-[11px] leading-tight flex flex-col gap-1">
                                                                    <div className="font-bold text-gray-800">{pData?.subject} ({pData?.classType || pData?.type})</div>
                                                                    <div className="text-purple-700">{pData?.faculty}</div>
                                                                    <div className="text-emerald-700">{pData?.room}</div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-gray-400 text-xs">-</div>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
