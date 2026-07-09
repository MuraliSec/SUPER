import React, { useState, useEffect } from 'react';
import api from './api/axios';

const StudentManagement = ({ user }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', item }
    const [batches, setBatches] = useState([]);
    const [form, setForm] = useState({
        rollNumber: '',
        name: '',
        email: '',
        mobileNumber: '',
        academicYear: '',
        branch: '',
        batch: ''
    });
    const [tempPasswordInfo, setTempPasswordInfo] = useState(null); // null | { username, password, name }

    useEffect(() => {
        fetchStudents();
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/batches');
            setBatches(res.data);
        } catch (err) {
            console.error('Failed to load batches:', err);
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/students');
            setStudents(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setError('');
        setForm({
            rollNumber: '',
            name: '',
            email: '',
            mobileNumber: '',
            academicYear: new Date().getFullYear().toString(),
            branch: '',
            batch: ''
        });
        setModal({ mode: 'add' });
    };

    const handleOpenEditModal = (student) => {
        setError('');
        setForm({ ...student });
        setModal({ mode: 'edit', item: student });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (modal.mode === 'add') {
                const res = await api.post('/students', form);
                await fetchStudents();
                setModal(null);
                
                // If temporary password was returned, show it
                if (res.data && res.data.tempPassword) {
                    setTempPasswordInfo({
                        username: res.data.student.rollNumber,
                        password: res.data.tempPassword,
                        name: res.data.student.name
                    });
                }
            } else {
                await api.put(`/students/${modal.item._id}`, form);
                await fetchStudents();
                setModal(null);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Operation failed');
        }
    };

    const handleDelete = async (student) => {
        if (!window.confirm(`Are you sure you want to delete student ${student.name} (${student.rollNumber})? This will also remove their user account.`)) {
            return;
        }
        setError('');
        try {
            await api.delete(`/students/${student._id}`);
            await fetchStudents();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete student');
        }
    };

    const isAdmin = ['COLLEGE_ADMIN', 'COMPANY_ADMIN', 'HOD', 'superAdmin'].includes(user?.role);

    // Filter students locally based on search query
    const filteredStudents = students.filter(s => {
        const query = searchQuery.toLowerCase();
        return (
            (s.name || '').toLowerCase().includes(query) ||
            (s.rollNumber || '').toLowerCase().includes(query) ||
            (s.branch || '').toLowerCase().includes(query) ||
            (s.batch || '').toLowerCase().includes(query)
        );
    });

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header section */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-800">Student Management</h1>
                    <p className="text-gray-500 text-sm mt-1">Create student accounts. Students will select their own courses after their first login.</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition"
                >
                    <span className="text-lg">+</span> Add Student Record
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 font-medium text-sm flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-lg font-bold">×</button>
                </div>
            )}

            {/* Filters panel */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex items-center justify-between gap-4">
                <div className="flex-1 relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"></span>
                    <input
                        type="text"
                        placeholder="Search students by roll number, name, branch, batch, or section..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button 
                    onClick={fetchStudents} 
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition"
                    title="Refresh List"
                >
                     Refresh
                </button>
            </div>

            {/* Student grid/table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                {loading ? (
                    <div className="text-center py-12 text-gray-500 font-medium">Loading student list...</div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <span className="text-5xl block mb-4">‍</span>
                        {searchQuery ? 'No matching student records found.' : 'No student records created yet.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold">
                                    <th className="px-6 py-4">Roll Number</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Contact Info</th>
                                    <th className="px-6 py-4">Class details</th>
                                    <th className="px-6 py-4">Enrolled Subjects</th>
                                    {isAdmin && <th className="px-6 py-4">Created By</th>}
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredStudents.map(student => (
                                    <tr key={student._id} className="hover:bg-indigo-50/30 transition">
                                        <td className="px-6 py-4 font-mono font-bold text-gray-700">{student.rollNumber}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-800">{student.name}</div>
                                            <div className="text-xs text-gray-400 font-medium">Joined {new Date(student.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-700">{student.email}</div>
                                            <div className="text-xs text-gray-500">{student.mobileNumber || '—'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-700">{student.branch || '—'}</div>
                                            <div className="text-xs text-gray-500">Batch: {student.batch || '—'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {student.subjects && student.subjects.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {student.subjects.map(s => (
                                                        <span key={s.subjectId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded" title={s.subjectName}>
                                                            {s.subjectCode}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">None</span>
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-gray-600">
                                                    {student.createdByFacultyName || '—'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(student)}
                                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 transition"
                                                >
                                                     Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(student)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 transition"
                                                >
                                                     Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CRUD Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">{modal.mode === 'add' ? 'Add New Student' : 'Edit Student Details'}</h2>
                            <button onClick={() => setModal(null)} className="text-gray-400 hover:text-red-500 text-2xl font-bold"></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className={modal.mode === 'add' ? 'col-span-2' : ''}>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Roll Number *</label>
                                    <input
                                        type="text"
                                        required
                                        disabled={modal.mode === 'edit'}
                                        value={form.rollNumber}
                                        onChange={e => setForm(p => ({ ...p, rollNumber: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                                        placeholder="e.g. 21BCE0001"
                                    />
                                </div>
                                {modal.mode === 'edit' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                                            <input
                                                type="text"
                                                required={modal.mode === 'edit'}
                                                value={form.name}
                                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                                            <input
                                                type="email"
                                                required={modal.mode === 'edit'}
                                                value={form.email}
                                                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g. student@institution.edu"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
                                            <input
                                                type="text"
                                                value={form.mobileNumber}
                                                onChange={e => setForm(p => ({ ...p, mobileNumber: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g. +91 9876543210"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Academic Year</label>
                                            <input
                                                type="text"
                                                value={form.academicYear}
                                                onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g. 2026"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Branch</label>
                                            <input
                                                type="text"
                                                value={form.branch}
                                                onChange={e => setForm(p => ({ ...p, branch: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g. Computer Science"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Batch *</label>
                                            <select
                                                required={modal.mode === 'edit'}
                                                value={form.batch}
                                                onChange={e => setForm(p => ({ ...p, batch: e.target.value }))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Select a Batch</option>
                                                {batches.map(b => (
                                                    <option key={b._id} value={b.batchId || b.name}>
                                                        {b.batchId || b.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Info note */}
                            <div className="border-t pt-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex gap-2 items-start">
                                    <span className="text-lg">ℹ</span>
                                    <span><strong>Course Enrollment:</strong> Students will select their own courses after logging in for the first time through the Student Portal.</span>
                                </div>
                            </div>

                            {/* Form submit/cancel */}
                            <div className="flex justify-end gap-3 border-t pt-4">
                                <button
                                    type="button"
                                    onClick={() => setModal(null)}
                                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
                                >
                                    {modal.mode === 'add' ? 'Create Student' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Temp Password Copy Modal */}
            {tempPasswordInfo && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Student Account Created!</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Here is the temporary login password generated for <strong>{tempPasswordInfo.name}</strong> ({tempPasswordInfo.username}).
                            Please copy and share it with the student. It will only be shown once.
                        </p>
                        
                        <div className="bg-gray-100 rounded-lg p-3 font-mono text-lg font-bold text-gray-800 flex justify-between items-center mb-6">
                            <span>{tempPasswordInfo.password}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(tempPasswordInfo.password);
                                    alert('Password copied to clipboard!');
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                            >
                                Copy
                            </button>
                        </div>

                        <button
                            onClick={() => setTempPasswordInfo(null)}
                            className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-lg font-semibold text-sm transition"
                        >
                            I have copied the password
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentManagement;
