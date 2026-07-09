const fs = require('fs');
const path = require('path');

function getFiles(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFiles(fullPath, filesList);
        } else if (fullPath.endsWith('.jsx')) {
            filesList.push(fullPath);
        }
    }
    return filesList;
}

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2300}-\u{23FF}]/gu;

const files = getFiles('client/src');
let totalEmojis = 0;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let fileHasEmoji = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (emojiRegex.test(lines[i])) {
            if (!fileHasEmoji) {
                console.log(`\n--- ${file} ---`);
                fileHasEmoji = true;
            }
            console.log(`Line ${i + 1}: ${lines[i].trim()}`);
            totalEmojis++;
        }
    }
}

console.log(`\nTotal lines with emojis found: ${totalEmojis}`);
