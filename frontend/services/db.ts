import { mockStudents } from '../mockData.ts';
import { StudentSummary, User, ClassData, Subject, SystemLog } from '../types.ts';
import { getSupabaseClient } from './supabase.ts';
import { getCookie } from '../utils/cookies.ts';

const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    username: 'admin',
    password: 'password123',
    name: 'Super Admin',
    role: 'Admin',
    avatarUrl: 'https://picsum.photos/100/100?random=90',
    status: 'Aktif'
  },
  {
    id: 'u2',
    username: 'guru',
    password: 'password123',
    name: 'Budi Santoso, S.Kom',
    role: 'Guru',
    classId: 'C001',
    avatarUrl: 'https://picsum.photos/100/100?random=99',
    status: 'Aktif'
  },
  {
    id: 'u3',
    username: 'siswa',
    password: 'password123',
    name: 'Ahmad Budi Santoso',
    role: 'Ortu/Siswa',
    studentId: 'S001',
    avatarUrl: 'https://picsum.photos/150/150?random=1',
    status: 'Aktif'
  }
];

const INITIAL_CLASSES: ClassData[] = [
  { id: 'C001', name: 'XI TKJ 1' },
  { id: 'C002', name: 'XI TKJ 2' },
  { id: 'C003', name: 'XII TKJ 1' }
];

const INITIAL_SUBJECTS: Subject[] = [
  { id: 'M001', name: 'Jaringan Dasar' },
  { id: 'M002', name: 'Pemrograman Web' },
  { id: 'M003', name: 'Sistem Operasi' }
];

const INITIAL_DB = {
  users: INITIAL_USERS,
  classes: INITIAL_CLASSES,
  subjects: INITIAL_SUBJECTS,
  students: mockStudents,
  attendance: {} as Record<string, any>,
  grades: {} as Record<string, Record<string, any>>,
  behaviorLogs: [] as any[],
  notifications: [] as any[],
  systemLogs: [] as SystemLog[],
  dailyGrades: {} as Record<string, any>
};

