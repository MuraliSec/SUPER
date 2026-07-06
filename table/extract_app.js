const fs = require('fs');
const path = require('path');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/20e40ac2-b9d3-4ecb-8fc6-54caa79a32e4/.system_generated/logs/transcript_full.jsonl';
if (!fs.existsSync(logFile)) {
    console.error("Log file not found!");
    process.exit(1);
}

const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

console.log("Reading log lines: " + lines.length);

// Let's search for the last successful write_file or replace_file_content tool response containing App.jsx,
// or a view_file response that had a lot of App.jsx,
// or just look for the contents of App.jsx.
let foundAppJsx = null;
for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        // Look for tool calls or tool responses
        if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
                if (tc.name === 'write_to_file' && tc.args && tc.args.TargetFile && tc.args.TargetFile.endsWith('App.jsx')) {
                    console.log(`Found write_to_file at step ${obj.step_index}`);
                    foundAppJsx = tc.args.CodeContent;
                    break;
                }
            }
        }
        if (foundAppJsx) break;
    } catch (e) {
        // ignore parse error
    }
}

if (foundAppJsx) {
    fs.writeFileSync('client/src/App.jsx', foundAppJsx);
    console.log("SUCCESS! Restored App.jsx from log file history.");
} else {
    console.log("Not found in write_to_file. Let's search for any read/view of App.jsx.");
    // Let's search for strings matching App.jsx file contents.
    // Let's look for lines that contain '"AbsolutePath":"c:\\\\Users\\\\DELL\\\\Downloads\\\\table\\\\table\\\\client\\\\src\\\\App.jsx"'
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.trim()) continue;
        if (line.includes('App.jsx') && line.includes('import React')) {
            console.log(`Found a potential match at line ${i}`);
            // Let's print out the first 500 chars to check
            console.log(line.substring(0, 500));
        }
    }
}
