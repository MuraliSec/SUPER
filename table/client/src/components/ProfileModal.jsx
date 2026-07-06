import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const mapRoleToDisplay = (role) => {
    const mapping = {
        'COLLEGE_ADMIN': 'Main Administration System',
        'HOD': 'Main Administration System',
        'FACULTY': 'Faculty',
        'STUDENT': 'Student',
        'COMPANY_ADMIN': 'Company Admin',
        'superAdmin': 'Super Admin'
    };
    return mapping[role] || role;
};

const ProfileModal = ({ user, tab: initialTab = 'view', onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState(initialTab); // 'view' | 'edit'
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobileNumber: '',
        profilePhoto: '',
        branch: '',
        academicYear: '',
        batch: '',
        address: '',
        parentDetails: '',
        collegeName: ''
    });

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const res = await api.get('/profile/details', {
                    headers: { 'x-username': user.username }
                });
                setProfile(res.data);
                setFormData({
                    name: res.data.name || '',
                    email: res.data.email || '',
                    mobileNumber: res.data.mobileNumber || '',
                    profilePhoto: res.data.profilePhoto || '',
                    branch: res.data.branch || '',
                    academicYear: res.data.academicYear || '',
                    batch: res.data.batch || '',
                    address: res.data.address || '',
                    parentDetails: res.data.parentDetails || '',
                    collegeName: res.data.collegeName || ''
                });
            } catch (err) {
                console.error('Error fetching profile details:', err);
                setError('Failed to load profile details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const isStudent = user.role === 'STUDENT';
            const isFaculty = user.role === 'FACULTY';
            const isAdmin = ['HOD', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

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
                payload.facultyName = formData.name;
                payload.facultyId = user.username;
            } else if (isStudent) {
                payload.studentName = formData.name;
                payload.rollNumber = user.username;
                payload.academicYear = formData.academicYear;
                payload.batch = formData.batch;
                payload.address = formData.address;
                payload.parentDetails = formData.parentDetails;
                // Preserve existing subjects list
                payload.subjects = profile?.subjects || [];
            }

            const res = await api.post('/profile/complete', payload);
            if (res.data.success) {
                setSuccess('Profile updated successfully!');
                setProfile(prev => ({ ...prev, ...formData }));
                onUpdate({
                    name: formData.name || formData.collegeName,
                    email: formData.email,
                    profilePhoto: formData.profilePhoto,
                    mobileNumber: formData.mobileNumber
                });
                setTimeout(() => {
                    setActiveTab('view');
                    setSuccess('');
                }, 1500);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const isStudent = user.role === 'STUDENT';
    const isFaculty = user.role === 'FACULTY';
    const isAdmin = ['HOD', 'COLLEGE_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

    // Style tokens
    const modalOverlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, fontFamily: "'Inter', sans-serif"
    };

    const containerStyle = {
        background: 'white', padding: '32px', borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%', maxWidth: '580px', boxSizing: 'border-box',
        position: 'relative', border: '1px solid rgba(255,255,255,0.8)'
    };

    const tabButtonStyle = (active) => ({
        padding: '10px 20px', border: 'none', background: active ? '#4c51bf' : 'transparent',
        color: active ? 'white' : '#718096', fontWeight: '800', borderRadius: '10px',
        cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s'
    });

    const labelStyle = {
        display: 'block', fontSize: '13px', fontWeight: '700',
        color: '#4a5568', marginBottom: '6px'
    };

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: '10px',
        border: '1px solid #cbd5e0', outline: 'none', fontSize: '14px',
        boxSizing: 'border-box'
    };

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={containerStyle} onClick={e => e.stopPropagation()}>
                {/* Close Button */}
                <button onClick={onClose} style={{
                    position: 'absolute', top: '20px', right: '20px', background: 'transparent',
                    border: 'none', fontSize: '20px', cursor: 'pointer', color: '#a0aec0'
                }}></button>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', background: '#f7fafc', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px' }}>
                    <button onClick={() => setActiveTab('view')} style={tabButtonStyle(activeTab === 'view')}> View Profile</button>
                    <button onClick={() => setActiveTab('edit')} style={tabButtonStyle(activeTab === 'edit')}> Edit Profile</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#4c51bf', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ color: '#718096', fontWeight: '600' }}>Loading profile details...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : (
                    <div>
                        {error && (
                            <div style={{ background: '#fff5f5', color: '#c53030', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', border: '1px solid #feb2b2', fontWeight: '600' }}>
                                 {error}
                            </div>
                        )}
                        {success && (
                            <div style={{ background: '#f0fff4', color: '#38a169', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', border: '1px solid #c6f6d5', fontWeight: '600' }}>
                                 {success}
                            </div>
                        )}

                        {/* ── VIEW TAB ── */}
                        {activeTab === 'view' && profile && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    {profile.profilePhoto ? (
                                        <img src={profile.profilePhoto} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4c51bf' }} />
                                    ) : (
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}></div>
                                    )}
                                    <div>
                                        <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#1a202c', margin: '0 0 4px 0' }}>{profile.name || profile.collegeName || user.username}</h3>
                                        <p style={{ color: '#718096', fontSize: '13px', margin: 0, fontWeight: '600' }}>@{profile.username} ({mapRoleToDisplay(user.role)})</p>
                                    </div>
                                </div>

                                <div style={{ gap: '16px', borderTop: '1px solid #edf2f7', paddingTop: '20px' }} className="grid grid-cols-1 md:grid-cols-2">
                                    {isAdmin && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>College Branding Name</span>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.collegeName || 'Not Set'}</div>
                                        </div>
                                    )}
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Email Address</span>
                                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.email || 'None'}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Mobile Number</span>
                                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.mobileNumber || 'None'}</div>
                                    </div>
                                    {isFaculty && (
                                        <>
                                            <div>
                                                <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Department</span>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.department || 'None'}</div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Branch</span>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.branch || 'None'}</div>
                                            </div>
                                        </>
                                    )}
                                    {isStudent && (
                                        <>
                                            <div>
                                                <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Academic Year</span>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.academicYear || 'None'}</div>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Batch</span>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.batch || 'None'}</div>
                                            </div>
                                            {profile.branch && (
                                                <div>
                                                    <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Branch</span>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.branch}</div>
                                                </div>
                                            )}
                                            {profile.parentDetails && (
                                                <div>
                                                    <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Parent Details</span>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.parentDetails}</div>
                                                </div>
                                            )}
                                            {profile.address && (
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <span style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', fontWeight: '700' }}>Address</span>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{profile.address}</div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── EDIT TAB ── */}
                        {activeTab === 'edit' && (
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                    {formData.profilePhoto ? (
                                        <img src={formData.profilePhoto} alt="Preview" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4c51bf' }} />
                                    ) : (
                                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '24px' }}></div>
                                    )}
                                    <div>
                                        <label style={labelStyle}>Update Profile Photo</label>
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: '13px' }} />
                                    </div>
                                </div>

                                <div style={{ gap: '16px' }} className="grid grid-cols-1 md:grid-cols-2">
                                    {!isAdmin && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={labelStyle}>Full Name *</label>
                                            <input type="text" name="name" value={formData.name} onChange={handleTextChange} style={inputStyle} required />
                                        </div>
                                    )}
                                    {isAdmin && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={labelStyle}>College Name *</label>
                                            <input type="text" name="collegeName" value={formData.collegeName} onChange={handleTextChange} style={inputStyle} required />
                                        </div>
                                    )}
                                    <div>
                                        <label style={labelStyle}>Email Address *</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleTextChange} style={inputStyle} required />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Mobile Number</label>
                                        <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleTextChange} style={inputStyle} />
                                    </div>

                                    {(isFaculty || isStudent) && (
                                        <div>
                                            <label style={labelStyle}>Branch</label>
                                            <input type="text" name="branch" value={formData.branch} onChange={handleTextChange} style={inputStyle} />
                                        </div>
                                    )}

                                    {isStudent && (
                                        <>
                                            <div>
                                                <label style={labelStyle}>Academic Year</label>
                                                <input type="text" name="academicYear" value={formData.academicYear} onChange={handleTextChange} style={inputStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Parent Details</label>
                                                <input type="text" name="parentDetails" value={formData.parentDetails} onChange={handleTextChange} style={inputStyle} />
                                            </div>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={labelStyle}>Address</label>
                                                <textarea name="address" value={formData.address} onChange={handleTextChange} style={{ ...inputStyle, height: '60px', resize: 'vertical' }} />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'end', marginTop: '16px' }}>
                                    <button type="button" onClick={onClose} style={{
                                        padding: '10px 20px', background: '#e2e8f0', color: '#4a5568',
                                        border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer'
                                    }}>Cancel</button>
                                    <button type="submit" disabled={saving} style={{
                                        padding: '10px 24px', background: 'linear-gradient(135deg,#4c51bf 0%,#667eea 100%)',
                                        color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(76,81,191,0.3)', opacity: saving ? 0.7 : 1
                                    }}>{saving ? 'Saving...' : ' Save Changes'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
