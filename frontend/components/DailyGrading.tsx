import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Lock, Unlock, Calculator, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { StudentSummary, DailyGrades } from '../types.ts';
import { authService } from '../services/auth.ts';

interface DailyGradingProps {
  students: StudentSummary[];
  selectedSubject: string;
  selectedClass: string;
  academicYear: string;
  semester: string;
  hasAccess: boolean;
}

const DEFAULT_DAILY_DATA: DailyGrades = { columns: [], records: {}, isLocked: false };

export const DailyGrading: React.FC<DailyGradingProps> = ({ students, selectedSubject, selectedClass, academicYear, semester, hasAccess }) => {
  const dbData = useRealtimeDB();
  const dailyKey = `${academicYear}_${semester}_${selectedClass}_${selectedSubject}`;
  const legacyDailyKey = `${selectedClass}_${selectedSubject}`;
  const dailyData: DailyGrades = dbData.dailyGrades?.[dailyKey] || dbData.dailyGrades?.[legacyDailyKey] || DEFAULT_DAILY_DATA;
  
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, Record<string, number | ''>>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const currentUser = authService.getCurrentUser();

  const className = dbData.classes?.find((c: any) => c?.id === selectedClass)?.name || selectedClass;
  const subjectName = dbData.subjects?.find((s: any) => s?.id === selectedSubject)?.name || selectedSubject;

  const studentIdsKey = students.map(s => s?.id).filter(Boolean).join(',');

  useEffect(() => {
    setColumns(dailyData.columns || []);
    // Ensure all students have a record object
    const initialRecords: Record<string, Record<string, number | ''>> = {};
    students.forEach(s => {
      if (s) {
        initialRecords[s.id] = dailyData.records?.[s.id] || {};
      }
    });
    setRecords(initialRecords);
    setIsLocked(dailyData.isLocked || false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyData, studentIdsKey]);

  const handleAddColumn = () => {
    if (isLocked || !hasAccess) return;
    const newColId = `col_${Date.now()}`;
    const newColName = `Tugas ${columns.length + 1}`;
    setColumns([...columns, { id: newColId, name: newColName }]);
  };

  const handleColumnNameChange = (colId: string, newName: string) => {
    if (isLocked || !hasAccess) return;
    setColumns(columns.map(c => c.id === colId ? { ...c, name: newName } : c));
  };

  const handleGradeChange = (studentId: string, colId: string, value: string) => {
    if (isLocked || !hasAccess) return;
    
    let numValue: number | '' = '';
    if (value.trim() !== '') {
      numValue = Math.min(100, Math.max(0, Number(value)));
    }
    
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [colId]: numValue
      }
    }));
    setSaveSuccess(false);
  };

  // Keyboard navigation (Spreadsheet style)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const numCols = columns.length;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const target = document.querySelector(`input[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (target) {
        target.focus();
        target.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const target = document.querySelector(`input[data-row="${rowIndex - 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (target) {
        target.focus();
        target.select();
      }
    } else if (e.key === 'ArrowRight') {
      const target = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`) as HTMLInputElement;
      if (target) {
        target.focus();
        target.select();
      }
    } else if (e.key === 'ArrowLeft') {
      const target = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`) as HTMLInputElement;
      if (target) {
        target.focus();
        target.select();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Tab: Move left
        let nextCol = colIndex - 1;
        let nextRow = rowIndex;
        if (nextCol < 0) {
          nextCol = numCols - 1;
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
        if (nextCol >= numCols) {
          nextCol = 0;
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

  // Excel Copy-Paste Logic
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColIndex: number) => {
    if (isLocked || !hasAccess) return;
    e.preventDefault();
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Split rows and columns, filtering trailing whitespace or empty lines
    const rows = pasteData
      .replace(/\r/g, '')
      .split('\n')
      .filter((row, idx, arr) => row.trim() !== '' || idx < arr.length - 1)
      .map(r => r.split('\t'));
      
    const newRecords = { ...records };

    rows.forEach((rowCells, rOffset) => {
      const student = students[startRowIndex + rOffset];
      if (!student) return;

      rowCells.forEach((cellValue, cOffset) => {
        const col = columns[startColIndex + cOffset];
        if (!col) return;

        const val = cellValue.trim();
        let numValue: number | '' = '';
        if (val !== '') {
          const parsed = Number(val);
          if (!isNaN(parsed)) {
            numValue = Math.min(100, Math.max(0, parsed));
          }
        }

        if (!newRecords[student.id]) newRecords[student.id] = {};
        newRecords[student.id][col.id] = numValue;
      });
    });

    setRecords(newRecords);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    if (!selectedClass || !selectedSubject || isLocked || !hasAccess) return;
    setIsSaving(true);
    
    db.dailyGrades.saveBulk(academicYear, semester, selectedClass, selectedSubject, {
      columns,
      records,
      isLocked
    });

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 500);
  };

  const toggleLock = () => {
    if (!selectedClass || !selectedSubject || !hasAccess) return;
    if (isLocked) {
      setShowUnlockModal(true);
    } else {
      setIsLocked(true);
      db.dailyGrades.toggleLock(academicYear, semester, selectedClass, selectedSubject, true);
    }
  };

  const confirmUnlock = () => {
    setIsLocked(false);
    db.dailyGrades.toggleLock(academicYear, semester, selectedClass, selectedSubject, false);
    setShowUnlockModal(false);
  };

  if (!selectedSubject) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
        Silakan pilih Mata Pelajaran terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">Manajemen Nilai Harian</h3>
            <p className="text-xs text-muted-foreground">Input nilai tugas secara dinamis. Otomatis menghitung rata-rata.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isLocked && hasAccess && (
            <button 
              onClick={handleAddColumn}
              className="flex items-center gap-2 border border-border bg-background px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Kolom</span>
            </button>
          )}
          <button 
            onClick={toggleLock}
            disabled={!hasAccess}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all text-sm font-semibold border disabled:opacity-50 disabled:cursor-not-allowed ${
              isLocked 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20' 
                : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isLocked ? '🔓 Buka Kunci' : '🔒 Kunci Nilai'}</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || isLocked || !hasAccess}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm text-sm font-medium disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Harian'}</span>
          </button>
        </div>
      </div>

      {!hasAccess && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-lg p-3 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span><strong>Mode Lihat Saja:</strong> Anda tidak diizinkan mengedit nilai harian kelas atau mata pelajaran ini.</span>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg p-3 text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Data nilai harian berhasil disimpan!
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium border-b border-r border-border w-12 text-center sticky left-0 bg-muted/90 backdrop-blur z-10">No</th>
                <th className="px-4 py-3 font-medium border-b border-r border-border min-w-[200px] sticky left-12 bg-muted/90 backdrop-blur z-10">Nama Siswa</th>
                
                {columns.map((col, idx) => (
                  <th key={col.id} className="px-2 py-3 font-medium border-b border-r border-border min-w-[100px] bg-primary/5">
                    {isLocked || !hasAccess ? (
                      <div className="text-center w-full px-2">{col.name}</div>
                    ) : (
                      <input 
                        type="text" 
                        value={col.name} 
                        onChange={(e) => handleColumnNameChange(col.id, e.target.value)}
                        className="w-full bg-transparent text-center focus:outline-none focus:border-b focus:border-primary font-medium"
                      />
                    )}
                  </th>
                ))}
                
                <th className="px-4 py-3 font-medium border-b border-border w-32 text-center bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  Rata-rata <span className="block text-[10px] mt-0.5 font-normal">Sinkron ke Tugas</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 3} className="px-6 py-8 text-center text-muted-foreground">
                    Tidak ada siswa di kelas ini.
                  </td>
                </tr>
              ) : students.map((student, rowIndex) => {
                const stdRecords = records[student.id] || {};
                
                let total = 0;
                let count = 0;
                columns.forEach(col => {
                  const val = stdRecords[col.id];
                  if (val !== '' && typeof val === 'number') {
                    total += val;
                    count++;
                  }
                });
                const average = count > 0 ? Math.round(total / count) : '-';

                return (
                  <tr key={student.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-2 border-b border-r border-border text-center text-muted-foreground bg-card sticky left-0 z-10 group-hover:bg-muted/50">
                      {rowIndex + 1}
                    </td>
                    <td className="px-4 py-2 border-b border-r border-border font-medium bg-card sticky left-12 z-10 group-hover:bg-muted/50 truncate max-w-[200px]">
                      {student.name}
                    </td>
                    
                    {columns.map((col, colIndex) => {
                      const val = stdRecords[col.id];
                      const isEmpty = val === '' || val === undefined;
                      
                      return (
                        <td key={col.id} className={`p-0 border-b border-r border-border relative ${isEmpty ? 'bg-yellow-500/10' : ''}`}>
                          <input 
                            type="text" 
                            data-row={rowIndex} data-col={colIndex}
                            disabled={isLocked || !hasAccess}
                            className={`w-full h-full absolute inset-0 px-4 py-2 text-center bg-transparent focus:bg-background focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-all disabled:opacity-80 disabled:cursor-not-allowed ${isEmpty ? 'text-yellow-700 dark:text-yellow-500 placeholder-yellow-600/50 dark:placeholder-yellow-500/40 font-semibold' : ''}`}
                            placeholder={isEmpty ? 'Susulan/Remedial' : ''}
                            value={val === undefined ? '' : val}
                            onChange={(e) => handleGradeChange(student.id, col.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                            onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                          />
                        </td>
                      )
                    })}
                    
                    <td className="px-4 py-2 border-b border-border text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-500/5">
                      {average}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2 border-t border-border">
           <div className="w-3 h-3 bg-yellow-500/20 border border-yellow-500/30 rounded-sm"></div>
           <span>Sel kuning (kosong) menandakan siswa belum mengumpulkan / menunggu susulan. Tidak akan membagi nilai rata-rata. Support Copy-Paste dari Excel.</span>
        </div>
      </div>

      {/* Custom Unlock Security Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 text-amber-500">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                  <h3 className="font-bold text-lg text-foreground">Konfirmasi Pengamanan</h3>
                </div>
                <button 
                  onClick={() => setShowUnlockModal(false)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-foreground leading-relaxed">
                  Anda akan membuka kembali penguncian nilai harian untuk kelas <strong className="text-primary">{className}</strong> dan mata pelajaran <strong className="text-primary">{subjectName}</strong>.
                </p>
                <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg border border-border">
                  ⚠️ <strong>Perhatian:</strong> Membuka kunci memungkinkan Guru dan Admin untuk memodifikasi kembali nilai siswa. Rata-rata nilai tugas akan langsung terhitung ulang di tab Bulk Grading setelah perubahan disimpan.
                </p>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
                >
                  Batalkan
                </button>
                <button 
                  onClick={confirmUnlock}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
                >
                  Ya, Buka Kunci
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
