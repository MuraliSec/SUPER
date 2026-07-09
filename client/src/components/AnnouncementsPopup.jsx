import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const managerRoles = ['COMPANY_ADMIN', 'COLLEGE_ADMIN', 'HOD', 'FACULTY'];

const fileKind = (name = '') => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'DOC';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'XLS';
    if (['ppt', 'pptx'].includes(ext)) return 'PPT';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'IMG';
    if (ext === 'txt') return 'TXT';
    if (ext === 'zip') return 'ZIP';
    return 'FILE';
};

const formatBytes = (bytes = 0) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date) => {
    try {
        return new Date(date).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
};

const AnnouncementsPopup = ({ user, scopeKey, isMobile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [seenIds, setSeenIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showComposer, setShowComposer] = useState(false);
    const [form, setForm] = useState({ title: '', message: '', file: null });
    const [posting, setPosting] = useState(false);
    const closeTimerRef = useRef(null);

    const hasAnnouncementScope = Boolean(scopeKey && scopeKey !== 'global');
    const canManage = hasAnnouncementScope && managerRoles.includes(user?.role);
    const seenStorageKey = `campuscore:announcements:seen:${scopeKey || 'global'}:${user?.id || user?.username || 'user'}`;
    const unreadCount = announcements.filter(item => !seenIds.includes(item.id)).length;

    const saveSeenIds = (ids) => {
        try {
            localStorage.setItem(seenStorageKey, JSON.stringify(ids));
        } catch (err) {
            console.error('Could not save announcement read state:', err);
        }
    };

    const markAnnouncementsAsSeen = () => {
        if (!announcements.length) return;

        setSeenIds(prev => {
            const next = Array.from(new Set([...prev, ...announcements.map(item => item.id)]));
            saveSeenIds(next);
            return next;
        });
    };

    const fetchAnnouncements = async () => {
        if (!hasAnnouncementScope) {
            setAnnouncements([]);
            setError('');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.get('/announcements');
            setAnnouncements(res.data.announcements || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Could not load announcements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchAnnouncements();
    }, [scopeKey, user?.id, hasAnnouncementScope]);

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(seenStorageKey) || '[]');
            setSeenIds(Array.isArray(saved) ? saved : []);
        } catch {
            setSeenIds([]);
        }
    }, [seenStorageKey]);

    useEffect(() => {
        if (isOpen) markAnnouncementsAsSeen();
    }, [isOpen, announcements]);

    const openPopup = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        setIsOpen(true);
    };

    const scheduleClose = () => {
        closeTimerRef.current = setTimeout(() => setIsOpen(false), 160);
    };

    const togglePopup = () => {
        setIsOpen(prev => !prev);
    };

    const submitAnnouncement = async (e) => {
        e.preventDefault();
        if (!form.title.trim() && !form.message.trim() && !form.file) return;

        const data = new FormData();
        data.append('title', form.title);
        data.append('message', form.message);
        if (form.file) data.append('file', form.file);

        setPosting(true);
        setError('');
        try {
            const res = await api.post('/announcements', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAnnouncements(prev => [res.data.announcement, ...prev]);
            setForm({ title: '', message: '', file: null });
            setShowComposer(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Could not post announcement');
        } finally {
            setPosting(false);
        }
    };

    const deleteAnnouncement = async (id) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await api.delete(`/announcements/${id}`);
            setAnnouncements(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            setError(err.response?.data?.error || 'Could not delete announcement');
        }
    };

    return (
        <div
            onMouseEnter={openPopup}
            onMouseLeave={scheduleClose}
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        >
            <button
                type="button"
                title="Announcements"
                onClick={togglePopup}
                onFocus={openPopup}
                style={{
                    width: isMobile ? '32px' : '38px',
                    height: isMobile ? '32px' : '38px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: isOpen ? 'white' : 'rgba(255,255,255,0.14)',
                    color: isOpen ? '#4c51bf' : 'white',
                    cursor: 'pointer',
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isOpen ? '0 8px 18px rgba(0,0,0,0.18)' : 'none',
                    position: 'relative',
                    lineHeight: 1
                }}
            >
                !
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        minWidth: '17px',
                        height: '17px',
                        padding: '0 4px',
                        borderRadius: '999px',
                        background: '#f56565',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: isMobile ? '40px' : '48px',
                    right: isMobile ? '-56px' : '0',
                    width: isMobile ? 'min(92vw, 360px)' : '390px',
                    maxHeight: '72vh',
                    overflowY: 'auto',
                    background: 'white',
                    color: '#1a202c',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 22px 55px rgba(15,23,42,0.22)',
                    zIndex: 1200,
                    padding: '14px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#1a202c' }}>Announcements</div>
                            <div style={{ fontSize: '11px', color: '#718096', fontWeight: '700' }}>
                                {announcements.length} active {announcements.length === 1 ? 'post' : 'posts'}
                            </div>
                        </div>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setShowComposer(prev => !prev)}
                                style={{
                                    border: 'none',
                                    background: '#edf2f7',
                                    color: '#4c51bf',
                                    borderRadius: '8px',
                                    padding: '7px 10px',
                                    cursor: 'pointer',
                                    fontWeight: '900',
                                    fontSize: '12px'
                                }}
                            >
                                {showComposer ? 'Close' : '+ Add'}
                            </button>
                        )}
                    </div>

                    {showComposer && (
                        <form onSubmit={submitAnnouncement} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '10px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            marginBottom: '12px'
                        }}>
                            <input
                                value={form.title}
                                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Title"
                                style={{
                                    width: '100%',
                                    border: '1px solid #dbe3ef',
                                    borderRadius: '8px',
                                    padding: '9px 10px',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                            <textarea
                                value={form.message}
                                onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Announcement text"
                                rows={3}
                                style={{
                                    width: '100%',
                                    border: '1px solid #dbe3ef',
                                    borderRadius: '8px',
                                    padding: '9px 10px',
                                    fontSize: '13px',
                                    resize: 'vertical',
                                    outline: 'none'
                                }}
                            />
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.zip"
                                onChange={e => setForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                                style={{ fontSize: '12px', color: '#4a5568' }}
                            />
                            <button
                                type="submit"
                                disabled={posting}
                                style={{
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '9px 12px',
                                    background: posting ? '#a3bffa' : '#4c51bf',
                                    color: 'white',
                                    fontWeight: '900',
                                    cursor: posting ? 'not-allowed' : 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                {posting ? 'Posting...' : 'Post Announcement'}
                            </button>
                        </form>
                    )}

                    {error && (
                        <div style={{
                            background: '#fff5f5',
                            border: '1px solid #feb2b2',
                            color: '#c53030',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            fontWeight: '700',
                            marginBottom: '10px'
                        }}>
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ padding: '22px', textAlign: 'center', color: '#718096', fontSize: '13px', fontWeight: '700' }}>
                            Loading announcements...
                        </div>
                    ) : announcements.length === 0 ? (
                        <div style={{
                            padding: '24px 12px',
                            textAlign: 'center',
                            color: '#718096',
                            background: '#f8fafc',
                            border: '1px dashed #cbd5e0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700'
                        }}>
                            No announcements yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {announcements.map(item => (
                                <div key={item.id} style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '11px',
                                    background: 'white'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: '900', fontSize: '14px', color: '#1a202c', wordBreak: 'break-word' }}>
                                                {item.title}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#718096', fontWeight: '700', marginTop: '2px' }}>
                                                {formatDate(item.createdAt)} by {item.createdBy?.name || 'User'}
                                            </div>
                                        </div>
                                        {canManage && (
                                            <button
                                                type="button"
                                                title="Delete announcement"
                                                onClick={() => deleteAnnouncement(item.id)}
                                                style={{
                                                    border: 'none',
                                                    background: '#fff5f5',
                                                    color: '#c53030',
                                                    borderRadius: '7px',
                                                    width: '26px',
                                                    height: '26px',
                                                    cursor: 'pointer',
                                                    fontWeight: '900',
                                                    flexShrink: 0
                                                }}
                                            >
                                                x
                                            </button>
                                        )}
                                    </div>

                                    {item.message && (
                                        <div style={{
                                            marginTop: '9px',
                                            color: '#2d3748',
                                            fontSize: '13px',
                                            lineHeight: 1.45,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {item.message}
                                        </div>
                                    )}

                                    {item.attachment && (
                                        <a
                                            href={item.attachment.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                marginTop: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '9px',
                                                textDecoration: 'none',
                                                background: '#f7fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '9px',
                                                padding: '9px',
                                                color: '#2d3748'
                                            }}
                                        >
                                            <span style={{
                                                width: '38px',
                                                height: '32px',
                                                borderRadius: '7px',
                                                background: '#4c51bf',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '10px',
                                                fontWeight: '900',
                                                flexShrink: 0
                                            }}>
                                                {fileKind(item.attachment.originalName)}
                                            </span>
                                            <span style={{ minWidth: 0, flex: 1 }}>
                                                <span style={{ display: 'block', fontSize: '12px', fontWeight: '900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.attachment.originalName}
                                                </span>
                                                <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: '700', marginTop: '2px' }}>
                                                    {formatBytes(item.attachment.size)} - Open file
                                                </span>
                                            </span>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnnouncementsPopup;
