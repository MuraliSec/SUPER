import React, { useState, useEffect } from 'react';
import api from './api/axios';

const TimetableConfig = () => {
    const [session, setSession] = useState('2025-26-Even');
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        periodsPerDay: 8,
        periodDuration: 60,
        startTime: '09:00',
        endTime: '17:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        lunchBreak: {
            enabled: true,
            period: 4,
            duration: 60
        }
    });

    useEffect(() => {
        fetchConfig();
    }, [session]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/timetable-advanced/config/${session}`);
            setConfig(response.data);
            setFormData({
                periodsPerDay: response.data.periodsPerDay,
                periodDuration: response.data.periodDuration,
                startTime: response.data.startTime,
                endTime: response.data.endTime,
                workingDays: response.data.workingDays,
                lunchBreak: response.data.lunchBreak
            });
        } catch (error) {
            console.error('Failed to fetch config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await api.put(`/timetable-advanced/config/${session}`, formData);
            setMessage({ type: 'success', text: 'Configuration saved successfully!' });
            fetchConfig();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save configuration' });
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDayToggle = (day) => {
        setFormData(prev => ({
            ...prev,
            workingDays: prev.workingDays.includes(day)
                ? prev.workingDays.filter(d => d !== day)
                : [...prev.workingDays, day]
        }));
    };

    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div style={{ padding: '30px', width: '100%' }}>
            <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                 Timetable Configuration
            </h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
                Configure periods, time ranges, and working days for timetable generation
            </p>

            {/* Session Selector */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                marginBottom: '20px'
            }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#333' }}>
                    Session
                </label>
                <input
                    type="text"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    placeholder="e.g., 2025-26-Even"
                    style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '16px'
                    }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    Loading configuration...
                </div>
            ) : (
                <>
                    {/* Periods Configuration */}
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', color: '#2d3748' }}>
                             Period Settings
                        </h3>

                        <div style={{ gap: '20px' }} className="grid grid-cols-1 md:grid-cols-2">
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                    Periods Per Day
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={formData.periodsPerDay}
                                    onChange={(e) => setFormData({ ...formData, periodsPerDay: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '16px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                    Period Duration (minutes)
                                </label>
                                <input
                                    type="number"
                                    min="30"
                                    max="120"
                                    step="15"
                                    value={formData.periodDuration}
                                    onChange={(e) => setFormData({ ...formData, periodDuration: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '16px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '16px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '16px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Working Days */}
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', color: '#2d3748' }}>
                             Working Days
                        </h3>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {allDays.map(day => (
                                <button
                                    key={day}
                                    onClick={() => handleDayToggle(day)}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        border: '2px solid',
                                        borderColor: formData.workingDays.includes(day) ? '#667eea' : '#e2e8f0',
                                        background: formData.workingDays.includes(day)
                                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                            : 'white',
                                        color: formData.workingDays.includes(day) ? 'white' : '#64748b',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lunch Break */}
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', color: '#2d3748' }}>
                             Lunch Break
                        </h3>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.lunchBreak.enabled}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        lunchBreak: { ...formData.lunchBreak, enabled: e.target.checked }
                                    })}
                                    style={{ marginRight: '10px', width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: '600', color: '#555' }}>Enable Lunch Break</span>
                            </label>
                        </div>

                        {formData.lunchBreak.enabled && (
                            <div style={{ gap: '20px' }} className="grid grid-cols-1 md:grid-cols-2">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                        Lunch Period Number
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={formData.periodsPerDay}
                                        value={formData.lunchBreak.period}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            lunchBreak: { ...formData.lunchBreak, period: parseInt(e.target.value) }
                                        })}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '16px'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                                        Lunch Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="30"
                                        max="120"
                                        step="15"
                                        value={formData.lunchBreak.duration}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            lunchBreak: { ...formData.lunchBreak, duration: parseInt(e.target.value) }
                                        })}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '16px'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Message Display */}
                    {message && (
                        <div style={{
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            background: message.type === 'success' ? '#d1fae5' : '#fee',
                            border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fcc'}`,
                            color: message.type === 'success' ? '#065f46' : '#c33'
                        }}>
                            {message.type === 'success' ? '' : ''} {message.text}
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: saving
                                ? '#ccc'
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '18px',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        {saving ? ' Saving...' : ' Save Configuration'}
                    </button>
                </>
            )}
        </div>
    );
};

export default TimetableConfig;
