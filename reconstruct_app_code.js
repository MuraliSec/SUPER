const fs = require('fs');
const path = require('path');

// Let's read all 8 views
const views = {};
for (let i = 1; i <= 8; i++) {
    const filename = `client/src/App.jsx.view.${i}`;
    if (!fs.existsSync(filename)) continue;
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');
    let totalLines = 0;
    let showingStart = 0;
    let showingEnd = 0;
    
    // Parse metadata
    for (const line of lines) {
        if (line.includes('Total Lines:')) {
            totalLines = parseInt(line.match(/Total Lines:\s*(\d+)/)[1], 10);
        }
        if (line.includes('Showing lines')) {
            const m = line.match(/Showing lines\s*(\d+)\s*to\s*(\d+)/);
            showingStart = parseInt(m[1], 10);
            showingEnd = parseInt(m[2], 10);
        }
    }
    
    // Extract code lines
    const codeLines = {};
    for (const line of lines) {
        const m = line.match(/^(\d+):\s*(.*)/);
        if (m) {
            const lineNum = parseInt(m[1], 10);
            // remove carriage return if present
            codeLines[lineNum] = m[2].replace(/\r$/, '');
        }
    }
    views[i] = { totalLines, showingStart, showingEnd, codeLines };
}

// Let's merge all code lines
const merged = {};
for (const i in views) {
    const view = views[i];
    for (const lineNum in view.codeLines) {
        merged[lineNum] = view.codeLines[lineNum];
    }
}

console.log("Merged line numbers count:", Object.keys(merged).length);
const sortedLines = Object.keys(merged).map(Number).sort((a,b)=>a-b);
console.log("Min line:", sortedLines[0], "Max line:", sortedLines[sortedLines.length - 1]);

// Let's print contiguous blocks
let start = null;
let prev = null;
for (const num of sortedLines) {
    if (start === null) {
        start = num;
    } else if (num !== prev + 1) {
        console.log(`Block: ${start} to ${prev}`);
        start = num;
    }
    prev = num;
}
if (start !== null) {
    console.log(`Block: ${start} to ${prev}`);
}

// Let's write the merged lines to a temporary file
const output = [];
for (let i = 1; i <= 664; i++) {
    if (merged[i] !== undefined) {
        output.push(`${i}: ${merged[i]}`);
    } else {
        output.push(`${i}: <MISSING>`);
    }
}
fs.writeFileSync('client/src/App.jsx.reconstructed', output.join('\n'));
