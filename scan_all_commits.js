const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const gitDir = 'c:/Users/DELL/Downloads/table/table/.git';
const objectsDir = path.join(gitDir, 'objects');

const commits = [];

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
                            if (header.startsWith('commit')) {
                                const content = decompressed.slice(nullIdx + 1).toString('utf8');
                                const sha = `${subdir}${file}`;
                                const firstLine = content.split('\n')[0];
                                const msgLine = content.split('\n\n')[1] || '';
                                console.log(`Commit: ${sha} - ${msgLine.trim()} (Tree: ${firstLine})`);
                                commits.push({ sha, tree: firstLine.split(' ')[1] });
                            }
                        }
                    } catch (e) {}
                });
            }
        }
    });
}

scanDir(objectsDir);
console.log("Done scanning commits.");
