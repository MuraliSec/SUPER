const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const gitDir = 'c:/Users/DELL/Downloads/table/table/.git';

function getObjectPath(sha) {
    return path.join(gitDir, 'objects', sha.substring(0, 2), sha.substring(2));
}

function readObject(sha) {
    const p = getObjectPath(sha);
    if (!fs.existsSync(p)) {
        throw new Error(`Object not found at ${p}`);
    }
    const compressed = fs.readFileSync(p);
    const decompressed = zlib.inflateSync(compressed);
    
    const nullIdx = decompressed.indexOf(0);
    const header = decompressed.slice(0, nullIdx).toString('utf8');
    const content = decompressed.slice(nullIdx + 1);
    
    const [type, size] = header.split(' ');
    return { type, size: parseInt(size, 10), content };
}

// Find latest commit or use a known commit SHA
// Let's read .git/refs/heads/master or main, or .git/HEAD
let commitSha = '';
try {
    const headContent = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (headContent.startsWith('ref:')) {
        const refPath = headContent.substring(4).trim();
        commitSha = fs.readFileSync(path.join(gitDir, refPath), 'utf8').trim();
    } else {
        commitSha = headContent;
    }
    console.log('HEAD commit SHA:', commitSha);
} catch (e) {
    // fallback to known sha
    commitSha = '140c35fb1311e8420158a994af83ed2d258ee9ba';
}

try {
    const commitObj = readObject(commitSha);
    console.log('Commit read successfully.');

    const treeMatch = commitObj.content.toString('utf8').match(/^tree ([0-9a-f]{40})/m);
    if (!treeMatch) {
        throw new Error('Tree SHA not found in commit');
    }
    const rootTreeSha = treeMatch[1];
    console.log('Root Tree SHA:', rootTreeSha);

    function parseTree(content) {
        const entries = [];
        let pos = 0;
        while (pos < content.length) {
            const spaceIdx = content.indexOf(32, pos);
            const nullIdx = content.indexOf(0, spaceIdx);
            if (spaceIdx === -1 || nullIdx === -1) break;
            const mode = content.slice(pos, spaceIdx).toString('utf8');
            const name = content.slice(spaceIdx + 1, nullIdx).toString('utf8');
            const shaBinary = content.slice(nullIdx + 1, nullIdx + 21);
            const shaHex = shaBinary.toString('hex');
            entries.push({ mode, name, sha: shaHex });
            pos = nullIdx + 21;
        }
        return entries;
    }

    function findPath(treeSha, pathParts) {
        const treeObj = readObject(treeSha);
        const entries = parseTree(treeObj.content);
        
        const targetPart = pathParts[0];
        const entry = entries.find(e => e.name === targetPart);
        if (!entry) {
            throw new Error(`Part ${targetPart} not found in tree ${treeSha}`);
        }
        
        if (pathParts.length === 1) {
            return entry.sha;
        } else {
            return findPath(entry.sha, pathParts.slice(1));
        }
    }

    const fileSha = findPath(rootTreeSha, ['client', 'src', 'App.jsx']);
    console.log('Found App.jsx SHA:', fileSha);
    
    const blobObj = readObject(fileSha);
    console.log('Blob size:', blobObj.size);
    
    const targetPath = 'c:/Users/DELL/Downloads/table/table/client/src/App.jsx';
    fs.writeFileSync(targetPath, blobObj.content);
    console.log(`Successfully restored App.jsx to ${targetPath}`);
} catch (err) {
    console.error('Error:', err.message);
}