// --- CORE ENGINE: Auto-calculate all student stats ---
const syncStudentStats = (data: any) => {
  const grades = data.grades || {};
  const attendance = data.attendance || {};
  const behaviorLogs = (data.behaviorLogs || []).filter(Boolean);
  const students = (data.students || []).filter(Boolean);
  const subjects = (data.subjects || []).filter(Boolean);
  const users = (data.users || []).filter(Boolean);
  const classes = (data.classes || []).filter(Boolean);
  const dailyGrades = data.dailyGrades || {};

  data.behaviorLogs = behaviorLogs;
  data.subjects = subjects;
  data.users = users;
  data.classes = classes;
  data.dailyGrades = dailyGrades;

  const DEFAULT_PERIOD = '2023/2024_Ganjil';
  const periods = new Set<string>([DEFAULT_PERIOD]);

  // Discover periods from data
  Object.keys(grades).forEach(key => {
    const parts = key.split('_');
    if (parts.length >= 3) periods.add(`${parts[0]}_${parts[1]}`);
  });
  Object.keys(dailyGrades).forEach(key => {
    const parts = key.split('_');
    if (parts.length >= 4) periods.add(`${parts[0]}_${parts[1]}`);
  });
  Object.keys(attendance).forEach(key => {
    const parts = key.split('_');
    if (parts.length >= 3) periods.add(`${parts[0]}_${parts[1]}`);
  });
  behaviorLogs.forEach((log: any) => {
    if (log.academicYear && log.semester) periods.add(`${log.academicYear}_${log.semester}`);
  });

  data.students = students.map((student: any) => {
    if (!student || !student.id) return student;
    student.periodStats = {};

    periods.forEach(period => {
      let totalScore = 0;
      let subjectCount = 0;
      const competencies: any[] = [];

      subjects.forEach((subj: any) => {
        if (!subj || !subj.id) return;
        
        const subjKey = `${period}_${subj.id}`;
        const legacySubjKey = subj.id;
        
        let targetSubjKey = grades[subjKey] ? subjKey : (period === DEFAULT_PERIOD ? legacySubjKey : null);
        
        let autoTugasScore = undefined;
        const dailyKey = `${period}_${student.classId}_${subj.id}`;
        const legacyDailyKey = `${student.classId}_${subj.id}`;
        const targetDailyKey = dailyGrades[dailyKey] ? dailyKey : (period === DEFAULT_PERIOD ? legacyDailyKey : null);
        
        if (targetDailyKey) {
          const subjDaily = dailyGrades[targetDailyKey];
          if (subjDaily && subjDaily.records) {
            const stdRecords = subjDaily.records[student.id] || {};
            let total = 0, count = 0;
            Object.values(stdRecords).forEach((val) => {
              if (val !== '' && typeof val === 'number') { total += val; count++; }
            });
            autoTugasScore = count > 0 ? Math.round(total / count) : '';
          }
        }

        if (targetSubjKey || autoTugasScore !== undefined) {
           if (!targetSubjKey) {
             targetSubjKey = subjKey;
             grades[targetSubjKey] = {};
           }
           if (!grades[targetSubjKey]) grades[targetSubjKey] = {};
           if (!grades[targetSubjKey][student.id]) {
             grades[targetSubjKey][student.id] = { tugas: '', uts: '', uas: '' };
           }
           if (autoTugasScore !== undefined) {
             grades[targetSubjKey][student.id].tugas = autoTugasScore;
           }

           const g = grades[targetSubjKey][student.id];
           if (g) {
             const finalScore = (Number(g.tugas || 0) * 0.5) + (Number(g.uts || 0) * 0.25) + (Number(g.uas || 0) * 0.25);
             totalScore += finalScore;
             subjectCount++;
             competencies.push({ subject: subj.name, score: Math.round(finalScore), fullMark: 100 });
           }
        }
      });

      const avgGrade = subjectCount > 0 ? totalScore / subjectCount : 0;

      let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalSakit = 0, totalAlpa = 0, totalDays = 0, totalLate = 0;

      Object.keys(attendance).forEach(dateKey => {
        let isMatch = false;
        if (dateKey.startsWith(`${period}_`)) isMatch = true;
        else if (period === DEFAULT_PERIOD && dateKey.split('_').length === 1) isMatch = true; // legacy

        if (isMatch) {
          const dayRecord = attendance[dateKey];
          if (dayRecord) {
            const rec = dayRecord[student.id];
            if (rec) {
              totalDays++;
              if (rec.status === 'Hadir') totalHadir++;
              else if (rec.status === 'Terlambat') { totalHadir++; totalTerlambat++; }
              else if (rec.status === 'Izin') totalIzin++;
              else if (rec.status === 'Sakit') totalSakit++;
              else if (rec.status === 'Alpa') totalAlpa++;

              if (rec.lateMinutes) totalLate += rec.lateMinutes;
            }
          }
        }
      });

      const attendanceRate = totalDays > 0 ? Math.round((totalHadir / totalDays) * 100) : 100;

      let behaviorScore = 0;
      behaviorLogs.forEach((log: any) => {
        let isMatch = false;
        if (log.academicYear && log.semester) {
          if (`${log.academicYear}_${log.semester}` === period) isMatch = true;
        } else if (period === DEFAULT_PERIOD) {
          isMatch = true;
        }

        if (isMatch && log.studentId === student.id) {
          behaviorScore += (log.type === 'Positif' ? log.points : -log.points);
        }
      });

      student.periodStats[period] = {
        averageGrade: parseFloat(avgGrade.toFixed(1)),
        totalScore: parseFloat(totalScore.toFixed(1)),
        competencies,
        attendanceRate,
        totalLateMinutes: totalLate,
        behaviorScore,
        attendanceDetails: {
          hadir: totalHadir - totalTerlambat,
          terlambat: totalTerlambat,
          izin: totalIzin,
          sakit: totalSakit,
          alpa: totalAlpa,
          total: totalDays
        },
        rank: 0
      };
    });

    // Populate flat properties with DEFAULT_PERIOD for backwards compatibility
    const defStats = student.periodStats[DEFAULT_PERIOD] || {
      averageGrade: 0, totalScore: 0, competencies: [], attendanceRate: 100, 
      totalLateMinutes: 0, behaviorScore: 0, attendanceDetails: { hadir:0, terlambat:0, izin:0, sakit:0, alpa:0, total:0 }, rank: 0
    };
    Object.assign(student, defStats);

    return student;
  });

  // 2. Hitung Peringkat (Rank) per Kelas per Periode
  periods.forEach(period => {
    const classGroups: Record<string, any[]> = {};
    data.students.forEach((s: any) => {
      if (!classGroups[s.classId]) classGroups[s.classId] = [];
      classGroups[s.classId].push(s);
    });

    Object.values(classGroups).forEach(classStudents => {
      classStudents.sort((a, b) => (b.periodStats[period]?.totalScore || 0) - (a.periodStats[period]?.totalScore || 0));
      let currentRank = 1, currentScore = -1;
      classStudents.forEach((s, index) => {
        const score = s.periodStats[period]?.totalScore || 0;
        if (score !== currentScore) { currentRank = index + 1; currentScore = score; }
        s.periodStats[period].rank = currentRank;
        if (period === DEFAULT_PERIOD) s.rank = currentRank;
      });
    });
  });

  return data;
};

