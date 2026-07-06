const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

let changed = 0;

// ─────────────────────────────────────────────────────────────
// 1. Replace state declarations: remove 5 student column states,
//    replace with a single studentSearch state
// ─────────────────────────────────────────────────────────────
const oldStudentStates = `    // Per-column search filters
    const [sRollSearch, setSRollSearch] = useState('');
    const [sNameSearch, setSNameSearch] = useState('');
    const [sBranchSearch, setSBranchSearch] = useState('');
    const [sBatchSearch, setSBatchSearch] = useState('');
    const [sYearSearch, setSYearSearch] = useState('');
    const [fIdSearch, setFIdSearch] = useState('');
    const [fNameSearch, setFNameSearch] = useState('');
    const [fDeptSearch, setFDeptSearch] = useState('');
    const [fEmailSearch, setFEmailSearch] = useState('');
    const [fLoadSearch, setFLoadSearch] = useState('');`;

const newStudentStates = `    // Unified search filters
    const [sRollSearch, setSRollSearch] = useState('');
    const [sNameSearch, setSNameSearch] = useState('');
    const [sBranchSearch, setSBranchSearch] = useState('');
    const [sBatchSearch, setSBatchSearch] = useState('');
    const [sYearSearch, setSYearSearch] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [fIdSearch, setFIdSearch] = useState('');
    const [fNameSearch, setFNameSearch] = useState('');
    const [fDeptSearch, setFDeptSearch] = useState('');
    const [fEmailSearch, setFEmailSearch] = useState('');
    const [fLoadSearch, setFLoadSearch] = useState('');
    const [facultySearch, setFacultySearch] = useState('');`;

if (content.includes(oldStudentStates)) {
    content = content.replace(oldStudentStates, newStudentStates);
    changed++;
    console.log('✅ 1. Replaced state declarations');
} else {
    console.log('❌ 1. State declarations not found');
}

// ─────────────────────────────────────────────────────────────
// 2. Update filteredStudents logic — add studentSearch filter
//    after existing per-column filters
// ─────────────────────────────────────────────────────────────
const oldStudentFilter = `                if (sYearSearch) {
                    const q = sYearSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.academicYear || '').toLowerCase().includes(q));
                }

                let filteredFaculty = facultyList;`;

const newStudentFilter = `                if (sYearSearch) {
                    const q = sYearSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s => (s.academicYear || '').toLowerCase().includes(q));
                }
                if (studentSearch) {
                    const q = studentSearch.toLowerCase();
                    filteredStudents = filteredStudents.filter(s =>
                        (s.rollNumber || '').toLowerCase().includes(q) ||
                        (s.name || '').toLowerCase().includes(q) ||
                        (s.branch || '').toLowerCase().includes(q) ||
                        (s.batch || '').toLowerCase().includes(q) ||
                        (s.academicYear || '').toLowerCase().includes(q)
                    );
                }

                let filteredFaculty = facultyList;`;

if (content.includes(oldStudentFilter)) {
    content = content.replace(oldStudentFilter, newStudentFilter);
    changed++;
    console.log('✅ 2. Updated filteredStudents logic');
} else {
    console.log('❌ 2. filteredStudents logic not found');
}

// ─────────────────────────────────────────────────────────────
// 3. Update filteredFaculty logic — add facultySearch filter
// ─────────────────────────────────────────────────────────────
const oldFacultyFilter = `                if (fLoadSearch) {
                    const q = fLoadSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => String(f.maxWeeklyLoad || '').toLowerCase().includes(q));
                }`;

const newFacultyFilter = `                if (fLoadSearch) {
                    const q = fLoadSearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f => String(f.maxWeeklyLoad || '').toLowerCase().includes(q));
                }
                if (facultySearch) {
                    const q = facultySearch.toLowerCase();
                    filteredFaculty = filteredFaculty.filter(f =>
                        (f.facultyId || '').toLowerCase().includes(q) ||
                        (f.name || '').toLowerCase().includes(q) ||
                        (f.department || '').toLowerCase().includes(q) ||
                        (f.email || '').toLowerCase().includes(q) ||
                        String(f.maxWeeklyLoad || '').toLowerCase().includes(q)
                    );
                }`;

if (content.includes(oldFacultyFilter)) {
    content = content.replace(oldFacultyFilter, newFacultyFilter);
    changed++;
    console.log('✅ 3. Updated filteredFaculty logic');
} else {
    console.log('❌ 3. filteredFaculty logic not found');
}

// ─────────────────────────────────────────────────────────────
// 4. Replace 5 student search inputs with single search input
//    (Student List view)
// ─────────────────────────────────────────────────────────────
const oldStudentInputs = `                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder="🔍 Roll No" value={sRollSearch} onChange={e => setSRollSearch(e.target.value)} className="w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <input type="text" placeholder="🔍 Name" value={sNameSearch} onChange={e => setSNameSearch(e.target.value)} className="w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <input type="text" placeholder="🔍 Branch" value={sBranchSearch} onChange={e => setSBranchSearch(e.target.value)} className="w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <input type="text" placeholder="🔍 Batch" value={sBatchSearch} onChange={e => setSBatchSearch(e.target.value)} className="w-[120px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <input type="text" placeholder="🔍 Year" value={sYearSearch} onChange={e => setSYearSearch(e.target.value)} className="w-[100px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <select value={dashYearFilter} onChange={e => setDashYearFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Years</option>
                                                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <select value={dashBranchFilter} onChange={e => setDashBranchFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Branches</option>
                                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            {['COLLEGE_ADMIN', 'HOD', 'superAdmin'].includes(role) && (
                                                <select value={dashFacultyFilter} onChange={e => setDashFacultyFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                    <option value="">All Faculty</option>
                                                    {facultyList.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                                                </select>
                                            )}
                                        </div>`;

