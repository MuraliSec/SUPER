import React, { useState, useEffect } from 'react';
import Login from './Login';
import ProfileModal from './components/ProfileModal';
import api from './api/axios';
import { useWindowSize } from './hooks/useWindowSize';

// Code splitting / Lazy loaded modules
const AdminPortal = React.lazy(() => import('./AdminPortal'));
const StudentPortal = React.lazy(() => import('./StudentPortal'));
const ExcelUpload = React.lazy(() => import('./ExcelUpload'));
const TimetableConfig = React.lazy(() => import('./TimetableConfig'));
const FacultyDashboard = React.lazy(() => import('./FacultyDashboard'));
const ElectiveGrouping = React.lazy(() => import('./ElectiveGrouping'));
const ReportsPortal = React.lazy(() => import('./ReportsPortal'));
const ProfileCompletion = React.lazy(() => import('./ProfileCompletion'));
const CompanyPortal = React.lazy(() => import('./CompanyPortal'));
const LMSPortal = React.lazy(() => import('./LMSPortal'));
const AttendancePortal = React.lazy(() => import('./AttendancePortal'));
const FacultyAvailability = React.lazy(() => import('./FacultyAvailability'));
const JobPortal = React.lazy(() => import('./JobPortal'));
const StudentManagement = React.lazy(() => import('./StudentManagement'));


// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
constructor(props) {
super(props);
this.state = { hasError: false, error: null };
}
static getDerivedStateFromError(error) {
return { hasError: true, error };
}
componentDidCatch(error, errorInfo) {
console.error("Uncaught error:", error, errorInfo);
}
render() {
if (this.state.hasError) {
return (
<div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
<h2 style={{ color: '#e53e3e' }}>Something went wrong.</h2>
<p>The application encountered an error. Please try refreshing the page.</p>
<pre style={{ textAlign: 'left', background: '#f7fafc', padding: '20px', borderRadius: '8px', overflow: 'auto', display: 'inline-block', maxWidth: '100%' }}>
{this.state.error?.toString()}
</pre>
<br />
<button
onClick={() => { localStorage.clear(); window.location.reload(); }}
style={{ marginTop: '20px', padding: '10px 20px', background: '#4c51bf', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
>
Clear Cache & Reload
</button>
</div>
);
}
return this.props.children;
}
}

const LoadingFallback = () => (
<div style={{
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
justifyContent: 'center',
padding: '80px 40px',
gap: '16px'
}}>
<div style={{
width: '40px',
height: '40px',
border: '4px solid #f3f3f3',
borderTop: '4px solid #4c51bf',
borderRadius: '50%',
animation: 'spin 1s linear infinite'
}} />
<div style={{ color: '#718096', fontSize: '14px', fontWeight: '600' }}>Loading module...</div>
</div>
);

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

function App() {
const [section, setSection] = useState('timetable'); // 'timetable', 'lms', or 'attendance'
const [activeTab, setActiveTab] = useState('admin');
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
const [mustChangePassword, setMustChangePassword] = useState(false);
const [newPassword, setNewPassword] = useState('');
const [changePasswordError, setChangePasswordError] = useState('');
const [viewingCollege, setViewingCollege] = useState(null);
const [viewMode, setViewMode] = useState('hod'); // 'hod', 'faculty', 'student' - used for administrative viewing
const [isQuizMode, setIsQuizMode] = useState(false);
const [profileCompleted, setProfileCompleted] = useState(true);
const [institutionProfile, setInstitutionProfile] = useState(null);
const [showDropdown, setShowDropdown] = useState(false);
const [showProfileModal, setShowProfileModal] = useState(false);
const [profileModalTab, setProfileModalTab] = useState('view');
const [showMobileNav, setShowMobileNav] = useState(false);
const { width: winWidth } = useWindowSize();
const isMobile = winWidth < 768;

const fetchInstProfile = async (u = user) => {
const instId = viewingCollege?.id || u?.institutionId;
if (instId) {
try {
const res = await api.get('/institution/profile', {
headers: { 'x-institution-id': instId }
});
setInstitutionProfile(res.data);
} catch (err) {
console.error('Error fetching institution profile:', err);
}
} else {
setInstitutionProfile(null);
}
};

useEffect(() => {
if (user) {
fetchInstProfile(user);
} else {
setInstitutionProfile(null);
}
}, [user, viewingCollege]);

const roleDisplayBadge = () => {
if (!user) return '';
if (user.role === 'COMPANY_ADMIN' && !viewingCollege) return '[SYSTEM CENTRAL]';
if (viewMode === 'hod') return '[MAIN ADMINISTRATION SYSTEM]';
if (viewMode === 'faculty') return '[FACULTY]';
if (viewMode === 'student') return '[STUDENT]';
return `[${mapRoleToDisplay(user.role).toUpperCase()}]`;
};

useEffect(() => {
const savedUser = localStorage.getItem('user');
const token = localStorage.getItem('token');
if (savedUser && token) {
const u = JSON.parse(savedUser);
setUser(u);
if (u.mustChangePassword) {
setMustChangePassword(true);
}
if (u.profileCompleted === false) {
setProfileCompleted(false);
} else {
setProfileCompleted(true);
}

// Map role to viewMode
if (u.role === 'COLLEGE_ADMIN' || u.role === 'HOD') setViewMode('hod');
else if (u.role === 'FACULTY') { setViewMode('faculty'); setActiveTab('faculty-dashboard'); }
else if (u.role === 'STUDENT') setViewMode('student');

const savedViewingId = localStorage.getItem('viewingInstitutionId');
const savedViewingName = localStorage.getItem('viewingInstitutionName');
if (savedViewingId) {
setViewingCollege({ id: savedViewingId, name: savedViewingName });
}
}
setLoading(false);
}, []);

const handleLogout = () => {
localStorage.removeItem('user');
localStorage.removeItem('token');
localStorage.removeItem('viewingInstitutionId');
localStorage.removeItem('viewingInstitutionName');
setUser(null);
setViewingCollege(null);
};

const selectCollege = (id, name) => {
const collegeObj = { id, name };
localStorage.setItem('viewingInstitutionId', id);
localStorage.setItem('viewingInstitutionName', name);
setViewingCollege(collegeObj);
setViewMode('hod');
setSection('timetable');
setActiveTab('admin');
};

const backToCentral = () => {
localStorage.removeItem('viewingInstitutionId');
localStorage.removeItem('viewingInstitutionName');
setViewingCollege(null);
setSection('timetable');
setActiveTab('company');
};

if (loading) return null;

if (!user) {
return (
<Login
onLogin={(u) => {
setUser(u);
if (u.mustChangePassword) {
setMustChangePassword(true);
}
if (u.profileCompleted === false) {
setProfileCompleted(false);
} else {
setProfileCompleted(true);
}
if (u.role === 'COLLEGE_ADMIN' || u.role === 'HOD') {
setViewMode('hod');
setSection('timetable');
setActiveTab('admin');
}
else if (u.role === 'FACULTY') {
setViewMode('faculty');
setSection('timetable');
setActiveTab('faculty-dashboard');
}
else if (u.role === 'STUDENT') {
setViewMode('student');
setSection('timetable');
setActiveTab('student-view');
}
}}
/>
);
}

// Define Tabs per Section
const timetableTabs = [
{ id: 'company', label: 'Institutions', component: CompanyPortal, roles: ['COMPANY_ADMIN'], section: 'timetable' },
{ id: 'admin', label: 'Admin Dashboard', component: AdminPortal, roles: ['hod'], section: 'timetable' },
{ id: 'upload', label: 'Data Upload', component: ExcelUpload, roles: ['hod'], section: 'timetable' },
{ id: 'config', label: 'Config', component: TimetableConfig, roles: ['hod'], section: 'timetable' },
{ id: 'elective', label: 'Electives', component: ElectiveGrouping, roles: ['hod'], section: 'timetable' },
{ id: 'faculty-dashboard', label: 'My Dashboard', component: FacultyDashboard, roles: ['faculty'], section: 'timetable' },
{ id: 'student-view', label: 'Timetables', component: StudentPortal, roles: ['student', 'faculty', 'hod'], section: 'timetable' },
{ id: 'student-mgmt', label: 'Student Management', component: StudentManagement, roles: ['faculty', 'hod'], section: 'timetable' },
{ id: 'faculty-list', label: 'Faculty', component: FacultyAvailability, roles: ['hod', 'faculty'], section: 'timetable' },
{ id: 'reports', label: 'Reports', component: ReportsPortal, roles: ['hod', 'COMPANY_ADMIN'], section: 'timetable' },
];

const lmsTabs = [
{ id: 'lms-main', label: 'LMS Dashboard', component: LMSPortal, roles: ['hod', 'faculty', 'student', 'COMPANY_ADMIN'], section: 'lms' },
];

const attendanceTabs = [
{ id: 'attendance-main', label: 'Attendance', component: AttendancePortal, roles: ['hod', 'faculty', 'student', 'COMPANY_ADMIN'], section: 'attendance' },
];

const jobTabs = [
{ id: 'job-main', label: 'Job Board', component: JobPortal, roles: ['hod', 'faculty', 'student', 'COMPANY_ADMIN'], section: 'jobs' },
];

// Helper to determine if a tab should be shown
const isTabVisible = (tab) => {
if (user.role === 'COMPANY_ADMIN' && !viewingCollege) {
return tab.roles.includes('COMPANY_ADMIN');
}
return tab.roles.includes(viewMode);
};

const currentTabs =
section === 'timetable' ? timetableTabs :
(section === 'lms' ? lmsTabs :
(section === 'attendance' ? attendanceTabs : jobTabs));
const visibleTabs = currentTabs.filter(isTabVisible);

// Ensure activeTab is valid for current visible tabs
const getSafeActiveTab = () => {
if (visibleTabs.find(t => t.id === activeTab)) return activeTab;
return visibleTabs[0]?.id || '';
};

const currentTabId = getSafeActiveTab();
const ActiveComponent = [...timetableTabs, ...lmsTabs, ...attendanceTabs, ...jobTabs].find(tab => tab.id === currentTabId)?.component || (() => <div style={{ padding: 40 }}>Unauthorized or No Section Selected</div>);
const roleDisplayLabel = (user.role === 'HOD' || user.role === 'COLLEGE_ADMIN')
? 'Main Administration Portal'
: user.role.replace('_', ' ');

if (mustChangePassword) {
return (
<ErrorBoundary>
<div style={{
minHeight: '100vh',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
fontFamily: "'Inter', sans-serif"
}}>
<div style={{
background: 'white',
padding: '40px',
borderRadius: '16px',
boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
width: '100%',
maxWidth: '430px'
}}>
<h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a202c', marginBottom: '10px', textAlign: 'center' }}>Change Password</h2>
<p style={{ color: '#718096', marginBottom: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
For security reasons, you must change your password on first login.
</p>
{changePasswordError && (
<div style={{
background: '#fff5f5',
color: '#c53030',
padding: '12px',
borderRadius: '8px',
marginBottom: '20px',
fontSize: '13px',
border: '1px solid #feb2b2',
fontWeight: '500'
}}>{changePasswordError}</div>
)}
<form onSubmit={async (e) => {
e.preventDefault();
if (newPassword.length < 6) {
setChangePasswordError('Password must be at least 6 characters long.');
return;
}
try {
await api.post('/auth/change-password', { username: user.username, newPassword });
const updatedUser = { ...user, mustChangePassword: false };
localStorage.setItem('user', JSON.stringify(updatedUser));
setUser(updatedUser);
setMustChangePassword(false);
alert('Password changed successfully! Welcome to the portal.');
} catch (err) {
setChangePasswordError(err.response?.data?.error || err.message || 'Failed to change password');
}
}}>
<div style={{ marginBottom: '25px' }}>
<label style={{ display: 'block', marginBottom: '8px', color: '#4a5568', fontWeight: '700', fontSize: '14px' }}>New Password</label>
<input
type="password"
value={newPassword}
onChange={e => setNewPassword(e.target.value)}
style={{
width: '100%',
padding: '12px 16px',
borderRadius: '12px',
border: '2px solid #edf2f7',
outline: 'none',
fontSize: '16px'
}}
placeholder="Enter new password"
required
/>
</div>
<button
type="submit"
style={{
width: '100%',
padding: '14px',
background: 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
color: 'white',
border: 'none',
borderRadius: '12px',
fontWeight: '800',
fontSize: '16px',
cursor: 'pointer'
}}
>
Update Password
</button>
</form>
</div>
</div>
</ErrorBoundary>
);
}

if (!profileCompleted) {
return (
<ErrorBoundary>
<React.Suspense fallback={<LoadingFallback />}>
<ProfileCompletion
user={user}
onComplete={(updatedFields) => {
const updatedUser = { ...user, ...updatedFields, profileCompleted: true };
localStorage.setItem('user', JSON.stringify(updatedUser));
if (updatedFields.token) {
localStorage.setItem('token', updatedFields.token);
}
setUser(updatedUser);
setProfileCompleted(true);
fetchInstProfile(updatedUser);

// Set initial active tabs
if (updatedUser.role === 'COLLEGE_ADMIN' || updatedUser.role === 'HOD') {
setViewMode('hod');
setSection('timetable');
setActiveTab('admin');
} else if (updatedUser.role === 'FACULTY') {
setViewMode('faculty');
setSection('timetable');
setActiveTab('faculty-dashboard');
} else if (updatedUser.role === 'STUDENT') {
setViewMode('student');
setSection('timetable');
setActiveTab('student-view');
}
}}
/>
</React.Suspense>
</ErrorBoundary>
);
}

return (
<ErrorBoundary>
<div className="min-h-screen" style={{ background: '#f0f2f5', fontFamily: "'Inter', sans-serif" }}>
{/* Top Main Navigation */}
<nav style={{
background: viewingCollege ? '#1a202c' : 'linear-gradient(135deg, #4c51bf 0%, #667eea 100%)',
color: 'white',
boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
position: 'sticky',
top: 0,
zIndex: 1000
}}>
<div style={{ padding: '0 16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>

{/* Left side: brand + hamburger on mobile */}
<div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '24px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
<div style={{ display: 'flex', flexDirection: 'column' }}>
<span style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '800', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
{user.role === 'COMPANY_ADMIN' && !viewingCollege ? 'COMPANY ADMIN' : (institutionProfile?.collegeName || institutionProfile?.name || (viewingCollege && viewingCollege.name ? viewingCollege.name.toUpperCase() : 'COLLEGE PORTAL'))}
</span>
{user && (
<span style={{ fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', marginTop: '1px' }}>
{roleDisplayBadge()}
</span>
)}
</div>
</div>

{/* Section buttons - hidden on mobile, shown on desktop */}
<div className="hide-mobile">
{(viewingCollege || user.role !== 'COMPANY_ADMIN') && (
<div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '3px' }}>
<button onClick={() => { setSection('timetable'); setActiveTab(viewMode === 'hod' ? 'admin' : (viewMode === 'faculty' ? 'faculty-dashboard' : 'student-view')); }}
style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: section === 'timetable' ? 'white' : 'transparent', color: section === 'timetable' ? '#4c51bf' : 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: '0.3s' }}>
Timetable
</button>
<button onClick={() => { setSection('lms'); setActiveTab('lms-main'); }}
style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: section === 'lms' ? 'white' : 'transparent', color: section === 'lms' ? '#4c51bf' : 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: '0.3s' }}>
LMS
</button>
<button onClick={() => { setSection('attendance'); setActiveTab('attendance-main'); }}
style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: section === 'attendance' ? 'white' : 'transparent', color: section === 'attendance' ? '#4c51bf' : 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: '0.3s' }}>
Attendance
</button>
<button onClick={() => { setSection('jobs'); setActiveTab('job-main'); }}
style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: section === 'jobs' ? 'white' : 'transparent', color: section === 'jobs' ? '#4c51bf' : 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', transition: '0.3s' }}>
Jobs
</button>
</div>
)}
</div>
</div>

{/* Right side: profile + viewing dropdown + mobile hamburger */}
<div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '15px' }}>
{/* Viewing As - hide text label on mobile */}
{(viewingCollege || user.role === 'COLLEGE_ADMIN') && (
<div className={isMobile ? '' : ''} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: isMobile ? '4px 8px' : '5px 12px', borderRadius: '10px', fontSize: isMobile ? '12px' : '13px' }}>
{!isMobile && <span style={{ opacity: 0.8 }}>Viewing As:</span>}
<select value={viewMode}
onChange={(e) => { const m = e.target.value; setViewMode(m); if (section === 'timetable') setActiveTab(m === 'hod' ? 'admin' : (m === 'faculty' ? 'faculty-dashboard' : 'student-view')); }}
style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 'bold', outline: 'none', cursor: 'pointer', fontSize: isMobile ? '11px' : '13px', maxWidth: isMobile ? '100px' : 'none' }}>
<option value="hod" style={{ color: '#333' }}>{isMobile ? 'Admin' : 'Main Administration System'}</option>
<option value="faculty" style={{ color: '#333' }}>Faculty</option>
<option value="student" style={{ color: '#333' }}>Student</option>
</select>
</div>
)}

