const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/DELL/.gemini/antigravity-ide/brain';
const convDirs = fs.readdirSync(brainDir).filter(f => f !== 'tempmediaStorage');

console.log("Scanning all conversation histories for App.jsx views...");

for (const dir of convDirs) {
    const logFile = path.join(brainDir, dir, '.system_generated/logs/transcript_full.jsonl');
    if (!fs.existsSync(logFile)) continue;
    const fileContent = fs.readFileSync(logFile, 'utf8');
    const lines = fileContent.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            if (line.includes('App.jsx') && obj.type === 'VIEW_FILE' && obj.status === 'DONE') {
                const content = obj.content || '';
                const linesCount = (content.match(/\n/g) || []).length;
                console.log(`Found VIEW_FILE in conversation ${dir} at step ${obj.step_index}, lines in output: ${linesCount}`);
                if (content.includes('Total Lines: 664')) {
                    console.log(`Found 664-line view in ${dir} step ${obj.step_index}`);
                    // Let's write this log step output to a separate file
                    fs.writeFileSync(`client/src/App.jsx.log_view_${dir}_step_${obj.step_index}`, content);
                }
            }
        } catch(e) {}
    }
}
console.log("Done.");
