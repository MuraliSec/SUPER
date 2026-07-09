import React, { useState, useEffect } from 'react';
import api from './api/axios';
import SystemHealthDiagnostics from './SystemHealthDiagnostics';

const CompanyPortal = (props) => {
    const [institutions, setInstitutions] = useState([]);
    const [stats, setStats] = useState({ institutions: 0, totalFaculty: 0, totalBatches: 0 });
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeView, setActiveView] = useState('institutions');
    
    // New Institution Form
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        address: '',
        contact: '',
        adminUsername: '',
        adminPassword: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [instRes, statsRes] = await Promise.all([
                api.get('/company/institutions'),
                api.get('/company/stats')
            ]);
            setInstitutions(instRes.data);
            setStats(statsRes.data);
        } catch (err) {
            console.error('Error fetching company data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddInstitution = async (e) => {
        e.preventDefault();
        try {
            await api.post('/company/institutions', formData);
            setShowAddModal(false);
            setFormData({ name: '', code: '', address: '', contact: '', adminUsername: '', adminPassword: '' });
            fetchData();
        } catch (err) {
            alert('Error adding institution: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleResetPassword = async (instId, newPassword) => {
        try {
            await api.put(`/company/institutions/${instId}/reset-password`, { newPassword });
            alert('Password successfully updated!');
        } catch (err) {
            alert('Error updating password');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure? This will delete all college data and credentials.')) return;
        try {
            await api.delete(`/company/institutions/${id}`);
            fetchData();
        } catch (err) {
            alert('Error deleting institution');
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Central Dashboard...</div>;

    return (
        <div style={{ width: '100%', padding: '40px 20px', fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#2d3748', margin: 0 }}>Company Dashboard</h1>
                    <p style={{ color: '#718096', marginTop: '4px' }}>Centralized management for all affiliated colleges</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', background: '#edf2f7', borderRadius: '8px', padding: '4px' }}>
                        <button
                            onClick={() => setActiveView('institutions')}
                            style={{
                                padding: '9px 14px',
                                background: activeView === 'institutions' ? 'white' : 'transparent',
                                color: activeView === 'institutions' ? '#2d3748' : '#718096',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                boxShadow: activeView === 'institutions' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                            }}
                        >
                            Colleges
                        </button>
                        <button
                            onClick={() => setActiveView('diagnostics')}
                            style={{
                                padding: '9px 14px',
                                background: activeView === 'diagnostics' ? 'white' : 'transparent',
                                color: activeView === 'diagnostics' ? '#2d3748' : '#718096',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                boxShadow: activeView === 'diagnostics' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                            }}
                        >
                            Diagnostics
                        </button>
                    </div>
                    {activeView === 'institutions' && (
                        <button 
                            onClick={() => setShowAddModal(true)}
                            style={{
                                padding: '12px 24px',
                                background: '#4a5568',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            + Add New College
                        </button>
                    )}
                </div>
            </div>

            {activeView === 'diagnostics' ? (
                <SystemHealthDiagnostics />
            ) : (
                <>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {[
                    { label: 'Registered Colleges', value: stats.institutions, color: '#667eea', icon: '' },
                    { label: 'Total Faculty', value: stats.totalFaculty, color: '#48bb78', icon: '‍' },
                    { label: 'Total Batches', value: stats.totalBatches, color: '#ed8936', icon: '' }
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                        borderLeft: `6px solid ${stat.color}`
                    }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.icon}</div>
                        <div style={{ color: '#718096', fontSize: '14px', fontWeight: '600', textTransform: 'uppercase' }}>{stat.label}</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2d3748' }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Institutions Table */}
            <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f7fafc', borderBottom: '1px solid #edf2f7' }}>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#4a5568' }}>College Name</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#4a5568' }}>Code</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#4a5568', background: '#fef3c7' }}> Admin Credentials</th>
                            <th style={{ padding: '16px', textAlign: 'left', color: '#4a5568' }}>Contact</th>
                            <th style={{ padding: '16px', textAlign: 'right', color: '#4a5568' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {institutions.map(inst => (
                            <tr key={inst._id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                <td style={{ padding: '16px' }}>
                                    <div 
                                        onClick={() => props.onSelectCollege(inst._id, inst.name)}
                                        style={{ fontWeight: '600', color: '#2d3748', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        {inst.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#a0aec0' }}>{inst.address}</div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{ 
                                        padding: '4px 10px', 
                                        background: '#ebf4ff', 
                                        color: '#3182ce', 
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}>
                                        {inst.code}
                                    </span>
                                </td>
                                <td style={{ padding: '16px', background: '#fffbeb' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>User: {inst.adminUsername}</div>
                                    <div style={{ fontSize: '11px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span>Pass: ••••••••</span>
                                        <button 
                                            onClick={() => {
                                                const newPass = prompt(`Enter new password for ${inst.adminUsername}:`);
                                                if(newPass) handleResetPassword(inst._id, newPass);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '10px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </td>
                                <td style={{ padding: '16px', color: '#4a5568' }}>{inst.contact}</td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => props.onSelectCollege(inst._id, inst.name)}
                                        style={{ color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginRight: '15px' }}
                                    >
                                        Manage
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(inst._id)}
                                        style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
                </>
            )}

            {/* Modal for Adding Institution */}
            {showAddModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '500px' }}>
                        <h2 style={{ marginBottom: '20px' }}>Add New College</h2>
                        <form onSubmit={handleAddInstitution}>
                            <div style={{ gap: '15px' }} className="grid grid-cols-1 md:grid-cols-2">
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>College Name</label>
                                    <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Unique Code</label>
                                    <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required />
                                </div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Address</label>
                                <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Contact Details</label>
                                <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} />
                            </div>

                            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />
                            <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>College Admin Credentials</h3>
                            
                            <div style={{ gap: '15px' }} className="grid grid-cols-1 md:grid-cols-2">
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Username</label>
                                    <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        value={formData.adminUsername} onChange={e => setFormData({ ...formData, adminUsername: e.target.value })} required />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Password</label>
                                    <input type="password" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        value={formData.adminPassword} onChange={e => setFormData({ ...formData, adminPassword: e.target.value })} required />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: '#48bb78', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Create College</button>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '12px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyPortal;
