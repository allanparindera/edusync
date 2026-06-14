import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Download, Upload, AlertCircle, Calculator, BookOpen, Users, Target, Trophy, Sigma, AlertTriangle, Lock, Trash2, PlusCircle, X } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { exportToCSV } from '../utils/export.ts';
import { StudentSummary, ClassData, Subject } from '../types.ts';
import { authService } from '../services/auth.ts';
import { DailyGrading } from './DailyGrading.tsx';

interface GradeRecord {
  tugas: number | string;
  uts: number | string;
  uas: number | string;
}

type GradeMatrix = Record<string, GradeRecord>;

export const BulkGrading: React.FC = () => {
  const dbData = useRealtimeDB();
  const currentUser = authService.getCurrentUser();
  
  const allStudents = useMemo(() => (dbData.students || []).filter(Boolean), [dbData.students]);
  const classes = useMemo(() => (dbData.classes || []).filter(Boolean), [dbData.classes]);
  const subjects = useMemo(() => (dbData.subjects || []).filter(Boolean), [dbData.subjects]);
  const allGrades = useMemo(() => dbData.grades || {}, [dbData.grades]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Period Logic
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const defaultSemester = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const defaultYearStr = currentMonth >= 7 
    ? `${currentYear}/${currentYear + 1}`
    : `${currentYear - 1}/${currentYear}`;

  // Filters State
  const [academicYear, setAcademicYear] = useState<string>(defaultYearStr);
  const [semester, setSemester] = useState<string>(defaultSemester);
  const [selectedClass, setSelectedClass] = useState<string>(currentUser?.role === 'Guru' ? currentUser.classId || '' : (classes[0]?.id || ''));
  const [selectedSubject, setSelectedSubject] = useState<string>(
    currentUser?.role === 'Guru' && currentUser.subjectId 
      ? currentUser.subjectId 
      : (subjects[0]?.id || '')
  );
  const [kkm, setKkm] = useState<number>(75);
  const [activeTab, setActiveTab] = useState<'harian' | 'akhir'>('harian');

  // Dynamic Academic Years
  const availableYears = useMemo(() => db.academicYears.getAll(), [dbData]);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearStart, setNewYearStart] = useState<string>('');

  // Delete All Data Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isPastPeriod = academicYear !== defaultYearStr || semester !== defaultSemester;

  // Role-Based Access Control
  let hasAccess = currentUser?.role === 'Admin' || (
    currentUser?.role === 'Guru' && 
    currentUser.classId === selectedClass && 
    (!currentUser.subjectId || currentUser.subjectId === selectedSubject)
  );

  if (isPastPeriod && currentUser?.role !== 'Admin') {
    hasAccess = false;
  }

  // Check if there are daily grades columns in the database for this class/subject
  const dailyKey = `${academicYear}_${semester}_${selectedClass}_${selectedSubject}`;
  const legacyDailyKey = `${selectedClass}_${selectedSubject}`;
  const dailyData = dbData.dailyGrades?.[dailyKey] || dbData.dailyGrades?.[legacyDailyKey];
  const hasDailyGrades = !!(dailyData && dailyData.columns && dailyData.columns.length > 0);

  // Data Isolation & Filtering
  const students = useMemo(() => {
    let filtered = allStudents.filter(Boolean);
    if (currentUser?.role === 'Guru') {
      filtered = filtered.filter((s: any) => s.classId === currentUser.classId);
    } else if (selectedClass && selectedClass !== 'all') {
      filtered = filtered.filter((s: any) => s.classId === selectedClass);
    }
    return filtered;
  }, [allStudents, currentUser, selectedClass]);

  // Initialize local state from DB based on selected subject
  const [grades, setGrades] = useState<GradeMatrix>({});

  // PENTING: Hanya reset state grades ketika subject atau class atau periode berubah
  useEffect(() => {
    if (!selectedSubject) return;
    const compoundKey = `${academicYear}_${semester}_${selectedSubject}`;
    const subjectGrades = allGrades[compoundKey] || allGrades[selectedSubject] || {};
    const initial: GradeMatrix = {};
    
    students.forEach((s: any) => {
      initial[s.id] = {
        tugas: subjectGrades[s.id]?.tugas ?? '',
        uts: subjectGrades[s.id]?.uts ?? '',
        uas: subjectGrades[s.id]?.uas ?? ''
      };
    });
    setGrades(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedClass]);

  // PENTING: Sinkronkan kolom tugas secara dinamis dari database tanpa mengganggu input UTS/UAS yang sedang diedit
  useEffect(() => {
    if (!selectedSubject) return;
    const compoundKey = `${academicYear}_${semester}_${selectedSubject}`;
    const subjectGrades = allGrades[compoundKey] || allGrades[selectedSubject] || {};
    
    setGrades(prev => {
      const updated = { ...prev };
      let hasChange = false;
      students.forEach((s: any) => {
        const dbTugas = subjectGrades[s.id]?.tugas ?? '';
        const currentTugas = updated[s.id]?.tugas ?? '';
        if (currentTugas !== dbTugas) {
          hasChange = true;
          if (updated[s.id]) {
            updated[s.id] = {
              ...updated[s.id],
              tugas: dbTugas
            };
          } else {
            updated[s.id] = {
              tugas: dbTugas,
              uts: '',
              uas: ''
            };
          }
        }
      });
      return hasChange ? updated : prev;
    });
  }, [allGrades, selectedSubject, students]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleGradeChange = (studentId: string, field: keyof GradeRecord, value: string) => {
    if (!hasAccess) return;
    let numValue: number | string = value;
    if (value !== '') {
      numValue = Math.min(100, Math.max(0, Number(value)));
    }
    
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { tugas: '', uts: '', uas: '' }),
        [field]: numValue
      }
    }));
    setSaveSuccess(false);
  };

  // Kalkulasi Statistik & Peringkat secara Real-time
  const gradeStats = useMemo(() => {
    const result = students.map((student: any) => {
      const record = grades[student.id] || { tugas: '', uts: '', uas: '' };
      const t = Number(record.tugas) || 0;
      const u = Number(record.uts) || 0;
      const a = Number(record.uas) || 0;
      const finalScore = (t * 0.5) + (u * 0.25) + (a * 0.25);
      return { id: student.id, finalScore, record };
    });

    // Sort untuk menentukan peringkat
    const sorted = [...result].sort((a, b) => b.finalScore - a.finalScore);
    const rankMap: Record<string, number> = {};
    let currentRank = 1;
    let currentScore = -1;

    sorted.forEach((s, index) => {
      if (s.finalScore !== currentScore) {
        currentRank = index + 1;
        currentScore = s.finalScore;
      }
      rankMap[s.id] = currentRank;
    });

    // Hitung Ringkasan Kelas
    const total = result.reduce((sum: number, s: any) => sum + s.finalScore, 0);
    const avg = result.length > 0 ? (total / result.length).toFixed(1) : '0.0';
    const highest = result.length > 0 ? sorted[0].finalScore.toFixed(1) : '0.0';
    const remedial = result.filter((s: any) => s.finalScore < kkm).length;

    return { rankMap, avg, highest, remedial, result };
  }, [students, grades, kkm]);

  // Navigasi Keyboard ala Spreadsheet
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.querySelector(`input[data-row="${rowIndex - 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    } else if (e.key === 'ArrowRight') {
      const nextInput = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowLeft') {
      const prevInput = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Tab: Move left
        let nextCol = colIndex - 1;
        let nextRow = rowIndex;
        if (nextCol < 1) {
          nextCol = 2; // wrap to UAS (col 2)
          nextRow = rowIndex - 1;
        }
        const target = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`) as HTMLInputElement;
        if (target) {
          target.focus();
          target.select();
        }
      } else {
        // Tab: Move right
        let nextCol = colIndex + 1;
        let nextRow = rowIndex;
        if (nextCol > 2) {
          nextCol = 1; // wrap to UTS (col 1)
          nextRow = rowIndex + 1;
        }
        const target = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`) as HTMLInputElement;
        if (target) {
          target.focus();
          target.select();
        }
      }
    }
  };

  // Excel/Spreadsheet Copy-Paste Logic
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColIndex: number) => {
    if (!hasAccess) return;
    e.preventDefault();
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Split rows and columns, filtering trailing whitespace or empty lines
    const rows = pasteData
      .replace(/\r/g, '')
      .split('\n')
      .filter((row, idx, arr) => row.trim() !== '' || idx < arr.length - 1)
      .map(r => r.split('\t'));
      
    setGrades(prev => {
      const updated = { ...prev };
      let hasChange = false;

      rows.forEach((rowCells, rOffset) => {
        const targetRowIndex = startRowIndex + rOffset;
        if (targetRowIndex >= students.length) return;
        const student = students[targetRowIndex];
        if (!student) return;

        rowCells.forEach((cellValue, cOffset) => {
          const targetColIndex = startColIndex + cOffset;
          if (targetColIndex < 1 || targetColIndex > 2) return; // Only UTS (1) and UAS (2) are editable

          const field: 'uts' | 'uas' = targetColIndex === 1 ? 'uts' : 'uas';
          const val = cellValue.trim();
          let numValue: number | string = '';
          if (val !== '') {
            const parsed = Number(val);
            if (!isNaN(parsed)) {
              numValue = Math.min(100, Math.max(0, parsed));
            }
          }

          if (!updated[student.id]) {
            updated[student.id] = { tugas: '', uts: '', uas: '' };
          }
          updated[student.id] = {
            ...updated[student.id],
            [field]: numValue
          };
          hasChange = true;
        });
      });

      if (hasChange) {
        setSaveSuccess(false);
        return updated;
      }
      return prev;
    });
  };

  const handleSave = () => {
    if (!selectedSubject) return alert('Pilih mata pelajaran terlebih dahulu!');
    if (!hasAccess) return;
    setIsSaving(true);
    
    // Convert empty strings back to 0 before saving to DB
    const sanitizedGrades: any = {};
    Object.keys(grades).forEach(studentId => {
      sanitizedGrades[studentId] = {
        tugas: Number(grades[studentId].tugas) || 0,
        uts: Number(grades[studentId].uts) || 0,
        uas: Number(grades[studentId].uas) || 0,
      };
    });

    db.grades.saveBulk(academicYear, semester, selectedSubject, sanitizedGrades);
    
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 500);
  };

  // --- Tambah Tahun Ajaran ---
  const handleAddYear = () => {
    const startYear = parseInt(newYearStart);
    if (isNaN(startYear) || startYear < 2020 || startYear > 2099) {
      alert('Masukkan tahun awal yang valid (2020-2099).');
      return;
    }
    const yearStr = `${startYear}/${startYear + 1}`;
    db.academicYears.add(yearStr);
    setAcademicYear(yearStr);
    setShowAddYear(false);
    setNewYearStart('');
  };

  // --- Hapus Seluruh Data Mapel ---
  const handleDeleteAllSubjectData = async () => {
    if (!selectedSubject) return;
    const subjName = subjects.find((s: any) => s && s.id === selectedSubject)?.name || selectedSubject;
    if (deleteConfirmText !== subjName) {
      alert('Nama mata pelajaran tidak cocok. Ketik ulang dengan benar.');
      return;
    }
    setIsDeleting(true);
    try {
      await db.grades.deleteBySubject(academicYear, semester, selectedSubject);
      setGrades({});
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      alert(`Seluruh data nilai "${subjName}" pada ${academicYear} Semester ${semester} berhasil dihapus.`);
    } catch (err) {
      alert('Gagal menghapus data. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const subjName = subjects.find((s: any) => s && s.id === selectedSubject)?.name || 'Mapel';
    const clsName = selectedClass === 'all' ? 'Semua_Kelas' : classes.find((c: any) => c && c.id === selectedClass)?.name || 'Kelas';
    
    const exportData = students.map((student: any, index: number) => {
      const stat = gradeStats.result.find((r: any) => r.id === student.id);
      return {
        No: index + 1,
        NIS: student.nis,
        Nama: student.name,
        Kelas: classes.find((c: any) => c && c.id === student.classId)?.name || student.classId,
        Tugas: stat?.record.tugas || 0,
        UTS: stat?.record.uts || 0,
        UAS: stat?.record.uas || 0,
        Nilai_Akhir: stat?.finalScore.toFixed(1) || "0.0",
        Peringkat: gradeStats.rankMap[student.id] || '-'
      };
    });
    exportToCSV(`Nilai_${subjName}_${clsName}.csv`, exportData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasAccess) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newGrades = { ...grades };
      let importedCount = 0;

      // Skip header row
      lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(',').map(p => p.trim());
        // Expected format: No, NIS, Nama, Kelas, Tugas, UTS, UAS, Nilai_Akhir, Peringkat
        if (parts.length >= 7) {
          const nis = parts[1];
          const student = students.find((s: any) => s && s.nis === nis);
          if (student) {
            newGrades[student.id] = {
              tugas: hasDailyGrades ? (grades[student.id]?.tugas ?? '') : (Number(parts[4]) || 0),
              uts: Number(parts[5]) || 0,
              uas: Number(parts[6]) || 0,
            };
            importedCount++;
          }
        }
      });
      
      setGrades(newGrades);
      alert(`Berhasil mengimpor nilai untuk ${importedCount} siswa. Jangan lupa klik "Simpan Nilai" untuk menyimpan ke database.`);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manajemen Nilai</h2>
          <p className="text-muted-foreground text-sm">Kelola nilai harian dan rekap nilai akhir kelas.</p>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
          <button 
            onClick={() => setActiveTab('harian')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'harian' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Nilai Harian
          </button>
          <button 
            onClick={() => setActiveTab('akhir')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'akhir' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Rekap Nilai Akhir
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Mata Pelajaran
          </label>
          <select 
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium disabled:opacity-75 disabled:cursor-not-allowed"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={currentUser?.role === 'Guru' && !!currentUser?.subjectId}
          >
            {subjects.length === 0 && <option value="">-- Belum ada Mapel --</option>}
            {subjects.map((s: any) => s && <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Users className="w-3 h-3" /> Filter Kelas
          </label>
          <select 
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={currentUser?.role === 'Guru'}
          >
            {currentUser?.role !== 'Guru' && <option value="all">Semua Kelas</option>}
            {classes.map((c: any) => c && <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            Tahun Ajaran
          </label>
          {showAddYear ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="2025"
                min="2020" max="2099"
                className="w-20 px-2 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                value={newYearStart}
                onChange={(e) => setNewYearStart(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddYear()}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-sm font-medium text-muted-foreground">{newYearStart ? `${parseInt(newYearStart) + 1}` : '....'}</span>
              <button onClick={handleAddYear} className="p-1.5 text-green-600 hover:bg-green-500/10 rounded-md transition-colors" title="Simpan">
                <PlusCircle className="w-4 h-4" />
              </button>
              <button onClick={() => { setShowAddYear(false); setNewYearStart(''); }} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-colors" title="Batal">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <select 
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button 
                onClick={() => setShowAddYear(true)} 
                className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors shrink-0" 
                title="Tambah Tahun Ajaran Baru"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            Semester
          </label>
          <select 
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </div>
        <div className="w-full sm:w-32 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Target className="w-3 h-3" /> KKM
          </label>
          <input 
            type="number" 
            min="0" max="100"
            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
            value={kkm}
            onChange={(e) => setKkm(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {activeTab === 'harian' ? (
        selectedClass === 'all' ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-8 text-center text-amber-700 dark:text-amber-500 flex flex-col items-center justify-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <h3 className="font-semibold text-lg">Pilih Kelas Terlebih Dahulu</h3>
            <p className="text-sm max-w-md">Input Nilai Harian memerlukan isolasi kelas untuk menampilkan lembar spreadsheet siswa. Silakan pilih kelas spesifik pada filter di atas.</p>
          </div>
        ) : (
          <DailyGrading students={students} selectedSubject={selectedSubject} selectedClass={selectedClass} academicYear={academicYear} semester={semester} hasAccess={hasAccess} />
        )
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end items-center gap-2">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            {hasAccess && currentUser?.role === 'Admin' && (
              <button 
                onClick={() => setShowDeleteModal(true)}
                disabled={!selectedSubject}
                className="flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 rounded-md hover:bg-destructive/20 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Hapus Semua Data</span>
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasAccess}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 border border-border bg-background px-4 py-2 rounded-md hover:bg-muted transition-colors shadow-sm text-sm font-medium">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !selectedSubject || !hasAccess}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
            </button>
          </div>
          
          {!hasAccess && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-lg p-3 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span><strong>Mode Lihat Saja:</strong> Anda tidak diizinkan mengedit nilai rekap kelas atau mata pelajaran ini.</span>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <Calculator className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-400">Sistem Pembobotan & Peringkat Otomatis</h4>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                Nilai Akhir dihitung otomatis: <strong>(Tugas × 50%) + (UTS × 25%) + (UAS/Praktik × 25%)</strong>. Kolom Tugas disinkronkan otomatis dari tab Nilai Harian.
              </p>
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg p-3 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Data nilai akhir berhasil disimpan ke database real-time!
            </div>
          )}

          {/* Spreadsheet Container */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-12 text-center">No</th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-32">NIS</th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border min-w-[200px]">Nama Siswa</th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-32 text-center bg-primary/5 relative group">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Tugas</span>
                        <span title="Terkunci otomatis (Sinkron dari Nilai Harian)">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      </div>
                      <span className="block text-[10px] text-primary mt-0.5">Bobot: 50%</span>
                    </th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-32 text-center bg-primary/5">
                      UTS <span className="block text-[10px] text-primary mt-0.5">Bobot: 25%</span>
                    </th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-32 text-center bg-primary/5">
                      UAS <span className="block text-[10px] text-primary mt-0.5">Bobot: 25%</span>
                    </th>
                    <th className="px-4 py-3 font-medium border-b border-r border-border w-32 text-center bg-muted">
                      Nilai Akhir <span className="block text-[10px] mt-0.5">Otomatis</span>
                    </th>
                    <th className="px-4 py-3 font-medium border-b border-border w-24 text-center bg-muted">
                      Peringkat <span className="block text-[10px] mt-0.5">Kelas</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                        Tidak ada siswa di kelas ini.
                      </td>
                    </tr>
                  ) : students.map((student: any, index: number) => {
                    if (!student) return null;
                    const stat = gradeStats.result.find((r: any) => r.id === student.id);
                    const record = stat?.record || { tugas: '', uts: '', uas: '' };
                    const finalGrade = stat?.finalScore.toFixed(1) || "0.0";
                    const isFailing = Number(finalGrade) < kkm;
                    const rank = gradeStats.rankMap[student.id] || '-';

                    return (
                      <tr key={student.id || Math.random()} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-2 border-b border-r border-border text-center text-muted-foreground bg-muted/10">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 border-b border-r border-border font-mono text-xs text-muted-foreground">
                          {student.nis}
                        </td>
                        <td className="px-4 py-2 border-b border-r border-border font-medium">
                          {student.name}
                        </td>
                        
                        {/* Editable Cells */}
                        <td className="px-4 py-2 border-b border-r border-border text-center text-muted-foreground bg-muted/10 font-semibold" title="Nilai ditarik otomatis dari Manajemen Nilai Harian (Read-Only)">
                          <div className="flex items-center justify-center gap-1.5">
                            <Lock className="w-3 h-3 text-muted-foreground/60" />
                            <span>{record.tugas !== '' ? record.tugas : '-'}</span>
                          </div>
                        </td>
                        <td className="p-0 border-b border-r border-border relative">
                          <input 
                            type="text" 
                            data-row={index} data-col={1}
                            disabled={!hasAccess}
                            className="w-full h-full absolute inset-0 px-4 py-2 text-center bg-transparent focus:bg-background focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-all disabled:opacity-85 disabled:cursor-not-allowed"
                            value={record.uts}
                            onChange={(e) => handleGradeChange(student.id, 'uts', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, index, 1)}
                            onPaste={(e) => handlePaste(e, index, 1)}
                          />
                        </td>
                        <td className="p-0 border-b border-r border-border relative">
                          <input 
                            type="text" 
                            data-row={index} data-col={2}
                            disabled={!hasAccess}
                            className="w-full h-full absolute inset-0 px-4 py-2 text-center bg-transparent focus:bg-background focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-all disabled:opacity-85 disabled:cursor-not-allowed"
                            value={record.uas}
                            onChange={(e) => handleGradeChange(student.id, 'uas', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, index, 2)}
                            onPaste={(e) => handlePaste(e, index, 2)}
                          />
                        </td>
                        
                        {/* Calculated Cells */}
                        <td className={`px-4 py-2 border-b border-r border-border text-center font-bold ${isFailing ? 'text-destructive bg-destructive/5' : 'text-green-600 bg-green-500/5'}`}>
                          {finalGrade}
                          {isFailing && <span title={`Di bawah KKM (${kkm})`}><AlertCircle className="w-3 h-3 inline-block ml-1 text-destructive" /></span>}
                        </td>
                        <td className="px-4 py-2 border-b border-border text-center font-bold text-primary bg-primary/5">
                          {rank}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {students.length > 0 && (
              <div className="bg-muted/30 border-t border-border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border shadow-sm">
                  <div className="p-2 bg-blue-500/10 rounded-md text-blue-600">
                    <Sigma className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Rata-rata Kelas</p>
                    <p className="text-lg font-bold">{gradeStats.avg}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border shadow-sm">
                  <div className="p-2 bg-yellow-500/10 rounded-md text-yellow-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Nilai Tertinggi</p>
                    <p className="text-lg font-bold">{gradeStats.highest}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border shadow-sm">
                  <div className="p-2 bg-destructive/10 rounded-md text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Siswa Remedial</p>
                    <p className="text-lg font-bold text-destructive">{gradeStats.remedial} <span className="text-sm font-normal text-muted-foreground">Siswa</span></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Hapus Seluruh Data Mapel</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tindakan ini akan menghapus <strong>seluruh nilai rekap dan harian</strong> untuk mata pelajaran <strong className="text-destructive">{subjects.find((s: any) => s && s.id === selectedSubject)?.name}</strong> pada periode <strong>{academicYear} Semester {semester}</strong>.
                </p>
              </div>
            </div>
            <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-3">
              <p className="text-xs text-destructive font-medium">⚠️ Tindakan ini TIDAK DAPAT DIBATALKAN. Data yang dihapus tidak bisa dikembalikan.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Ketik nama mata pelajaran untuk konfirmasi:</label>
              <input 
                type="text"
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-destructive text-sm"
                placeholder={subjects.find((s: any) => s && s.id === selectedSubject)?.name || ''}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleDeleteAllSubjectData}
                disabled={isDeleting || deleteConfirmText !== (subjects.find((s: any) => s && s.id === selectedSubject)?.name || '')}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
