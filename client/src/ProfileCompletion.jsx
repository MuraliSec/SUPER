import React, { useState, useEffect } from 'react';
import api from './api/axios';

const ProfileCompletion = ({ user, onComplete }) => {
    const isStudent = user.role === 'STUDENT';
    const isFaculty = user.role === 'FACULTY';
    const isAdmin = ['HOD', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

    const [step, setStep] = useState(1); // Used for Student Wizard
    const [batches, setBatches] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [subjectSearch, setSubjectSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        // Admin
        collegeName: '',
        // Faculty
        facultyName: user.name || '',
        facultyId: user.username || '',
        department: '',
        // Student
        studentName: user.name || '',
        rollNumber: user.username || '',
        academicYear: '',
        batch: '',
        semester: '',
        address: '',
        parentDetails: '',
        // Common
        email: user.email || '',
        mobileNumber: '',
        branch: '',
        profilePhoto: ''
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setFetchingData(true);
            try {
                if (isStudent) {
                    // Fetch batches for student dropdown
                    const bRes = await api.get(`/auth/batches-public/${user.institutionId}`);
                    setBatches(bRes.data || []);

                    // Fetch subjects for course selection
                    const sRes = await api.get('/subjects');
                    setAvailableSubjects(sRes.data || []);
                }
            } catch (err) {
                console.error('Error loading profile completion data:', err);
                setError('Failed to load form options. Please reload page.');
            } finally {
                setFetchingData(false);
            }
        };
        loadInitialData();
    }, [user]);

    const handleTextChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Image size should be less than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profilePhoto: reader.result }));
                setError('');
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleSubject = (subject) => {
        setSelectedSubjects(prev => {
            const exists = prev.find(s => s._id === subject._id);
            if (exists) {
                return prev.filter(s => s._id !== subject._id);
            } else {
                return [...prev, subject];
            }
        });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                role: user.role,
                username: user.username,
                institutionId: user.institutionId,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
                profilePhoto: formData.profilePhoto,
                branch: formData.branch
            };

            if (isAdmin) {
                payload.collegeName = formData.collegeName;
            } else if (isFaculty) {
                payload.facultyName = formData.facultyName;
                payload.facultyId = formData.facultyId;
            } else if (isStudent) {
                payload.studentName = formData.studentName;
                payload.rollNumber = formData.rollNumber;
                payload.academicYear = formData.academicYear;
                payload.batch = formData.batch;
                payload.semester = formData.semester;
                payload.address = formData.address;
                payload.parentDetails = formData.parentDetails;
                payload.subjects = selectedSubjects.map(s => ({
                    subjectId: s._id,
                    subjectCode: s.code,
                    subjectName: s.name
                }));
            }

            const res = await api.post('/profile/complete', payload);
            if (res.data.success) {
                onComplete({
                    name: updatedName(),
                    email: formData.email,
                    profilePhoto: formData.profilePhoto,
                    mobileNumber: formData.mobileNumber,
                    profileCompleted: true,
                    username: res.data.username || user.username,
                    token: res.data.token
                });
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Profile completion failed');
        } finally {
            setLoading(false);
        }
    };

    const updatedName = () => {
        if (isAdmin) return formData.collegeName;
        if (isFaculty) return formData.facultyName;
        if (isStudent) return formData.studentName;
        return user.name;
    };

    const nextStep = () => {
        setError('');
        if (step === 1) {
            if (!formData.studentName || !formData.rollNumber || !formData.email || !formData.batch || !formData.semester) {
                setError('Name, Roll Number, Email, Batch, and Semester are required fields');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (selectedSubjects.length === 0) {
                setError('Please select at least one course.');
                return;
            }
            setStep(3);
        }
    };

    const prevStep = () => {
        setError('');
        setStep(prev => Math.max(1, prev - 1));
    };

    const uniqueSubjects = React.useMemo(() => {
        const seen = new Set();
        return availableSubjects.filter(sub => {
            const name = String(sub.name || '').trim().toLowerCase();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [availableSubjects]);

    // Style helper for label
    const labelStyle = {
        display: 'block',
        fontSize: '13px',
        fontWeight: '700',
        color: '#4a5568',
        marginBottom: '6px'
    };

    // Style helper for input
    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #cbd5e0',
        outline: 'none',
        fontSize: '14px',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box'
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
            fontFamily: "'Inter', sans-serif",
            padding: '24px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                background: 'white',
                padding: '36px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: isStudent ? '750px' : '520px',
                boxSizing: 'border-box'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ fontSize: '42px', marginBottom: '8px' }}></div>
                    <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1a202c', margin: 0 }}>
                        Complete Your Profile
                    </h2>
                    <p style={{ color: '#718096', fontSize: '14px', marginTop: '6px', fontWeight: '500' }}>
                        {isStudent ? 'Set up your student account to unlock your dashboard' : 'Enter your profile details to unlock your dashboard'}
                    </p>

                    {/* Step indicator for student */}
                    {isStudent && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                            {[1, 2, 3].map(s => (
                                <div key={s} style={{
                                    height: '6px',
                                    width: '32px',
                                    borderRadius: '3px',
                                    background: s === step ? '#4c51bf' : (s < step ? '#9ae6b4' : '#e2e8f0'),
                                    transition: 'background 0.3s'
                                }} />
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{
                        background: '#fff5f5',
                        color: '#c53030',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        marginBottom: '20px',
                        fontSize: '13px',
                        border: '1px solid #feb2b2',
                        fontWeight: '600'
                    }}>
                         {error}
                    </div>
                )}

                {fetchingData ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                        <div style={{ fontSize: '24px', marginBottom: '10px', animation: 'spin 1s linear infinite' }}></div>
                        <p style={{ fontWeight: '600' }}>Fetching options...</p>
                    </div>
                ) : (
                    <div>
                        {/* ── ADMIN / HOD FORM ── */}
                        {isAdmin && (
                            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>College Name *</label>
                                    <input
                                        type="text"
                                        name="collegeName"
                                        value={formData.collegeName}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        placeholder="Enter full college name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Contact Email *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        placeholder="admin@college.edu"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Mobile Number</label>
                                    <input
                                        type="tel"
                                        name="mobileNumber"
                                        value={formData.mobileNumber}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        placeholder="Enter mobile number"
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Profile Photo</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        {formData.profilePhoto ? (
                                            <img src={formData.profilePhoto} alt="Preview" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4c51bf' }} />
                                        ) : (
                                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '20px' }}></div>
                                        )}
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: '13px' }} />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} style={{
                                    marginTop: '12px', padding: '14px', background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
                                    color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(76, 81, 191, 0.3)', opacity: loading ? 0.7 : 1
                                }}>
                                    {loading ? 'Saving Profile...' : ' Save & Open Dashboard'}
                                </button>
                            </form>
                        )}

                        {/* ── FACULTY FORM ── */}
                        {isFaculty && (
                            <form onSubmit={handleSubmit} style={{ gap: '16px' }} className="grid grid-cols-1 md:grid-cols-2">
                                <div>
                                    <label style={labelStyle}>Faculty Name *</label>
                                    <input
                                        type="text"
                                        name="facultyName"
                                        value={formData.facultyName}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Faculty ID *</label>
                                    <input
                                        type="text"
                                        name="facultyId"
                                        value={formData.facultyId}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Email Address *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Mobile Number</label>
                                    <input
                                        type="tel"
                                        name="mobileNumber"
                                        value={formData.mobileNumber}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={labelStyle}>Branch</label>
                                    <input
                                        type="text"
                                        name="branch"
                                        value={formData.branch}
                                        onChange={handleTextChange}
                                        style={inputStyle}
                                        placeholder="e.g. AI & ML"
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Profile Photo</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        {formData.profilePhoto ? (
                                            <img src={formData.profilePhoto} alt="Preview" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4c51bf' }} />
                                        ) : (
                                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '20px' }}></div>
                                        )}
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: '13px' }} />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} style={{
                                    gridColumn: '1 / -1', marginTop: '12px', padding: '14px', background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
                                    color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(76, 81, 191, 0.3)', opacity: loading ? 0.7 : 1
                                }}>
                                    {loading ? 'Saving Profile...' : ' Save & Open Dashboard'}
                                </button>
                            </form>
                        )}

                        {/* ── STUDENT WIZARD ── */}
                        {isStudent && (
                            <div>
                                {/* Step 1: Profile Details */}
                                {step === 1 && (
                                    <div style={{ gap: '16px' }} className="grid grid-cols-1 md:grid-cols-2">
                                        <div>
                                            <label style={labelStyle}>Student Name *</label>
                                            <input
                                                type="text"
                                                name="studentName"
                                                value={formData.studentName}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Roll Number *</label>
                                            <input
                                                type="text"
                                                name="rollNumber"
                                                value={formData.rollNumber}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Email Address *</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Mobile Number</label>
                                            <input
                                                type="tel"
                                                name="mobileNumber"
                                                value={formData.mobileNumber}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Academic Year</label>
                                            <input
                                                type="text"
                                                name="academicYear"
                                                value={formData.academicYear}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                placeholder="e.g. 2025-2029"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Branch</label>
                                            <input
                                                type="text"
                                                name="branch"
                                                value={formData.branch}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                placeholder="e.g. CSE"
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Batch *</label>
                                            <select
                                                name="batch"
                                                value={formData.batch}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                required
                                            >
                                                <option value="">-- Select Batch --</option>
                                                {batches.map(b => (
                                                    <option key={b.batchId || b._id} value={b.name}>
                                                        {b.name} {[b.department].filter(Boolean).join(' - ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Semester *</label>
                                            <input
                                                type="number"
                                                name="semester"
                                                value={formData.semester}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                required
                                                min="1"
                                                max="8"
                                                placeholder="e.g. 1, 2, 3..."
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Parent Details</label>
                                            <input
                                                type="text"
                                                name="parentDetails"
                                                value={formData.parentDetails}
                                                onChange={handleTextChange}
                                                style={inputStyle}
                                                placeholder="Father / Mother Name & contact"
                                            />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={labelStyle}>Address</label>
                                            <textarea
                                                name="address"
                                                value={formData.address}
                                                onChange={handleTextChange}
                                                style={{ ...inputStyle, height: '60px', resize: 'vertical' }}
                                                placeholder="Enter permanent address"
                                            />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={labelStyle}>Profile Photo</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                {formData.profilePhoto ? (
                                                    <img src={formData.profilePhoto} alt="Preview" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4c51bf' }} />
                                                ) : (
                                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '20px' }}></div>
                                                )}
                                                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: '13px' }} />
                                            </div>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                            <button onClick={nextStep} style={{
                                                padding: '12px 28px', background: '#4c51bf', color: 'white',
                                                border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px',
                                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(76, 81, 191, 0.25)'
                                            }}>
                                                Next: Select Courses →
                                            </button>
                                        </div>
                                    </div>
                                )}
 
                                {/* Step 2: Course Selection */}
                                {step === 2 && (
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1a202c', marginTop: 0, marginBottom: '12px' }}>
                                             Select Your Courses
                                        </h3>
                                        <p style={{ color: '#718096', fontSize: '13px', marginBottom: '16px', fontWeight: '500' }}>
                                            Please select the courses you are currently enrolled in.
                                        </p>
                                        
                                        <div style={{ marginBottom: '16px' }}>
                                            <input
                                                type="text"
                                                placeholder=" Search courses by name or code..."
                                                value={subjectSearch}
                                                onChange={e => setSubjectSearch(e.target.value)}
                                                style={inputStyle}
                                            />
                                        </div>

                                        <div style={{
                                            maxHeight: '260px',
                                            overflowY: 'auto',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '12px',
                                            padding: '12px',
                                            display: 'grid',
                                            gap: '8px',
                                            background: '#f8fafc'
                                        }}>
                                            {uniqueSubjects
                                                .filter(sub => 
                                                    String(sub.name || '').toLowerCase().includes(subjectSearch.toLowerCase()) ||
                                                    String(sub.code || '').toLowerCase().includes(subjectSearch.toLowerCase())
                                                )
                                                .map(sub => {
                                                    const isChecked = selectedSubjects.some(s => s._id === sub._id);
                                                    return (
                                                        <label
                                                            key={sub._id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '12px',
                                                                padding: '10px 14px',
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                background: isChecked ? '#ebf8ff' : 'white',
                                                                border: isChecked ? '1px solid #63b3ed' : '1px solid #e2e8f0',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleSubject(sub)}
                                                                style={{ width: '18px', height: '18px', accentColor: '#4c51bf', cursor: 'pointer' }}
                                                            />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748' }}>{sub.name}</div>
                                                                <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600' }}>Code: {sub.code}</div>
                                                            </div>
                                                        </label>
                                                    );
                                                })
                                            }
                                            {uniqueSubjects.filter(sub => 
                                                String(sub.name || '').toLowerCase().includes(subjectSearch.toLowerCase()) ||
                                                String(sub.code || '').toLowerCase().includes(subjectSearch.toLowerCase())
                                            ).length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '24px', color: '#a0aec0', fontSize: '13px', fontWeight: '600' }}>
                                                    No courses found.
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                                            <button onClick={prevStep} style={{
                                                padding: '12px 24px', background: 'white', color: '#4a5568',
                                                border: '2px solid #e2e8f0', borderRadius: '10px', fontWeight: '700', fontSize: '14px',
                                                cursor: 'pointer'
                                            }}>
                                                ← Back
                                            </button>
                                            <button onClick={nextStep} style={{
                                                padding: '12px 28px', background: '#4c51bf', color: 'white',
                                                border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px',
                                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(76, 81, 191, 0.25)'
                                            }}>
                                                Next: Review & Save →
                                            </button>
                                        </div>
                                    </div>
                                )}
 
                                {/* Step 3: Review & Save */}
                                {step === 3 && (
                                    <div>
                                        <div style={{
                                            background: '#f7fafc',
                                            borderRadius: '16px',
                                            padding: '24px',
                                            textAlign: 'left',
                                            marginBottom: '24px',
                                            border: '1px solid #edf2f7',
                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.01)'
                                        }}>
                                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1a202c', marginTop: 0, marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}> Profile Summary</h3>
                                            <div style={{ gap: '8px', fontSize: '13px', marginBottom: '20px' }} className="grid grid-cols-1 md:grid-cols-2">
                                                <div><strong>Name:</strong> {formData.studentName}</div>
                                                <div><strong>Roll No:</strong> {formData.rollNumber}</div>
                                                <div><strong>Email:</strong> {formData.email}</div>
                                                <div><strong>Batch:</strong> {formData.batch}</div>
                                                <div><strong>Semester:</strong> {formData.semester}</div>
                                                {formData.mobileNumber && <div><strong>Mobile:</strong> {formData.mobileNumber}</div>}
                                                {formData.branch && <div><strong>Branch:</strong> {formData.branch}</div>}
                                            </div>
                                            
                                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1a202c', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}> Enrolled Courses ({selectedSubjects.length})</h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {selectedSubjects.map(sub => (
                                                    <span key={sub._id} style={{ background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                                                        {sub.name} ({sub.code})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <button onClick={prevStep} style={{
                                                padding: '12px 24px', background: 'white', color: '#4a5568',
                                                border: '2px solid #e2e8f0', borderRadius: '10px', fontWeight: '700', fontSize: '14px',
                                                cursor: 'pointer'
                                            }}>
                                                ← Back
                                            </button>
                                            <button onClick={handleSubmit} disabled={loading} style={{
                                                padding: '14px 36px', background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                                                color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px',
                                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(72, 187, 120, 0.25)', opacity: loading ? 0.7 : 1
                                            }}>
                                                {loading ? 'Saving Profile...' : ' Save & Go to Dashboard'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ProfileCompletion;
