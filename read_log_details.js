const fs = require('fs');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/20e40ac2-b9d3-4ecb-8fc6-54caa79a32e4/.system_generated/logs/transcript_full.jsonl';
const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        // Look for any VIEW_FILE outputs that printed App.jsx
        if (line.includes('App.jsx') && (line.includes('Total Lines') || line.includes('Showing lines'))) {
            console.log(`--- Step ${obj.step_index} / Line ${idx} ---`);
            const content = obj.content || (obj.tool_calls && obj.tool_calls[0] && obj.tool_calls[0].result);
            if (content) {
                console.log(content.substring(0, 1500));
            } else if (obj.tool_calls) {
                console.log(JSON.stringify(obj.tool_calls));
            } else {
                console.log(line.substring(0, 500));
            }
        }
    } catch(e) {}
}
