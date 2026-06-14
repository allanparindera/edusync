import React, { useState, useMemo } from 'react';
import { 
  Users, UserCheck, Clock, GraduationCap, Search, Filter, 
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, Award, AlertCircle, AlertTriangle, BookOpen,
  CheckCircle2, TrendingUp
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ReferenceLine, LabelList
} from 'recharts';
import { mockAttendanceData, mockTardinessData } from '../mockData.ts';
import { StudentSummary, ClassData } from '../types.ts';
import { StudentModal } from './StudentModal.tsx';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { authService } from '../services/auth.ts';
import { db } from '../services/db.ts';

export const Dashboard: React.FC = () => {
  const dbData = useRealtimeDB();
  const currentUser = authService.getCurrentUser();
  const allStudents: StudentSummary[] = (dbData.students || []).filter(Boolean);
  const classes: ClassData[] = (dbData.classes || []).filter(Boolean);
  
  // State Filter Utama
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State UI
  const [activeTab, setActiveTab] = useState<'overview' | 'academic' | 'attendance'>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // State Khusus Siswa & Global Filter
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const defaultSemester = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const defaultYearStr = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  // Dynamic Academic Years
  const availableYears = useMemo(() => db.academicYears.getAll(), [dbData]);

  const [studentAcademicYear, setStudentAcademicYear] = useState<string>(() => {
    const years = db.academicYears.getAll();
    return years[0] || defaultYearStr;
  });
  const [studentSemester, setStudentSemester] = useState<string>(defaultSemester);

  // Sorting State untuk Tabel Siswa
  const [sortConfig, setSortConfig] = useState<{key: keyof StudentSummary, direction: 'asc' | 'desc'} | null>(null);


  // Helper for period stats
  const getPeriodStats = (s: StudentSummary) => {
    if (!s) return null;
    
    if (studentSemester === 'Satu Tahun') {
      const ganjilKey = `${studentAcademicYear}_Ganjil`;
      const genapKey = `${studentAcademicYear}_Genap`;
      const ganjilStats = s.periodStats?.[ganjilKey];
      const genapStats = s.periodStats?.[genapKey];
      
      if (!ganjilStats && !genapStats) {
        return {
          averageGrade: 0, totalScore: 0, rank: 0, behaviorScore: 0, attendanceRate: 100, totalLateMinutes: 0,
          competencies: [], attendanceDetails: { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
        };
      }
      
      const attDetails = {
        hadir: (ganjilStats?.attendanceDetails?.hadir || 0) + (genapStats?.attendanceDetails?.hadir || 0),
        terlambat: (ganjilStats?.attendanceDetails?.terlambat || 0) + (genapStats?.attendanceDetails?.terlambat || 0),
        izin: (ganjilStats?.attendanceDetails?.izin || 0) + (genapStats?.attendanceDetails?.izin || 0),
        sakit: (ganjilStats?.attendanceDetails?.sakit || 0) + (genapStats?.attendanceDetails?.sakit || 0),
        alpa: (ganjilStats?.attendanceDetails?.alpa || 0) + (genapStats?.attendanceDetails?.alpa || 0),
        total: (ganjilStats?.attendanceDetails?.total || 0) + (genapStats?.attendanceDetails?.total || 0),
      };
      
      const attendanceRate = attDetails.total > 0 
        ? Math.round(((attDetails.hadir + attDetails.terlambat) / attDetails.total) * 100) 
        : 100;
        
      const compMap: Record<string, { scoreSum: number; count: number }> = {};
      const addComps = (comps: any[]) => {
        if (!comps) return;
        comps.forEach(c => {
          if (!compMap[c.subject]) compMap[c.subject] = { scoreSum: 0, count: 0 };
          compMap[c.subject].scoreSum += c.score;
          compMap[c.subject].count++;
        });
      };
      addComps(ganjilStats?.competencies || []);
      addComps(genapStats?.competencies || []);
      
      const competencies = Object.keys(compMap).map(subject => ({
        subject,
        score: Math.round(compMap[subject].scoreSum / compMap[subject].count),
        fullMark: 100
      }));
      
      const totalScore = competencies.reduce((acc, c) => acc + c.score, 0);
      const averageGrade = competencies.length > 0 ? parseFloat((totalScore / competencies.length).toFixed(1)) : 0;
      
      return {
        averageGrade,
        totalScore,
        rank: 0, // calculated dynamically later
        behaviorScore: (ganjilStats?.behaviorScore || 0) + (genapStats?.behaviorScore || 0),
        attendanceRate,
        totalLateMinutes: (ganjilStats?.totalLateMinutes || 0) + (genapStats?.totalLateMinutes || 0),
        competencies,
        attendanceDetails: attDetails
      };
    }
    
    const periodKey = `${studentAcademicYear}_${studentSemester}`;
    return s.periodStats?.[periodKey] || {
      averageGrade: 0, totalScore: 0, rank: 0, behaviorScore: 0, attendanceRate: 100, totalLateMinutes: 0,
      competencies: [], attendanceDetails: { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
    };
  };

  // 1. Data Isolation & Filtering Siswa berdasarkan Kelas/Peran
  const students = useMemo(() => {
    if (!currentUser) return [];
    let filtered = allStudents;
    
    if (currentUser.role === 'Guru') {
      filtered = filtered.filter(s => s && s.classId === currentUser.classId);
    } else if (currentUser.role === 'Ortu/Siswa') {
      filtered = filtered.filter(s => s && s.id === currentUser.studentId);
    } else if (currentUser.role === 'Admin' && selectedClass !== 'all') {
      filtered = filtered.filter(s => s && s.classId === selectedClass);
    }
    
    return filtered;
  }, [allStudents, currentUser, selectedClass]);

  // 2. Filter Tanggal Presensi Berdasarkan Semester & Tahun Ajaran
  const filteredDates = useMemo(() => {
    const keys = Object.keys(dbData.attendance || {}).sort();
    
    return keys.filter(key => {
      const parts = key.split('_');
      let year = studentAcademicYear;
      let sem = studentSemester;
      let dateStr = key;
      
      if (parts.length >= 3) {
        year = parts[0];
        sem = parts[1];
        dateStr = parts[2];
      }
      
      if (year !== studentAcademicYear) return false;
      if (studentSemester !== 'Satu Tahun' && sem !== studentSemester) return false;
      
      const recordDate = new Date(dateStr);
      if (isNaN(recordDate.getTime())) return false;
      
      const month = recordDate.getMonth() + 1;
      if (studentSemester === 'Ganjil') return month >= 7 && month <= 12;
      if (studentSemester === 'Genap') return month >= 1 && month <= 6;
      return true; // Satu Tahun
    });
  }, [dbData.attendance, studentAcademicYear, studentSemester]);

  // 3. Dynamic Charts Calculation
  const { dynamicAttendanceData, dynamicTardinessData } = useMemo(() => {
    const dates = filteredDates.slice(-30); // Batasi maks 30 hari untuk visualisasi chart
    
    const attData = dates.map(date => {
      const dayData = dbData.attendance[date] || {};
      const rawDate = date.slice(date.lastIndexOf('_') + 1);
      const [,mm,dd] = rawDate.split('-');
      const label = mm && dd ? `${dd}/${mm}` : rawDate.slice(5);
      const summary = { name: label, Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
      
      students.forEach(s => {
        if (!s) return;
        const rec = dayData[s.id];
        if (rec && rec.status in summary) {
          summary[rec.status as keyof typeof summary]++;
        }
      });
      return summary;
    });

    const tardData = dates.map(date => {
      const dayData = dbData.attendance[date] || {};
      const rawDate = date.slice(date.lastIndexOf('_') + 1);
      const [,mm,dd] = rawDate.split('-');
      const label = mm && dd ? `${dd}/${mm}` : rawDate.slice(5);
      let totalMinutes = 0;
      students.forEach(s => {
        if (!s) return;
        if (dayData[s.id]?.lateMinutes) {
          totalMinutes += dayData[s.id].lateMinutes;
        }
      });
      return { name: label, Menit: totalMinutes };
    });

    return {
      dynamicAttendanceData: attData.length > 0 ? attData : mockAttendanceData,
      dynamicTardinessData: tardData.length > 0 ? tardData : mockTardinessData
    };
  }, [filteredDates, dbData.attendance, students]);

  // 4. Diagram Pai Distribusi Status Presensi
  const attendanceDistribution = useMemo(() => {
    const counts = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    filteredDates.forEach(date => {
      const dayData = dbData.attendance[date] || {};
      students.forEach(s => {
        if (!s) return;
        const rec = dayData[s.id];
        if (rec && rec.status in counts) {
          counts[rec.status as keyof typeof counts]++;
        }
      });
    });

    return [
      { name: 'Hadir', value: counts.Hadir, color: '#22c55e' },
      { name: 'Terlambat', value: counts.Terlambat, color: '#f97316' },
      { name: 'Izin', value: counts.Izin, color: '#3b82f6' },
      { name: 'Sakit', value: counts.Sakit, color: '#eab308' },
      { name: 'Alpa', value: counts.Alpa, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [filteredDates, dbData.attendance, students]);

  // 5. Grafik Sebaran Predikat Nilai (A, B, C, D)
  const gradeDistribution = useMemo(() => {
    const ranges = {
      'Predikat A (>=90)': 0,
      'Predikat B (80-89)': 0,
      'Predikat C (70-79)': 0,
      'Predikat D (<70)': 0,
    };

    students.forEach(s => {
      if (!s) return;
      const stats = getPeriodStats(s);
      const grade = stats?.averageGrade || 0;
      if (grade >= 90) ranges['Predikat A (>=90)']++;
      else if (grade >= 80) ranges['Predikat B (80-89)']++;
      else if (grade >= 70) ranges['Predikat C (70-79)']++;
      else ranges['Predikat D (<70)']++;
    });

    return Object.keys(ranges).map(key => ({
      name: key.split(' ')[1] || key,
      Jumlah: ranges[key as keyof typeof ranges],
    }));
  }, [students, studentAcademicYear, studentSemester]);

  // 6. Rata-rata Nilai Per Mata Pelajaran
  const subjectPerformance = useMemo(() => {
    const subjectScores: Record<string, { total: number; count: number }> = {};
    
    students.forEach(s => {
      const stats = getPeriodStats(s);
      if (!stats || !stats.competencies) return;
      stats.competencies.forEach((c: any) => {
        if (!subjectScores[c.subject]) {
          subjectScores[c.subject] = { total: 0, count: 0 };
        }
        subjectScores[c.subject].total += c.score;
        subjectScores[c.subject].count++;
      });
    });

    return Object.keys(subjectScores).map(subject => ({
      name: subject,
      RataRata: parseFloat((subjectScores[subject].total / subjectScores[subject].count).toFixed(1)),
    })).sort((a, b) => b.RataRata - a.RataRata);
  }, [students, studentAcademicYear, studentSemester]);

  // 7. Dynamic Metrics Calculations
  const metrics = useMemo(() => {
    const activeStudents = students.filter(s => s && s.status === 'Aktif').length;
    const totalGrades = students.reduce((acc, s) => acc + (getPeriodStats(s)?.averageGrade || 0), 0);
    const avgGrade = activeStudents > 0 ? (totalGrades / activeStudents).toFixed(1) : '0.0';

    // Rata-rata kehadiran di rentang tanggal yang dipilih
    let totalPresentRate = 0;
    let studentsWithAtt = 0;
    students.forEach(s => {
      if (!s) return;
      const stats = getPeriodStats(s);
      totalPresentRate += stats?.attendanceRate || 0;
      studentsWithAtt++;
    });
    const avgAttendance = studentsWithAtt > 0 ? Math.round(totalPresentRate / studentsWithAtt) : 100;

    // Total menit terlambat di rentang waktu terpilih
    let totalLate = 0;
    filteredDates.forEach(date => {
      const dayData = dbData.attendance[date] || {};
      students.forEach(s => {
        if (!s) return;
        if (dayData[s.id]?.lateMinutes) {
          totalLate += dayData[s.id].lateMinutes;
        }
      });
    });

    return {
      totalActiveStudents: activeStudents,
      avgAttendanceRate: avgAttendance, 
      totalLateMinutes: totalLate,
      averageClassGrade: avgGrade,
    };
  }, [students, filteredDates, dbData.attendance, studentAcademicYear, studentSemester]);

  // 8. Smart Insights Lists
  const topStudents = useMemo(() => {
    return [...students]
      .filter(s => s && getPeriodStats(s)?.averageGrade !== undefined)
      .sort((a, b) => (getPeriodStats(b)?.averageGrade || 0) - (getPeriodStats(a)?.averageGrade || 0))
      .slice(0, 3);
  }, [students, studentAcademicYear, studentSemester]);

  const academicWarnings = useMemo(() => {
    return [...students]
      .filter(s => s && (getPeriodStats(s)?.averageGrade ?? 0) < 70)
      .sort((a, b) => (getPeriodStats(a)?.averageGrade || 0) - (getPeriodStats(b)?.averageGrade || 0));
  }, [students, studentAcademicYear, studentSemester]);

  const attendanceWarnings = useMemo(() => {
    return [...students]
      .filter(s => s && (getPeriodStats(s)?.attendanceRate ?? 0) < 85)
      .sort((a, b) => (getPeriodStats(a)?.attendanceRate || 0) - (getPeriodStats(b)?.attendanceRate || 0));
  }, [students, studentAcademicYear, studentSemester]);

  const tardinessLeaders = useMemo(() => {
    return [...students]
      .filter(s => s && (getPeriodStats(s)?.totalLateMinutes ?? 0) > 0)
      .sort((a, b) => (getPeriodStats(b)?.totalLateMinutes || 0) - (getPeriodStats(a)?.totalLateMinutes || 0))
      .slice(0, 3);
  }, [students, studentAcademicYear, studentSemester]);

  // Dynamic ranking map
  const studentRankMap = useMemo(() => {
    const studentScores = students.map(s => {
      const stats = getPeriodStats(s);
      return { id: s.id, score: stats?.totalScore || 0 };
    });
    studentScores.sort((a, b) => b.score - a.score);
    const ranks: Record<string, number> = {};
    let currentRank = 1;
    let currentScore = -1;
    studentScores.forEach((item, index) => {
      if (item.score !== currentScore) {
        currentRank = index + 1;
        currentScore = item.score;
      }
      ranks[item.id] = currentRank;
    });
    return ranks;
  }, [students, studentAcademicYear, studentSemester]);

  // Get the freshest student object for the modal
  const selectedStudent = useMemo(() => {
    return students.find(s => s && s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // SAFE FILTERING: Mencegah crash jika s.name atau s.nis undefined
  const filteredStudents = students.filter(s => {
    if (!s) return false;
    const name = s.name || '';
    const nis = s.nis || '';
    const search = searchTerm.toLowerCase();
    return name.toLowerCase().includes(search) || nis.toLowerCase().includes(search);
  });

  // Sorting Logic
  const sortedStudents = useMemo(() => {
    let sortableItems = [...filteredStudents];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        if (sortConfig.key === 'averageGrade') {
          aValue = getPeriodStats(a)?.averageGrade ?? 0;
          bValue = getPeriodStats(b)?.averageGrade ?? 0;
        } else if (sortConfig.key === 'rank') {
          aValue = studentRankMap[a.id] ?? 999;
          bValue = studentRankMap[b.id] ?? 999;
        } else if (sortConfig.key === 'behaviorScore') {
          aValue = getPeriodStats(a)?.behaviorScore ?? 0;
          bValue = getPeriodStats(b)?.behaviorScore ?? 0;
        } else if (sortConfig.key === 'totalLateMinutes') {
          aValue = getPeriodStats(a)?.totalLateMinutes ?? 0;
          bValue = getPeriodStats(b)?.totalLateMinutes ?? 0;
        } else if (sortConfig.key === 'attendanceRate') {
          aValue = getPeriodStats(a)?.attendanceRate ?? 100;
          bValue = getPeriodStats(b)?.attendanceRate ?? 100;
        } else {
          aValue = a[sortConfig.key] ?? '';
          bValue = b[sortConfig.key] ?? '';
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredStudents, sortConfig, studentAcademicYear, studentSemester, studentRankMap]);

  const handleSort = (key: keyof StudentSummary) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof StudentSummary }) => {
    if (sortConfig?.key === columnKey) {
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
    }
    return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
  };

  // If Ortu/Siswa, show a simplified dashboard focused on their data
  if (currentUser?.role === 'Ortu/Siswa') {
    const myData = students[0];
    if (!myData) return <div className="p-8 text-center text-muted-foreground">Data siswa tidak ditemukan.</div>;

    const classStudentsOfSelected = allStudents.filter(s => s && s.classId === myData.classId);
    const classAvg = classStudentsOfSelected.length > 0
      ? classStudentsOfSelected.reduce((a, s) => a + (getPeriodStats(s)?.averageGrade || 0), 0) / classStudentsOfSelected.length
      : 0;
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight mb-2 sm:mb-0">Rapor & Analitik: {myData.name}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/50 border border-border/70 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-xs bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={studentAcademicYear}
                onChange={(e) => setStudentAcademicYear(e.target.value)}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>Tahun Ajaran {y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 border border-border/70 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-xs bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={studentSemester}
                onChange={(e) => setStudentSemester(e.target.value)}
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
                <option value="Satu Tahun">Satu Tahun Penuh</option>
              </select>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
           <StudentModal 
             student={myData} 
             onClose={() => {}} 
             isEmbedded={true} 
             classStudentCount={classStudentsOfSelected.length}
             classAverageGrade={parseFloat(classAvg.toFixed(1))}
             academicYear={studentAcademicYear}
             semester={studentSemester}
           />
        </div>
      </div>
    );
  }

  const classStudentsOfSelected = useMemo(() => {
    if (!selectedStudent) return [];
    return allStudents.filter(s => s && s.classId === selectedStudent.classId);
  }, [allStudents, selectedStudent]);

  const classAverageForSelected = useMemo(() => {
    if (classStudentsOfSelected.length === 0) return 0;
    const total = classStudentsOfSelected.reduce((acc, s) => acc + (getPeriodStats(s)?.averageGrade || 0), 0);
    return parseFloat((total / classStudentsOfSelected.length).toFixed(1));
  }, [classStudentsOfSelected, studentAcademicYear, studentSemester]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Filters */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-card border border-border rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Dashboard Analitik</h2>
          <p className="text-xs text-muted-foreground">
            T.A. <strong>{studentAcademicYear}</strong> &middot; Sem. <strong>{studentSemester}</strong>
            {currentUser?.role === 'Admin' && selectedClass !== 'all' && ` · ${classes.find(c => c && c.id === selectedClass)?.name || ''}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tahun Ajaran */}
          <div className="flex items-center gap-2 bg-muted/50 border border-border/70 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              className="text-xs bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
              value={studentAcademicYear}
              onChange={(e) => setStudentAcademicYear(e.target.value)}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>T.A. {y}</option>
              ))}
            </select>
          </div>

          {/* Semester — pill buttons */}
          <div className="flex items-center gap-1 bg-muted/50 border border-border/70 rounded-lg p-1">
            {(['Ganjil', 'Genap', 'Satu Tahun'] as const).map(sem => (
              <button
                key={sem}
                onClick={() => setStudentSemester(sem)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  studentSemester === sem
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {sem === 'Satu Tahun' ? 'Full Year' : `Sem. ${sem}`}
              </button>
            ))}
          </div>

          {/* Admin kelas filter */}
          {currentUser?.role === 'Admin' && (
            <div className="flex items-center gap-2 bg-muted/50 border border-border/70 rounded-lg px-3 py-1.5">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                className="text-xs bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => c && <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Navigasi Tab Analitik */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <TrendingUp className="w-4 h-4" /> Ringkasan Umum
        </button>
        <button
          onClick={() => setActiveTab('academic')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'academic' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <GraduationCap className="w-4 h-4" /> Analisis Akademik
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'attendance' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <UserCheck className="w-4 h-4" /> Kehadiran & Disiplin
        </button>
      </div>

      {/* TAB 1: RINGKASAN UMUM */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Smart Alert Insights — dipindah ke atas sebagai prioritas utama */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Students */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-bold">🏆 Bintang Kelas</span>
              </div>
              <div className="space-y-2">
                {topStudents.length > 0 ? topStudents.map((s, idx) => (
                  <div key={s.id} className="flex justify-between items-center">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        idx === 0 ? 'bg-yellow-500 text-yellow-950' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-amber-600 text-amber-950'
                      }`}>{idx + 1}</span>
                      <span className="truncate max-w-[130px]">{s.name}</span>
                    </span>
                    <span className="text-xs font-bold text-yellow-600 shrink-0">{getPeriodStats(s)?.averageGrade || 0}</span>
                  </div>
                )) : <p className="text-xs text-muted-foreground italic">Belum ada data nilai.</p>}
              </div>
            </div>

            {/* Academic Warnings */}
            <div className={`border rounded-xl p-4 ${
              academicWarnings.length > 0
                ? 'bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20'
                : 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={`w-4 h-4 ${academicWarnings.length > 0 ? 'text-destructive' : 'text-green-500'}`} />
                <span className="text-sm font-bold">
                  {academicWarnings.length > 0 ? `⚠️ ${academicWarnings.length} Butuh Bimbingan` : '✅ Nilai Semua Aman'}
                </span>
              </div>
              {academicWarnings.length > 0 ? (
                <div className="space-y-1.5">
                  {academicWarnings.slice(0, 3).map(s => (
                    <div key={s.id} className="flex justify-between text-xs">
                      <span className="font-medium truncate max-w-[130px]">{s.name}</span>
                      <span className="font-bold text-destructive shrink-0">{getPeriodStats(s)?.averageGrade || 0}</span>
                    </div>
                  ))}
                  {academicWarnings.length > 3 && <p className="text-[10px] text-muted-foreground">+{academicWarnings.length - 3} siswa lainnya</p>}
                </div>
              ) : <p className="text-xs text-green-600 font-medium">Semua siswa di atas KKM 70 🎉</p>}
            </div>

            {/* Tardiness */}
            <div className={`border rounded-xl p-4 ${
              tardinessLeaders.length > 0
                ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20'
                : 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <Clock className={`w-4 h-4 ${tardinessLeaders.length > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                <span className="text-sm font-bold">
                  {tardinessLeaders.length > 0 ? '⏰ Sering Terlambat' : '✅ Disiplin Sempurna'}
                </span>
              </div>
              {tardinessLeaders.length > 0 ? (
                <div className="space-y-1.5">
                  {tardinessLeaders.map((s, idx) => (
                    <div key={s.id} className="flex justify-between text-xs">
                      <span className="font-medium truncate max-w-[130px]">{idx + 1}. {s.name}</span>
                      <span className="font-bold text-amber-600 shrink-0">{getPeriodStats(s)?.totalLateMinutes || 0} mnt</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-green-600 font-medium">Tidak ada keterlambatan 🎉</p>}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Siswa Aktif"
              value={metrics.totalActiveStudents.toString()}
              icon={<Users className="w-5 h-5 text-blue-500" />}
              statusLabel={currentUser?.role === 'Guru' ? `Kelas ${classes.find(c => c && c.id === currentUser.classId)?.name || ''}` : selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${classes.find(c => c && c.id === selectedClass)?.name || ''}`}
              statusColor="blue"
            />
            <MetricCard
              title="Rata-rata Presensi"
              value={`${metrics.avgAttendanceRate}%`}
              icon={<UserCheck className="w-5 h-5 text-green-500" />}
              statusLabel={metrics.avgAttendanceRate >= 90 ? '✅ Sangat Baik' : metrics.avgAttendanceRate >= 80 ? '⚠️ Perlu Perhatian' : '🚨 Kritis'}
              statusColor={metrics.avgAttendanceRate >= 90 ? 'green' : metrics.avgAttendanceRate >= 80 ? 'yellow' : 'red'}
              progressValue={metrics.avgAttendanceRate}
            />
            <MetricCard
              title="Total Terlambat"
              value={`${metrics.totalLateMinutes} mnt`}
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              statusLabel={metrics.totalLateMinutes === 0 ? '✅ Tidak Ada Keterlambatan' : metrics.totalLateMinutes <= 60 ? '⚠️ Perlu Diawasi' : '🚨 Butuh Tindakan'}
              statusColor={metrics.totalLateMinutes === 0 ? 'green' : metrics.totalLateMinutes <= 60 ? 'yellow' : 'red'}
            />
            <MetricCard
              title="Rata-rata Nilai"
              value={metrics.averageClassGrade.toString()}
              icon={<GraduationCap className="w-5 h-5 text-purple-500" />}
              statusLabel={parseFloat(metrics.averageClassGrade.toString()) >= 80 ? '✅ Di Atas Standar' : parseFloat(metrics.averageClassGrade.toString()) >= 70 ? '⚠️ Di Atas KKM' : '🚨 Di Bawah KKM'}
              statusColor={parseFloat(metrics.averageClassGrade.toString()) >= 80 ? 'green' : parseFloat(metrics.averageClassGrade.toString()) >= 70 ? 'yellow' : 'red'}
              progressValue={parseFloat(metrics.averageClassGrade.toString())}
            />
          </div>

          {/* Charts & Smart Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts Column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><UserCheck className="w-4 h-4 text-primary" /> Kehadiran Harian</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dynamicAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="Hadir" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="Terlambat" stackId="a" fill="#f97316" />
                      <Bar dataKey="Izin" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Sakit" stackId="a" fill="#eab308" />
                      <Bar dataKey="Alpa" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Student Table Section */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-base font-bold">Daftar Siswa & Ringkasan Performa</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Cari nama atau NIS..." 
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-input rounded-md focus:outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('name')}>
                      Siswa <SortIcon columnKey="name" />
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('attendanceRate')}>
                      Kehadiran <SortIcon columnKey="attendanceRate" />
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('totalLateMinutes')}>
                      Keterlambatan <SortIcon columnKey="totalLateMinutes" />
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('averageGrade')}>
                      Rata-rata Nilai <SortIcon columnKey="averageGrade" />
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('behaviorScore')}>
                      Perilaku <SortIcon columnKey="behaviorScore" />
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('rank')}>
                      Peringkat <SortIcon columnKey="rank" />
                    </th>
                    <th className="px-6 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedStudents.map((student) => {
                    if (!student) return null;
                    const stats = getPeriodStats(student);
                    const attRate = stats?.attendanceRate ?? 100;
                    const lateMins = stats?.totalLateMinutes ?? 0;
                    const avgGrade = stats?.averageGrade ?? 0;
                    const behScore = stats?.behaviorScore ?? 0;
                    const rankVal = studentRankMap[student.id] ?? 0;
                    return (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
                          <img src={student.avatarUrl} alt={student.name} className="w-7 h-7 rounded-full object-cover" />
                          <div>
                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">{student.name}</div>
                            <div className="text-[10px] text-muted-foreground">{student.nis} • {classes.find(c => c && c.id === student.classId)?.name || student.classId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-muted rounded-full h-1.5 max-w-[50px]">
                            <div className={`h-1.5 rounded-full ${attRate > 90 ? 'bg-green-500' : attRate > 75 ? 'bg-amber-500' : 'bg-destructive'}`} style={{ width: `${attRate}%` }}></div>
                          </div>
                          <span>{attRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lateMins > 60 ? 'bg-destructive/10 text-destructive' : lateMins > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'}`}>
                          {lateMins} mnt
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-foreground">
                        {avgGrade}
                      </td>
                      <td className="px-6 py-3.5">
                         <span className={`font-semibold ${behScore < 0 ? 'text-destructive' : behScore > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {behScore > 0 ? '+' : ''}{behScore}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-primary">
                        #{rankVal || '-'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button 
                          onClick={() => setSelectedStudentId(student.id)}
                          className="text-primary hover:underline text-xs font-semibold"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  )})}
                  {sortedStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-xs">
                        Tidak ada data siswa yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANALISIS AKADEMIK */}
      {activeTab === 'academic' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Academic Sub-Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs text-center">
              <span className="text-xs text-muted-foreground block mb-1">Rata-rata Nilai Kelas</span>
              <span className="text-2xl font-black text-primary">{metrics.averageClassGrade}</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs text-center">
              <span className="text-xs text-muted-foreground block mb-1">Predikat A (Siswa)</span>
              <span className="text-2xl font-black text-green-500">
                {gradeDistribution.find(d => d.name === 'A')?.Jumlah || 0} Siswa
              </span>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs text-center">
              <span className="text-xs text-muted-foreground block mb-1">Mata Pelajaran Aktif</span>
              <span className="text-2xl font-black text-purple-500">{subjectPerformance.length} Mapel</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Range Distribution */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-green-500" /> Sebaran Predikat Nilai</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="Jumlah" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {gradeDistribution.map((entry, index) => {
                        let color = '#3b82f6'; // Default blue
                        if (entry.name === 'A') color = '#22c55e';
                        else if (entry.name === 'B') color = '#a855f7';
                        else if (entry.name === 'C') color = '#f97316';
                        else if (entry.name === 'D') color = '#ef4444';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          {/* Subject Performance - with KKM reference line + color coding */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-500" /> Performa Rata-rata per Mapel</h3>
              <p className="text-[10px] text-muted-foreground mb-4">Garis merah = batas KKM (70). Merah = di bawah KKM.</p>
              <div className="h-[250px]">
                {subjectPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectPerformance} layout="vertical" margin={{ top: 10, right: 50, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                      <ReferenceLine x={70} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'KKM', position: 'insideTopRight', fontSize: 9, fill: '#ef4444' }} />
                      <Bar dataKey="RataRata" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="RataRata" position="right" style={{ fontSize: '10px', fill: 'hsl(var(--foreground))', fontWeight: 600 }} />
                        {subjectPerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.RataRata < 70 ? '#ef4444' : entry.RataRata < 80 ? '#f97316' : '#8b5cf6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                    Belum ada data mata pelajaran yang terekam.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Academic Lists Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Students Detail */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                <Award className="w-4 h-4 text-yellow-500" /> Peringkat 3 Besar Kelas
              </h3>
              <div className="space-y-3">
                {topStudents.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-yellow-500 text-yellow-950' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-amber-600 text-amber-950'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-foreground">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.nis}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-primary">{getPeriodStats(s)?.averageGrade || 0}</div>
                      <div className="text-[9px] text-muted-foreground">Rata-rata</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Academic Support Warning List */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                <AlertCircle className="w-4 h-4 text-destructive" /> Rekomendasi Bimbingan Nilai
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {academicWarnings.length > 0 ? (
                  academicWarnings.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 bg-destructive/5 rounded-lg border border-destructive/10">
                      <div>
                        <div className="text-xs font-bold text-foreground">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">NIS: {s.nis}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-destructive">{getPeriodStats(s)?.averageGrade || 0}</div>
                        <div className="text-[9px] text-destructive/80">Di bawah KKM (70)</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-green-500 font-medium">
                    <CheckCircle2 className="w-8 h-8 mb-2" />
                    Hebat! Tidak ada siswa dengan nilai rata-rata di bawah 70.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KEHADIRAN & DISIPLIN */}
      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Pie Chart: Status Presensi */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><UserCheck className="w-4 h-4 text-green-500" /> Distribusi Status Kehadiran</h3>
              <div className="h-[220px] flex items-center justify-center relative">
                {attendanceDistribution.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={attendanceDistribution}
                          cx="50%" cy="50%"
                          innerRadius={65} outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {attendanceDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center pointer-events-none">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">% Hadir</span>
                      <span className="text-xl font-black">
                        {(() => {
                          const hadir = (attendanceDistribution.find(i => i.name === 'Hadir')?.value || 0) + (attendanceDistribution.find(i => i.name === 'Terlambat')?.value || 0);
                          const total = attendanceDistribution.reduce((acc, i) => acc + i.value, 0);
                          return total > 0 ? `${Math.round((hadir / total) * 100)}%` : '-';
                        })()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic text-center">
                    Tidak ada rekaman presensi dalam rentang waktu ini.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3 text-[10px] font-semibold">
                {attendanceDistribution.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span>{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Line Chart: Keterlambatan Menit */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Total Keterlambatan (Menit)</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dynamicTardinessData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="Menit" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Warnings and Discipline Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Low Attendance Warning List */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                <AlertCircle className="w-4 h-4 text-destructive" /> Peringatan Kehadiran Kritis (&lt;85%)
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {attendanceWarnings.length > 0 ? (
                  attendanceWarnings.map((s) => {
                    const attRate = getPeriodStats(s)?.attendanceRate ?? 0;
                    const attDetails = getPeriodStats(s)?.attendanceDetails;
                    const absentCount = (attDetails?.alpa ?? 0) + (attDetails?.izin ?? 0) + (attDetails?.sakit ?? 0);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2.5 bg-destructive/5 rounded-lg border border-destructive/10">
                        <div>
                          <div className="text-xs font-bold text-foreground">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">NIS: {s.nis} &middot; {absentCount}x tidak hadir</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-destructive">{attRate}%</div>
                          <div className="text-[9px] text-destructive/80">Kehadiran</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-green-500 font-medium">
                    <CheckCircle2 className="w-8 h-8 mb-2" />
                    Sempurna! Semua siswa memiliki tingkat kehadiran di atas 85%.
                  </div>
                )}
              </div>
            </div>

            {/* Tardiness Log Leaderboard */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                <Clock className="w-4 h-4 text-amber-500" /> Akumulasi Menit Terlambat Tertinggi
              </h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {tardinessLeaders.length > 0 ? (
                  tardinessLeaders.map((s, idx) => {
                    const lateMins = getPeriodStats(s)?.totalLateMinutes ?? 0;
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold text-amber-600">#{idx + 1}</span>
                          <div>
                            <div className="text-xs font-bold text-foreground">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground">NIS: {s.nis}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-amber-600">{lateMins} menit</div>
                          <div className="text-[9px] text-muted-foreground">total akumulasi</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-green-500 font-medium">
                    <CheckCircle2 className="w-8 h-8 mb-2" />
                    Bagus! Tidak ada catatan keterlambatan untuk siswa saat ini.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Student Details Modal */}
      <StudentModal 
        student={selectedStudent} 
        onClose={() => setSelectedStudentId(null)} 
        classStudentCount={classStudentsOfSelected.length}
        classAverageGrade={classAverageForSelected}
        academicYear={studentAcademicYear}
        semester={studentSemester}
      />
    </div>
  );
};

// --- SUB-COMPONENT: Metric Card v2 ---
const MetricCard = ({ title, value, icon, statusLabel, statusColor, progressValue }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  statusLabel?: string;
  statusColor?: 'green' | 'yellow' | 'red' | 'blue' | 'default';
  progressValue?: number;
}) => {
  const bgBorder = {
    green: 'bg-green-500/5 border-green-500/20',
    yellow: 'bg-amber-500/5 border-amber-500/20',
    red: 'bg-destructive/5 border-destructive/20',
    blue: 'bg-blue-500/5 border-blue-500/20',
    default: 'bg-card border-border',
  }[statusColor || 'default'];

  const badgeCls = {
    green: 'bg-green-500/15 text-green-700',
    yellow: 'bg-amber-500/15 text-amber-700',
    red: 'bg-destructive/15 text-destructive',
    blue: 'bg-blue-500/15 text-blue-700',
    default: 'bg-muted text-muted-foreground',
  }[statusColor || 'default'];

  const barCls = {
    green: 'bg-green-500',
    yellow: 'bg-amber-500',
    red: 'bg-destructive',
    blue: 'bg-blue-500',
    default: 'bg-primary',
  }[statusColor || 'default'];

  return (
    <div className={`border rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all ${bgBorder}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
        </div>
        <div className="p-2.5 bg-muted/80 rounded-xl shrink-0">{icon}</div>
      </div>
      {progressValue !== undefined && (
        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
          <div className={`h-1.5 rounded-full transition-all ${barCls}`} style={{ width: `${Math.min(progressValue, 100)}%` }} />
        </div>
      )}
      {statusLabel && (
        <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
          {statusLabel}
        </span>
      )}
    </div>
  );
};
