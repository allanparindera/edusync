import React, { useState, useMemo, useEffect } from 'react';
import { Award, AlertTriangle, Plus, MessageSquare, Clock, Trash2, X, Filter, Search, Calendar } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { StudentSummary, ClassData } from '../types.ts';
import { authService } from '../services/auth.ts';

interface Props {
  preselectStudentId?: string | null;
  onClearPreselect?: () => void;
}

const PRESETS = [
  { label: 'Terlambat (-5)', type: 'Negatif', points: '5', desc: 'Terlambat masuk kelas' },
  { label: 'Aktif Pembelajaran (+10)', type: 'Positif', points: '10', desc: 'Aktif dalam pembelajaran' },
  { label: 'Tidak Piket (-5)', type: 'Negatif', points: '5', desc: 'Tidak melaksanakan tugas piket' },
  { label: 'Alpa (-20)', type: 'Negatif', points: '20', desc: 'Tidak hadir tanpa keterangan (Alpa)' },
];

export const BehaviorLogger: React.FC<Props> = ({ preselectStudentId, onClearPreselect }) => {
  const dbData = useRealtimeDB();
  const currentUser = authService.getCurrentUser();
  const allStudents: StudentSummary[] = (dbData.students || []).filter(Boolean);
  const classes: ClassData[] = (dbData.classes || []).filter(Boolean);
  
  const isAdmin = currentUser?.role === 'Admin';


  // Active Period Logic
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const defaultSemester = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const defaultYearStr = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [academicYear, setAcademicYear] = useState<string>(defaultYearStr);
  const [semester, setSemester] = useState<string>(defaultSemester);
  
  const [feedAcademicYear, setFeedAcademicYear] = useState<string>(defaultYearStr);
  const [feedSemester, setFeedSemester] = useState<string>(defaultSemester);

  // Dynamic Academic Years
  const availableYears = useMemo(() => db.academicYears.getAll(), [dbData]);

  // --- Form State ---
  const [selectedClassForInput, setSelectedClassForInput] = useState<string>(
    currentUser?.role === 'Guru' ? currentUser.classId || '' : 'all'
  );
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [type, setType] = useState<'Positif' | 'Negatif'>('Positif');
  const [points, setPoints] = useState('5');
  const [description, setDescription] = useState('');

  // --- Feed State ---
  const [feedSearch, setFeedSearch] = useState('');
  const [feedClassFilter, setFeedClassFilter] = useState<string>('all');
  const [feedTimeFilter, setFeedTimeFilter] = useState<string>('today');

  // Handle Preselect from Student Modal
  useEffect(() => {
    if (preselectStudentId) {
      if (!selectedStudents.includes(preselectStudentId)) {
        setSelectedStudents(prev => [...prev, preselectStudentId]);
      }
      const student = allStudents.find(s => s.id === preselectStudentId);
      if (student && isAdmin) {
        setSelectedClassForInput(student.classId);
      }
      if (onClearPreselect) onClearPreselect();
    }
  }, [preselectStudentId, onClearPreselect, selectedStudents, allStudents, isAdmin]);

  // Available students for the dropdown based on selected class
  const availableStudentsForInput = useMemo(() => {
    let filtered = allStudents;
    if (currentUser?.role === 'Guru') {
      filtered = filtered.filter(s => s.classId === currentUser.classId);
    } else if (selectedClassForInput !== 'all') {
      filtered = filtered.filter(s => s.classId === selectedClassForInput);
    }
    // Exclude already selected
    return filtered.filter(s => !selectedStudents.includes(s.id));
  }, [allStudents, currentUser, selectedClassForInput, selectedStudents]);

  const handleAddStudent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id && !selectedStudents.includes(id)) {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(selectedStudents.filter(s => s !== id));
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPreset(val);
    if (val) {
      const preset = PRESETS.find(p => p.label === val);
      if (preset) {
        setType(preset.type as 'Positif' | 'Negatif');
        setPoints(preset.points);
        setDescription(preset.desc);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0 || !description) {
      alert('Pilih minimal satu siswa dan isi keterangan!');
      return;
    }

    selectedStudents.forEach(studentId => {
      const student = allStudents.find(s => s.id === studentId);
      if (student) {
        const newLog = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          studentId: student.id,
          studentName: student.name,
          type,
          points: parseInt(points) || 0,
          description,
          timestamp: new Date().toLocaleString('id-ID'),
          createdAt: new Date().toISOString(),
          academicYear,
          semester
        };
        db.behavior.add(newLog);
      }
    });
    
    // Reset form
    setSelectedStudents([]);
    setDescription('');
    setPoints('5');
    setSelectedPreset('');
    alert(`Berhasil menyimpan catatan untuk ${selectedStudents.length} siswa.`);
  };

  const handleDeleteLog = (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Yakin ingin menghapus log perilaku ini? Poin siswa akan dikembalikan seperti semula.')) {
      db.behavior.delete(id);
    }
  };

  // --- Feed Filtering Logic ---
  const recentLogs = (dbData.behaviorLogs || []).filter(Boolean);
  
  const filteredFeed = useMemo(() => {
    return recentLogs.filter((log: any) => {
      // 1. Search Filter
      const searchMatch = log.studentName?.toLowerCase().includes(feedSearch.toLowerCase()) || 
                          log.description?.toLowerCase().includes(feedSearch.toLowerCase());
      
      // 2. Class Filter
      let classMatch = true;
      if (feedClassFilter !== 'all') {
        const student = allStudents.find(s => s.id === log.studentId);
        classMatch = student?.classId === feedClassFilter;
      }

      // Period Filter
      const periodMatch = (!log.academicYear && feedAcademicYear === defaultYearStr && feedSemester === defaultSemester) || 
                          (log.academicYear === feedAcademicYear && log.semester === feedSemester);
      if (!periodMatch) return false;

      // 3. Time Filter
      let timeMatch = true;
      if (feedTimeFilter !== 'all' && log.createdAt) {
        const logDate = new Date(log.createdAt);
        const now = new Date();
        if (feedTimeFilter === 'today') {
          timeMatch = logDate.toDateString() === now.toDateString();
        } else if (feedTimeFilter === 'week') {
          const diffTime = Math.abs(now.getTime() - logDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          timeMatch = diffDays <= 7;
        } else if (feedTimeFilter === 'month') {
          const diffTime = Math.abs(now.getTime() - logDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          timeMatch = diffDays <= 30;
        }
      }

      return searchMatch && classMatch && timeMatch;
    });
  }, [recentLogs, feedSearch, feedClassFilter, feedTimeFilter, allStudents, feedAcademicYear, feedSemester]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Log Perilaku & Prestasi</h2>
        <p className="text-muted-foreground text-sm">Catat poin kedisiplinan atau keaktifan siswa secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Input Form (Left) */}
        <div className="lg:col-span-5">
          <div className="bg-card border border-border rounded-xl shadow-sm p-5 sticky top-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2 border-b border-border pb-3">
              <Plus className="w-4 h-4 text-primary" /> Input Catatan Baru
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              

              {/* Tahun Ajaran & Semester */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tahun Ajaran</label>
                  <select 
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Semester</label>
                  <select 
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              {/* Pilih Kelas */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Pilih Kelas</label>
                  <select 
                    value={selectedClassForInput}
                    onChange={(e) => {
                      setSelectedClassForInput(e.target.value);
                      setSelectedStudents([]); // Reset selected students when class changes
                    }}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="all">Semua Kelas</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Multi-select Siswa */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pilih Siswa (Bisa lebih dari satu)</label>
                
                {/* Selected Chips */}
                {selectedStudents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/30 rounded-md border border-border min-h-[40px]">
                    {selectedStudents.map(id => {
                      const s = allStudents.find(x => x.id === id);
                      return s ? (
                        <span key={id} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 animate-in zoom-in-95">
                          {s.name}
                          <button type="button" onClick={() => removeStudent(id)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                            <X className="w-3 h-3"/>
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                <select 
                  value=""
                  onChange={handleAddStudent}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                >
                  <option value="" disabled>+ Tambah Siswa...</option>
                  {availableStudentsForInput.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>
                  ))}
                </select>
              </div>

              {/* Kategori / Preset */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <label className="text-sm font-medium">Kategori (Template Cepat)</label>
                <select 
                  value={selectedPreset}
                  onChange={handlePresetChange}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                >
                  <option value="">-- Pilih Template (Opsional) --</option>
                  {PRESETS.map((p, i) => (
                    <option key={i} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Jenis Catatan */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Jenis Catatan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('Positif')}
                    className={`py-2 px-3 rounded-md text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${type === 'Positif' ? 'bg-green-500/10 border-green-500 text-green-700' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
                  >
                    <Award className="w-4 h-4" /> Prestasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('Negatif')}
                    className={`py-2 px-3 rounded-md text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${type === 'Negatif' ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
                  >
                    <AlertTriangle className="w-4 h-4" /> Pelanggaran
                  </button>
                </div>
              </div>

              {/* Poin */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Poin {type === 'Positif' ? 'Plus (+)' : 'Minus (-)'}</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              {/* Keterangan */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Keterangan / Alasan</label>
                <textarea 
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Aktif bertanya saat materi subnetting..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={selectedStudents.length === 0}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
              >
                Simpan Catatan ({selectedStudents.length} Siswa)
              </button>
            </form>
          </div>
        </div>

        {/* Recent Logs Feed (Right) */}
        <div className="lg:col-span-7">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden h-full flex flex-col min-h-[600px]">
            
            {/* Feed Header & Filters */}
            <div className="p-4 border-b border-border bg-muted/10 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Feed Aktivitas Kelas
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-2">

                <div className="flex gap-2 w-full sm:w-auto">
                  <select 
                    value={feedAcademicYear}
                    onChange={(e) => setFeedAcademicYear(e.target.value)}
                    className="flex-1 sm:flex-none pl-3 pr-8 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select 
                    value={feedSemester}
                    onChange={(e) => setFeedSemester(e.target.value)}
                    className="flex-1 sm:flex-none pl-3 pr-8 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Cari nama atau keterangan..." 
                    value={feedSearch}
                    onChange={(e) => setFeedSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                <div className="flex gap-2">
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <select 
                      value={feedClassFilter}
                      onChange={(e) => setFeedClassFilter(e.target.value)}
                      className="pl-8 pr-6 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                    >
                      <option value="all">Semua Kelas</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <select 
                      value={feedTimeFilter}
                      onChange={(e) => setFeedTimeFilter(e.target.value)}
                      className="pl-8 pr-6 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                    >
                      <option value="all">Semua Waktu</option>
                      <option value="today">Hari Ini</option>
                      <option value="week">7 Hari Terakhir</option>
                      <option value="month">30 Hari Terakhir</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Feed List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-muted/5">
              {filteredFeed.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 flex flex-col items-center">
                  <MessageSquare className="w-10 h-10 opacity-20 mb-3" />
                  <p>Tidak ada catatan yang sesuai dengan filter.</p>
                </div>
              ) : (
                filteredFeed.map((log: any) => {
                  if (!log) return null;
                  const student = allStudents.find(s => s.id === log.studentId);
                  const currentScore = student?.behaviorScore || 0;
                  
                  return (
                  <div key={log.id || Math.random()} className="flex gap-4 animate-in slide-in-from-top-2 group">
                    <div className="mt-1 shrink-0">
                      {log.type === 'Positif' ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 border border-green-500/30">
                          <Award className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive border border-destructive/30">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-card border border-border rounded-xl p-4 shadow-sm relative hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{log.studentName}</h4>
                          <p className="text-xs text-muted-foreground">{student?.nis} • {classes.find(c => c.id === student?.classId)?.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" /> {log.timestamp}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Hapus Log"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-foreground mb-3 bg-muted/30 p-2 rounded-md border border-border/50">{log.description}</p>
                      
                      <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${log.type === 'Positif' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                          {log.type === 'Positif' ? '+' : '-'}{log.points} Poin Ditambahkan
                        </span>
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          Total Poin Saat Ini: 
                          <strong className={`text-sm ${currentScore < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {currentScore > 0 ? '+' : ''}{currentScore}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
