const fs = require('fs');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/20e40ac2-b9d3-4ecb-8fc6-54caa79a32e4/.system_generated/logs/transcript_full.jsonl';
const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        // Let's check if it's a VIEW_FILE or replacement result or target content
        // Let's print any keys
        if (line.includes('App.jsx') && line.includes('timetableTabs')) {
            console.log(`Line ${idx}: length=${line.length}`);
            // let's print parts of it
            const str = line.substring(0, 1000);
            console.log("Snippet:", str);
        }
    } catch(e) {}
}
