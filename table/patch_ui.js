const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!content.includes("import BatchConfigColumn")) {
    content = content.replace("import api from './api/axios';", "import api from './api/axios';\nimport BatchConfigColumn from './BatchConfigColumn';");
}

// 2. We want to replace the single batch view with the multi-column view
const startStr = "{selectedBatch && (";
const endStr = "{/* Multi-batch summary before generate */}";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);

    const newRender = `{selectedBatches.length > 0 && (
    <div className="mb-6 flex overflow-x-auto overflow-y-hidden gap-4 py-2 px-1 pb-4" style={{ minHeight: '600px', scrollbarColor: '#c7d2fe transparent', scrollbarWidth: 'thin' }}>
        {selectedBatches.map(batch => (
            <BatchConfigColumn 
                key={batch._id}
                batch={batch}
                allSubjects={allSubjects}
                rooms={rooms}
                courses={courses}
                batches={batches}
                maxWeeklyHours={maxWeeklyHours}
                initialConfig={batchConfigsRef.current[batch._id] || {}}
                onConfigUpdate={(batchId, config) => {
                    batchConfigsRef.current[batchId] = config;
                }}
            />
        ))}
    </div>
)}

`;

    content = before + newRender + after;
    fs.writeFileSync(file, content);
    console.log("Success patched AdminPortal UI render!");
} else {
    console.log("Indices not found! startIndex:", startIndex, "endIndex:", endIndex);
}
