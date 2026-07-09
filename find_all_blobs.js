const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const gitDir = 'c:/Users/DELL/Downloads/table/table/.git';
const objectsDir = path.join(gitDir, 'objects');

console.log("Scanning loose objects for App.jsx...");

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(subdir => {
        const subpath = path.join(dir, subdir);
        if (fs.statSync(subpath).isDirectory()) {
            if (subdir.length === 2) {
                fs.readdirSync(subpath).forEach(file => {
                    const filepath = path.join(subpath, file);
                    try {
                        const compressed = fs.readFileSync(filepath);
                        const decompressed = zlib.inflateSync(compressed);
                        const nullIdx = decompressed.indexOf(0);
                        if (nullIdx !== -1) {
                            const header = decompressed.slice(0, nullIdx).toString('utf8');
                            if (header.startsWith('blob')) {
                                const content = decompressed.slice(nullIdx + 1).toString('utf8');
                                if (content.includes('timetableTabs') && content.includes('LMSPortal')) {
                                    console.log(`Found matching blob! Path: ${filepath}, SHA: ${subdir}${file}, Size: ${content.length}`);
                                    if (content.length > 25000) {
                                        console.log("Writing recovered content to client/src/App.jsx.recovered");
                                        fs.writeFileSync('client/src/App.jsx.recovered', content);
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                });
            }
        }
    });
}

scanDir(objectsDir);
console.log("Done scanning loose objects.");
