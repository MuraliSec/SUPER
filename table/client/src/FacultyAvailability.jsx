import React, { useState, useEffect } from 'react';
import api from './api/axios';

function FacultyAvailability() {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null); // { day, period, data }
    const [showModal, setShowModal] = useState(false);

    // Search states
    const [availSearch, setAvailSearch] = useState('');
    const [busySearch, setBusySearch] = useState('');
    const [roomSearch, setRoomSearch] = useState('');

    useEffect(() => {
        fetchAvailability();
    }, []);

    const fetchAvailability = async () => {
        try {
            const res = await api.get('/faculty-info/availability');
            setAvailability(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const periodLabels = [
        "9:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "12:00 - 1:00",
        "1:00 - 2:00", "2:00 - 3:00", "3:00 - 4:00", "4:00 - 5:00"
    ];

    const getCellColor = (available, total) => {
        const percentage = (available / total) * 100;
        if (percentage >= 80) return 'bg-green-100 text-green-800 hover:bg-green-200';
        if (percentage >= 50) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
        return 'bg-red-100 text-red-800 hover:bg-red-200';
    };

    const handleCellClick = (day, periodData) => {
        setSelectedSlot({ day, period: periodData.period, ...periodData });
        // Reset searches
        setAvailSearch('');
        setBusySearch('');
        setRoomSearch('');
        setShowModal(true);
    };

    // Filter helpers
    // Filter helpers - robust check
    const filteredAvailableFaculty = selectedSlot?.availableFaculty.filter(f => {
        const name = f?.name || "";
        const dept = f?.department || "";
        const search = availSearch.toLowerCase();
        return name.toLowerCase().includes(search) || dept.toLowerCase().includes(search);
    }) || [];

    const filteredBusyFaculty = selectedSlot?.busyFacultyNames?.filter(name => {
        const n = name || "";
        return n.toLowerCase().includes(busySearch.toLowerCase());
    }) || [];

    const filteredRooms = selectedSlot?.availableRooms?.filter(r => {
        const name = r?.name || "";
        const type = r?.type || "";
        const search = roomSearch.toLowerCase();
        return name.toLowerCase().includes(search) || type.toLowerCase().includes(search);
    }) || [];

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-indigo-900 mb-6 flex items-center gap-3">
                <span></span> Faculty Availability & Meeting Scheduler
            </h1>

            <p className="mb-6 text-gray-600">
                Select a time slot to see available faculty and schedule a meeting.
                Color intensity indicates availability (Green = High, Red = Low).
            </p>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-xl shadow-lg p-6">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border-b-2 border-gray-200 bg-gray-50 text-left font-bold text-gray-700">Days / Time</th>
                                {periodLabels.map((label, i) => (
                                    <th key={i} className="p-3 border-b-2 border-gray-200 bg-gray-50 text-center font-bold text-gray-700 min-w-[120px]">
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {availability.map((dayData, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                    <td className="p-4 font-bold text-gray-800 bg-gray-50">{dayData.day}</td>
                                    {dayData.periods.map((p, j) => (
                                        <td key={j} className="p-2">
                                            <div
                                                onClick={() => handleCellClick(dayData.day, p)}
                                                className={`cursor-pointer rounded-lg p-3 text-center transition shadow-sm h-full flex flex-col justify-center items-center ${getCellColor(p.availableCount, p.total)}`}
                                            >
                                                <span className="text-xl font-bold block">{p.availableCount} / {p.total}</span>
                                                <span className="text-xs opacity-75 font-semibold">Faculty Free</span>
                                                <div className="mt-1 w-full border-t border-black/10 pt-1">
                                                    <span className="text-sm font-bold block">{p.availableRoomCount} / {p.totalRooms}</span>
                                                    <span className="text-[10px] opacity-75">Rooms Free</span>
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL */}
            {showModal && selectedSlot && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold">Schedule Meeting</h2>
                                <p className="opacity-90 mt-1">
                                    {selectedSlot.day} • Period {selectedSlot.period}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition"
                            >
                                
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Available Faculty */}
                                <div>
                                    <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
                                        <span className="bg-green-100 p-1 rounded"></span> Available Faculty ({filteredAvailableFaculty.length})
                                    </h3>
                                    <input
                                        type="text"
                                        placeholder="Search available..."
                                        className="w-full mb-2 p-2 border rounded text-sm"
                                        value={availSearch}
                                        onChange={(e) => setAvailSearch(e.target.value)}
                                    />
                                    <div className="bg-green-50 border border-green-100 rounded-lg p-4 h-[300px] overflow-y-auto">
                                        {filteredAvailableFaculty.length > 0 ? (
                                            <ul className="space-y-2">
                                                {filteredAvailableFaculty.map(f => (
                                                    <li key={f._id} className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded shadow-sm">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        <span className="font-semibold">{f.name}</span>
                                                        <span className="text-gray-400 text-xs">({f.department})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500 italic">No matching faculty found.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Busy Faculty */}
                                <div>
                                    <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
                                        <span className="bg-red-100 p-1 rounded"></span> Busy Faculty ({filteredBusyFaculty.length})
                                    </h3>
                                    <input
                                        type="text"
                                        placeholder="Search busy..."
                                        className="w-full mb-2 p-2 border rounded text-sm"
                                        value={busySearch}
                                        onChange={(e) => setBusySearch(e.target.value)}
                                    />
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 h-[300px] overflow-y-auto">
                                        {filteredBusyFaculty.length > 0 ? (
                                            <ul className="space-y-2">
                                                {filteredBusyFaculty.sort().map((name, idx) => (
                                                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded shadow-sm opacity-75">
                                                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                                        <span>{name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500 italic">No matching faculty found.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Rooms Section */}
                            <div className="mt-8 pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span></span> Available Rooms ({filteredRooms.length})
                                </h3>
                                <div className="max-w-md mb-4">
                                    <input
                                        type="text"
                                        placeholder="Search rooms..."
                                        className="w-full p-2 border rounded text-sm"
                                        value={roomSearch}
                                        onChange={(e) => setRoomSearch(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-gray-50 h-[200px] overflow-y-auto">
                                    {filteredRooms.length > 0 ? (
                                        filteredRooms.map(r => (
                                            <div key={r._id} className="bg-white p-2 rounded border border-gray-200 text-sm text-center shadow-sm h-full">
                                                <div className="font-bold text-indigo-700">{r.name}</div>
                                                <div className="text-xs text-gray-500">{r.type}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="col-span-4 text-gray-500 italic text-center">No matching rooms found.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    alert(`Meeting Scheduled for ${selectedSlot.day} at Period ${selectedSlot.period}!\n\nAll ${selectedSlot.availableCount} available faculty have been notified (simulation).`);
                                    setShowModal(false);
                                }}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg transition flex items-center gap-2"
                            >
                                <span></span> Schedule Meeting for All Available
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FacultyAvailability;
