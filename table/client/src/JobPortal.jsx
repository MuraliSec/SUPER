import React, { useState, useEffect } from 'react';
import api from './api/axios';

const JobPortal = ({ user }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        company: '',
        description: '',
        location: '',
        salary: '',
        link: ''
    });

    const isInternalAdmin = ['HOD', 'FACULTY', 'COLLEGE_ADMIN'].includes(user.role);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            const res = await api.get('/jobs');
            setJobs(res.data);
        } catch (err) {
            console.error('Error fetching jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/jobs', formData);
            setShowModal(false);
            setFormData({ title: '', company: '', description: '', location: '', salary: '', link: '' });
            fetchJobs();
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Error posting job';
            alert('Error: ' + msg);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this job?')) return;
        try {
            await api.delete(`/jobs/${id}`);
            fetchJobs();
        } catch (err) {
            alert('Error deleting job');
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Opportunities...</div>;

    return (
        <div style={{ padding: '30px', width: '100%', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1a202c', margin: 0 }}>Career Portal</h1>
                    <p style={{ color: '#718096', marginTop: '4px' }}>Discover and manage job opportunities within our network</p>
                </div>
                {isInternalAdmin && (
                    <button 
                        onClick={() => setShowModal(true)}
                        style={{
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(76, 81, 191, 0.2)'
                        }}
                    >
                        + Post New Job
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {jobs.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '48px', marginBottom: '15px' }}></div>
                        <h3 style={{ color: '#4a5568', margin: 0 }}>No jobs found at the moment</h3>
                        <p style={{ color: '#a0aec0' }}>Check back later or post a new opportunity if you're an admin</p>
                    </div>
                ) : (
                    jobs.map(job => (
                        <div key={job._id} style={{
                            background: 'white',
                            padding: '24px',
                            borderRadius: '20px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                            border: '1px solid #edf2f7',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: '0.3s'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ padding: '4px 12px', background: '#ebf4ff', color: '#2b6cb0', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
                                    {job.location || 'Remote'}
                                </span>
                                {isInternalAdmin && (
                                    <button 
                                        onClick={() => handleDelete(job._id)}
                                        style={{ background: 'none', border: 'none', color: '#feb2b2', cursor: 'pointer', fontSize: '18px' }}
                                        title="Delete Post"
                                    >
                                        
                                    </button>
                                )}
                            </div>
                            
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#2d3748', marginTop: '15px', marginBottom: '4px' }}>{job.title}</h2>
                            <p style={{ color: '#4c51bf', fontWeight: '700', margin: 0 }}>{job.company}</p>
                            
                            <p style={{ 
                                color: '#718096', 
                                fontSize: '14px', 
                                marginTop: '15px', 
                                flex: 1, 
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {job.description}
                            </p>

                            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#a0aec0' }}>Salary Range</div>
                                    <div style={{ fontWeight: '700', color: '#2d3748' }}>{job.salary || 'Not Disclosed'}</div>
                                </div>
                                <a 
                                    href={job.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: '10px 20px',
                                        background: '#edf2f7',
                                        color: '#4a5568',
                                        borderRadius: '10px',
                                        textDecoration: 'none',
                                        fontWeight: '700',
                                        fontSize: '14px'
                                    }}
                                >
                                    Apply Now ↗
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Post Job Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Post a New Opening</h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Job Title</label>
                                <input type="text" placeholder="e.g. Software Engineer" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Company Name</label>
                                <input type="text" placeholder="e.g. Google" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Description</label>
                                <textarea placeholder="Responsibilities, tech stack, etc." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }}
                                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                            </div>
                            <div style={{ gap: '15px' }} className="grid grid-cols-1 md:grid-cols-2">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Location</label>
                                    <input type="text" placeholder="e.g. Delhi" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Salary</label>
                                    <input type="text" placeholder="e.g. 10 - 15 LPA" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Application Link</label>
                                <input type="url" placeholder="https://careers.google.com/..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} required />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: '#4c51bf', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Publish Opportunity</button>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '12px 20px', background: '#f7fafc', color: '#4a5568', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobPortal;
