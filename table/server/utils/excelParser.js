const XLSX = require('xlsx');

function headerKeys(row) {
  return Object.keys(row).map(k => (row[k] || '').toString().trim());
}

function looksLikeFaculty(headers) {
  const h = headers.join('|').toLowerCase();
  return h.includes('emp id') || h.includes('employee name') || h.includes('email');
}

function looksLikeRoom(headers) {
  const h = headers.join('|').toLowerCase();
  return h.includes('room id') || h.includes('room name') || h.includes('room type');
}

function looksLikeBatch(headers) {
  const h = headers.join('|').toLowerCase();
  return h.includes('batch') && (h.includes('semester') || h.includes('degree') || h.includes('year'));
}

function looksLikeSubjects(headers) {
  const h = headers.join('|').toLowerCase();
  return h.includes('course code') || (h.includes('course l') || h.includes('course t') || h.includes('course p')) || h.includes('subject');
}

function normalize(val){ if (val===undefined || val===null) return ''; return val.toString().trim(); }

function parseSheetToObjects(sheet) {
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return json;
}

function parseExcelBuffer(buffer){
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const out = { faculties: [], rooms: [], batches: [], subjects: [] };

  wb.SheetNames.forEach(name => {
    const sheet = wb.Sheets[name];
    const rows = parseSheetToObjects(sheet);
    if (!rows || rows.length===0) return;
    const keys = headerKeys(rows[0]);

    if (looksLikeFaculty(keys)){
      // faculty mapping: Emp ID, Employee Name, Department, Email
      rows.forEach(r => {
        out.faculties.push({ facultyId: normalize(r['Emp ID'] || r['EmpID'] || r['Emp Id'] || r['Emp Id.'] || r['Emp Id']), name: normalize(r['Employee Name'] || r['Faculty'] || r['Faculty Name'] || r['Employee Name']), department: normalize(r['Department'] || r['School/Department'] || r['Dept']), email: normalize(r['Email'] || r['E-mail'] || r['Email ID']) });
      });
    } else if (looksLikeRoom(keys)){
      rows.forEach(r => {
        out.rooms.push({ roomId: normalize(r['Room ID'] || r['RoomId'] || r['ID'] || r['S No.']), name: normalize(r['Room Name'] || r['Room Name/Number'] || r['Room Name/Number'] || r['Room Name']), type: normalize(r['Room Type'] || r['Room Type']), capacity: Number(r['Capacity'] || r['Cap'] || 0) || 0, sessionYear: normalize(r['Session']) });
      });
    } else if (looksLikeBatch(keys)){
      rows.forEach(r => {
        out.batches.push({ batchId: normalize(r['Batch'] || r['Batch ID'] || r['Batch Id']), semester: normalize(r['Semester'] || r['Sem']), degree: normalize(r['Degree'] || r['Program']), yearLabel: normalize(r['Year'] || r['Year (First Year)'] || ''), department: normalize(r['Department'] || r['School/Department']), session: normalize(r['Session']) });
      });
    } else if (looksLikeSubjects(keys)){
      // subjects sheet may contain many columns: Course code, Subject, Course L, Course T, Course P, Credits, Year, Semester, Program, Department, Faculty L/T/P
      rows.forEach(r => {
        out.subjects.push({ code: normalize(r['Course code'] || r['Course Code'] || r['CourseCode'] || r['Course']), name: normalize(r['Subject'] || r['Subject Name'] || r['Course Name']), type: normalize(r['Type'] || r['Type (Core/Elective)']), batch: normalize(r['Batch']), lectureHours: Number(r['Course L'] || r['Course L.'] || r['CourseL'] || r['Course Lecture'] || 0) || 0, tutorialHours: Number(r['Course T'] || r['Course T.'] || r['CourseT'] || r['Course Tutorial'] || 0) || 0, labHours: Number(r['Course P'] || r['Course P.'] || r['CourseP'] || r['Course Partical'] || r['Course Practical'] || 0) || 0, credits: Number(r['Credits'] || r['Credit'] || 0) || 0, year: normalize(r['Year'] || r['Year(first year)'] || r['Year(third year)'] || r['Year']), semester: normalize(r['Semester'] || r['Sem']), program: normalize(r['Program'] || r['Degree']), department: normalize(r['Department']), assignedFacultyId: normalize(r['Emp ID'] || r['Faculty ID'] || r['FacultyID'] || r['Fauclty Lecture'] || ''), facultyName: normalize(r['Faculty'] || r['Faculty Name'] || r['Faculty Name']) });
      });
    } else {
      // fallback: try to detect subjects by columns
      const maybe = rows.filter(r => r['Course code'] || r['Course Code'] || r['Subject']);
      if (maybe.length>0){
        maybe.forEach(r => {
          out.subjects.push({ code: normalize(r['Course code'] || r['Course Code']), name: normalize(r['Subject']), lectureHours: Number(r['Course L']||0)||0, labHours: Number(r['Course P']||0)||0, semester: normalize(r['Semester']), department: normalize(r['Department']), assignedFacultyId: normalize(r['Emp ID']||'') });
        });
      }
    }
  });

  return out;
}

module.exports = { parseExcelBuffer };
