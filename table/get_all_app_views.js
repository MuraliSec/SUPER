const fs = require('fs');

const logFile = 'C:/Users/DELL/.gemini/antigravity-ide/brain/20e40ac2-b9d3-4ecb-8fc6-54caa79a32e4/.system_generated/logs/transcript_full.jsonl';
const fileContent = fs.readFileSync(logFile, 'utf8');
const lines = fileContent.split('\n');

let count = 0;
for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        if (line.includes('App.jsx') && obj.type === 'VIEW_FILE' && obj.status === 'DONE') {
            const content = obj.content;
            if (content && content.includes('Total Lines: 664')) {
                count++;
                console.log(`Writing matching view from Step ${obj.step_index} / Line ${idx} to App.jsx.view.${count}`);
                fs.writeFileSync(`client/src/App.jsx.view.${count}`, content);
            }
        }
    } catch(e) {}
}
console.log(`Done writing ${count} files.`);
