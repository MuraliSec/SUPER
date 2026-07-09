const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700,\s*padding: '4px 10px 4px 8px', borderRadius: 20, border: `1\.5px solid \$\{selectedBatch\?\._id === b\._id \? '#1e3a8a' : '#93c5fd'\}`, cursor: 'pointer', background: selectedBatch\?\._id === b\._id \? '#bfdbfe' : '#dbeafe'/g;

const replaceWith = `color: '#1d4ed8', fontSize: 11, fontWeight: 700,
                                                            padding: '4px 10px 4px 8px', borderRadius: 20, border: \`1.5px solid \${selectedBatch?._id === b._id ? '#1e3a8a' : '#93c5fd'}\`, cursor: 'pointer', background: selectedBatch?._id === b._id ? '#bfdbfe' : '#dbeafe'`;

content = content.replace(regex, replaceWith);
fs.writeFileSync(file, content);