// In-memory database
let memoryDB: any = null;
let syncChannel: any = null;

export const getDB = () => {
  if (!memoryDB) {
    memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
  }
  return memoryDB;
};

// --- CLOUD SYNC ENGINE ---
export const syncToCloud = async (data: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('edusync_store').upsert({
      id: 'main',
      data: data,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Supabase upsert error:', error);
      if (error.message.toLowerCase().includes('row-level security') || error.code === '42501') {
        alert("GAGAL MENYIMPAN KE CLOUD!\n\nRow Level Security (RLS) di Supabase masih aktif. Silakan jalankan perintah SQL ini di Supabase Anda:\n\nALTER TABLE edusync_store DISABLE ROW LEVEL SECURITY;");
      }
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Error syncing to cloud:', error);
    throw error;
  }
};

export const initCloudSync = async (): Promise<boolean> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("Berjalan di mode LOKAL. Kredensial Supabase belum diatur.");
    memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
    window.dispatchEvent(new Event('edusync-db-update')); // Beritahu UI
    return false;
  }

  try {
    // 1. Fetch initial data from cloud
    const { data, error } = await supabase.from('edusync_store').select('data').eq('id', 'main').single();

    if (error) {
      console.error("Supabase fetch error:", error);
      if (error.code === 'PGRST116') {
        // Jika baris 'main' belum ada, buat dengan data inisial
        memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
        await syncToCloud(memoryDB);
      } else {
        // Error lain (mungkin RLS)
        console.error("Pastikan RLS sudah di-disable di tabel edusync_store!");
        memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
      }
    } else if (data && data.data) {
      // Gabungkan data dari cloud dengan INITIAL_DB agar struktur key selalu lengkap, lalu hitung statistik
      memoryDB = syncStudentStats({ ...JSON.parse(JSON.stringify(INITIAL_DB)), ...data.data });
    } else {
      memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
    }

    // PENTING: Beritahu UI bahwa data dari cloud sudah siap dan harus di-render ulang!
    window.dispatchEvent(new Event('edusync-db-update'));

    // 2. Subscribe to realtime changes from other devices
    if (syncChannel) {
      try {
        await supabase.removeChannel(syncChannel);
      } catch (e) {
        console.warn('Failed to remove old channel:', e);
      }
    }
    syncChannel = supabase.channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'edusync_store' },
        (payload) => {
          if (payload.new && (payload.new as any).data) {
            memoryDB = syncStudentStats({ ...JSON.parse(JSON.stringify(INITIAL_DB)), ...(payload.new as any).data });
            window.dispatchEvent(new Event('edusync-db-update'));
          }
        }
      );
    syncChannel.subscribe();

    return true;
  } catch (error) {
    console.error('Failed to init cloud sync', error);
    memoryDB = syncStudentStats(JSON.parse(JSON.stringify(INITIAL_DB)));
    window.dispatchEvent(new Event('edusync-db-update'));
    return false;
  }
};

