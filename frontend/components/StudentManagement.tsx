import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, X, Check, Upload, CheckSquare, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { StudentSummary, ClassData, User } from '../types.ts';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { authService } from '../services/auth.ts';
import { StudentModal } from './StudentModal.tsx';
import { exportToCSV } from '../utils/export.ts';

export const StudentManagement: React.FC = () => {
  const dbData = useRealtimeDB();
  const currentUser = authService.getCurrentUser();
  
  // SAFE: Filter out nulls/undefined from DB
  const allStudents: StudentSummary[] = (dbData.students || []).filter(Boolean);
  const allUsers: User[] = (dbData.users || []).filter(Boolean);
  const classes: ClassData[] = (dbData.classes || []).filter(Boolean);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = currentUser?.role === 'Admin';

  // Data Isolation
  const students = useMemo(() => {
    if (isAdmin) return allStudents;
    if (currentUser?.role === 'Guru') return allStudents.filter(s => s && s.classId === currentUser.classId);
    return [];
  }, [allStudents, currentUser, isAdmin]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'class' | 'status' | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{key: 'nis' | 'name', direction: 'asc' | 'desc'} | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Auto-create account state
  const [createAccount, setCreateAccount] = useState(true);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [searchTerm, filterClass, filterStatus, sortConfig]);

  // Get the freshest student object for the modal
  const selectedStudent = useMemo(() => {
    return students.find(s => s && s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const classStudentsOfSelected = useMemo(() => {
    if (!selectedStudent) return [];
    return allStudents.filter(s => s && s.classId === selectedStudent.classId);
  }, [allStudents, selectedStudent]);

  const classAverageForSelected = useMemo(() => {
    if (classStudentsOfSelected.length === 0) return 0;
    const total = classStudentsOfSelected.reduce((acc, s) => acc + (s.averageGrade || 0), 0);
    return parseFloat((total / classStudentsOfSelected.length).toFixed(1));
  }, [classStudentsOfSelected]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [formData, setFormData] = useState({
    nis: '',
    name: '',
    classId: currentUser?.role === 'Guru' ? currentUser.classId || (classes[0]?.id || '') : (classes[0]?.id || ''),
    status: 'Aktif' as 'Aktif' | 'Non-Aktif' | 'Lulus' | 'Pindah'
  });

  // Bulk Edit Form State
  const [bulkFormData, setBulkFormData] = useState({
    classId: '',
    status: ''
  });

  // SAFE FILTERING
  const filteredStudents = students.filter(s => {
    if (!s) return false;
    const name = s.name || '';
    const nis = s.nis || '';
    const search = searchTerm.toLowerCase();
    
    const matchSearch = name.toLowerCase().includes(search) || nis.toLowerCase().includes(search);
    const matchClass = filterClass === 'all' || s.classId === filterClass;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    
    return matchSearch && matchClass && matchStatus;
  });

  // SORTING LOGIC
  const sortedStudents = useMemo(() => {
    let sortableItems = [...filteredStudents];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredStudents, sortConfig]);

  const handleSort = (key: 'nis' | 'name') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: 'nis' | 'name' }) => {
    if (sortConfig?.key === columnKey) {
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
    }
    return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
  };

  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const paginatedStudents = sortedStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Bulk Selection Handlers ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedStudents.filter(s => s && s.id).map(s => s.id);
      const newIds = new Set([...selectedIds, ...pageIds]);
      setSelectedIds(Array.from(newIds));
    } else {
      const pageIds = paginatedStudents.filter(s => s && s.id).map(s => s.id);
      setSelectedIds(selectedIds.filter(id => !pageIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string) => {
    if (!id) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = (action: string) => {
    if (!action || selectedIds.length === 0) return;
    
    if (action === 'delete') {
      if (!isAdmin) return;
      if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} siswa terpilih? Data nilai dan presensi juga akan terhapus.`)) {
        db.students.deleteBulk(selectedIds);
        setSelectedIds([]);
      }
    } else if (action === 'mutasi') {
      setBulkActionType('class');
      setBulkFormData({ classId: classes[0]?.id || '', status: '' });
      setIsBulkEditModalOpen(true);
    } else if (action === 'status') {
      setBulkActionType('status');
      setBulkFormData({ classId: '', status: 'Aktif' });
      setIsBulkEditModalOpen(true);
    }
  };

  const handleBulkEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<StudentSummary> = {};
    
    if (bulkActionType === 'class' && bulkFormData.classId) {
      updates.classId = bulkFormData.classId;
    } else if (bulkActionType === 'status' && bulkFormData.status) {
      updates.status = bulkFormData.status as any;
    }
    
    if (Object.keys(updates).length > 0) {
      db.students.updateBulk(selectedIds, updates);
    }
    
    setIsBulkEditModalOpen(false);
    setSelectedIds([]);
    setBulkActionType(null);
    setBulkFormData({ classId: '', status: '' });
  };

  // --- Single Item Handlers ---
  const openAddModal = () => {
    setEditingId(null);
    setCreateAccount(true);
    setFormData({ 
      nis: '', 
      name: '', 
      classId: currentUser?.role === 'Guru' ? currentUser.classId || (classes[0]?.id || '') : (classes[0]?.id || ''), 
      status: 'Aktif' 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student: StudentSummary) => {
    if (!student) return;
    setEditingId(student.id);
    setFormData({
      nis: student.nis || '',
      name: student.name || '',
      classId: student.classId || '',
      status: student.status || 'Aktif'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      db.students.update(editingId, formData);
    } else {
      const maxStudentId = allStudents.reduce((max, s) => {
        if (!s || !s.id) return max;
        const num = parseInt(s.id.replace(/\D/g, ''));
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      const newStudentId = `S${String(maxStudentId + 1).padStart(3, '0')}`;
      
      const avatarUrl = `https://picsum.photos/150/150?random=${maxStudentId + 10}`;
      
      const studentToAdd: StudentSummary = {
        id: newStudentId,
        ...formData,
        avatarUrl,
        attendanceRate: 100,
        totalLateMinutes: 0,
        averageGrade: 0,
        totalScore: 0,
        rank: 0,
        behaviorScore: 0,
        competencies: []
      };
      db.students.add(studentToAdd);

      if (createAccount) {
        const maxUserId = allUsers.reduce((max, u) => {
          if (!u || !u.id) return max;
          const num = parseInt(u.id.replace(/\D/g, ''));
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        const newUserId = `U${String(maxUserId + 1).padStart(3, '0')}`;

        const newUser: User = {
          id: newUserId,
          username: formData.nis,
          password: formData.nis,
          name: formData.name,
          role: 'Ortu/Siswa',
          studentId: newStudentId,
          avatarUrl: avatarUrl,
          status: 'Aktif'
        };
        db.users.add(newUser);
      }
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Apakah Anda yakin ingin menghapus siswa ini? Data nilai dan presensi juga akan terhapus.')) {
      db.students.delete(id);
    }
  };

  const handleExportCSV = () => {
    const exportData = sortedStudents.map((s, index) => ({
      No: index + 1,
      NIS: s.nis,
      Nama: s.name,
      Kelas: classes.find(c => c.id === s.classId)?.name || s.classId,
      Status: s.status,
      Kehadiran: `${s.attendanceRate}%`,
      Rata_Rata_Nilai: s.averageGrade
    }));
    exportToCSV('Data_Siswa.csv', exportData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newStudents: StudentSummary[] = [];
      
      let currentMaxStudentId = allStudents.reduce((max, s) => {
        if (!s || !s.id) return max;
        const num = parseInt(s.id.replace(/\D/g, ''));
        return !isNaN(num) && num > max ? num : max;
      }, 0);

      lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          currentMaxStudentId++;
          const newStudentId = `S${String(currentMaxStudentId).padStart(3, '0')}`;

          newStudents.push({
            id: newStudentId,
            nis: parts[0],
            name: parts[1],
            classId: parts[2] || (currentUser?.role === 'Guru' ? currentUser.classId || (classes[0]?.id || '') : (classes[0]?.id || '')),
            status: (parts[3] as any) || 'Aktif',
            avatarUrl: `https://picsum.photos/150/150?random=${Math.floor(Math.random() * 1000)}`,
            attendanceRate: 100,
            totalLateMinutes: 0,
            averageGrade: 0,
            totalScore: 0,
            rank: 0,
            behaviorScore: 0,
            competencies: []
          });
        }
      });
      
      if (newStudents.length > 0) {
        db.students.importBulk(newStudents);
        
        if (window.confirm(`Berhasil mengimpor ${newStudents.length} siswa.\n\nApakah Anda ingin membuat akun login otomatis untuk mereka? (Username & Password = NIS)`)) {
          let currentMaxUserId = allUsers.reduce((max, u) => {
            if (!u || !u.id) return max;
            const num = parseInt(u.id.replace(/\D/g, ''));
            return !isNaN(num) && num > max ? num : max;
          }, 0);

          const newUsers: User[] = newStudents.map(s => {
            currentMaxUserId++;
            return {
              id: `U${String(currentMaxUserId).padStart(3, '0')}`,
              username: s.nis,
              password: s.nis,
              name: s.name,
              role: 'Ortu/Siswa',
              studentId: s.id,
              avatarUrl: s.avatarUrl || '',
              status: 'Aktif'
            };
          });
          db.users.importBulk(newUsers);
          alert('Siswa dan Akun login berhasil dibuat!');
        } else {
          alert(`Berhasil mengimpor ${newStudents.length} siswa.`);
        }
      } else {
        alert('Gagal mengimpor. Pastikan format CSV benar (NIS, Nama, Kelas, Status).');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manajemen Siswa</h2>
          <p className="text-muted-foreground text-sm">Kelola data induk siswa, status aktif, dan mutasi kelas.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-border bg-background px-4 py-2 rounded-md hover:bg-muted transition-colors shadow-sm text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors shadow-sm text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.length} siswa terpilih
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              className="text-sm bg-background border border-primary/30 text-primary px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              onChange={(e) => handleBulkAction(e.target.value)}
              value=""
            >
              <option value="" disabled>-- Pilih Aksi Massal --</option>
              <option value="mutasi">Mutasi Kelas</option>
              <option value="status">Ubah Status</option>
              {isAdmin && <option value="delete">Hapus Terpilih</option>}
            </select>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-muted/10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan Nama atau NIS..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-sm bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Lulus">Lulus</option>
                <option value="Pindah">Pindah</option>
                <option value="Non-Aktif">Non-Aktif</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-sm bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                disabled={currentUser?.role === 'Guru'}
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-input text-primary focus:ring-primary"
                    checked={paginatedStudents.length > 0 && paginatedStudents.every(s => s && selectedIds.includes(s.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('nis')}>
                  NIS <SortIcon columnKey="nis" />
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleSort('name')}>
                  Profil Siswa <SortIcon columnKey="name" />
                </th>
                <th className="px-6 py-3 font-medium">Kelas</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => {
                  if (!student) return null;
                  return (
                  <tr key={student.id || Math.random()} className={`hover:bg-muted/30 transition-colors ${selectedIds.includes(student.id) ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-input text-primary focus:ring-primary"
                        checked={selectedIds.includes(student.id)}
                        onChange={() => handleSelectOne(student.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">{student.nis}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={student.avatarUrl} alt={student.name} className="w-8 h-8 rounded-full border border-border object-cover" />
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {classes.find(c => c.id === student.classId)?.name || student.classId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.status === 'Aktif' ? 'bg-green-500/10 text-green-600' : 
                        student.status === 'Lulus' ? 'bg-blue-500/10 text-blue-600' :
                        student.status === 'Pindah' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          student.status === 'Aktif' ? 'bg-green-500' : 
                          student.status === 'Lulus' ? 'bg-blue-500' :
                          student.status === 'Pindah' ? 'bg-amber-500' :
                          'bg-destructive'
                        }`}></span>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedStudentId(student.id)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Lihat Detail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(student)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(student.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Tidak ada data siswa yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-muted/10">
          <span>Menampilkan {paginatedStudents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} hingga {Math.min(currentPage * itemsPerPage, sortedStudents.length)} dari {sortedStudents.length} entri</span>
          <div className="flex gap-1 items-center">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1 font-medium text-foreground">
              {currentPage} / {totalPages || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nomor Induk Siswa (NIS)</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.nis}
                  onChange={e => setFormData({...formData, nis: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Lengkap</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Penempatan Kelas</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.classId}
                  onChange={e => setFormData({...formData, classId: e.target.value})}
                  disabled={currentUser?.role === 'Guru'}
                >
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Lulus">Lulus</option>
                  <option value="Pindah">Pindah</option>
                  <option value="Non-Aktif">Non-Aktif</option>
                </select>
              </div>

              {!editingId && (
                <div className="pt-2 pb-2">
                  <label className="flex items-center gap-3 text-sm cursor-pointer bg-primary/5 p-3 rounded-lg border border-primary/20">
                    <input 
                      type="checkbox" 
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="rounded border-primary text-primary focus:ring-primary w-4 h-4"
                    />
                    <div>
                      <span className="font-medium text-primary block">Buat Akun Login Otomatis</span>
                      <span className="text-xs text-muted-foreground">Username & Password akan menggunakan NIS siswa.</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-semibold">
                {bulkActionType === 'class' ? 'Mutasi Kelas Massal' : 'Ubah Status Massal'} ({selectedIds.length} Siswa)
              </h3>
              <button onClick={() => setIsBulkEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkEditSubmit} className="p-5 space-y-4">
              
              {bulkActionType === 'class' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pindah ke Kelas</label>
                  <select 
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={bulkFormData.classId}
                    onChange={e => setBulkFormData({...bulkFormData, classId: e.target.value})}
                    disabled={currentUser?.role === 'Guru'}
                  >
                    <option value="" disabled>-- Pilih Kelas Tujuan --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {bulkActionType === 'status' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ubah Status Menjadi</label>
                  <select 
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={bulkFormData.status}
                    onChange={e => setBulkFormData({...bulkFormData, status: e.target.value})}
                  >
                    <option value="" disabled>-- Pilih Status Baru --</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
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

      {/* Detail Modal */}
      <StudentModal 
        student={selectedStudent} 
        onClose={() => setSelectedStudentId(null)} 
        classStudentCount={classStudentsOfSelected.length}
        classAverageGrade={classAverageForSelected}
      />
    </div>
  );
};