const newStudentInputs = `                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder="🔍 Search by Roll No, Name, Branch, Batch or Year..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                            <select value={dashYearFilter} onChange={e => setDashYearFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Years</option>
                                                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <select value={dashBranchFilter} onChange={e => setDashBranchFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="">All Branches</option>
                                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            {['COLLEGE_ADMIN', 'HOD', 'superAdmin'].includes(role) && (
                                                <select value={dashFacultyFilter} onChange={e => setDashFacultyFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                    <option value="">All Faculty</option>
                                                    {facultyList.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                                                </select>
                                            )}
                                        </div>`;

if (content.includes(oldStudentInputs)) {
    content = content.replace(oldStudentInputs, newStudentInputs);
    changed++;
    console.log('✅ 4. Replaced student search inputs');
} else {
    console.log('❌ 4. Student search inputs not found');
}

// ─────────────────────────────────────────────────────────────
// 5. Replace 5 faculty search inputs with single search input
// ─────────────────────────────────────────────────────────────
const oldFacultyInputs = `                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder="🔍 Faculty ID" value={fIdSearch} onChange={e => setFIdSearch(e.target.value)} className="w-[130px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder="🔍 Name" value={fNameSearch} onChange={e => setFNameSearch(e.target.value)} className="w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder="🔍 Department" value={fDeptSearch} onChange={e => setFDeptSearch(e.target.value)} className="w-[130px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />`;

const newFacultyInputs = `                                        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
                                            <input type="text" placeholder="🔍 Search by ID, Name, Department, Email or Load..." value={facultySearch} onChange={e => setFacultySearch(e.target.value)} className="flex-1 min-w-[260px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />`;

if (content.includes(oldFacultyInputs)) {
    content = content.replace(oldFacultyInputs, newFacultyInputs);
    changed++;
    console.log('✅ 5. Replaced first part of faculty search inputs');
} else {
    console.log('❌ 5. First part of faculty search inputs not found');
}

// Remove the remaining 2 faculty inputs (Email and Max Load) that follow
const oldFacultyInputs2 = `                                            <input type="text" placeholder="🔍 Email" value={fEmailSearch} onChange={e => setFEmailSearch(e.target.value)} className="w-[160px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                            <input type="text" placeholder="🔍 Max Load" value={fLoadSearch} onChange={e => setFLoadSearch(e.target.value)} className="w-[100px] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" />`;

if (content.includes(oldFacultyInputs2)) {
    content = content.replace(oldFacultyInputs2, '');
    changed++;
    console.log('✅ 6. Removed remaining faculty search inputs');
} else {
    console.log('❌ 6. Remaining faculty search inputs not found');
}

// ─────────────────────────────────────────────────────────────
// 7. Clear studentSearch when dashboard card is clicked
//    (the onClick already clears dashSearch/year/branch filters)
// ─────────────────────────────────────────────────────────────
const oldCardClick = `                                        setDashSearch('');
                                        setDashYearFilter('');
                                        setDashBranchFilter('');`;

const newCardClick = `                                        setDashSearch('');
                                        setStudentSearch('');
                                        setFacultySearch('');
                                        setDashYearFilter('');
                                        setDashBranchFilter('');`;

if (content.includes(oldCardClick)) {
    content = content.replace(oldCardClick, newCardClick);
    changed++;
    console.log('✅ 7. Updated card onClick to clear unified search states');
} else {
    console.log('❌ 7. Card onClick not found');
}

// ─────────────────────────────────────────────────────────────
// 8. Clear studentSearch when × button is clicked on Student List
// ─────────────────────────────────────────────────────────────
const oldStudentClose = `                                            <button onClick={() => setDashView(null)} className="text-indigo-200 hover:text-white text-2xl font-bold">×</button>`;
const newStudentClose = `                                            <button onClick={() => { setDashView(null); setStudentSearch(''); }} className="text-indigo-200 hover:text-white text-2xl font-bold">×</button>`;

if (content.includes(oldStudentClose)) {
    content = content.replace(oldStudentClose, newStudentClose);
    changed++;
    console.log('✅ 8. Updated student list × button to clear search');
} else {
    console.log('❌ 8. Student list × button not found');
}

// ─────────────────────────────────────────────────────────────
// 9. Clear facultySearch when × button is clicked on Faculty List
// ─────────────────────────────────────────────────────────────
const oldFacultyClose = `                                            <button onClick={() => setDashView(null)} className="text-emerald-200 hover:text-white text-2xl font-bold">×</button>`;
const newFacultyClose = `                                            <button onClick={() => { setDashView(null); setFacultySearch(''); }} className="text-emerald-200 hover:text-white text-2xl font-bold">×</button>`;

if (content.includes(oldFacultyClose)) {
    content = content.replace(oldFacultyClose, newFacultyClose);
    changed++;
    console.log('✅ 9. Updated faculty list × button to clear search');
} else {
    console.log('❌ 9. Faculty list × button not found');
}

// ─────────────────────────────────────────────────────────────
// Write result
// ─────────────────────────────────────────────────────────────
fs.writeFileSync(file, content);
console.log(`\nDone! ${changed} replacements made.`);