const saveDB = async (data: any, actionName: string) => {
  // Deep clone data agar React mendeteksi perubahan referensi (memicu re-render)
  const newData = JSON.parse(JSON.stringify(data));
  const syncedData = syncStudentStats(newData);

  if (actionName) {
    const sessionStr = getCookie('edusync_auth_session');
    let currentUser = { id: 'system', name: 'System', role: 'System' };
    if (sessionStr) {
      try { currentUser = JSON.parse(sessionStr); } catch (e) { }
    }

    const newNotif = {
      id: Date.now().toString(),
      message: actionName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    syncedData.notifications = [newNotif, ...(syncedData.notifications || [])].slice(0, 10);

    const newLog: SystemLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: actionName,
      timestamp: new Date().toLocaleString('id-ID')
    };
    syncedData.systemLogs = [newLog, ...(syncedData.systemLogs || [])].slice(0, 1000);
  }

  // Update memory synchronously for instant UI feedback
  memoryDB = syncedData;
  window.dispatchEvent(new Event('edusync-db-update'));

  // Push to cloud asynchronously and throw error if it fails
  await syncToCloud(syncedData);
};

export const db = {
  master: {
    addClass: async (cls: ClassData) => {
      const data = getDB();
      data.classes.push(cls);
      await saveDB(data, `Kelas baru ditambahkan: ${cls.name}`);
    },
    updateClass: async (id: string, name: string) => {
      const data = getDB();
      data.classes = data.classes.map((c: ClassData) => c.id === id ? { ...c, name } : c);
      await saveDB(data, `Data kelas diperbarui: ${name}`);
    },
    deleteClass: async (id: string) => {
      const data = getDB();
      const cls = data.classes.find((c: ClassData) => c.id === id);
      data.classes = data.classes.filter((c: ClassData) => c.id !== id);
      await saveDB(data, `Kelas dihapus: ${cls?.name || id}`);
    },
    addSubject: async (subj: Subject) => {
      const data = getDB();
      data.subjects.push(subj);
      await saveDB(data, `Mapel baru ditambahkan: ${subj.name}`);
    },
    updateSubject: async (id: string, name: string) => {
      const data = getDB();
      data.subjects = data.subjects.map((s: Subject) => s.id === id ? { ...s, name } : s);
      await saveDB(data, `Data mapel diperbarui: ${name}`);
    },
    deleteSubject: async (id: string) => {
      const data = getDB();
      const subj = data.subjects.find((s: Subject) => s.id === id);
      data.subjects = data.subjects.filter((s: Subject) => s.id !== id);
      if (data.grades) delete data.grades[id];
      await saveDB(data, `Mapel dihapus: ${subj?.name || id}`);
    }
  },
  users: {
    getAll: () => getDB().users || [],
    add: async (user: User) => {
      const data = getDB();
      data.users.push(user);
      await saveDB(data, `Akun baru ditambahkan: ${user.username}`);
    },
    update: async (id: string, updates: Partial<User>) => {
      const data = getDB();
      data.users = data.users.map((u: User) => u.id === id ? { ...u, ...updates } : u);
      await saveDB(data, `Data akun diperbarui: ${updates.username || id}`);
    },
    updateBulk: async (ids: string[], updates: Partial<User>) => {
      const data = getDB();
      data.users = data.users.map((u: User) => ids.includes(u.id) ? { ...u, ...updates } : u);
      await saveDB(data, `${ids.length} akun diperbarui massal`);
    },
    delete: async (id: string) => {
      const data = getDB();
      const user = data.users.find((u: User) => u.id === id);
      data.users = data.users.filter((u: User) => u.id !== id);
      await saveDB(data, `Akun dihapus: ${user?.username || id}`);
    },
    deleteBulk: async (ids: string[]) => {
      const data = getDB();
      data.users = data.users.filter((u: User) => !ids.includes(u.id));
      await saveDB(data, `${ids.length} akun dihapus massal`);
    },
    resetPasswordBulk: async (ids: string[]) => {
      const data = getDB();
      data.users = data.users.map((u: User) => ids.includes(u.id) ? { ...u, password: u.username } : u);
      await saveDB(data, `Password ${ids.length} akun direset ke default`);
    },
    importBulk: async (newUsers: User[]) => {
      const data = getDB();
      data.users = [...(data.users || []), ...newUsers];
      await saveDB(data, `Import massal ${newUsers.length} akun berhasil`);
    }
  },
  students: {
    getAll: () => getDB().students || [],
    add: async (student: StudentSummary) => {
      const data = getDB();
      data.students.push(student);
      await saveDB(data, `Siswa baru ditambahkan: ${student.name}`);
    },
    update: async (id: string, updates: Partial<StudentSummary>) => {
      const data = getDB();
      data.students = data.students.map((s: StudentSummary) => s.id === id ? { ...s, ...updates } : s);
      await saveDB(data, `Data siswa diperbarui: ${updates.name || id}`);
    },
    updateBulk: async (ids: string[], updates: Partial<StudentSummary>) => {
      const data = getDB();
      data.students = data.students.map((s: StudentSummary) => ids.includes(s.id) ? { ...s, ...updates } : s);
      await saveDB(data, `${ids.length} data siswa diperbarui massal`);
    },
    delete: async (id: string) => {
      const data = getDB();
      const student = data.students.find((s: StudentSummary) => s.id === id);
      data.students = data.students.filter((s: StudentSummary) => s.id !== id);

      if (data.grades) {
        Object.keys(data.grades).forEach(subjId => {
          if (data.grades[subjId][id]) delete data.grades[subjId][id];
        });
      }
      if (data.attendance) {
        Object.keys(data.attendance).forEach(date => {
          if (data.attendance[date][id]) delete data.attendance[date][id];
        });
      }
      if (data.behaviorLogs) {
        data.behaviorLogs = data.behaviorLogs.filter((l: any) => l.studentId !== id);
      }

      await saveDB(data, `Data siswa dihapus: ${student?.name || id}`);
    },
    deleteBulk: async (ids: string[]) => {
      const data = getDB();
      data.students = data.students.filter((s: StudentSummary) => !ids.includes(s.id));

      if (data.grades) {
        Object.keys(data.grades).forEach(subjId => {
          ids.forEach(id => {
            if (data.grades[subjId][id]) delete data.grades[subjId][id];
          });
        });
      }
      if (data.attendance) {
        Object.keys(data.attendance).forEach(date => {
          ids.forEach(id => {
            if (data.attendance[date][id]) delete data.attendance[date][id];
          });
        });
      }
      if (data.behaviorLogs) {
        data.behaviorLogs = data.behaviorLogs.filter((l: any) => !ids.includes(l.studentId));
      }

      await saveDB(data, `${ids.length} data siswa dihapus massal`);
    },
    importBulk: async (newStudents: StudentSummary[]) => {
      const data = getDB();
      data.students = [...(data.students || []), ...newStudents];
      await saveDB(data, `Import massal ${newStudents.length} siswa berhasil`);
    }
  },
  grades: {
    getAll: () => getDB().grades || {},
    saveBulk: async (academicYear: string, semester: string, subjectId: string, gradesData: any) => {
      const data = getDB();
      if (!data.grades) data.grades = {};
      const key = `${academicYear}_${semester}_${subjectId}`;
      data.grades[key] = { ...(data.grades[key] || {}), ...gradesData };
      await saveDB(data, `Nilai massal berhasil disimpan untuk mapel ID: ${subjectId} (${semester})`);
    },
    deleteBySubject: async (academicYear: string, semester: string, subjectId: string) => {
      const data = getDB();
      if (!data.grades) return;
      const gradeKey = `${academicYear}_${semester}_${subjectId}`;
      delete data.grades[gradeKey];
      // Also delete related daily grades for all classes
      if (data.dailyGrades) {
        const keysToDelete = Object.keys(data.dailyGrades).filter(k =>
          k.startsWith(`${academicYear}_${semester}_`) && k.endsWith(`_${subjectId}`)
        );
        keysToDelete.forEach(k => delete data.dailyGrades[k]);
      }
      await saveDB(data, `Seluruh data nilai mapel (${subjectId}) pada ${academicYear} ${semester} telah dihapus`);
    }
  },
  academicYears: {
    getAll: (): string[] => {
      const data = getDB();
      const years = new Set<string>();
      // Default base years
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const defaultYearStr = currentMonth >= 7
        ? `${currentYear}/${currentYear + 1}`
        : `${currentYear - 1}/${currentYear}`;
      years.add(defaultYearStr);
      // Custom saved years
      if (data.academicYears) {
        (data.academicYears as string[]).forEach((y: string) => years.add(y));
      }
      // Discover from existing data
      const discoverFromKeys = (obj: Record<string, any>) => {
        if (!obj) return;
        Object.keys(obj).forEach(key => {
          const match = key.match(/^(\d{4}\/\d{4})_/);
          if (match) years.add(match[1]);
        });
      };
      discoverFromKeys(data.grades);
      discoverFromKeys(data.dailyGrades);
      discoverFromKeys(data.attendance);
      // Sort descending
      return Array.from(years).sort((a, b) => {
        const ya = parseInt(a.split('/')[0]);
        const yb = parseInt(b.split('/')[0]);
        return yb - ya;
      });
    },
    add: async (year: string) => {
      const data = getDB();
      if (!data.academicYears) data.academicYears = [];
      if (!data.academicYears.includes(year)) {
        data.academicYears.push(year);
        await saveDB(data, `Tahun ajaran baru ditambahkan: ${year}`);
      }
    },
    remove: async (year: string) => {
      const data = getDB();
      if (!data.academicYears) return;
      data.academicYears = data.academicYears.filter((y: string) => y !== year);
      await saveDB(data, `Tahun ajaran dihapus: ${year}`);
    }
  },
  dailyGrades: {
    getByClassAndSubject: (academicYear: string, semester: string, classId: string, subjectId: string) => {
      const dbData = getDB();
      const key = `${academicYear}_${semester}_${classId}_${subjectId}`;
      return dbData.dailyGrades?.[key] || { columns: [], records: {}, isLocked: false };
    },
    saveBulk: async (academicYear: string, semester: string, classId: string, subjectId: string, dailyData: any) => {
      const data = getDB();
      if (!data.dailyGrades) data.dailyGrades = {};
      const key = `${academicYear}_${semester}_${classId}_${subjectId}`;
      data.dailyGrades[key] = dailyData;
      await saveDB(data, `Nilai harian berhasil disimpan untuk kelas: ${classId}, mapel: ${subjectId} (${semester})`);
    },
    toggleLock: async (academicYear: string, semester: string, classId: string, subjectId: string, isLocked: boolean) => {
      const data = getDB();
      if (!data.dailyGrades) data.dailyGrades = {};
      const key = `${academicYear}_${semester}_${classId}_${subjectId}`;
      if (!data.dailyGrades[key]) {
         data.dailyGrades[key] = { columns: [], records: {}, isLocked: false };
      }
      data.dailyGrades[key].isLocked = isLocked;
      await saveDB(data, isLocked ? `Tabel nilai harian dikunci` : `Tabel nilai harian dibuka`);
    }
  },
  attendance: {
    saveDaily: async (academicYear: string, semester: string, date: string, attendanceData: any) => {
      const data = getDB();
      if (!data.attendance) data.attendance = {};
      const key = `${academicYear}_${semester}_${date}`;
      data.attendance[key] = attendanceData;
      await saveDB(data, `Presensi massal tanggal ${date} disimpan (${semester})`);
    },
    updateSingle: async (academicYear: string, semester: string, date: string, studentId: string, attendanceData: any) => {
      const data = getDB();
      if (!data.attendance) data.attendance = {};
      
      let targetSemester = semester;
      if (semester === 'Satu Tahun') {
        const dateObj = new Date(date);
        const m = dateObj.getMonth() + 1;
        targetSemester = (m >= 7) ? 'Ganjil' : 'Genap';
      }
      
      const key = `${academicYear}_${targetSemester}_${date}`;
      const legacyKey = date;
      
      if (data.attendance[key]) {
        data.attendance[key][studentId] = attendanceData;
      } else if (data.attendance[legacyKey]) {
        data.attendance[legacyKey][studentId] = attendanceData;
      } else {
        data.attendance[key] = {};
        data.attendance[key][studentId] = attendanceData;
      }
      await saveDB(data, `Data presensi diperbarui untuk tanggal ${date} (${targetSemester})`);
    },
    updateBulk: async (academicYear: string, semester: string, records: { date: string, studentId: string }[], updates: { status: string, lateMinutes: number }) => {
      const data = getDB();
      if (!data.attendance) data.attendance = {};
      records.forEach(({ date, studentId }) => {
        let targetSemester = semester;
        if (semester === 'Satu Tahun') {
          const dateObj = new Date(date);
          const m = dateObj.getMonth() + 1;
          targetSemester = (m >= 7) ? 'Ganjil' : 'Genap';
        }
        
        const key = `${academicYear}_${targetSemester}_${date}`;
        const legacyKey = date;
        
        if (data.attendance[key]) {
          data.attendance[key][studentId] = { ...data.attendance[key][studentId], ...updates };
        } else if (data.attendance[legacyKey]) {
          data.attendance[legacyKey][studentId] = { ...data.attendance[legacyKey][studentId], ...updates };
        } else {
          data.attendance[key] = {};
          data.attendance[key][studentId] = updates;
        }
      });
      await saveDB(data, `${records.length} data presensi diperbarui massal`);
    },
    deleteBulk: async (academicYear: string, semester: string, records: { date: string, studentId: string }[]) => {
      const data = getDB();
      if (!data.attendance) return;
      records.forEach(({ date, studentId }) => {
        const semestersToTry = semester === 'Satu Tahun' ? ['Ganjil', 'Genap'] : [semester];
        semestersToTry.forEach(sem => {
          const key = `${academicYear}_${sem}_${date}`;
          if (data.attendance[key]) {
            delete data.attendance[key][studentId];
            if (Object.keys(data.attendance[key]).length === 0) {
              delete data.attendance[key];
            }
          }
        });
        
        const legacyKey = date;
        if (data.attendance[legacyKey]) {
          delete data.attendance[legacyKey][studentId];
          if (Object.keys(data.attendance[legacyKey]).length === 0) {
            delete data.attendance[legacyKey];
          }
        }
      });
      await saveDB(data, `${records.length} data presensi dihapus`);
    },
    importBulk: async (academicYear: string, semester: string, records: { date: string, studentId: string, status: string, lateMinutes: number }[]) => {
      const data = getDB();
      if (!data.attendance) data.attendance = {};
      records.forEach(r => {
        let targetSemester = semester;
        if (semester === 'Satu Tahun') {
          const dateObj = new Date(r.date);
          const m = dateObj.getMonth() + 1;
          targetSemester = (m >= 7) ? 'Ganjil' : 'Genap';
        }
        const key = `${academicYear}_${targetSemester}_${r.date}`;
        if (!data.attendance[key]) data.attendance[key] = {};
        data.attendance[key][r.studentId] = { status: r.status, lateMinutes: r.lateMinutes };
      });
      await saveDB(data, `Import massal ${records.length} data presensi berhasil`);
    }
  },
  behavior: {
    getAll: () => getDB().behaviorLogs || [],
    add: async (log: any) => {
      const data = getDB();
      data.behaviorLogs = [log, ...(data.behaviorLogs || [])];
      await saveDB(data, `Log perilaku ditambahkan untuk ${log.studentName}`);
    },
    delete: async (id: string) => {
      const data = getDB();
      data.behaviorLogs = (data.behaviorLogs || []).filter((l: any) => l.id !== id);
      await saveDB(data, `Log perilaku dihapus`);
    }
  },
  systemLogs: {
    getAll: () => getDB().systemLogs || [],
    clearAll: async () => {
      const data = getDB();
      data.systemLogs = [];
      await saveDB(data, `Semua log sistem dibersihkan`);
    }
  },
  notifications: {
    getAll: () => getDB().notifications || [],
    markAllRead: async () => {
      const data = getDB();
      data.notifications = (data.notifications || []).map((n: any) => ({ ...n, read: true }));
      await saveDB(data, '');
    }
  },
  system: {
    getBackupData: () => {
      return getDB();
    },
    importBackup: async (backupData: any) => {
      if (!backupData || typeof backupData !== 'object') {
        throw new Error("Data backup tidak valid (harus berupa objek JSON).");
      }
      const requiredKeys = ['users', 'classes', 'subjects', 'students'];
      const missingKeys = requiredKeys.filter(key => !(key in backupData));
      if (missingKeys.length > 0) {
        throw new Error(`Data backup tidak lengkap. Key berikut tidak ditemukan: ${missingKeys.join(', ')}`);
      }
      await saveDB(backupData, "Database dipulihkan dari berkas cadangan");
    }
  }
};
