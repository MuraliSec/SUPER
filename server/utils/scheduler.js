const fs = require('fs');

class Scheduler {
    constructor(config, rooms, existingTimetables, institutionId = null, schedulerOptions = {}) {
        this.config = config || {};
        this.rooms = rooms || [];
        this.existingTimetables = existingTimetables || [];
        this.institutionId = institutionId;

        // Master Slot Pattern Options
        this.schedulerOptions = schedulerOptions;
        this.batchRooms = schedulerOptions.batchRooms || null;
        this.batchNamesMap = schedulerOptions.batchNamesMap || {};
        this.blockedSlots = schedulerOptions.blockedSlots || {}; // { batchId: ["Day#Period"] }
        this.batchLunchConfigs = schedulerOptions.batchLunchConfigs || {};

        this.sharedAllocations = {}; // { batchId: { day_period: periodObj } }

        // Config defaults
        this.periodsPerDay = this.config.periodsPerDay || 8;
        this.days = (this.config.workingDays && this.config.workingDays.length > 0)
            ? this.config.workingDays
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.lunchEnabled = this.config.lunchBreak ? this.config.lunchBreak.enabled : true;
        this.lunchPeriod = this.config.lunchBreak ? this.config.lunchBreak.period : 4; // 1-based

        this.lectureRooms = (this.rooms.lectureRooms && this.rooms.lectureRooms.length > 0) ? this.rooms.lectureRooms : ['Classroom'];
        this.labRooms = (this.rooms.labRooms && this.rooms.labRooms.length > 0) ? this.rooms.labRooms : ['Lab'];

        // Global Occupancy Map (Day#Period -> { faculty: Set, rooms: Set })
        this.globalOccupancy = {};

        // Multi-batch results
        this.results = [];
        this.allWarnings = [];
        this.allLogs = [];
        this.logs = [];
        this.warnings = [];

        // Current batch context (temp)
        this.batch = null;
        this.schedule = [];
        this.dayStartOffsets = [];
    }

    log(msg) {
        this.logs.push(msg);
        // console.log(`[Scheduler] ${msg}`);
    }

