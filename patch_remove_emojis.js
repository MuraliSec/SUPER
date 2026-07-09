const fs = require('fs');
const file = 'client/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');
let changed = 0;

// Helper: strip emojis from a string using Unicode regex
function stripEmoji(str) {
    return str
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')   // Misc symbols & pictographs, emoticons, etc.
        .replace(/[\u{2700}-\u{27BF}]/gu, '')       // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')       // Variation selectors
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')     // Flags
        .replace(/[\u{2600}-\u{26FF}]/gu, '')       // Misc symbols
        .replace(/[\u{2300}-\u{23FF}]/gu, '')       // Misc Technical
        .replace(/\u200D/g, '')                      // Zero-width joiner
        .replace(/\s{2,}/g, ' ')                    // Collapse double spaces
        .trim();
}

// Apply emoji stripping to specific label patterns
const replacements = [
    // Tab labels
    ["label: '🏢 Institutions'", "label: 'Institutions'"],
    ["label: '👨\u200D💼 Admin Dashboard'", "label: 'Admin Dashboard'"],
    ["label: '📊 Data Upload'", "label: 'Data Upload'"],
    ["label: '⚙️ Config'", "label: 'Config'"],
    ["label: '🧩 Electives'", "label: 'Electives'"],
    ["label: '📊 My Dashboard'", "label: 'My Dashboard'"],
    ["label: '🎓 Timetables'", "label: 'Timetables'"],
    ["label: '👨\u200D🎓 Student Management'", "label: 'Student Management'"],
    ["label: '🧑\u200D🏫 Faculty'", "label: 'Faculty'"],
    ["label: '📈 Reports'", "label: 'Reports'"],
    ["label: '📚 LMS Dashboard'", "label: 'LMS Dashboard'"],
    ["label: '📝 Attendance'", "label: 'Attendance'"],
    ["label: '💼 Job Board'", "label: 'Job Board'"],

    // Top nav section buttons (desktop)
    ["🗓️ Timetable", "Timetable"],
    ["📚 LMS", "LMS"],
    ["📝 Attendance", "Attendance"],
    ["💼 Jobs", "Jobs"],

    // User avatar fallback emoji
    ["justifyContent: 'center', fontSize: isMobile ? '16px' : '18px' }}>👤</div>", 
     "justifyContent: 'center', fontSize: isMobile ? '16px' : '18px' }}></div>"],

    // Profile dropdown user avatar
    ["justifyContent: 'center', fontSize: '24px' }}>👤</div>",
     "justifyContent: 'center', fontSize: '24px' }}></div>"],

    // Profile dropdown email/phone labels
    ["<span>📧</span>", ""],
    ["<span>📞</span>", ""],

    // Profile dropdown buttons
    ["<span>👤</span> View Profile", "View Profile"],
    ["<span>⚙️</span> Edit Profile", "Edit Profile"],
    ["<span>🚪</span> Logout", "Logout"],

    // Logout button emoji
    [">🚪</button>", ">✕</button>"],

    // Mobile hamburger icons
    ["{showMobileNav ? '✕' : '☰'}", "{'☰'}"],

    // Company admin header
    ["'🏢 COMPANY ADMIN'", "'COMPANY ADMIN'"],

    // Mobile Exit button
    ["isMobile ? '✕' : 'Exit'", "'Exit'"],
];

for (const [from, to] of replacements) {
    if (content.includes(from)) {
        content = content.split(from).join(to);
        changed++;
        console.log(`✅ Replaced: "${from.substring(0, 50)}..."`);
    } else {
        console.log(`❌ Not found: "${from.substring(0, 50)}..."`);
    }
}

fs.writeFileSync(file, content);
console.log(`\nDone! ${changed} replacements made.`);
