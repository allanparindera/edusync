import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Clock, Save, CheckCircle2, Search, History, Upload, Edit2, Trash2, X, Check, AlertCircle, AlertTriangle, CheckSquare, FileDown, Filter, ArrowUpDown, ArrowUp, ArrowDown, FileText, PlusCircle, BookOpen } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { StudentSummary, ClassData } from '../types.ts';
import { authService } from '../services/auth.ts';
import { exportToCSV } from '../utils/export.ts';

type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';

interface DailyAttendance {
  status: AttendanceStatus;
  lateMinutes: number;
}

type TabType = 'daily' | 'history' | 'import';

const STATUS_OPTIONS = [
  { value: 'Hadir', label: 'Hadir', colorClass: 'bg-green-500 text-white', hoverClass: 'hover:bg-green-500/20 hover:text-green-600' },
  { value: 'Terlambat', label: 'Terlambat', colorClass: 'bg-orange-500 text-white', hoverClass: 'hover:bg-orange-500/20 hover:text-orange-600' },
  { value: 'Izin', label: 'Izin', colorClass: 'bg-blue-500 text-white', hoverClass: 'hover:bg-blue-500/20 hover:text-blue-600' },
  { value: 'Sakit', label: 'Sakit', colorClass: 'bg-yellow-500 text-white', hoverClass: 'hover:bg-yellow-500/20 hover:text-yellow-600' },
  { value: 'Alpa', label: 'Alpa', colorClass: 'bg-red-500 text-white', hoverClass: 'hover:bg-red-500/20 hover:text-red-600' }
];

interface PreviewRecord {
  date: string;
  nis: string;
  status: string;
  lateMinutes: number;
  isValid: boolean;
  errorMsg?: string;
  studentId?: string;
}

