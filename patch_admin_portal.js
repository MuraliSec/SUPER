const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add batchConfigsRef
content = content.replace(
    'const [crudModal, setCrudModal] = useState(null); // null | { type, mode, item }',
    `const [crudModal, setCrudModal] = useState(null); // null | { type, mode, item }
    const batchConfigsRef = React.useRef({});
    
    useEffect(() => {
        if (selectedBatch) {
            batchConfigsRef.current[selectedBatch._id] = {
                subjectConfig: { ...subjectConfig },
                selectedLectureRooms: [...selectedLectureRooms],
                selectedLabRooms: [...selectedLabRooms]
            };
        }
    }, [subjectConfig, selectedLectureRooms, selectedLabRooms, selectedBatch]);`
);

// 2. Update handleBatchSelect
const oldHandleBatchSelect = `    const handleBatchSelect = (batchId) => {
        if (!batchId) {
            setSelectedBatch(null);
            setSubjectConfig({});
            return;
        }
        const batch = batches.find(b => b._id === batchId);
        if (!batch) return;
        setSelectedBatch(batch);
        const initialConfig = {};`;

const newHandleBatchSelect = `    const handleBatchSelect = (batchId) => {
        if (!batchId) {
            setSelectedBatch(null);
            setSubjectConfig({});
            setSelectedLectureRooms([]);
            setSelectedLabRooms([]);
            return;
        }
        const batch = batches.find(b => b._id === batchId);
        if (!batch) return;
        setSelectedBatch(batch);
        
        const saved = batchConfigsRef.current[batchId];
        if (saved) {
            setSubjectConfig(saved.subjectConfig || {});
            setSelectedLectureRooms(saved.selectedLectureRooms || []);
            setSelectedLabRooms(saved.selectedLabRooms || []);
            return;
        } else {
            setSubjectConfig({});
            setSelectedLectureRooms([]);
            setSelectedLabRooms([]);
        }
        
        const initialConfig = {};`;
content = content.replace(oldHandleBatchSelect, newHandleBatchSelect);

// 3. Make Chips clickable & add styling for active tab
content = content.replace(
    `                                                            padding: '4px 10px 4px 8px', borderRadius: 20, border: '1.5px solid #93c5fd'`,
    `                                                            padding: '4px 10px 4px 8px', borderRadius: 20, border: \`1.5px solid \${selectedBatch?._id === b._id ? '#1e3a8a' : '#93c5fd'}\`, cursor: 'pointer', background: selectedBatch?._id === b._id ? '#bfdbfe' : '#dbeafe'`
);

content = content.replace(
    `                                                            🎓 {b.name || b.batchId}`,
    `                                                            <span onClick={() => handleBatchSelect(b._id)}>🎓 {b.name || b.batchId}</span>`
);

// 4. Update the generate payload
const oldPayload = `            const payload = {
                batchId: selectedBatch._id,
                batchIds: selectedBatches.length > 0 ? selectedBatches.map(b => b._id) : [selectedBatch._id],
                batchNames: selectedBatches.length > 0 ? selectedBatches.map(b => b.name || b.batchId) : [selectedBatch.name],
                subjectConfig: processedSubjectConfig, // Use the processed config
                selectedRooms: {
                    lectureRooms: selectedLectureRooms,
                    labRooms: selectedLabRooms
                }
            };`;

const newPayload = `            const payload = {
                batchId: selectedBatch._id,
                batchIds: selectedBatches.length > 0 ? selectedBatches.map(b => b._id) : [selectedBatch._id],
                batchNames: selectedBatches.length > 0 ? selectedBatches.map(b => b.name || b.batchId) : [selectedBatch.name],
                batchConfigs: selectedBatches.reduce((acc, b) => {
                    const conf = batchConfigsRef.current[b._id]?.subjectConfig || {};
                    const procConf = {};
                    Object.keys(conf).forEach(subName => {
                        const subjObj = allSubjects.find(s => s.name === subName) || {};
                        const type = (subjObj.type || subjObj.courseType || 'Core').toString().toLowerCase();
                        const isTraining = type.includes('training');
                        const isElective = type.includes('elective');
                        procConf[subName] = {
                            ...conf[subName],
                            subjectType: isTraining ? 'Training' : (isElective ? 'Elective' : 'Core')
                        };
                    });
                    acc[b._id] = procConf;
                    return acc;
                }, {}),
                batchRooms: selectedBatches.reduce((acc, b) => {
                    const conf = batchConfigsRef.current[b._id];
                    if (conf) {
                        acc[b._id] = {
                            lectureRooms: conf.selectedLectureRooms || [],
                            labRooms: conf.selectedLabRooms || []
                        };
                    }
                    return acc;
                }, {}),
                subjectConfig: processedSubjectConfig, // Use the processed config
                selectedRooms: {
                    lectureRooms: selectedLectureRooms,
                    labRooms: selectedLabRooms
                }
            };`;

let nextContent = content.replace(oldPayload, newPayload);
if (nextContent !== content) {
    fs.writeFileSync(file, nextContent);
    console.log('PATCH_OK');
} else {
    fs.writeFileSync(file, content); // save partial
    console.log('PATCH_FAIL on step 4: payload block not found');
}