{viewingCollege && (
<button onClick={backToCentral} style={{ background: '#f56565', border: 'none', color: 'white', padding: isMobile ? '6px 10px' : '8px 15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: isMobile ? '12px' : '13px' }}>
{'Exit'}
</button>
)}

{/* User profile / avatar */}
<div style={{ position: 'relative' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', cursor: 'pointer', userSelect: 'none' }}
onClick={() => setShowDropdown(!showDropdown)}>
{user.profilePhoto ? (
<img src={user.profilePhoto} alt="Avatar" style={{ width: isMobile ? '32px' : '38px', height: isMobile ? '32px' : '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
) : (
<div style={{ width: isMobile ? '32px' : '38px', height: isMobile ? '32px' : '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '16px' : '18px' }}></div>
)}
{!isMobile && (
<div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '10px' }}>
<div style={{ fontSize: '14px', fontWeight: '800', lineHeight: '1.2' }}>{user.name || user.username}</div>
<div style={{ fontSize: '10px', opacity: 0.8, fontWeight: '600', textTransform: roleDisplayLabel === 'Main Administration Portal' ? 'none' : 'uppercase' }}>{roleDisplayLabel}</div>
</div>
)}
</div>

{/* Mobile hamburger for section nav */}
{(viewingCollege || user.role !== 'COMPANY_ADMIN') && (
<button onClick={(e) => { e.stopPropagation(); setShowMobileNav(!showMobileNav); }}
className="show-mobile"
style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
{''}
</button>
)}

{showDropdown && (
<div style={{
position: 'absolute', top: '50px', right: '0', background: 'white', color: '#2d3748',
borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
width: isMobile ? '220px' : '260px', padding: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '12px',
textAlign: 'left'
}}>
<div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px' }}>
{user.profilePhoto ? (
<img src={user.profilePhoto} alt="Profile" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4c51bf' }} />
) : (
<div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}></div>
)}
<div>
<div style={{ fontWeight: '800', fontSize: '14px', color: '#1a202c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '120px' : '160px' }}>{user.name || user.username}</div>
<div style={{ fontSize: '11px', color: '#718096', fontWeight: '600' }}>@{user.username}</div>
<div style={{ fontSize: '10px', color: '#4c51bf', fontWeight: '800', textTransform: 'uppercase', marginTop: '2px' }}>{mapRoleToDisplay(user.role)}</div>
</div>
</div>
<div style={{ fontSize: '12px', color: '#4a5568', wordBreak: 'break-all' }}>
<div style={{ display: 'flex', gap: '4px' }}> <span style={{ fontWeight: '600', color: '#2d3748' }}>{user.email || 'Not provided'}</span></div>
{user.mobileNumber && <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}> <span style={{ fontWeight: '600', color: '#2d3748' }}>{user.mobileNumber}</span></div>}
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
<button onClick={() => { setShowDropdown(false); setProfileModalTab('view'); setShowProfileModal(true); }} style={{
width: '100%', padding: '8px 12px', background: '#f7fafc', border: 'none', borderRadius: '8px',
color: '#4a5568', fontWeight: '750', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
}}>
View Profile
</button>
<button onClick={() => { setShowDropdown(false); setProfileModalTab('edit'); setShowProfileModal(true); }} style={{
width: '100%', padding: '8px 12px', background: '#f7fafc', border: 'none', borderRadius: '8px',
color: '#4a5568', fontWeight: '750', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
}}>
Edit Profile
</button>
<button onClick={() => { setShowDropdown(false); handleLogout(); }} style={{
width: '100%', padding: '8px 12px', background: '#fff5f5', border: 'none', borderRadius: '8px',
color: '#c53030', fontWeight: '800', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
}}>
Logout
</button>
</div>
</div>
)}
</div>
</div>
</div>
</div>

{/* Mobile section nav dropdown */}
{showMobileNav && isMobile && (viewingCollege || user.role !== 'COMPANY_ADMIN') && (
<div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '4px' }}>
<button onClick={() => { setSection('timetable'); setActiveTab(viewMode === 'hod' ? 'admin' : (viewMode === 'faculty' ? 'faculty-dashboard' : 'student-view')); setShowMobileNav(false); }}
style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: section === 'timetable' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
Timetable
</button>
<button onClick={() => { setSection('lms'); setActiveTab('lms-main'); setShowMobileNav(false); }}
style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: section === 'lms' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
LMS
</button>
<button onClick={() => { setSection('attendance'); setActiveTab('attendance-main'); setShowMobileNav(false); }}
style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: section === 'attendance' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
Attendance
</button>
<button onClick={() => { setSection('jobs'); setActiveTab('job-main'); setShowMobileNav(false); }}
style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: section === 'jobs' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
Jobs
</button>
</div>
)}
</nav>

{/* Secondary Ribbon Navigation (Tabs) */}
<div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
<div style={{ padding: '0 16px', display: 'flex', gap: '2px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
{visibleTabs.map(tab => (
<button
key={tab.id}
onClick={() => setActiveTab(tab.id)}
style={{
padding: isMobile ? '12px 12px' : '15px 20px', border: 'none', background: 'transparent',
color: currentTabId === tab.id ? '#4c51bf' : '#718096',
fontWeight: '600', cursor: 'pointer', position: 'relative',
transition: '0.2s', whiteSpace: 'nowrap', fontSize: isMobile ? '12px' : '14px'
}}
>
{tab.label}
{currentTabId === tab.id && (
<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: '#4c51bf' }} />
)}
</button>
))}
</div>
</div>

{/* Main Content Area */}
<main className="responsive-padding">
<div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minHeight: 'calc(100vh - 200px)' }}>
<React.Suspense fallback={<LoadingFallback />}>
<ActiveComponent key={currentTabId} user={user} onSelectCollege={selectCollege} viewingAs={viewMode} role={viewMode} setIsQuizMode={setIsQuizMode} />
</React.Suspense>
</div>
</main>



<style>{`
@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}
`}</style>

{showProfileModal && (
<ProfileModal
user={user}
tab={profileModalTab}
onClose={() => setShowProfileModal(false)}
onUpdate={(updatedUserFields) => {
const updatedUser = { ...user, ...updatedUserFields };
localStorage.setItem('user', JSON.stringify(updatedUser));
setUser(updatedUser);
fetchInstProfile(updatedUser);
}}
/>
)}

<footer style={{ textAlign: 'center', padding: '40px 20px', color: '#a0aec0', fontSize: '14px' }}>
&copy; 2026 Admin Pro Scheduler & LMS. All rights reserved.
</footer>
</div>
</ErrorBoundary>
);
}

export default App;