export const AttendanceTracker: React.FC = () => {
  const dbData = useRealtimeDB();
  const currentUser = authService.getCurrentUser();
  const allStudents: StudentSummary[] = (dbData.students || []).filter(Boolean);
  const classes: ClassData[] = (dbData.classes || []).filter(Boolean);
  
  const isAdmin = currentUser?.role === 'Admin';

  const [selectedClass, setSelectedClass] = useState<string>(isAdmin ? (classes[0]?.id || 'all') : (currentUser?.classId || ''));
  const [activeTab, setActiveTab] = useState<TabType>('daily');

  // Active Period Logic
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const defaultSemester = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const defaultYearStr = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [academicYear, setAcademicYear] = useState<string>(defaultYearStr);
  const [semester, setSemester] = useState<string>(defaultSemester);
  const isPastPeriod = academicYear !== defaultYearStr || semester !== defaultSemester;
  const hasAccess = isAdmin || !isPastPeriod;

  // Dynamic Academic Years
  const availableYears = useMemo(() => db.academicYears.getAll(), [dbData]);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearStart, setNewYearStart] = useState<string>('');

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

  
  // Data Isolation & Filtering
  const students = useMemo(() => {
    let filtered = allStudents.filter(Boolean);
    if (currentUser?.role === 'Guru') {
      filtered = filtered.filter(s => s.classId === currentUser.classId);
    } else if (isAdmin && selectedClass !== 'all') {
      filtered = filtered.filter(s => s.classId === selectedClass);
    }
    return filtered;
  }, [allStudents, currentUser, isAdmin, selectedClass]);
  
  // --- Daily Input State ---
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, DailyAttendance>>({});
  const [hasExistingData, setHasExistingData] = useState(false);
  const [overwriteMode, setOverwriteMode] = useState(false);

  // --- History State ---
  const [historySearch, setHistorySearch] = useState('');
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySortConfig, setHistorySortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<{date: string, studentId: string, status: AttendanceStatus, lateMinutes: number} | null>(null);
  
  // Bulk Edit State
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditStatus, setBulkEditStatus] = useState<AttendanceStatus>('Hadir');
  const [bulkEditLateMinutes, setBulkEditLateMinutes] = useState(0);

  // --- Import State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [hasImportErrors, setHasImportErrors] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [importOverwrite, setImportOverwrite] = useState(false);

  // Initialize daily attendance state and check for existing data
  useEffect(() => {
    if (activeTab !== 'daily') return;
    let targetSemester = semester;
    if (semester === 'Satu Tahun') {
      const dateObj = new Date(date);
      const m = dateObj.getMonth() + 1;
      targetSemester = (m >= 7) ? 'Ganjil' : 'Genap';
    }
    const compoundKey = `${academicYear}_${targetSemester}_${date}`;
    const savedForDate = dbData.attendance?.[compoundKey] || dbData.attendance?.[date] || {};
    
    const existingCount = students.filter(s => s && savedForDate[s.id]).length;
    setHasExistingData(existingCount > 0);
    setOverwriteMode(false);

    const initial: Record<string, DailyAttendance> = {};
    students.forEach(s => {
      if (!s) return;
      initial[s.id] = savedForDate[s.id] || { status: 'Hadir', lateMinutes: 0 };
    });
    setAttendance(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedClass, activeTab, academicYear, semester]);

  // Flatten and filter history data
  const historyData = useMemo(() => {
    const result: any[] = [];
    Object.entries(dbData.attendance || {}).forEach(([recordKey, studentsData]: [string, any]) => {
      let datePart = recordKey;
      let periodYear = defaultYearStr;
      let periodSemester = defaultSemester;

      const parts = recordKey.split('_');
      if (parts.length >= 3) {
        periodYear = parts[0];
        periodSemester = parts[1];
        datePart = parts.slice(2).join('_');
      }

      if (periodYear !== academicYear) return;
      if (semester !== 'Satu Tahun' && periodSemester !== semester) return;
      if (!datePart.startsWith(historyMonth)) return;

      Object.entries(studentsData).forEach(([studentId, record]: [string, any]) => {
        const student = students.find(s => s && s.id === studentId);
        if (student) {
          result.push({
            id: `${datePart}_${studentId}`,
            date: datePart,
            studentId,
            studentName: student.name,
            nis: student.nis,
            classId: student.classId,
            status: record.status,
            lateMinutes: record.lateMinutes
          });
        }
      });
    });
    return result;
  }, [dbData.attendance, students, historyMonth, academicYear, semester]);

  // SAFE FILTERING
  const filteredHistory = useMemo(() => {
    return historyData.filter(h => {
      if (!h) return false;
      const name = h.studentName || '';
      const nis = h.nis || '';
      const search = historySearch.toLowerCase();
      
      const matchSearch = name.toLowerCase().includes(search) || nis.toLowerCase().includes(search) || (h.date && h.date.includes(search));
      const matchStatus = historyStatusFilter === 'all' || h.status === historyStatusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [historyData, historySearch, historyStatusFilter]);

  // SORTING LOGIC
  const sortedHistory = useMemo(() => {
    let sortable = [...filteredHistory];
    if (historySortConfig) {
      sortable.sort((a, b) => {
        const aVal = a[historySortConfig.key] ?? '';
        const bVal = b[historySortConfig.key] ?? '';
        if (aVal < bVal) return historySortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return historySortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by date descending
      sortable.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return sortable;
  }, [filteredHistory, historySortConfig]);

  const handleSortHistory = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (historySortConfig && historySortConfig.key === key && historySortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setHistorySortConfig({ key, direction });
  };

  const HistorySortIcon = ({ columnKey }: { columnKey: string }) => {
    if (historySortConfig?.key === columnKey) {
      return historySortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
    }
    return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
  };

  // Calculate Monthly Summary based on filtered class and month (ignoring search/status filter for the summary itself)
  const historySummary = useMemo(() => {
    return historyData.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<string, number>);
  }, [historyData]);

  // --- Daily Input Handlers ---
  const isFormLocked = hasExistingData && !overwriteMode;

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isFormLocked) return;
    setAttendance(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId], 
        status, 
        lateMinutes: status === 'Terlambat' ? (prev[studentId]?.lateMinutes || 15) : 0 
      }
    }));
  };

  const handleLateMinutesChange = (studentId: string, minutes: string) => {
    if (isFormLocked) return;
    const num = parseInt(minutes) || 0;
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], lateMinutes: num }
    }));
  };

  const handleMarkAllPresent = () => {
    if (isFormLocked) return;
    const newAttendance = { ...attendance };
    students.forEach(s => {
      if (!s) return;
      newAttendance[s.id] = { status: 'Hadir', lateMinutes: 0 };
    });
    setAttendance(newAttendance);
  };

  const handleSaveDaily = () => {
    if (isFormLocked) return;
    if (hasExistingData && overwriteMode) {
      if (!window.confirm('Data presensi untuk tanggal ini sudah ada. Yakin ingin menimpa data yang lama?')) return;
    }
    setIsSaving(true);
    let targetSemester = semester;
    if (semester === 'Satu Tahun') {
      const dateObj = new Date(date);
      const m = dateObj.getMonth() + 1;
      targetSemester = (m >= 7) ? 'Ganjil' : 'Genap';
    }
    db.attendance.saveDaily(academicYear, targetSemester, date, attendance);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setHasExistingData(true);
      setOverwriteMode(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 500);
  };

  // --- History Handlers ---
  const handleSelectRecord = (id: string) => {
    setSelectedRecords(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecords(sortedHistory.map(h => h.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleBulkAction = (action: string) => {
    if (!action || selectedRecords.length === 0) return;
    
    if (action === 'delete') {
      if (!isAdmin) return;
      if (window.confirm(`Yakin ingin menghapus ${selectedRecords.length} data presensi?`)) {
        const recordsToDelete = selectedRecords.map(id => {
          const [date, studentId] = id.split('_');
          return { date, studentId };
        });
        db.attendance.deleteBulk(academicYear, semester, recordsToDelete);
        setSelectedRecords([]);
      }
    } else if (action === 'edit') {
      setBulkEditStatus('Hadir');
      setBulkEditLateMinutes(0);
      setIsBulkEditModalOpen(true);
    }
  };

  const handleBulkEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recordsToUpdate = selectedRecords.map(id => {
      const [date, studentId] = id.split('_');
      return { date, studentId };
    });
    
    db.attendance.updateBulk(academicYear, semester, recordsToUpdate, {
      status: bulkEditStatus,
      lateMinutes: bulkEditStatus === 'Terlambat' ? bulkEditLateMinutes : 0
    });
    
    setIsBulkEditModalOpen(false);
    setSelectedRecords([]);
  };

  const handleExportHistory = () => {
    const exportData = sortedHistory.map(h => ({
      Tanggal: h.date,
      NIS: h.nis,
      Nama_Siswa: h.studentName,
      Kelas: classes.find(c => c && c.id === h.classId)?.name || h.classId,
      Status: h.status,
      Terlambat_Menit: h.lateMinutes
    }));
    exportToCSV(`Riwayat_Presensi_${historyMonth}.csv`, exportData);
  };

  const openEditModal = (record: any) => {
    setEditData({
      date: record.date,
      studentId: record.studentId,
      status: record.status,
      lateMinutes: record.lateMinutes
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editData) {
      db.attendance.updateSingle(academicYear, semester, editData.date, editData.studentId, {
        status: editData.status,
        lateMinutes: editData.status === 'Terlambat' ? editData.lateMinutes : 0
      });
      setEditModalOpen(false);
    }
  };

  // --- Import Handlers ---
  const handleDownloadTemplate = () => {
    const template = "Tanggal,NIS,Status,MenitTerlambat\n2023-10-25,2023001,Hadir,0\n2023-10-25,2023002,Terlambat,15\n2023-10-25,2023003,Sakit,0";
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Template_Import_Presensi.csv';
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const parsedData: PreviewRecord[] = [];
      let hasError = false;

      // Track dates in file to check for internal duplicates
      const fileDates = new Set<string>();

      // Skip header row
      lines.slice(1).forEach((line, index) => {
        if (!line.trim()) return;
        const parts = line.split(',').map(s => s.trim());
        
        if (parts.length >= 3) {
          const [recordDate, nis, status, lateStr] = parts;
          const student = students.find(s => s && s.nis === nis);
          
          let isValid = true;
          let errorMsg = '';

          // 1. Validasi NIS
          if (!student) {
            isValid = false;
            errorMsg = 'NIS tidak ditemukan di kelas ini.';
          }

          // 2. Validasi Status
          if (isValid && !['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'].includes(status)) {
            isValid = false;
            errorMsg = 'Status tidak valid (Hadir/Terlambat/Izin/Sakit/Alpa).';
          }

          // 3. Validasi Tanggal Dobel (Database)
          if (isValid && student) {
            const dateObj = new Date(recordDate);
            const m = dateObj.getMonth() + 1;
            const targetSem = (m >= 7) ? 'Ganjil' : 'Genap';
            const compoundKey = `${academicYear}_${targetSem}_${recordDate}`;
            
            const existingRecord = dbData.attendance?.[compoundKey]?.[student.id] || dbData.attendance?.[recordDate]?.[student.id];
            if (existingRecord) {
              if (!importOverwrite) {
                isValid = false;
                errorMsg = 'Data presensi untuk tanggal ini sudah ada di database. Aktifkan mode "Timpa Data" untuk menimpa.';
              } else {
                errorMsg = 'TIMPA: Data lama akan ditimpa.';
                // isValid remains true - will overwrite
              }
            }
          }

          // 4. Validasi Tanggal Dobel (Internal File)
          if (isValid && student) {
            const uniqueKey = `${recordDate}_${student.id}`;
            if (fileDates.has(uniqueKey)) {
              isValid = false;
              errorMsg = 'Duplikasi data siswa pada tanggal yang sama di dalam file CSV.';
            } else {
              fileDates.add(uniqueKey);
            }
          }

          if (!isValid) hasError = true;

          parsedData.push({
            date: recordDate,
            nis,
            status,
            lateMinutes: parseInt(lateStr) || 0,
            isValid,
            errorMsg,
            studentId: student?.id
          });
        }
      });

      setPreviewData(parsedData);
      setHasImportErrors(hasError);
      setImportSuccessMsg('');
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Re-validate when importOverwrite changes
  useEffect(() => {
    if (previewData.length === 0) return;
    // Re-run validation by re-processing the existing preview data
    const fileDates = new Set<string>();
    let hasError = false;
    
    const revalidated = previewData.map(p => {
      let isValid = true;
      let errorMsg = '';
      const student = students.find(s => s && s.nis === p.nis);
      
      if (!student) {
        isValid = false;
        errorMsg = 'NIS tidak ditemukan di kelas ini.';
      }
      
      if (isValid && !['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'].includes(p.status)) {
        isValid = false;
        errorMsg = 'Status tidak valid (Hadir/Terlambat/Izin/Sakit/Alpa).';
      }
      
      if (isValid && student) {
        const dateObj = new Date(p.date);
        const m = dateObj.getMonth() + 1;
        const targetSem = (m >= 7) ? 'Ganjil' : 'Genap';
        const compoundKey = `${academicYear}_${targetSem}_${p.date}`;
        const existingRecord = dbData.attendance?.[compoundKey]?.[student.id] || dbData.attendance?.[p.date]?.[student.id];
        if (existingRecord) {
          if (!importOverwrite) {
            isValid = false;
            errorMsg = 'Data presensi untuk tanggal ini sudah ada di database. Aktifkan mode "Timpa Data" untuk menimpa.';
          } else {
            errorMsg = 'TIMPA: Data lama akan ditimpa.';
          }
        }
      }
      
      if (isValid && student) {
        const uniqueKey = `${p.date}_${student.id}`;
        if (fileDates.has(uniqueKey)) {
          isValid = false;
          errorMsg = 'Duplikasi data siswa pada tanggal yang sama di dalam file CSV.';
        } else {
          fileDates.add(uniqueKey);
        }
      }
      
      if (!isValid) hasError = true;
      return { ...p, isValid, errorMsg, studentId: student?.id };
    });
    
    setPreviewData(revalidated);
    setHasImportErrors(hasError);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importOverwrite]);

  const handleConfirmImport = () => {
    if (hasImportErrors || previewData.length === 0) return;

    const recordsToImport = previewData.map(p => ({
      date: p.date,
      studentId: p.studentId!,
      status: p.status,
      lateMinutes: p.lateMinutes
    }));

    db.attendance.importBulk(academicYear, semester, recordsToImport);
    setImportSuccessMsg(`Berhasil mengimpor ${recordsToImport.length} data presensi.`);
    setPreviewData([]); // Clear preview after success
  };

  const cancelImport = () => {
    setPreviewData([]);
    setHasImportErrors(false);
    setImportSuccessMsg('');
  };

  // Calculate daily summary
  const summary = Object.values(attendance).reduce((acc, curr) => {
    if (curr && curr.status) {
      acc[curr.status]++;
    }
    return acc;
  }, { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 });

  // Count for tab badges
  const historyCount = historyData.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manajemen Presensi</h2>
          <p className="text-muted-foreground text-sm">Catat, edit, dan kelola riwayat kehadiran siswa.</p>
        </div>
        {isPastPeriod && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-lg px-3 py-1.5 text-xs font-semibold animate-in slide-in-from-right-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Periode Lampau (Read-Only)
          </div>
        )}
      </div>

      {/* Period & Class Filters */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        {isAdmin && (
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Filter className="w-3 h-3" /> Kelas
            </label>
            <select 
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c: any) => c && <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Tahun Ajaran
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
                {availableYears.map((y: string) => <option key={y} value={y}>{y}</option>)}
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
            <option value="Satu Tahun">Satu Tahun</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
        <button 
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'daily' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Input Harian
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-bold">{students.length}</span>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" /> Riwayat & Edit
            {historyCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{historyCount}</span>}
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'import' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2"><Upload className="w-4 h-4" /> Import Massal</div>
        </button>
      </div>

      {/* TAB 1: DAILY INPUT */}

      {!hasAccess && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-lg p-3 text-sm flex items-center gap-2 mb-4 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span><strong>Mode Lihat Saja:</strong> Anda tidak diizinkan mengedit data presensi pada periode lampau.</span>
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Warning Banner if Data Exists */}
          {hasExistingData && !overwriteMode && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-700 dark:text-amber-500">Data Presensi Sudah Ada</h4>
                <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mt-1">
                  Anda sudah melakukan absensi untuk tanggal <strong>{date}</strong>. Data saat ini ditampilkan di bawah. Anda dapat menimpa data ini atau mengedit lewat tab <strong>Riwayat & Edit</strong>.
                </p>
                <button
                  onClick={() => setOverwriteMode(true)}
                  className="mt-3 flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors text-sm font-medium shadow-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Timpa Data Lama
                </button>
              </div>
            </div>
          )}

          {/* Overwrite Mode Active Banner */}
          {hasExistingData && overwriteMode && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
              <Edit2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400">Mode Timpa Aktif</h4>
                <p className="text-sm text-blue-700/80 dark:text-blue-400/80 mt-1">
                  Anda sedang mengedit data presensi tanggal <strong>{date}</strong>. Ubah status di bawah, lalu klik <strong>Simpan</strong> untuk menimpa data yang lama.
                </p>
                <button
                  onClick={() => setOverwriteMode(false)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  Batalkan mode timpa
                </button>
              </div>
            </div>
          )}

          {/* Sticky Top Controls */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-border mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative flex-1 sm:max-w-xs w-full">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleMarkAllPresent}
                  disabled={isFormLocked || students.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Tandai Semua Hadir</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600 font-semibold uppercase">Hadir</p>
              <p className="text-2xl font-bold text-green-700">{summary.Hadir}</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
              <p className="text-xs text-orange-600 font-semibold uppercase">Terlambat</p>
              <p className="text-2xl font-bold text-orange-700">{summary.Terlambat}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600 font-semibold uppercase">Izin</p>
              <p className="text-2xl font-bold text-blue-700">{summary.Izin}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
              <p className="text-xs text-yellow-600 font-semibold uppercase">Sakit</p>
              <p className="text-2xl font-bold text-yellow-700">{summary.Sakit}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-red-600 font-semibold uppercase">Alpa</p>
              <p className="text-2xl font-bold text-red-700">{summary.Alpa}</p>
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg p-3 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4" />
              Data presensi tanggal {date} berhasil disinkronisasi!
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari nama siswa..." 
              className="w-full pl-9 pr-4 py-3 text-sm bg-card border border-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={`space-y-3 pb-20 ${isFormLocked ? 'opacity-75 pointer-events-none' : ''}`}>
            {students.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-xl">
                Tidak ada siswa di kelas ini.
              </div>
            ) : students.filter(s => {
              if (!s) return false;
              const name = s.name || '';
              const nis = s.nis || '';
              const search = searchTerm.toLowerCase();
              return name.toLowerCase().includes(search) || nis.toLowerCase().includes(search);
            }).map((student) => {
              const record = attendance[student.id] || { status: 'Hadir', lateMinutes: 0 };
              return (
                <div key={student.id || Math.random()} className={`bg-card border rounded-xl p-4 shadow-sm transition-colors ${record.status === 'Alpa' ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <img src={student.avatarUrl} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">{student.name}</h4>
                      <p className="text-xs text-muted-foreground">{student.nis} • {classes.find(c => c && c.id === student.classId)?.name || student.classId}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    {/* Segmented Control */}
                    <div className="flex bg-muted/50 p-1 rounded-lg w-full sm:w-auto">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(student.id, opt.value as AttendanceStatus)}
                          className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            record.status === opt.value 
                              ? opt.colorClass + ' shadow-sm'
                              : 'text-muted-foreground ' + opt.hoverClass
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Late Minutes Input (Only show if Terlambat) */}
                    {record.status === 'Terlambat' && (
                      <div className="flex items-center gap-2 w-full sm:w-24 animate-in fade-in slide-in-from-left-2">
                        <Clock className="w-4 h-4 text-orange-500 shrink-0" />
                        <div className="relative flex-1">
                          <input 
                            type="number" 
                            min="1"
                            value={record.lateMinutes || ''}
                            onChange={(e) => handleLateMinutesChange(student.id, e.target.value)}
                            className="w-full pl-2 pr-6 py-1.5 text-xs bg-background border border-orange-500/50 bg-orange-500/5 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mnt</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Floating Action Button (FAB) for Save */}
          {!isFormLocked && students.length > 0 && (
            <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
              <button 
                onClick={handleSaveDaily}
                disabled={isSaving}
                className={`flex items-center justify-center gap-2 ${hasExistingData && overwriteMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary/90'} text-white px-6 py-3 rounded-full shadow-xl transition-all hover:scale-105 font-medium disabled:opacity-50 disabled:hover:scale-100`}
              >
                <Save className="w-5 h-5" />
                <span>{isSaving ? 'Menyimpan...' : (hasExistingData && overwriteMode ? 'Timpa & Simpan' : 'Simpan Presensi')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY & EDIT */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Cari tanggal, nama, atau NIS..." 
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="relative w-full sm:w-40">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="month" 
                    className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                  />
                </div>
                <div className="relative w-full sm:w-40">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select 
                    className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  >
                    <option value="all">Semua Status</option>
                    <option value="Hadir">Hadir</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Alpa">Alpa</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportHistory}
                className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="text-sm text-muted-foreground px-1">
            Rekap {historyMonth}: <strong className="text-green-600">{historySummary.Hadir} Hadir</strong>, <strong className="text-orange-600">{historySummary.Terlambat} Terlambat</strong>, <strong className="text-blue-600">{historySummary.Izin} Izin</strong>, <strong className="text-yellow-600">{historySummary.Sakit} Sakit</strong>, <strong className="text-red-600">{historySummary.Alpa} Alpa</strong>
          </div>

          {/* Bulk Actions Toolbar */}
          {selectedRecords.length > 0 && (
            <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <CheckSquare className="w-4 h-4" />
                {selectedRecords.length} data terpilih
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select 
                  className="text-sm bg-background border border-primary/30 text-primary px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  onChange={(e) => handleBulkAction(e.target.value)}
                  value=""
                >
                  <option value="" disabled>-- Pilih Aksi Massal --</option>
                  <option value="edit">Edit Status Terpilih</option>
                  {isAdmin && <option value="delete">Hapus Terpilih</option>}
                </select>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <input 
                        type="checkbox" 
                        className="rounded border-input text-primary focus:ring-primary"
                        checked={selectedRecords.length === sortedHistory.length && sortedHistory.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSortHistory('date')}>
                      Tanggal <HistorySortIcon columnKey="date" />
                    </th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSortHistory('nis')}>
                      NIS <HistorySortIcon columnKey="nis" />
                    </th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSortHistory('studentName')}>
                      Nama Siswa <HistorySortIcon columnKey="studentName" />
                    </th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Terlambat</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedHistory.length > 0 ? (
                    sortedHistory.map((record) => (
                      <tr key={record.id || Math.random()} className={`hover:bg-muted/30 transition-colors ${selectedRecords.includes(record.id) ? 'bg-primary/5' : ''}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            className="rounded border-input text-primary focus:ring-primary"
                            checked={selectedRecords.includes(record.id)}
                            onChange={() => handleSelectRecord(record.id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{record.date}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{record.nis}</td>
                        <td className="px-4 py-3 font-medium">{record.studentName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'Hadir' ? 'bg-green-500/10 text-green-600' :
                            record.status === 'Terlambat' ? 'bg-orange-500/10 text-orange-600' :
                            record.status === 'Izin' ? 'bg-blue-500/10 text-blue-600' :
                            record.status === 'Sakit' ? 'bg-yellow-500/10 text-yellow-600' :
                            'bg-red-500/10 text-red-600'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {record.lateMinutes > 0 ? (
                            <span className="text-orange-600 font-medium">{record.lateMinutes} mnt</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => openEditModal(record)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                        Tidak ada riwayat presensi ditemukan untuk bulan {historyMonth}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BULK IMPORT */}
      {activeTab === 'import' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-400">Format Import CSV</h4>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                Gunakan format berikut (pisahkan dengan koma): <br/>
                <code className="bg-background/50 px-1 py-0.5 rounded mt-1 inline-block">Tanggal, NIS, Status, MenitTerlambat</code><br/>
                Contoh:<br/>
                <code className="bg-background/50 px-1 py-0.5 rounded mt-1 inline-block text-xs">
                  2023-10-25, 2023001, Hadir, 0<br/>
                  2023-10-25, 2023002, Terlambat, 15<br/>
                  2023-10-25, 2023003, Sakit, 0
                </code>
              </p>
              <button 
                onClick={handleDownloadTemplate}
                className="mt-3 flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors text-xs font-medium"
              >
                <FileDown className="w-3.5 h-3.5" /> Download Template CSV
              </button>
            </div>
          </div>

          {/* Overwrite Toggle */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Mode Timpa Data</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Jika diaktifkan, data presensi yang sudah ada akan ditimpa oleh data baru dari CSV.
                </p>
              </div>
              <button
                onClick={() => setImportOverwrite(!importOverwrite)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${importOverwrite ? 'bg-amber-500' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${importOverwrite ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {importOverwrite && (
              <div className="mt-3 flex items-center gap-2 text-amber-600 text-xs bg-amber-500/10 border border-amber-500/20 rounded-md p-2 animate-in fade-in">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>Perhatian:</strong> Data lama yang bentrok akan ditimpa tanpa bisa dikembalikan.</span>
              </div>
            )}
          </div>

          {importSuccessMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg p-4 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {importSuccessMsg}
            </div>
          )}

          {hasImportErrors && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Proses Import Dicegah!</p>
                <p>Ditemukan error pada data. Harap perbaiki file CSV Anda dan unggah ulang.</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Klik atau Drag & Drop file CSV di sini</p>
              <p className="text-xs text-muted-foreground">Maksimal ukuran file: 2MB</p>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload} 
              />
            </div>
          </div>

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
                <h3 className="font-semibold">Tabel Preview ({previewData.length} Data)</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={cancelImport}
                    className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleConfirmImport}
                    disabled={hasImportErrors}
                    className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Konfirmasi & Simpan
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Tanggal</th>
                      <th className="px-4 py-3 font-medium">NIS</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Terlambat</th>
                      <th className="px-4 py-3 font-medium">Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className={!row.isValid ? 'bg-destructive/5' : (row.errorMsg?.startsWith('TIMPA') ? 'bg-amber-500/5' : '')}>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{row.date}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{row.nis}</td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.lateMinutes > 0 ? `${row.lateMinutes} mnt` : '-'}</td>
                        <td className="px-4 py-3">
                          {row.isValid ? (
                            row.errorMsg?.startsWith('TIMPA') ? (
                              <span className="flex items-center gap-1 text-amber-600 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> {row.errorMsg}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                            )
                          ) : (
                            <span className="flex items-center gap-1 text-destructive text-xs font-medium"><AlertCircle className="w-3 h-3" /> {row.errorMsg}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-semibold">Edit Presensi</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tanggal: <span className="font-medium text-foreground">{editData.date}</span></p>
                <p className="text-sm text-muted-foreground">Siswa: <span className="font-medium text-foreground">{students.find(s => s && s.id === editData.studentId)?.name}</span></p>
              </div>
              
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">Status Kehadiran</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editData.status}
                  onChange={e => setEditData({...editData, status: e.target.value as AttendanceStatus})}
                >
                  <option value="Hadir">Hadir</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </div>

              {editData.status === 'Terlambat' && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-medium">Menit Terlambat</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editData.lateMinutes}
                    onChange={e => setEditData({...editData, lateMinutes: parseInt(e.target.value) || 0})}
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-semibold">Edit Massal ({selectedRecords.length} Data)</h3>
              <button onClick={() => setIsBulkEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkEditSubmit} className="p-5 space-y-4">
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">Ubah Status Menjadi</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={bulkEditStatus}
                  onChange={e => setBulkEditStatus(e.target.value as AttendanceStatus)}
                >
                  <option value="Hadir">Hadir</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </div>

              {bulkEditStatus === 'Terlambat' && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-medium">Menit Terlambat</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={bulkEditLateMinutes}
                    onChange={e => setBulkEditLateMinutes(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsBulkEditModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Terapkan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