    warn(msg) {
        this.warnings.push(msg);
        console.warn(`[Scheduler] ${msg}`);
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    resolveFaculty(conf, mode) {
        const currentBatchId = this.batch ? (this.batch._id ? this.batch._id.toString() : this.batch.batchId) : null;
        
        let faculty = '';
        if (mode === 'Lab') {
            if (conf.labFacultyMap && currentBatchId && conf.labFacultyMap[currentBatchId] && conf.labFacultyMap[currentBatchId].length > 0) {
                faculty = conf.labFacultyMap[currentBatchId].join(', ');
            } else if (Array.isArray(conf.labFaculty) && conf.labFaculty.length > 0) {
                faculty = conf.labFaculty.join(', ');
            } else if (conf.lectureFacultyMap && currentBatchId && conf.lectureFacultyMap[currentBatchId] && conf.lectureFacultyMap[currentBatchId].length > 0) {
                faculty = conf.lectureFacultyMap[currentBatchId].join(', ');
            } else if (Array.isArray(conf.lectureFaculty) && conf.lectureFaculty.length > 0) {
                faculty = conf.lectureFaculty.join(', ');
            }
        } else {
            if (conf.lectureFacultyMap && currentBatchId && conf.lectureFacultyMap[currentBatchId] && conf.lectureFacultyMap[currentBatchId].length > 0) {
                faculty = conf.lectureFacultyMap[currentBatchId].join(', ');
            } else if (Array.isArray(conf.lectureFaculty) && conf.lectureFaculty.length > 0) {
                faculty = conf.lectureFaculty.join(', ');
            } else if (conf.labFacultyMap && currentBatchId && conf.labFacultyMap[currentBatchId] && conf.labFacultyMap[currentBatchId].length > 0) {
                faculty = conf.labFacultyMap[currentBatchId].join(', ');
            } else if (Array.isArray(conf.labFaculty) && conf.labFaculty.length > 0) {
                faculty = conf.labFaculty.join(', ');
            }
        }
        
        return faculty || conf.faculty || '';
    }

    // --- Initialization ---

    buildGlobalOccupancy() {
        this.globalOccupancy = {}; // Reset
        this.existingTimetables.forEach(tt => {
            // Skip if it's the batch we are currently generating (to avoid conflicts with its own old version)
            if (this.batch) {
                const currentBatchId = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
                if (tt.batchId === currentBatchId || tt.batch === currentBatchId) return;
            }

            (tt.schedule || []).forEach(daySch => {
                (daySch.periods || []).forEach(p => {
                    if (p.type !== 'Free' && p.type !== 'Lunch') {
                        const key = `${daySch.day}#${p.period}`;
                        this.markOccupied(key, p);
                    }
                });
            });
        });

        // Also include results generated in this instance (multi-batch)
        this.results.forEach(res => {
            (res.schedule || []).forEach(daySch => {
                (daySch.periods || []).forEach(p => {
                    if (p.type !== 'Free' && p.type !== 'Lunch') {
                        const key = `${daySch.day}#${p.period}`;
                        this.markOccupied(key, p);
                    }
                });
            });
        });
    }

    markOccupied(key, periodData) {
        if (!this.globalOccupancy[key]) {
            this.globalOccupancy[key] = { faculty: new Set(), rooms: new Set() };
        }

        const addFaculty = (fac) => {
            if (fac && fac !== 'Multiple') fac.split(',').map(f => f.trim()).filter(Boolean).forEach(f => this.globalOccupancy[key].faculty.add(f));
        };

        // Handle Elective Groups (Multiple allocations in one slot)
        if (Array.isArray(periodData.electiveAllocations)) {
            periodData.electiveAllocations.forEach(alloc => {
                addFaculty(alloc.faculty);
                if (alloc.room) this.globalOccupancy[key].rooms.add(alloc.room);
            });
        } else {
            addFaculty(periodData.faculty);
            if (periodData.room && periodData.room !== 'Multiple')
                this.globalOccupancy[key].rooms.add(periodData.room);
        }
    }

    // --- Constraints Checking ---

    isSlotFree(dayIndex, periodIndex) {
        if (periodIndex >= this.periodsPerDay) return false;
        const slot = this.schedule[dayIndex].periods[periodIndex];
        return slot.type === 'Free';
    }

    isResourceFree(dayIndex, periodIndex, faculty, room) {
        const dayName = this.days[dayIndex];
        const periodNum = periodIndex + 1;
        const key = `${dayName}#${periodNum}`;

        if (!this.globalOccupancy[key]) return true;

        if (faculty && faculty !== 'Multiple') {
            const facs = faculty.split(',').map(f => f.trim()).filter(Boolean);
            for (const fac of facs) {
                if (this.globalOccupancy[key].faculty.has(fac)) return false;
            }
        }
        if (room && room !== 'Multiple' && this.globalOccupancy[key].rooms.has(room)) return false;

        return true;
    }

    reserve(dayIndex, periodIndex, faculty, room) {
        const dayName = this.days[dayIndex];
        const periodNum = periodIndex + 1;
        const key = `${dayName}#${periodNum}`;

        if (!this.globalOccupancy[key]) {
            this.globalOccupancy[key] = { faculty: new Set(), rooms: new Set() };
        }

        if (faculty && faculty !== 'Multiple') {
            faculty.split(',').map(f => f.trim()).filter(Boolean).forEach(fac => this.globalOccupancy[key].faculty.add(fac));
        }
        if (room && room !== 'Multiple') this.globalOccupancy[key].rooms.add(room);
    }

    // Check if assigning faculty to slot (d, p) would violate the 2-hour consecutive rule
    checkConsecutiveViolation(d, p, faculty, duration = 1) {
        if (!faculty || faculty === 'Multiple') return false;

        const dayName = this.days[d];
        const periods = this.schedule[d].periods;

        // Helper to check if faculty is busy in a specific period (p is 0-indexed)
        const isFacultyBusyAt = (periodIdx) => {
            if (periodIdx < 0 || periodIdx >= this.periodsPerDay) return false;

            // Check current batch schedule (in memory)
            const localPeriod = periods[periodIdx];
            const facsToCheck = faculty.split(',').map(f => f.trim()).filter(Boolean);

            const hasConflict = facsToCheck.some(fac => {
                const lpFacs = localPeriod.faculty ? localPeriod.faculty.split(',').map(f => f.trim()) : [];
                if (lpFacs.includes(fac) || (Array.isArray(localPeriod.electiveAllocations) && localPeriod.electiveAllocations.some(a => {
                    const allocFacs = a.faculty ? a.faculty.split(',').map(f => f.trim()) : [];
                    return allocFacs.includes(fac);
                }))) {
                    return true;
                }

                // Check global occupancy (other batches)
                const key = `${dayName}#${periodIdx + 1}`;
                if (this.globalOccupancy[key] && this.globalOccupancy[key].faculty.has(fac)) {
                    return true;
                }
                return false;
            });

            return hasConflict;
        };

        if (duration >= 4) return true;

        let consecutiveCount = 0;
        const start = Math.max(0, p - 2);
        const end = Math.min(this.periodsPerDay - 1, p + duration + 1);

        for (let i = start; i <= end; i++) {
            let isBusy = isFacultyBusyAt(i) || (i >= p && i < p + duration);
            if (isBusy) {
                consecutiveCount++;
                if (consecutiveCount >= 4) return true;
            } else {
                consecutiveCount = 0;
            }
        }

        return false;
    }

    // --- Core Allocation Logic ---

    initBatch(batch) {
        this.batch = batch;

        // Dynamically assign rooms for this batch if provided
        const batchIdStr = batch._id ? batch._id.toString() : batch.batchId;
        if (this.batchRooms && this.batchRooms[batchIdStr]) {
            const bRooms = this.batchRooms[batchIdStr];
            this.lectureRooms = (bRooms.lectureRooms && bRooms.lectureRooms.length > 0) ? bRooms.lectureRooms : ['Classroom'];
            this.labRooms = (bRooms.labRooms && bRooms.labRooms.length > 0) ? bRooms.labRooms : ['Lab'];
        } else {
            this.lectureRooms = (this.rooms.lectureRooms && this.rooms.lectureRooms.length > 0) ? this.rooms.lectureRooms : ['Classroom'];
            this.labRooms = (this.rooms.labRooms && this.rooms.labRooms.length > 0) ? this.rooms.labRooms : ['Lab'];
        }

        this.buildGlobalOccupancy(); // Re-build per batch to ignore correct self

        const currentBatchId = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
        const currentBatchBlocked = this.blockedSlots[currentBatchId] || [];
        const currentLunchConfig = this.batchLunchConfigs[currentBatchId] || null;

        const getLunchPeriodsForDay = (config, dayName) => {
            if (!config || !config.enabled || !config.dayConfigs || !config.dayConfigs[dayName] || !config.dayConfigs[dayName].enabled) return [];
            const dayConf = config.dayConfigs[dayName];
            const periods = [];
            const startMap = { '11:00': 3, '12:00': 4, '13:00': 5, '14:00': 6 };
            const endMap = { '12:00': 4, '13:00': 5, '14:00': 6, '15:00': 7 };
            
            let startPeriod = startMap[dayConf.startTime];
            let endPeriod = endMap[dayConf.endTime];
            if (startPeriod && endPeriod && startPeriod < endPeriod) {
                 for (let i = startPeriod; i < endPeriod; i++) {
                     periods.push(i);
                 }
            } else if (startPeriod) {
                 periods.push(startPeriod);
            }
            return periods;
        };

        this.schedule = this.days.map(day => {
            const configuredLunchPeriods = currentLunchConfig ? getLunchPeriodsForDay(currentLunchConfig, day) : [];
            return {
                day,
                periods: Array.from({ length: this.periodsPerDay }, (_, i) => {
                    let isLunch = false;
                    if (currentLunchConfig) {
                        isLunch = configuredLunchPeriods.includes(i + 1);
                    } else {
                        isLunch = this.lunchEnabled && (i + 1) === this.lunchPeriod;
                    }
                    const isBlocked = currentBatchBlocked.includes(`${day}#${i + 1}`);
                    let type = 'Free';
                    if (isBlocked) type = 'Blocked';
                    else if (isLunch) type = 'Lunch';

                    return {
                        period: i + 1,
                        type,
                        subject: null,
                        faculty: null,
                        room: null
                    };
                })
            };
        });

        // Inject shared allocations
        if (this.sharedAllocations[currentBatchId]) {
            Object.keys(this.sharedAllocations[currentBatchId]).forEach(key => {
                const [dStr, pStr] = key.split('_');
                const d = parseInt(dStr, 10);
                const p = parseInt(pStr, 10);
                // Override the free slot with the shared allocation
                if (this.schedule[d] && this.schedule[d].periods[p]) {
                    this.schedule[d].periods[p] = JSON.parse(JSON.stringify(this.sharedAllocations[currentBatchId][key]));
                }
            });
        }

        this.logs = [];
        this.warnings = [];
    }

    generate(batch, subjectConfig) {
        this.initBatch(batch);

        // 1. Prepare Tasks
        const tasks = this.createAllocationTasks(subjectConfig);

        // 2. Sort Tasks (Priority: Slot Groups > Labs > Lectures)
        tasks.sort((a, b) => b.priority - a.priority);

        // 3. Allocate each task
        for (const task of tasks) {
            this.allocateTask(task);
        }

        const result = {
            batchId: batch._id ? batch._id.toString() : batch.batchId,
            batchName: batch.batchId,
            schedule: this.schedule,
            warnings: this.warnings,
            logs: this.logs
        };

        this.results.push(result);
        return result;
    }


    generateMulti(batchesData) {
        this.masterSlotPattern = null;
        this.sharedAllocations = {}; // Ensure a clean slate

        // Sort: Process batches with 'targetBatches' first to properly establish shared slots
        const sortedBatchesData = [...batchesData].sort((a, b) => {
            const hasTargetA = Object.values(a.subjectConfig || {}).some(c => c.targetBatches && c.targetBatches.length > 0);
            const hasTargetB = Object.values(b.subjectConfig || {}).some(c => c.targetBatches && c.targetBatches.length > 0);
            if (hasTargetA && !hasTargetB) return -1;
            if (!hasTargetA && hasTargetB) return 1;
            return 0;
        });

        // batchesData: [{ batch, subjectConfig }, ...]
        for (const data of sortedBatchesData) {
            this.generate(data.batch, data.subjectConfig);
        }
        return this.results;
    }

    createAllocationTasks(subjectConfig) {
        const tasks = [];
        const slotGroups = { A: [], B: [] };

        // PASS 1: Group Electives
        Object.entries(subjectConfig || {}).forEach(([subjectName, conf]) => {
            const slotGroup = conf.slotGroup || '';
            if (slotGroup === 'A') slotGroups.A.push(subjectName);
            else if (slotGroup === 'B') slotGroups.B.push(subjectName);
        });

        // Create Slot Group Tasks
        ['A', 'B'].forEach(group => {
            if (slotGroups[group].length > 0) {

                // ─── LECTURES ────────────────────────────────────────────────
                // Base = minimum lectureHours across all subjects in the group
                // Extra (individual) = each subject's lectureHours - minLecture
                const allLectureHours = slotGroups[group].map(n =>
                    parseInt(subjectConfig[n].lectureHours || 0)
                );
                const minLecture = Math.min(...allLectureHours);

                if (minLecture > 0) {
                    tasks.push({
                        type: 'SLOT_GROUP',
                        groupName: group,
                        subjects: slotGroups[group],
                        duration: 1,
                        sessions: minLecture,      // Only shared base hours
                        priority: 100,
                        mode: 'Lecture',
                        config: subjectConfig
                    });
                }

                // Extra individual lecture sessions for subjects above the minimum
                slotGroups[group].forEach(subName => {
                    const subConf = subjectConfig[subName];
                    const subLecture = parseInt(subConf.lectureHours || 0);
                    // Also account for any explicitly-set extraLectureHours
                    const explicitExtra = parseInt(subConf.extraLectureHours || 0);
                    const extra = (subLecture - minLecture) + explicitExtra;
                    if (extra > 0) {
                        tasks.push({
                            type: 'LECTURE',
                            subject: subName,
                            duration: 1,
                            sessions: extra,
                            priority: 10, // Lower than group — schedule after
                            conf: { ...subConf, faculty: this.resolveFaculty(subConf, 'Lecture') }
                        });
                    }
                });

                // ─── LABS ─────────────────────────────────────────────────────
                // Base = minimum labHours across subjects that have labs
                const subjectsWithLabs = slotGroups[group].filter(s =>
                    parseInt(subjectConfig[s].labHours || 0) > 0
                );

                if (subjectsWithLabs.length > 0) {
                    const allLabHours = subjectsWithLabs.map(n =>
                        parseInt(subjectConfig[n].labHours || 0)
                    );
                    const minLab = Math.min(...allLabHours);

                    const duration = 2; // Fixed to max 2 continuous hours
                    const sessions = Math.floor(minLab / duration);
                    const remainder = minLab % duration;

                    if (sessions > 0) {
                        tasks.push({
                            type: 'SLOT_GROUP',
                            groupName: group,
                            subjects: subjectsWithLabs,
                            duration: duration,
                            sessions: sessions,
                            priority: 95,
                            mode: 'Lab',
                            config: subjectConfig
                        });
                    }
                    if (remainder > 0) {
                        tasks.push({
                            type: 'SLOT_GROUP',
                            groupName: group,
                            subjects: subjectsWithLabs,
                            duration: remainder,
                            sessions: 1,
                            priority: 95,
                            mode: 'Lab',
                            config: subjectConfig
                        });
                    }

                    // Extra individual lab sessions per subject
                    subjectsWithLabs.forEach(subName => {
                        const subConf = subjectConfig[subName];
                        const subLab = parseInt(subConf.labHours || 0);
                        const explicitExtra = parseInt(subConf.extraLabHours || 0);
                        const extraLab = (subLab - minLab) + explicitExtra;
                        if (extraLab > 0) {
                            const extraDur = 2; // Fixed to max 2 continuous hours
                            const extraSessions = Math.floor(extraLab / extraDur);
                            const extraRem = extraLab % extraDur;
                            if (extraSessions > 0) {
                                tasks.push({
                                    type: 'LAB',
                                    subject: subName,
                                    duration: extraDur,
                                    sessions: extraSessions,
                                    priority: 50,
                                    conf: { ...subConf, faculty: this.resolveFaculty(subConf, 'Lab') }
                                });
                            }
                            if (extraRem > 0) {
                                tasks.push({
                                    type: 'LAB',
                                    subject: subName,
                                    duration: extraRem,
                                    sessions: 1,
                                    priority: 50,
                                    conf: { ...subConf, faculty: this.resolveFaculty(subConf, 'Lab') }
                                });
                            }
                        }
                    });
                }
            }
        });

        // PASS 2: Individual Subjects
        Object.entries(subjectConfig).forEach(([subjectName, conf]) => {
            // Skip if part of a slot group
            if (slotGroups.A.includes(subjectName) || slotGroups.B.includes(subjectName)) return;

            // Lab Task
            const baseLab = parseInt(conf.labHours || 0);
            const extraLab = parseInt(conf.extraLabHours || 0);
            const totalLab = baseLab + extraLab;

            if (totalLab > 0) {
                let duration = 2; // Max 2 continuous hours
                if (subjectName.toLowerCase().includes('tutorial')) duration = 1;

                const sessions = Math.floor(totalLab / duration);
                const remainder = totalLab % duration;

                if (sessions > 0) {
                    tasks.push({
                        type: 'LAB',
                        subject: subjectName,
                        duration: duration,
                        sessions: sessions,
                        priority: 50,
                        conf: { ...conf, faculty: this.resolveFaculty(conf, 'Lab') }
                    });
                }

                if (remainder > 0) {
                    tasks.push({
                        type: 'LAB',
                        subject: subjectName,
                        duration: remainder,
                        sessions: 1,
                        priority: 50,
                        conf: { ...conf, faculty: this.resolveFaculty(conf, 'Lab') }
                    });
                }
            }

            // Lecture Task
            const baseLecture = parseInt(conf.lectureHours || 0);
            const extraLecture = parseInt(conf.extraLectureHours || 0);
            const totalLecture = baseLecture + extraLecture;

            if (totalLecture > 0) {
                tasks.push({
                    type: 'LECTURE',
                    subject: subjectName,
                    duration: 1,
                    sessions: totalLecture,
                    priority: 10,
                    conf: { ...conf, faculty: this.resolveFaculty(conf, 'Lecture') }
                });
            }
        });

        // Remove tasks that are fully satisfied by shared allocations 
        // Notice this runs for each batch. If a batch inherited slots from sharedAllocations,
        // we should reduce the needed `sessions`.
        const currentBatchId = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
        const inherited = this.sharedAllocations[currentBatchId] || {};
        const subjectFulfilledHours = {};

        Object.values(inherited).forEach(periodObj => {
            // Count inherited hours
            if (periodObj.isElective && periodObj.electiveAllocations) {
                periodObj.electiveAllocations.forEach(alloc => {
                    if (alloc.subject) {
                        subjectFulfilledHours[alloc.subject] = (subjectFulfilledHours[alloc.subject] || 0) + 1;
                    }
                });
            } else if (periodObj.subject) {
                subjectFulfilledHours[periodObj.subject] = (subjectFulfilledHours[periodObj.subject] || 0) + 1;
            }
        });

        for (const task of tasks) {
            if (task.type === 'SLOT_GROUP') {
                let minFulfilled = 999;
                for (const sub of task.subjects) {
                    const f = subjectFulfilledHours[sub] || 0;
                    if (f < minFulfilled) minFulfilled = f;
                }
                if (minFulfilled !== 999 && minFulfilled > 0) {
                    const fulfilledSessions = task.mode === 'Lab' ? Math.floor(minFulfilled / task.duration) : minFulfilled;
                    task.sessions -= fulfilledSessions;
                }
            } else {
                const subName = task.subject;
                const f = subjectFulfilledHours[subName] || 0;
                if (f > 0) {
                    const fulfilledSessions = task.type === 'LAB' ? Math.floor(f / task.duration) : f;
                    task.sessions -= fulfilledSessions;
                    subjectFulfilledHours[subName] -= (fulfilledSessions * task.duration); // Deduct so it doesn't double count if LAB/LECTURE split
                }
            }
        }

        return tasks.filter(t => t.sessions > 0);
    }

    allocateTask(task) {
        const name = task.type === 'SLOT_GROUP' ? `Group ${task.groupName} (${task.mode})` : task.subject;
        this.log(`Allocating ${task.sessions} session(s) (duration: ${task.duration}) for ${name}`);
        for (let i = 0; i < task.sessions; i++) {
            const success = this.findAndBookSlot(task);
            if (success) {
                this.log(`Successfully allocated session ${i + 1}/${task.sessions} for ${name}`);
            } else {
                const relaxedConsecutive = this.findAndBookSlot(task, { allowConsecutiveOverflow: true });
                if (relaxedConsecutive) {
                    this.warn(`Allocated required session ${i + 1}/${task.sessions} for ${name} by relaxing the consecutive-hours limit.`);
                    continue;
                }

                const relaxedResources = this.findAndBookSlot(task, {
                    allowConsecutiveOverflow: true,
                    allowResourceConflicts: true
                });
                if (relaxedResources) {
                    this.warn(`Allocated required session ${i + 1}/${task.sessions} for ${name} with a resource conflict. Please review faculty/room availability.`);
                    continue;
                }

                this.warn(`Failed to allocate required session ${i + 1}/${task.sessions} for ${name}. Add free periods or reduce selected hours.`);
            }
        }
    }


    findAndBookSlot(task, options = {}) {
        // Greedy heuristic: Find valid slots, score them, pick best.
        const validSlots = [];
        const allowConsecutiveOverflow = Boolean(options.allowConsecutiveOverflow);

        // RANDOMIZATION: Randomly shuffle the order in which we check days
        const dayIndices = this.days.map((_, i) => i);
        this.shuffle(dayIndices);

        for (const d of dayIndices) {
            // Optimization: Don't place same subject/group multiple times a day if possible (unless forced)
            if (this.isTaskScheduledOnDay(task, d) && task.type !== 'SLOT_GROUP') {
                // Penalize or skip handled in calculateScore or here
            }

            // RANDOMIZATION: Randomly shuffle the order of periods to check
            const periodIndices = Array.from({ length: this.periodsPerDay - task.duration + 1 }, (_, i) => i);
            this.shuffle(periodIndices);

            for (const p of periodIndices) {
                // 0. Master Pattern Match completely removed

                // 1. Check Space (isSlotFree)
                let spaceOk = true;
                for (let k = 0; k < task.duration; k++) {
                    if (!this.isSlotFree(d, p + k)) {
                        spaceOk = false;
                        break;
                    }
                }
                if (!spaceOk) continue;

                // 2. Check Resources (Faculty, Room)
                const resources = this.checkResources(task, d, p, options);
                if (resources.valid) {
                    // 3. New Rule: Check Consecutive Hours violation
                    if (!allowConsecutiveOverflow && task.type === 'SLOT_GROUP') {
                        let violation = false;
                        for (const subName of task.subjects) {
                            const conf = task.config[subName];
                            const fac = this.resolveFaculty(conf, task.mode === 'Lab' ? 'Lab' : 'Lecture');
                            if (this.checkConsecutiveViolation(d, p, fac, task.duration)) {
                                violation = true;
                                break;
                            }
                        }
                        if (violation) continue;
                    } else if (!allowConsecutiveOverflow) {
                        if (this.checkConsecutiveViolation(d, p, task.conf.faculty, task.duration)) {
                            continue;
                        }
                    }

                    validSlots.push({
                        d, p,
                        resources: resources.data,
                        score: this.calculateScore(d, p, task)
                    });
                }
            }
        }

        if (validSlots.length === 0) return false;

        // Pick best
        validSlots.sort((a, b) => b.score - a.score); // Higher score best
        const best = validSlots[0]; // Or random top 3 for variation? Deterministic -> best[0]

        // Commit
        this.commitSlot(task, best);
        return true;
    }

    isTaskScheduledOnDay(task, dayIndex) {
        // Check if subject already present 
        // Simplified check
        const daySchedule = this.schedule[dayIndex];
        if (task.type === 'SLOT_GROUP') {
            return daySchedule.periods.some(p => p.slotGroup === task.groupName && (p.type === 'Lab' || p.type === 'Elective'));
        } else {
            return daySchedule.periods.some(p => p.subject === task.subject);
        }
    }

    checkResources(task, d, p, options = {}) {
        const allowResourceConflicts = Boolean(options.allowResourceConflicts);

        if (task.type === 'SLOT_GROUP') {
            // Need rooms and faculty for ALL subjects in group
            // AND they must be free for ALL periods in duration
            const allocationMap = [];
            const usedRooms = new Set();
            const usedFaculty = new Set();

            const roomPool = task.mode === 'Lab' ? this.labRooms : this.lectureRooms;

            for (const subName of task.subjects) {
                const conf = task.config[subName];
                const fac = this.resolveFaculty(conf, task.mode === 'Lab' ? 'Lab' : 'Lecture');
                // Faculty check
                for (let k = 0; k < task.duration; k++) {
                    if (!this.isResourceFree(d, p + k, fac, null) && !allowResourceConflicts) {
                        return { valid: false };
                    }
                }

                if (fac && fac !== 'Multiple') {
                    if (usedFaculty.has(fac) && !allowResourceConflicts) return { valid: false }; // Double booked in group
                    usedFaculty.add(fac);
                }

                // Room check
                // Find a room from pool that is free for duration AND not used in this group
                let foundRoom = null;
                // Randomize room pool to distribute utilization
                const shuffledPool = this.shuffle([...roomPool]);

                for (const room of shuffledPool) {
                    if (usedRooms.has(room)) continue;

                    let roomFree = true;
                    for (let k = 0; k < task.duration; k++) {
                        if (!this.isResourceFree(d, p + k, null, room)) {
                            roomFree = false;
                            break;
                        }
                    }
                    if (roomFree) {
                        foundRoom = room;
                        break;
                    }
                }

                if (!foundRoom && allowResourceConflicts) {
                    foundRoom = shuffledPool.find(room => !usedRooms.has(room)) || shuffledPool[0] || roomPool[0];
                }

                if (!foundRoom) return { valid: false };
                usedRooms.add(foundRoom);

                const getNames = (ids) => ids.map(id => this.batchNamesMap[id] || id);
                const currentBatchIdStr = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
                const combinedIds = [currentBatchIdStr, ...(conf.targetBatches || [])];

                allocationMap.push({
                    subject: subName,
                    faculty: this.resolveFaculty(conf, task.mode === 'Lab' ? 'Lab' : 'Lecture'),
                    room: foundRoom,
                    batches: getNames(combinedIds),
                    classType: task.mode
                });
            }
            return { valid: true, data: { allocationMap } };

        } else {
            // Individual Task
            const conf = task.conf;
            // Faculty
            for (let k = 0; k < task.duration; k++) {
                if (!this.isResourceFree(d, p + k, conf.faculty, null) && !allowResourceConflicts) return { valid: false };
            }

            // Room
            const roomPool = task.type === 'LAB' ? this.labRooms : this.lectureRooms;
            const shuffledPool = this.shuffle([...roomPool]);
            let foundRoom = null;
            for (const room of shuffledPool) {
                let roomFree = true;
                for (let k = 0; k < task.duration; k++) {
                    if (!this.isResourceFree(d, p + k, null, room)) {
                        roomFree = false;
                        break;
                    }
                }
                if (roomFree) {
                    foundRoom = room;
                    break;
                }
            }

            if (!foundRoom && allowResourceConflicts) {
                foundRoom = shuffledPool[0] || roomPool[0];
            }

            if (!foundRoom) return { valid: false };
            return { valid: true, data: { room: foundRoom, faculty: conf.faculty } };
        }
    }

    calculateScore(d, p, task) {
        // Heuristics:
        // 1. Prefer earlier in the day to fill up to 3pm
        // 2. Penalize if already scheduled on this day
        // 3. Balance days

        let score = 1000;

        // Constraint: Minimum end time is 3:00 PM (Period 6)
        // Prefer slots that are earlier than or at Period 6 to fill the core window
        if (p < 6) {
            score += (10 - p) * 10; // Slightly prefer earlier within the core window
        } else {
            score -= (p - 6) * 20; // Penalize slots after 3pm unless necessary
        }

        // Spread subjects: Penalize if already scheduled on this day
        if (this.isTaskScheduledOnDay(task, d)) {
            score -= 500;
        }

        // Balance load: penalize days that are already full
        const dayLoad = this.schedule[d].periods.filter(s => s.type !== 'Free' && s.type !== 'Lunch').length;
        score -= (dayLoad * 50);

        // RANDOMIZATION: Add jitter
        score += Math.floor(Math.random() * 50);

        return score;
    }

    commitSlot(task, slot) {
        const { d, p, resources } = slot;

        // Ensure periods array exists
        if (!this.schedule[d].periods) return;

        if (task.type === 'SLOT_GROUP') {
            const allocs = resources.allocationMap;
            const subjectNames = allocs.map(a => a.subject).join(', ');

            for (let k = 0; k < task.duration; k++) {
                const currentP = p + k;
                // Safety check
                if (!this.schedule[d].periods[currentP]) continue;

                const periodObj = this.schedule[d].periods[currentP];

                periodObj.type = task.mode === 'Lab' ? 'Lab' : 'Elective';
                periodObj.classType = task.mode;
                periodObj.subject = `Elective ${task.groupName} (${task.mode})`;
                periodObj.originalSubjects = subjectNames;
                periodObj.isElective = true;
                periodObj.slotGroup = task.groupName;
                periodObj.subjectType = 'Elective';
                periodObj.faculty = 'Multiple';
                periodObj.room = 'Multiple';
                periodObj.electiveAllocations = allocs;

                // Reserve
                allocs.forEach(a => this.reserve(d, currentP, a.faculty, a.room));

                // Pre-allocate to target batches
                const originalSubjectsIdsMap = {};
                task.subjects.forEach(sub => {
                    if (task.config[sub] && task.config[sub].targetBatches) {
                        task.config[sub].targetBatches.forEach(bId => originalSubjectsIdsMap[bId] = true);
                    }
                });

                Object.keys(originalSubjectsIdsMap).forEach(targetBatchId => {
                    const currentBatchId = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
                    if (targetBatchId !== currentBatchId) {
                        if (!this.sharedAllocations[targetBatchId]) this.sharedAllocations[targetBatchId] = {};
                        this.sharedAllocations[targetBatchId][`${d}_${currentP}`] = periodObj;
                    }
                });
            }

        } else {
            // Individual
            for (let k = 0; k < task.duration; k++) {
                const currentP = p + k;
                // Safety check
                if (!this.schedule[d].periods[currentP]) continue;

                const periodObj = this.schedule[d].periods[currentP];
                const getNames = (ids) => ids.map(id => this.batchNamesMap[id] || id);

                periodObj.type = task.type === 'LAB' ? 'Lab' : 'Lecture';
                periodObj.classType = task.type === 'LAB' ? 'Lab' : 'Lecture';
                periodObj.subject = task.subject;
                periodObj.faculty = resources.faculty;
                periodObj.room = resources.room;
                periodObj.subjectType = task.conf.subjectType;
                const currentBatchIdStr = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
                const combinedIds = [currentBatchIdStr, ...(task.conf.targetBatches || [])];
                periodObj.batches = getNames(combinedIds);

                // --- CLEAR stale group fields ---
                // If this period was previously part of a SLOT_GROUP, these fields
                // would still be sitting on the object. Null them out explicitly.
                periodObj.isElective = false;
                periodObj.electiveAllocations = null;
                periodObj.slotGroup = null;
                periodObj.originalSubjects = null;

                this.reserve(d, currentP, resources.faculty, resources.room);

                // Pre-allocate to target batches
                const bIds = task.conf.targetBatches || [];
                bIds.forEach(targetBatchId => {
                    const currentBatchId = this.batch._id ? this.batch._id.toString() : this.batch.batchId;
                    if (targetBatchId !== currentBatchId) {
                        if (!this.sharedAllocations[targetBatchId]) this.sharedAllocations[targetBatchId] = {};
                        this.sharedAllocations[targetBatchId][`${d}_${currentP}`] = periodObj;
                    }
                });
            }
        }

        this.log(`Allocated ${task.type === 'SLOT_GROUP' ? task.groupName : task.subject} at Day ${d} Period ${Number(p) + 1}`);
    }
}

module.exports = Scheduler;
