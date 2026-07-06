const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex1 = /<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">\s*<div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 max-h-\[90vh\] overflow-y-auto">/;
const replace1 = `<div className="flex flex-col gap-6 w-full">
                    <div className="flex flex-col xl:flex-row items-start gap-4 w-full">
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex-shrink-0 w-full xl:w-[350px] max-h-[85vh] overflow-y-auto z-10 sticky left-0">`;

if (content.match(regex1)) {
    content = content.replace(regex1, replace1);
} else {
    console.log("Failed to match regex1");
}

const regex2 = /\{selectedBatches\.length > 0 && \(\s*<div className="mb-6 flex overflow-x-auto overflow-y-hidden gap-4 py-2 px-1 pb-4" style=\{\{ minHeight: '600px', scrollbarColor: '#c7d2fe transparent', scrollbarWidth: 'thin' \}\}>\s*\{selectedBatches\.map\(batch => \(\s*<BatchConfigColumn[\s\S]*?\/>\s*\)\)\}\s*<\/div>\s*\)\}/;

const extractedConfigRowMatch = content.match(regex2);
if (extractedConfigRowMatch) {
    const extractedConfigRow = extractedConfigRowMatch[0].replace('className="mb-6 flex overflow-x-auto overflow-y-hidden gap-4 py-2 px-1 pb-4"', 'className="flex overflow-x-auto overflow-y-hidden gap-4 py-2 px-1 pb-4 flex-1 w-full"');
    content = content.replace(regex2, '');

    const regex3 = /\{\/\* Multi-batch summary before generate \*\/\}\s*\{selectedBatches\.length > 0 && \([\s\S]*?\}\s*<\/div>/;
    const endContainerMatch = content.match(regex3);

    if (endContainerMatch) {
        let endContainerText = endContainerMatch[0];
        // Replace the closing div with: closing div + config columns + closing flex-row div
        const replacement3 = `
                        {/* Multi-batch summary before generate */}
                        {selectedBatches.length > 0 && (
                            <>
                                <button
                                    onClick={generateTimetable}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-lg transition shadow-md disabled:bg-gray-400 flex items-center justify-center gap-2 mb-4 mt-6"
                                >
                                    {loading ? (
                                        <><span className="animate-spin">⏳</span> Generating...</>
                                    ) : selectedBatches.length > 1 ? (
                                        <>⚡ Generate {selectedBatches.length} Timetables</>
                                    ) : (
                                        <>📅 Generate Timetable</>
                                    )}
                                </button>
                                {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}
                            </>
                        )}
                        </div>
                        
                        ${extractedConfigRow}
                        
                    </div>
       `;
        content = content.replace(endContainerMatch[0], replacement3);
    } else {
        console.log("Failed to match regex3");
    }
} else {
    console.log("Failed to match regex2");
}

const regex4 = /<div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-100 min-h-\[600px\] overflow-x-auto">/;
const replace4 = `<div className="w-full bg-white p-6 rounded-xl shadow-lg border border-gray-100 min-h-[600px] overflow-x-auto mt-6">`;

if (content.match(regex4)) {
    content = content.replace(regex4, replace4);
} else {
    console.log("Failed to match regex4");
}

fs.writeFileSync(file, content);
console.log("Patched layout");
