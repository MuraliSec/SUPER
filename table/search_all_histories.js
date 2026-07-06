const fs = require('fs');
const path = require('path');

const pathsToSearch = [
    'C:/Users/DELL/AppData/Roaming/Code/User/History',
    'C:/Users/DELL/.gemini',
    'C:/Users/DELL/.vscode'
];

function walkDir(dir, callback) {
    let files = [];
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }
    files.forEach(f => {
        let dirPath = path.join(dir, f);
        try {
            let stat = fs.statSync(dirPath);
            if (stat.isDirectory()) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        } catch (e) {}
    });
}

console.log("Searching for App.jsx backups in history/configs...");
pathsToSearch.forEach(p => {
    console.log(`Scanning path: ${p}`);
    walkDir(p, (filePath) => {
        if (filePath.toLowerCase().includes('app.jsx')) {
            console.log(`Found: ${filePath} (${fs.statSync(filePath).size} bytes)`);
        }
    });
});
