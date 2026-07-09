const fs = require('fs');
const path = require('path');

const searchDir = 'C:/Users/DELL/.gemini/antigravity-ide';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        try {
            let isDirectory = fs.statSync(dirPath).isDirectory();
            if (isDirectory) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        } catch (e) {}
    });
}

console.log("Searching for App.jsx backups...");
walkDir(searchDir, (filePath) => {
    if (filePath.includes('App.jsx') || filePath.includes('app_jsx')) {
        console.log(`Found file: ${filePath}`);
    }
});
