// Minimal timetable generator implementing constraints described by user.
// Input `config` shape (example in server/example-config.json):
// {
//   days: ["Mon","Tue","Wed","Thu","Fri"],
//   periodsPerDay: 8,
//   weeks: 1,
//   freezePeriods: [{day: "Mon", period: 3}],
//   batches: [ { batchId: 'B1', year: 'First Year', subjects: [ { code, name, type:'Lecture'|'Lab', weeklyHours, batch, lectureHours, labHours, assignedFacultyId, assignedRoomId } ] } ],
//   faculties: [ { facultyId, name, maxWeeklyLoad } ],
//   rooms: [ { roomId, name, type } ]
// }

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function generate(config) {
  const days = config.days || ['Mon','Tue','Wed','Thu','Fri'];
  const periodsPerDay = config.periodsPerDay || 8;
  const weeks = config.weeks || 1;
  const freeze = (config.freezePeriods || []).reduce((acc, f) => {
    acc[`${f.day}#${f.period}`] = true; return acc;
  }, {});

  // Build quick maps
  const facultyMap = {};
  (config.faculties||[]).forEach(f => { facultyMap[f.facultyId] = Object.assign({allocated:0}, f); });
  const roomMap = {};
  (config.rooms||[]).forEach(r => { roomMap[r.roomId] = Object.assign({util:0}, r); });

  const timetables = {};

  // Keep global occupancy: day#period -> { faculties: Set, rooms: Set }
  const globalOccupancy = {};
  function occKey(d,p){ return `${d}#${p}` }

  // helper to check availability
  function isFacultyFree(facId, day, period){
    const key = occKey(day, period);
    if (!facId) return false;
    const occ = globalOccupancy[key];
    return !(occ && occ.faculties && occ.faculties.has(facId));
  }
  function isRoomFree(roomId, day, period){
    const key = occKey(day, period);
    const occ = globalOccupancy[key];
    return !(occ && occ.rooms && occ.rooms.has(roomId));
  }
  function occupy(facId, roomId, day, period){
    const key = occKey(day, period);
    if (!globalOccupancy[key]) globalOccupancy[key] = { faculties: new Set(), rooms: new Set() };
    if (facId) globalOccupancy[key].faculties.add(facId);
    if (roomId) globalOccupancy[key].rooms.add(roomId);
    if (facId && facultyMap[facId]) facultyMap[facId].allocated++;
    if (roomId && roomMap[roomId]) roomMap[roomId].util++;
  }

  const facultySummary = {};
  const roomSummary = {};

  // For each batch, build empty timetable matrix and allocate slots
  for (const batch of (config.batches||[])){
    const batchId = batch.batchId || 'batch';
    // initialize
    const matrix = {};
    days.forEach(d=>{
      matrix[d] = new Array(periodsPerDay).fill(null).map(()=>({ type: 'FREE', subject: null, faculty: null, room: null }));
    });

    // flatten subjects with required hours
    const subjectList = [];
    (batch.subjects||[]).forEach(s=>{
      const lectureH = s.lectureHours || 0;
      const labH = s.labHours || 0; // labs counted in 2-hour blocks, so labH is number of lab-sessions per week
      if (lectureH>0) subjectList.push(Object.assign({}, s, {allocLecture: lectureH, isLab:false}));
      if (labH>0) subjectList.push(Object.assign({}, s, {allocLab: labH, isLab:true}));
    });

    // assign lectures and labs randomly but respecting constraints

    // helper to count subject occurrences per day
    function subjectCountOnDay(day, subjectCode){
      let c = 0;
      for (let p=0;p<periodsPerDay;p++){
        const cell = matrix[day][p];
        if (cell && cell.subject && cell.subject.code===subjectCode) c++;
      }
      return c;
    }

    // helper to find possible slots for lecture (1-hour)
    function findLectureSlot(subject, facultyId, roomId){
      const dayOrder = Array.from(days);
      shuffle(dayOrder);
      for (const d of dayOrder){
        const periodOrder = Array.from({length:periodsPerDay},(_,i)=>i);
        shuffle(periodOrder);
        for (const p of periodOrder){
          if (freeze[`${d}#${p+1}`]) continue; // freeze periods are free periods
          if (matrix[d][p].type !== 'FREE') continue;
          // subject repetition limit
          if (subjectCountOnDay(d, subject.code) >= 2) continue;
          if (!isFacultyFree(facultyId, d, p+1)) continue;
          if (!isRoomFree(roomId, d, p+1)) continue;
          return {d, p};
        }
      }
      return null;
    }

    // helper to find lab slot (2 consecutive periods)
    function findLabSlot(subject, facultyId, roomId){
      const dayOrder = Array.from(days);
      shuffle(dayOrder);
      for (const d of dayOrder){
        // lab only once per day per subject
        if (subjectCountOnDay(d, subject.code) > 0) continue;
        for (let p=0; p<periodsPerDay-1; p++){
          if (freeze[`${d}#${p+1}`] || freeze[`${d}#${p+2}`]) continue;
          if (matrix[d][p].type !== 'FREE' || matrix[d][p+1].type !== 'FREE') continue;
          // faculty and room both free for both periods
          if (!isFacultyFree(facultyId, d, p+1) || !isFacultyFree(facultyId, d, p+2)) continue;
          if (!isRoomFree(roomId, d, p+1) || !isRoomFree(roomId, d, p+2)) continue;
          return {d, p};
        }
      }
      return null;
    }

    // Build a worklist of atomic allocations: for each subject create N lecture slots and M lab slots
    const allocations = [];
    (batch.subjects||[]).forEach(s => {
      const lectureHours = s.lectureHours || 0;
      for (let i=0;i<lectureHours;i++) allocations.push({subject:s, kind:'lecture'});
      const labHours = s.labHours || 0;
      for (let i=0;i<labHours;i++) allocations.push({subject:s, kind:'lab'});
    });

    // randomize allocation order
    shuffle(allocations);

    for (const alloc of allocations){
      const s = alloc.subject;
      const facultyId = s.assignedFacultyId;
      const roomId = s.assignedRoomId; // admin can set preferred rooms; if not set pick any

      if (alloc.kind === 'lecture'){
        // pick room if missing: choose any non-lab room
        let roomToTry = roomId;
        if (!roomToTry){
          const candidate = (config.rooms||[]).find(r => r.type !== 'Lab');
          roomToTry = candidate ? candidate.roomId : null;
        }
        const slot = findLectureSlot(s, facultyId, roomToTry);
        if (slot){
          matrix[slot.d][slot.p] = { type: 'Lecture', subject: { code: s.code, name: s.name }, faculty: facultyMap[facultyId]?facultyMap[facultyId].name:null, facultyId, room: roomMap[roomToTry]?roomMap[roomToTry].name:roomToTry };
          occupy(facultyId, roomToTry, slot.d, slot.p+1);
        } else {
          // couldn't allocate: leave as free period
        }
      } else { // lab
        // pick lab room if missing
        let roomToTry = roomId;
        if (!roomToTry){
          const candidate = (config.rooms||[]).find(r => r.type === 'Lab');
          roomToTry = candidate ? candidate.roomId : null;
        }
        const slot = findLabSlot(s, facultyId, roomToTry);
        if (slot){
          // fill two consecutive periods
          matrix[slot.d][slot.p] = { type: 'Lab', subject: { code: s.code, name: s.name }, faculty: facultyMap[facultyId]?facultyMap[facultyId].name:null, facultyId, room: roomMap[roomToTry]?roomMap[roomToTry].name:roomToTry };
          matrix[slot.d][slot.p+1] = { type: 'Lab', subject: { code: s.code, name: s.name }, faculty: facultyMap[facultyId]?facultyMap[facultyId].name:null, facultyId, room: roomMap[roomToTry]?roomMap[roomToTry].name:roomToTry };
          occupy(facultyId, roomToTry, slot.d, slot.p+1);
          occupy(facultyId, roomToTry, slot.d, slot.p+2);
        } else {
          // couldn't allocate lab
        }
      }
    }

    // finalize matrix: convert Sets to simple objects and count summaries
    // faculty summary
    for (const fid in facultyMap){
      facultySummary[fid] = { name: facultyMap[fid].name, allocated: facultyMap[fid].allocated };
    }
    for (const rid in roomMap){
      roomSummary[rid] = { name: roomMap[rid].name, util: roomMap[rid].util };
    }

    timetables[batchId] = { days: matrix };
  }

  return { timetables, facultySummary, roomSummary };
}

module.exports = { generate };
