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
let totalReplacements = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (emojiRegex.test(content)) {
        // First match the emojis and remove them
        const newContent = content.replace(emojiRegex, '');
        // Collapse double spaces that might result from emoji removal, but only in strings/JSX text if possible
        // Let's just write back the new content directly.
        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            console.log(`Removed emojis from ${file}`);
            totalReplacements++;
        }
    }
}

console.log(`Done! Modified ${totalReplacements} files.`);
