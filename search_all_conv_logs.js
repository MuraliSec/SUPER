const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/DELL/.gemini/antigravity-ide/brain';
const convDirs = fs.readdirSync(brainDir).filter(f => f !== 'tempmediaStorage');

console.log("Scanning all conversation histories for App.jsx contents...");

for (const dir of convDirs) {
    const logFile = path.join(brainDir, dir, '.system_generated/logs/transcript_full.jsonl');
    if (!fs.existsSync(logFile)) continue;
    console.log(`Scanning log file: ${logFile}`);
    const fileContent = fs.readFileSync(logFile, 'utf8');
    const lines = fileContent.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            // check for write_to_file tool calls
            if (obj.tool_calls) {
                for (const tc of obj.tool_calls) {
                    if (tc.name === 'write_to_file' && tc.args && tc.args.TargetFile && tc.args.TargetFile.endsWith('App.jsx') && tc.args.CodeContent) {
                        const size = tc.args.CodeContent.length;
                        console.log(`Found write_to_file in conversation ${dir} at step ${obj.step_index}, size: ${size}`);
                        if (size > 25000) {
                            console.log("Writing to client/src/App.jsx.recovered_conv");
                            fs.writeFileSync('client/src/App.jsx.recovered_conv', tc.args.CodeContent);
                        }
                    }
                }
            }
        } catch(e) {}
    }
}
console.log("Done scanning.");
