const fs = require('fs');
const path = require('path');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/fc7930e2-9889-4234-b759-0d1578ec83c6/.system_generated/logs/transcript_full.jsonl';
if (!fs.existsSync(logFile)) {
    console.error("Log file not found");
    process.exit(1);
}

const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.step_index === 25 && obj.type === 'VIEW_FILE' && obj.status === 'DONE') {
            const content = obj.content || '';
            console.log("Found target step. Length of content:", content.length);
            
            // The content is a printed file view. It has metadata header and lines like "1: import React..."
            const codeLines = [];
            const viewLines = content.split('\n');
            for (const vl of viewLines) {
                const m = vl.match(/^(\d+):\s*(.*)/);
                if (m) {
                    codeLines.push(m[2].replace(/\r$/, ''));
                }
            }
            
            if (codeLines.length > 0) {
                const recoveredCode = codeLines.join('\n');
                console.log("Reconstructed code size:", recoveredCode.length, "lines:", codeLines.length);
                fs.writeFileSync('client/src/App.jsx', recoveredCode);
                console.log("Successfully restored App.jsx from fc7930e2 conversation history!");
            } else {
                console.log("No numbered code lines found in view file output.");
            }
            break;
        }
    } catch(e) {
        console.error(e);
    }
}
