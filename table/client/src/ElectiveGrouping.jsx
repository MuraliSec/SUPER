import React, { useState, useEffect } from 'react';
import api from './api/axios'; // Use shared API instance
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const ElectiveGrouping = () => {
    // Columns for unassigned, Slot A, and Slot B
    const [columns, setColumns] = useState({
        unassigned: {
            id: 'unassigned',
            title: 'Unassigned Subjects',
            items: []
        },
        slotA: {
            id: 'slotA',
            title: 'Elective Slot A (Common Time)',
            items: []
        },
        slotB: {
            id: 'slotB',
            title: 'Elective Slot B (Common Time)',
            items: []
        }
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
            // Fetch both Courses (user data source) and Subjects (grouping config source)
            const [coursesRes, subjectsRes] = await Promise.all([
                api.get('/courses'),
                api.get('/subjects')
            ]);

            const courses = coursesRes.data;
            const existingSubjects = subjectsRes.data;

            // Create a map of existing subject configs (groupings)
            const subjectMap = {};
            existingSubjects.forEach(s => {
                subjectMap[s.name] = s;
            });

            // Extract unique subjects from Courses
            const uniqueSubjects = new Map();
            courses.forEach(c => {
                if (c.subject) {
                    const subName = c.subject.trim();
                    if (!uniqueSubjects.has(subName)) {
                        // Use existing config if available, else default
                        const existing = subjectMap[subName];
                        uniqueSubjects.set(subName, {
                            _id: existing?._id || `temp-${subName}`, // Use temp ID if new
                            name: subName,
                            code: c.code || existing?.code || "", // Fallback code
                            slotGroup: existing?.slotGroup || null,
                            type: c.type || "Core" // Capture type from course data
                        });
                    }
                }
            });

            // Flatten map to array
            const allSubjects = Array.from(uniqueSubjects.values());

            // Separate subjects into buckets based on slotGroup
            const unassigned = [];
            const itemsSlotA = [];
            const itemsSlotB = [];

            allSubjects.forEach(sub => {
                if (sub.slotGroup === 'A') itemsSlotA.push(sub);
                else if (sub.slotGroup === 'B') itemsSlotB.push(sub);
                else unassigned.push(sub);
            });

            setColumns({
                unassigned: { id: 'unassigned', title: 'Unassigned Subjects', items: unassigned },
                slotA: { id: 'slotA', title: 'Elective Slot A', items: itemsSlotA },
                slotB: { id: 'slotB', title: 'Elective Slot B', items: itemsSlotB }
            });
            setLoading(false);
        } catch (err) {
            console.error('Error fetching subjects:', err);
            setMessage({ type: 'error', text: 'Failed to load subjects. Ensure server is running.' });
            setLoading(false);
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const { source, destination } = result;

        if (source.droppableId !== destination.droppableId) {
            const sourceColumn = columns[source.droppableId];
            const destColumn = columns[destination.droppableId];
            const sourceItems = [...sourceColumn.items];
            const destItems = [...destColumn.items];
            const [removed] = sourceItems.splice(source.index, 1);
            destItems.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...sourceColumn,
                    items: sourceItems
                },
                [destination.droppableId]: {
                    ...destColumn,
                    items: destItems
                }
            });
        } else {
            const column = columns[source.droppableId];
            const copiedItems = [...column.items];
            const [removed] = copiedItems.splice(source.index, 1);
            copiedItems.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...column,
                    items: copiedItems
                }
            });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const updates = [];

            // Map items to their new slot group using NAME for upsert
            columns.unassigned.items.forEach(item => updates.push({ subjectName: item.name, slotGroup: null }));
            columns.slotA.items.forEach(item => updates.push({ subjectName: item.name, slotGroup: 'A' }));
            columns.slotB.items.forEach(item => updates.push({ subjectName: item.name, slotGroup: 'B' }));

            await api.put('/subjects/grouping', { updates });
            setMessage({ type: 'success', text: 'Groupings saved successfully!' });

            // Re-fetch to normalize IDs
            fetchSubjects();
        } catch (err) {
            console.error('Error saving groupings:', err);
            setMessage({ type: 'error', text: 'Failed to save groupings.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading subjects...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">Drag & Drop Elective Grouping</h1>

            {message && (
                <div className={`mb-4 p-4 rounded text-center ${message.type === 'success' ? 'bg-green-600/20 text-green-400 border border-green-500' : 'bg-red-600/20 text-red-400 border border-red-500'}`}>
                    {message.text}
                </div>
            )}

            <div className="flex justify-center mb-8">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-8 py-3 rounded-lg font-semibold transition-all shadow-lg ${saving ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/30'}`}
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 justify-center">
                <DragDropContext onDragEnd={onDragEnd}>
                    {Object.entries(columns).map(([columnId, column]) => (
                        <div key={columnId} className="flex flex-col items-center w-full lg:w-1/3">
                            <h2 className="text-xl font-semibold mb-4 text-gray-300">{column.title}</h2>
                            <Droppable droppableId={columnId}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`w-full min-h-[500px] p-4 rounded-xl border-2 transition-all duration-200 ${snapshot.isDraggingOver
                                            ? 'bg-gray-800 border-blue-500 shadow-blue-500/20 shadow-inner'
                                            : 'bg-gray-800/50 border-gray-700'
                                            }`}
                                    >
                                        {column.items.map((item, index) => (
                                            <Draggable key={item._id} draggableId={item._id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`p-4 mb-3 rounded-lg flex justify-between items-center shadow-md transition-shadow duration-200 ${snapshot.isDragging
                                                            ? 'bg-blue-600 text-white shadow-xl scale-105 z-50'
                                                            : 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:shadow-lg'
                                                            }`}
                                                        style={{
                                                            ...provided.draggableProps.style,
                                                            opacity: snapshot.isDragging ? 0.9 : 1
                                                        }}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-lg">{item.name}</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs text-gray-400">{item.code}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${(item.type || 'Core') === 'Elective'
                                                                        ? 'bg-pink-900/30 text-pink-300 border-pink-700'
                                                                        : 'bg-blue-900/30 text-blue-300 border-blue-700'
                                                                    }`}>
                                                                    {item.type || 'Core'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-gray-400">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </DragDropContext>
            </div>
        </div>
    );
};

export default ElectiveGrouping;
