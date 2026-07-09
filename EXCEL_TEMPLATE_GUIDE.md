# 📊 Excel File Template Guide

## Quick Reference for Excel Data Upload

This document provides a quick reference for preparing your Excel file for upload to the University Timetable System.

## 📁 Required Sheets

Your Excel file should contain the following sheets:

1. **Faculty** (or "Faculty Sheet")
2. **Rooms** (or "Rooms Sheet")
3. **Batches** (or "Batches Sheet")
4. **First Year Data** (or any sheet with "Year" or "Data" in the name)
5. **Third Year Data** (optional, for third year courses)

---

## 1️⃣ Faculty Sheet

### Required Columns:
| Column Name (Options) | Type | Example | Notes |
|----------------------|------|---------|-------|
| Faculty ID / Emp ID | Text | 2301c60002 | Unique identifier |
| Faculty Name / Employee Name | Text | Mr. JOGULA KARUNAKAR | Full name |
| Faculty Department / Department | Text | AGRI | Department code |
| Faculty Email / Email | Text | 2301c60004@sru.edu.in | Valid email |

### Sample Data:
```
Faculty ID    | Faculty Name              | Department | Email
2301c60002   | Mr. JOGULA KARUNAKAR      | AGRI       | 2301c60004@sru.edu.in
2301c60005   | Ms. KATHULA KARTHIKA      | AGRI       | 2301c60005@sru.edu.in
```

---

## 2️⃣ Rooms Sheet

### Required Columns:
| Column Name (Options) | Type | Example | Notes |
|----------------------|------|---------|-------|
| Room ID / S No. | Number/Text | 1 | Unique identifier |
| Room Name/Number | Text | 1101_BL1_FF | Room identifier |
| Room Type | Text | Lecture Hall | "Lecture Hall", "Lab", "Computing Facility", etc. |
| Capacity | Number | 90 | Maximum students |
| Session / Session year | Text | 2025-26-Even | Academic session |

### Sample Data:
```
Room ID | Room Name    | Room Type     | Capacity | Session
1       | 1101_BL1_FF  | Lecture Hall  | 90       | 2025-26-Even
15      | 1104_A_BL1_FF| Advanced Lab  | 30       | 2025-26-Even
```

---

## 3️⃣ Batches Sheet

### Required Columns:
| Column Name (Options) | Type | Example | Notes |
|----------------------|------|---------|-------|
| Semester | Number | 2 | Semester number (1 or 2) |
| Batch ID / Batch | Text | 25CAIBTAIB01 | Unique batch code |
| Degree | Text | BTECH-CSE | Degree program |
| Year | Text | First | "First", "Second", "Third", "Fourth" |
| Department / School/Department | Text | CSE | Department code |
| Session | Text | 2025-26-Even | Academic session |

### Sample Data:
```
Semester | Batch ID      | Degree     | Year  | Department | Session
2        | 25CAIBTAIB01  | BTECH-CSE  | First | CSE        | 2025-26-Even
2        | 25CAIBTAIB02  | BTECH-CSE  | First | CSE        | 2025-26-Even
```

---

## 4️⃣ Course Data Sheets (First Year, Third Year, etc.)

### Required Columns:
| Column Name (Options) | Type | Example | Notes |
|----------------------|------|---------|-------|
| Faculty ID / Emp ID | Text | 2301c60002 | Must match Faculty sheet |
| Faculty Name | Text | Mr. JOGULA KARUNAKAR | Faculty name |
| Course Code / Course code | Text | 25AITC01005-26 | Unique course code |
| Subject | Text | Probability And Statistics | Subject name |
| Type / Type(Core/Elective) | Text | Core | "Core" or "Elective" |
| Batch | Text | 25CAIBTAIB01 | Must match Batches sheet |
| Course L | Number | 3 | Lecture hours per week |
| Course T | Number | 0 | Tutorial hours per week |
| Course P | Number | 0 | Practical hours per week |
| Credits / credits | Number | 3 | Credit points |
| Year / Year(first year) | Text | First | Academic year |
| Semester / semester | Number | 2 | Semester number |
| Program / Program(B.tech) | Text | B.Tech | Program type |
| Department / Department(CSE/ECE/etc...) | Text | CSE | Department code |
| Faculty L / Fauclty L | Number | 3 | Faculty lecture load |
| Faculty T | Number | 0 | Faculty tutorial load |
| Faculty P | Number | 0 | Faculty practical load |
| Total Load | Number | 3 | Total faculty load |
| Session | Text | 2025-26-Even | Academic session |

### Sample Data:
```
Faculty ID | Faculty Name    | Course Code      | Subject                    | Type | Batch        | Course L | Course T | Course P | Credits | Year  | Semester | Program | Department | Faculty L | Faculty T | Faculty P | Total Load | Session
2301c60002 | Mr. JOGULA K.   | 25AITC01005-26  | Probability And Statistics | Core | 25CAIBTAIB01 | 3        | 0        | 0        | 3       | First | 2        | B.Tech  | CSE        | 3         | 0         | 0         | 3          | 2025-26-Even
```

---

## ✅ Validation Checklist

Before uploading your Excel file, verify:

- [ ] All sheet names are correct (case-insensitive)
- [ ] All required columns are present
- [ ] Faculty IDs in Course sheets match Faculty sheet
- [ ] Batch IDs in Course sheets match Batches sheet
- [ ] Room Types are consistent (Lecture Hall, Lab, etc.)
- [ ] Sessions are consistent across all sheets
- [ ] No empty required fields
- [ ] Numbers are in correct format (not text)
- [ ] Email addresses are valid

---

## 🎯 Tips for Best Results

1. **Consistent Naming**: Use consistent department codes (CSE, ECE, AGRI)
2. **Session Format**: Use format like "2025-26-Even" or "2025-26-Odd"
3. **Year Names**: Use "First", "Second", "Third", "Fourth" (not "1st", "2nd")
4. **Room Types**: Be specific - "Lecture Hall", "Computing Facility 1", "Advanced Lab"
5. **Course Codes**: Make them unique and descriptive
6. **Load Calculation**: Ensure Total Load = Faculty L + Faculty T + Faculty P

---

## 📋 Common Mistakes to Avoid

❌ **Don't:**
- Use merged cells
- Leave required fields empty
- Mix different session formats
- Use special characters in IDs
- Duplicate Faculty IDs or Batch IDs
- Mismatch Faculty IDs between sheets

✅ **Do:**
- Keep data clean and consistent
- Use standard formats
- Verify all IDs match across sheets
- Test with a small dataset first
- Keep a backup of your original file

---

## 🔄 Update vs. Add

The system will:
- **Add** new records if the ID doesn't exist
- **Update** existing records if the ID matches

This means you can:
- Upload the same file multiple times safely
- Add new data incrementally
- Update existing data by re-uploading

---

## 📞 Need Help?

If you encounter errors during upload:
1. Check the error messages in the upload results
2. Verify your Excel file against this guide
3. Ensure all required columns are present
4. Check for typos in column names
5. Verify data types (numbers vs. text)

---

**Happy Scheduling! 🎓**
