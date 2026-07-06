const fs = require('fs');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/20e40ac2-b9d3-4ecb-8fc6-54caa79a32e4/.system_generated/logs/transcript_full.jsonl';
const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (!lines[i]) continue;
    try {
        const obj = JSON.parse(lines[i]);
        console.log(`Index ${i}: step_index=${obj.step_index}, type=${obj.type}, source=${obj.source}`);
    } catch(e) {}
}
