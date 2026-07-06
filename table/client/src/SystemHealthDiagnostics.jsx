import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from './api/axios';

const statusStyles = {
    healthy: { color: '#047857', background: '#ecfdf5', border: '#a7f3d0', label: 'Healthy' },
    skipped: { color: '#475569', background: '#f8fafc', border: '#cbd5e1', label: 'Skipped' },
    warning: { color: '#92400e', background: '#fffbeb', border: '#fde68a', label: 'Warning' },
    failed: { color: '#b91c1c', background: '#fef2f2', border: '#fecaca', label: 'Failed' }
};

const muted = '#64748b';
const text = '#0f172a';

const getStatusStyle = (status) => statusStyles[status] || statusStyles.warning;

const formatDate = (value) => {
    if (!value) return 'Not checked';
    return new Date(value).toLocaleString();
};

const formatDuration = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return `${value} ms`;
};

const StatusBadge = ({ status }) => {
    const style = getStatusStyle(status);
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '24px',
            padding: '3px 9px',
            borderRadius: '999px',
            background: style.background,
            border: `1px solid ${style.border}`,
            color: style.color,
            fontSize: '12px',
            fontWeight: 800,
            whiteSpace: 'nowrap'
        }}>
            {style.label}
        </span>
    );
};

const MetricCard = ({ label, value, status, detail }) => {
    const style = getStatusStyle(status);
    return (
        <div style={{
            background: '#ffffff',
            border: `1px solid ${style.border}`,
            borderLeft: `5px solid ${style.color}`,
            borderRadius: '8px',
            padding: '16px',
            minHeight: '112px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(15,23,42,0.08)'
        }}>
            <div style={{ color: muted, fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: text, fontSize: '24px', fontWeight: 850, lineHeight: 1.2, marginTop: '8px', wordBreak: 'break-word' }}>{value}</div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {status ? <StatusBadge status={status} /> : <span />}
                {detail && <span style={{ color: muted, fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>{detail}</span>}
            </div>
        </div>
    );
};

const Section = ({ title, right, children }) => (
    <section style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: text, fontSize: '18px', fontWeight: 850 }}>{title}</h2>
            {right}
        </div>
        {children}
    </section>
);

const EmptyState = ({ message }) => (
    <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '18px',
        color: muted,
        fontWeight: 700
    }}>
        {message}
    </div>
);

const TableWrap = ({ children }) => (
    <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)'
    }}>
        {children}
    </div>
);

const tableHeaderStyle = {
    padding: '12px',
    textAlign: 'left',
    color: '#334155',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
    textTransform: 'uppercase'
};

const tableCellStyle = {
    padding: '12px',
    color: '#334155',
    borderBottom: '1px solid #eef2f7',
    fontSize: '13px',
    verticalAlign: 'top'
};

