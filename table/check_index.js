const fs = require('fs');

const indexFile = 'c:/Users/DELL/Downloads/table/table/.git/index';
if (!fs.existsSync(indexFile)) {
    console.error("Index not found");
    process.exit(1);
}

const buf = fs.readFileSync(indexFile);
const sig = buf.toString('utf8', 0, 4);
const version = buf.readUInt32BE(4);
const entryCount = buf.readUInt32BE(8);

console.log(`Sig: ${sig}, Version: ${version}, Entries: ${entryCount}`);

let offset = 12;
for (let i = 0; i < entryCount; i++) {
    // metadata is 62 bytes (up to path length flags)
    if (offset >= buf.length) break;
    
    const sha = buf.toString('hex', offset + 40, offset + 60);
    const flags = buf.readUInt16BE(offset + 60);
    const pathLen = flags & 0xFFF; // 12 bits for length
    
    let pathEnd = offset + 62 + pathLen;
    // path is null-terminated and padded to 8-byte boundary relative to index entry start
    // Let's find null byte
    let nullIdx = offset + 62;
    while (nullIdx < buf.length && buf[nullIdx] !== 0) {
        nullIdx++;
    }
    const path = buf.toString('utf8', offset + 62, nullIdx);
    
    if (path.includes('App.jsx')) {
        console.log(`Found entry: Path: ${path}, SHA: ${sha}, Size: ${buf.readUInt32BE(offset + 36)}`);
    }
    
    // entries are padded to 8-byte boundary
    // entry starts at offset. Length of entry is 62 + pathLen.
    // The next entry starts at offset + entryLength padded to 8 bytes.
    let entryLen = 62 + (nullIdx - (offset + 62)) + 1;
    let remainder = entryLen % 8;
    let pad = remainder === 0 ? 0 : 8 - remainder;
    offset = offset + entryLen + pad;
}
