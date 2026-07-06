const fs = require('fs');
const file = 'client/src/AdminPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldPayloadRegex = /const payload = \{\s*batchId: selectedBatch\._id,\s*batchIds: selectedBatches\.length > 0 \? selectedBatches\.map\(b => b\._id\) : \[selectedBatch\._id\],\s*batchNames: selectedBatches\.length > 0 \? selectedBatches\.map\(b => b\.name \|\| b\.batchId\) : \[selectedBatch\.name\],\s*subjectConfig: processedSubjectConfig, \/\/ Use the processed config\s*selectedRooms: \{\s*lectureRooms: selectedLectureRooms,\s*labRooms: selectedLabRooms\s*\}\s*\};/m;

const newPayload = `const payload = {
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

const replacedLength = content.length;
content = content.replace(oldPayloadRegex, newPayload);
if (content.length === replacedLength) {
    console.log("No match found!");
} else {
    fs.writeFileSync(file, content);
    console.log("Success patched!");
}