const SystemHealthDiagnostics = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const loadHealth = useCallback(async (force = false) => {
        setError('');
        if (force) setRefreshing(true);
        try {
            const res = await api.get(`/company/health${force ? '?refresh=true' : ''}`);
            setHealth(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Unable to load health report');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadHealth(true);
    }, [loadHealth]);

    useEffect(() => {
        const intervalMs = health?.intervalMs || 5 * 60 * 1000;
        const timer = setInterval(() => loadHealth(false), intervalMs);
        return () => clearInterval(timer);
    }, [health?.intervalMs, loadHealth]);

    const cards = health?.cards || {};
    const apiEndpoints = health?.api?.endpoints || [];
    const verifiedApiEndpoints = apiEndpoints.filter(item => item.includedInHealth !== false);
    const hiddenApiCount = apiEndpoints.length - verifiedApiEndpoints.length;
    const failedModules = health?.report?.failedModules || [];
    const suggestedFixes = health?.report?.suggestedFixes || [];
    const slowApis = health?.performance?.slowestApis || [];

    const dashboardCards = useMemo(() => ([
        { label: 'Overall System Health', value: getStatusStyle(cards.overallSystemHealth).label, status: cards.overallSystemHealth },
        { label: 'Frontend Status', value: getStatusStyle(cards.frontendStatus).label, status: cards.frontendStatus },
        { label: 'Backend Status', value: getStatusStyle(cards.backendStatus).label, status: cards.backendStatus, detail: health?.backend?.nodeVersion },
        { label: 'Database Status', value: getStatusStyle(cards.databaseStatus).label, status: cards.databaseStatus },
        { label: 'API Health', value: getStatusStyle(cards.apiHealth).label, status: cards.apiHealth },
        { label: 'Authentication', value: getStatusStyle(cards.authentication).label, status: cards.authentication },
        { label: 'Storage Usage', value: cards.storageUsage?.value || 'Unknown', status: cards.storageUsage?.status },
        { label: 'Active Users', value: cards.activeUsers ?? 0, status: 'healthy', detail: 'last 15 min' },
        { label: 'Active Colleges', value: cards.activeColleges ?? 0, status: 'healthy' },
        { label: 'Response Time', value: formatDuration(cards.responseTime), status: cards.responseTime > 500 ? 'warning' : 'healthy', detail: 'avg API' },
        { label: 'Error Count', value: cards.errorCount ?? 0, status: cards.errorCount > 0 ? 'warning' : 'healthy' },
        { label: 'Last Health Check', value: formatDate(cards.lastHealthCheck), status: cards.overallSystemHealth }
    ]), [cards, health?.backend?.nodeVersion]);

    if (loading) {
        return <div style={{ padding: '40px', color: muted, fontWeight: 800 }}>Loading diagnostics...</div>;
    }

    return (
        <div style={{ padding: '32px 20px', background: '#f8fafc', minHeight: 'calc(100vh - 220px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
                <div>
                    <h1 style={{ margin: 0, color: text, fontSize: '28px', fontWeight: 900 }}>System Health & Diagnostics</h1>
                    <div style={{ marginTop: '6px', color: muted, fontWeight: 700, fontSize: '13px' }}>
                        Auto check every {Math.round((health?.intervalMs || 300000) / 60000)} minutes
                        {health?.cached ? ' · cached report' : ''}
                    </div>
                </div>
                <button
                    onClick={() => loadHealth(true)}
                    disabled={refreshing}
                    style={{
                        padding: '11px 18px',
                        background: refreshing ? '#94a3b8' : '#1e293b',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 850,
                        cursor: refreshing ? 'not-allowed' : 'pointer',
                        minWidth: '160px'
                    }}
                >
                    {refreshing ? 'Running Check...' : 'Run Health Check'}
                </button>
            </div>

            {error && (
                <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    borderRadius: '8px',
                    padding: '14px',
                    marginBottom: '20px',
                    fontWeight: 750
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                {dashboardCards.map(card => <MetricCard key={card.label} {...card} />)}
            </div>

            <Section title="Module Health">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {(health?.modules || []).map(module => (
                        <div key={module.name} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '14px',
                            minHeight: '118px',
                            boxShadow: '0 1px 3px rgba(15,23,42,0.06)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ color: text, fontWeight: 850, fontSize: '14px' }}>{module.name}</div>
                                <StatusBadge status={module.status} />
                            </div>
                            <div style={{ color: muted, marginTop: '10px', fontSize: '13px', lineHeight: 1.45, fontWeight: 650 }}>
                                {module.reason}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            <Section
                title="API Health"
                right={<span style={{ color: muted, fontSize: '13px', fontWeight: 750 }}>Verified {verifiedApiEndpoints.length} endpoints · Hidden skipped probes {hiddenApiCount} · Slow threshold {health?.api?.slowThresholdMs || 500} ms</span>}
            >
                <TableWrap>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
                        <thead>
                            <tr>
                                <th style={tableHeaderStyle}>Endpoint</th>
                                <th style={tableHeaderStyle}>Method</th>
                                <th style={tableHeaderStyle}>Status Code</th>
                                <th style={tableHeaderStyle}>Response Time</th>
                                <th style={tableHeaderStyle}>Result</th>
                                <th style={tableHeaderStyle}>Last Checked</th>
                                <th style={tableHeaderStyle}>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {verifiedApiEndpoints.map((item, index) => (
                                <tr key={`${item.method}-${item.endpoint}-${index}`}>
                                    <td style={{ ...tableCellStyle, fontFamily: 'monospace', color: item.slow ? '#b45309' : '#334155' }}>{item.endpoint}</td>
                                    <td style={tableCellStyle}>{item.method}</td>
                                    <td style={tableCellStyle}>{item.statusCode}</td>
                                    <td style={{ ...tableCellStyle, color: item.slow ? '#b45309' : '#334155', fontWeight: item.slow ? 850 : 650 }}>{formatDuration(item.responseTimeMs)}</td>
                                    <td style={tableCellStyle}><StatusBadge status={item.status} /></td>
                                    <td style={tableCellStyle}>{formatDate(item.lastChecked)}</td>
                                    <td style={{ ...tableCellStyle, maxWidth: '260px' }}>{item.reason || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
            </Section>

            <Section title="Database Health">
                <TableWrap>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                        <thead>
                            <tr>
                                <th style={tableHeaderStyle}>Database</th>
                                <th style={tableHeaderStyle}>Type</th>
                                <th style={tableHeaderStyle}>Status</th>
                                <th style={tableHeaderStyle}>Storage</th>
                                <th style={tableHeaderStyle}>Connections</th>
                                <th style={tableHeaderStyle}>Counts</th>
                                <th style={tableHeaderStyle}>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[health?.database?.master, ...(health?.database?.colleges || [])].filter(Boolean).map(db => (
                                <tr key={`${db.kind}-${db.institutionId || 'master'}`}>
                                    <td style={tableCellStyle}>
                                        <div style={{ fontWeight: 850, color: text }}>{db.name}</div>
                                        <div style={{ color: muted, fontSize: '12px', marginTop: '3px' }}>{db.databaseName || 'master'}</div>
                                    </td>
                                    <td style={tableCellStyle}>{db.kind}</td>
                                    <td style={tableCellStyle}><StatusBadge status={db.status} /></td>
                                    <td style={tableCellStyle}>{db.metrics?.storage || '-'}</td>
                                    <td style={tableCellStyle}>{db.metrics?.activeConnections ?? '-'}</td>
                                    <td style={tableCellStyle}>
                                        {Object.keys(db.counts || {}).length
                                            ? Object.entries(db.counts).map(([key, value]) => `${key}: ${value}`).join(', ')
                                            : '-'}
                                    </td>
                                    <td style={{ ...tableCellStyle, maxWidth: '280px' }}>{db.reason || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
            </Section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', marginTop: '28px' }}>
                <Section title="Performance">
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                            <MetricCard label="Average API" value={formatDuration(health?.performance?.averageApiResponseTime)} status={health?.performance?.averageApiResponseTime > 500 ? 'warning' : 'healthy'} />
                            <MetricCard label="DB Query Time" value={formatDuration(health?.performance?.databaseQueryTime)} status={health?.performance?.databaseQueryTime > 500 ? 'warning' : 'healthy'} />
                            <MetricCard label="Heap Used" value={health?.performance?.memoryUsage?.heapUsed || '-'} status="healthy" />
                            <MetricCard label="CPU Cores" value={health?.performance?.cpuUsage?.cores || '-'} status="healthy" />
                        </div>
                        <div style={{ marginTop: '16px', color: text, fontWeight: 850 }}>Slowest APIs</div>
                        {slowApis.length ? (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {slowApis.map(apiItem => (
                                    <div key={`${apiItem.method}-${apiItem.endpoint}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#334155', fontSize: '13px', fontWeight: 700 }}>
                                        <span style={{ fontFamily: 'monospace' }}>{apiItem.method} {apiItem.endpoint}</span>
                                        <span>{formatDuration(apiItem.responseTimeMs)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : <EmptyState message="No API timing data yet." />}
                    </div>
                </Section>

                <Section title="Error Monitoring">
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                            {Object.entries(health?.errors?.counters || {}).filter(([key]) => key !== 'recent').map(([key, value]) => (
                                <div key={key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                                    <div style={{ color: muted, fontSize: '11px', textTransform: 'uppercase', fontWeight: 850 }}>{key}</div>
                                    <div style={{ color: text, fontWeight: 900, fontSize: '20px', marginTop: '4px' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                        {(health?.errors?.recent || []).length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                {health.errors.recent.slice(0, 8).map(item => (
                                    <div key={item.id} style={{ borderTop: '1px solid #eef2f7', paddingTop: '9px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                            <strong style={{ color: text, fontSize: '13px' }}>{item.module}</strong>
                                            <span style={{ color: muted, fontSize: '12px' }}>{formatDate(item.timestamp)}</span>
                                        </div>
                                        <div style={{ color: muted, fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>{item.method} {item.path}</div>
                                        <div style={{ color: '#475569', fontSize: '13px', marginTop: '4px' }}>{item.message}</div>
                                    </div>
                                ))}
                            </div>
                        ) : <EmptyState message="No recent errors recorded." />}
                    </div>
                </Section>
            </div>

            <Section title="Frontend Health">
                <TableWrap>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
                        <thead>
                            <tr>
                                <th style={tableHeaderStyle}>Check</th>
                                <th style={tableHeaderStyle}>Status</th>
                                <th style={tableHeaderStyle}>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(health?.frontend?.checks || []).map(check => (
                                <tr key={check.name}>
                                    <td style={tableCellStyle}>{check.name}</td>
                                    <td style={tableCellStyle}><StatusBadge status={check.status} /></td>
                                    <td style={tableCellStyle}>{check.reason || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
            </Section>

            <Section title="Detailed Report">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                        <h3 style={{ margin: 0, color: text, fontSize: '15px', fontWeight: 850 }}>Failed Modules</h3>
                        {failedModules.length ? failedModules.map(module => (
                            <div key={module.name} style={{ marginTop: '10px', color: '#475569', fontSize: '13px' }}>
                                <strong>{module.name}</strong>: {module.reason}
                            </div>
                        )) : <div style={{ color: muted, marginTop: '10px', fontWeight: 700 }}>None</div>}
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                        <h3 style={{ margin: 0, color: text, fontSize: '15px', fontWeight: 850 }}>Suggested Fixes</h3>
                        {suggestedFixes.map((fix, index) => (
                            <div key={`${fix}-${index}`} style={{ marginTop: '10px', color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
                                {fix}
                            </div>
                        ))}
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default SystemHealthDiagnostics;
