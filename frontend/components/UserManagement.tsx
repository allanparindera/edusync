import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, ShieldCheck, X, Check, Upload, Camera, Download, Filter, CheckSquare } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { User, Role, StudentSummary, ClassData, Subject } from '../types.ts';

export const UserManagement: React.FC = () => {
  const dbData = useRealtimeDB();
  const users: User[] = (dbData.users || []).filter(Boolean);
  const students: StudentSummary[] = (dbData.students || []).filter(Boolean);
  const classes: ClassData[] = (dbData.classes || []).filter(Boolean);
  const subjects: Subject[] = (dbData.subjects || []).filter(Boolean);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    name: '',
    role: 'Guru',
    classId: '',
    subjectId: '',
    studentId: '',
    avatarUrl: '',
    status: 'Aktif'
  });

  // Link Mode State for Ortu/Siswa
  const [studentLinkMode, setStudentLinkMode] = useState<'existing' | 'new'>('existing');
  const [newStudentNis, setNewStudentNis] = useState('');
  const [newStudentClassId, setNewStudentClassId] = useState('');

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterClass]);

  // SAFE FILTERING: Mencegah crash jika u.name atau u.username undefined
  const filteredUsers = users.filter(u => {
    if (!u) return false;
    const name = u.name || '';
    const username = u.username || '';
    const search = searchTerm.toLowerCase();
    
    const matchSearch = name.toLowerCase().includes(search) || username.toLowerCase().includes(search);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    
    let userClassId = u.classId;
    if (u.role === 'Ortu/Siswa' && u.studentId) {
      const student = students.find(s => s.id === u.studentId);
      if (student) userClassId = student.classId;
    }
    const matchClass = filterClass === 'all' || userClassId === filterClass;

    return matchSearch && matchRole && matchClass;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Bulk Selection Handlers ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedUsers.filter(u => u && u.id).map(u => u.id);
      const newIds = new Set([...selectedIds, ...pageIds]);
      setSelectedIds(Array.from(newIds));
    } else {
      const pageIds = paginatedUsers.filter(u => u && u.id).map(u => u.id);
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
      if (selectedIds.includes('u1')) {
        alert('Super Admin tidak dapat dihapus! Silakan hilangkan centang pada Super Admin.');
        return;
      }
      if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} akun terpilih?`)) {
        db.users.deleteBulk(selectedIds);
        setSelectedIds([]);
      }
    } else if (action === 'suspend') {
      if (selectedIds.includes('u1')) {
        alert('Super Admin tidak dapat di-suspend!');
        return;
      }
      db.users.updateBulk(selectedIds, { status: 'Suspend' });
      setSelectedIds([]);
    } else if (action === 'aktif') {
      db.users.updateBulk(selectedIds, { status: 'Aktif' });
      setSelectedIds([]);
    } else if (action === 'reset') {
      if (window.confirm(`Apakah Anda yakin ingin mereset password ${selectedIds.length} akun terpilih menjadi sama dengan username mereka?`)) {
        db.users.resetPasswordBulk(selectedIds);
        setSelectedIds([]);
      }
    }
  };

  const toggleUserStatus = (user: User) => {
    if (user.id === 'u1') {
      alert('Status Super Admin tidak dapat diubah!');
      return;
    }
    const newStatus = user.status === 'Suspend' ? 'Aktif' : 'Suspend';
    db.users.update(user.id, { status: newStatus });
  };

  const openAddModal = () => {
    setEditingId(null);
    setStudentLinkMode('existing');
    setNewStudentNis('');
    setNewStudentClassId(classes[0]?.id || '');
    setFormData({ 
      username: '', 
      password: '', 
      name: '', 
      role: 'Guru', 
      classId: '', 
      subjectId: '',
      studentId: '',
      avatarUrl: `https://picsum.photos/100/100?random=${Date.now()}`,
      status: 'Aktif'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    if (!user) return;
    setEditingId(user.id);
    setStudentLinkMode('existing'); // Cannot create new student when editing
    setFormData({
      username: user.username || '',
      password: user.password || '',
      name: user.name || '',
      role: user.role || 'Guru',
      classId: user.classId || '',
      subjectId: user.subjectId || '',
      studentId: user.studentId || '',
      avatarUrl: user.avatarUrl || '',
      status: user.status || 'Aktif'
    });
    setIsModalOpen(true);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('Ukuran file maksimal 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFormData({ ...formData, avatarUrl: evt.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userData = {
      ...formData,
      avatarUrl: formData.avatarUrl || `https://picsum.photos/100/100?random=${Date.now()}`
    } as User;

    // Clean up irrelevant fields based on role
    if (userData.role === 'Admin') {
      delete userData.classId;
      delete userData.studentId;
      delete userData.subjectId;
    } else if (userData.role === 'Guru') {
      delete userData.studentId;
      if (!userData.subjectId) delete userData.subjectId;
    } else if (userData.role === 'Ortu/Siswa') {
      delete userData.classId;
      delete userData.subjectId;

      // Handle auto-create student
      if (!editingId && studentLinkMode === 'new') {
        const maxStudentId = students.reduce((max, s) => {
          if (!s || !s.id) return max;
          const num = parseInt(s.id.replace(/\D/g, ''));
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        const newStudentId = `S${String(maxStudentId + 1).padStart(3, '0')}`;
        
        const newStudent: StudentSummary = {
          id: newStudentId,
          nis: newStudentNis,
          name: userData.name,
          classId: newStudentClassId,
          status: 'Aktif',
          avatarUrl: userData.avatarUrl,
          attendanceRate: 100,
          totalLateMinutes: 0,
          averageGrade: 0,
          totalScore: 0,
          rank: 0,
          behaviorScore: 0,
          competencies: []
        };
        db.students.add(newStudent);
        userData.studentId = newStudentId;
      }
    }

    if (editingId) {
      db.users.update(editingId, userData);
    } else {
      const maxUserId = users.reduce((max, u) => {
        if (!u || !u.id) return max;
        const num = parseInt(u.id.replace(/\D/g, ''));
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      userData.id = `U${String(maxUserId + 1).padStart(3, '0')}`;
      db.users.add(userData);
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (id === 'u1') {
      alert('Super Admin tidak dapat dihapus!');
      return;
    }
    if (window.confirm('Apakah Anda yakin ingin menghapus akun ini?')) {
      db.users.delete(id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newUsers: User[] = [];
      
      let currentMaxUserId = users.reduce((max, u) => {
        if (!u || !u.id) return max;
        const num = parseInt(u.id.replace(/\D/g, ''));
        return !isNaN(num) && num > max ? num : max;
      }, 0);

      // Skip header row
      lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(',').map(p => p.trim());
        // Expected format: Nama, Username, Password, Role, ClassId, StudentId, AvatarUrl
        if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
          currentMaxUserId++;
          newUsers.push({
            id: `U${String(currentMaxUserId).padStart(3, '0')}`,
            name: parts[0],
            username: parts[1],
            password: parts[2],
            role: parts[3] as Role,
            classId: parts[4] || undefined,
            studentId: parts[5] || undefined,
            avatarUrl: parts[6] || `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`,
            status: 'Aktif'
          });
        }
      });
      
      if (newUsers.length > 0) {
        db.users.importBulk(newUsers);
        alert(`Berhasil mengimpor ${newUsers.length} akun.`);
      } else {
        alert('Gagal mengimpor. Pastikan format CSV benar (Nama, Username, Password, Role, ClassId, StudentId, AvatarUrl).');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = "Nama,Username,Password,Role,ClassId,StudentId,AvatarUrl\nGuru Baru,guru01,pass123,Guru,C001,,\nSiswa Baru,siswa01,pass123,Ortu/Siswa,,S001,";
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Template_Import_Akun.csv';
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manajemen Akun</h2>
          <p className="text-muted-foreground text-sm">Kelola akses login untuk Admin, Guru, dan Siswa/Ortu.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 border border-border bg-background px-4 py-2 rounded-md hover:bg-muted transition-colors shadow-sm text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Template CSV</span>
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
            <span>Tambah Akun</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.length} akun terpilih
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              className="text-sm bg-background border border-primary/30 text-primary px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              onChange={(e) => handleBulkAction(e.target.value)}
              value=""
            >
              <option value="" disabled>-- Pilih Aksi Massal --</option>
              <option value="aktif">Aktifkan Terpilih</option>
              <option value="suspend">Suspend Terpilih</option>
              <option value="reset">Reset Password Terpilih</option>
              <option value="delete">Hapus Terpilih</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari username atau nama..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-sm bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">Semua Role</option>
                <option value="Admin">Admin</option>
                <option value="Guru">Guru</option>
                <option value="Ortu/Siswa">Ortu/Siswa</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="text-sm bg-transparent border-none focus:ring-0 font-medium cursor-pointer outline-none text-foreground"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="all">Semua Kelas</option>
                {classes.map(c => c && <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-input text-primary focus:ring-primary"
                    checked={paginatedUsers.length > 0 && paginatedUsers.every(u => u && selectedIds.includes(u.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Pengguna</th>
                <th className="px-6 py-3 font-medium">Username</th>
                <th className="px-6 py-3 font-medium">Password</th>
                <th className="px-6 py-3 font-medium">Role & Akses</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedUsers.map((user) => {
                if (!user) return null;
                
                let userClassDisplay = '-';
                let userSubjectDisplay = '';
                if (user.role === 'Guru' && user.classId) {
                  userClassDisplay = classes.find(c => c && c.id === user.classId)?.name || user.classId;
                  if (user.subjectId) {
                    const subj = subjects.find(s => s && s.id === user.subjectId);
                    userSubjectDisplay = subj ? ` (${subj.name})` : ` (${user.subjectId})`;
                  }
                } else if (user.role === 'Ortu/Siswa' && user.studentId) {
                  const student = students.find(s => s && s.id === user.studentId);
                  if (student && student.classId) {
                    userClassDisplay = classes.find(c => c && c.id === student.classId)?.name || student.classId;
                  }
                }

                return (
                <tr key={user.id || Math.random()} className={`hover:bg-muted/30 transition-colors ${selectedIds.includes(user.id) ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-input text-primary focus:ring-primary"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => handleSelectOne(user.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={user.avatarUrl} alt={user.name} className={`w-8 h-8 rounded-full border border-border object-cover ${user.status === 'Suspend' ? 'grayscale opacity-50' : ''}`} />
                      <span className={`font-medium text-foreground ${user.status === 'Suspend' ? 'line-through text-muted-foreground' : ''}`}>{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">{user.username}</td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">
                    {user.password ? '••••••••' : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === 'Admin' ? 'bg-primary/10 text-primary' : 
                        user.role === 'Guru' ? 'bg-blue-500/10 text-blue-600' : 
                        'bg-green-500/10 text-green-600'
                      }`}>
                        {user.role}
                      </span>
                      {(user.role === 'Guru' || user.role === 'Ortu/Siswa') && (
                        <span className="text-xs text-muted-foreground">Kelas: {userClassDisplay}{user.role === 'Guru' && userSubjectDisplay}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => toggleUserStatus(user)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${user.status === 'Suspend' ? 'bg-muted-foreground' : 'bg-green-500'}`}
                        title={user.status === 'Suspend' ? 'Aktifkan Akun' : 'Suspend Akun'}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${user.status === 'Suspend' ? 'translate-x-1' : 'translate-x-5'}`} />
                      </button>
                      <div className="w-px h-4 bg-border mx-1"></div>
                      <button onClick={() => openEditModal(user)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Tidak ada data akun yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-muted/10">
          <span>Menampilkan {paginatedUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} hingga {Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari {filteredUsers.length} entri</span>
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {editingId ? 'Edit Akun' : 'Tambah Akun Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* Avatar Upload */}
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="relative group">
                    <img 
                      src={formData.avatarUrl || `https://picsum.photos/100/100?random=${Date.now()}`} 
                      alt="Avatar Preview" 
                      className="w-20 h-20 rounded-full border-2 border-border object-cover"
                    />
                    <button 
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={avatarInputRef} 
                      className="hidden" 
                      onChange={handleAvatarUpload} 
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2">Klik foto untuk mengubah (Maks 500KB)</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Lengkap</label>
                  <input 
                    required type="text" 
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <input 
                      required type="text" 
                      className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <div className="flex flex-col gap-2">
                      <input 
                        required type="text" 
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                      {editingId && (
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, password: formData.username})}
                          className="text-xs bg-muted text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border transition-colors w-fit"
                        >
                          Reset ke Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role Akses</label>
                  <select 
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="Admin">Admin (Akses Penuh)</option>
                    <option value="Guru">Guru (Akses Kelas)</option>
                    <option value="Ortu/Siswa">Ortu/Siswa (Read-Only)</option>
                  </select>
                </div>

                {formData.role === 'Guru' && (
                  <>
                    <div className="space-y-2 animate-in fade-in">
                      <label className="text-sm font-medium">Penempatan Kelas</label>
                      <select 
                        required
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})}
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map(c => c && <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2 animate-in fade-in">
                      <label className="text-sm font-medium">Mata Pelajaran Pengampu (Opsional)</label>
                      <select 
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.subjectId || ''} onChange={e => setFormData({...formData, subjectId: e.target.value || ''})}
                      >
                        <option value="">-- Semua Mata Pelajaran --</option>
                        {subjects.map(s => s && <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {formData.role === 'Ortu/Siswa' && (
                  <div className="space-y-4 animate-in fade-in border p-4 rounded-lg bg-muted/30">
                    {!editingId && (
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" checked={studentLinkMode === 'existing'} onChange={() => setStudentLinkMode('existing')} className="text-primary focus:ring-primary" />
                          Pilih Siswa yang Ada
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" checked={studentLinkMode === 'new'} onChange={() => setStudentLinkMode('new')} className="text-primary focus:ring-primary" />
                          Buat Data Siswa Baru
                        </label>
                      </div>
                    )}

                    {studentLinkMode === 'existing' || editingId ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Hubungkan ke Data Siswa</label>
                        <select 
                          required
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})}
                        >
                          <option value="">-- Pilih Siswa --</option>
                          {students.map(s => s && (
                            <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">NIS Siswa Baru</label>
                          <input 
                            required type="text" 
                            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            value={newStudentNis} onChange={e => setNewStudentNis(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Kelas</label>
                          <select 
                            required
                            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            value={newStudentClassId} onChange={e => setNewStudentClassId(e.target.value)}
                          >
                            <option value="">-- Pilih Kelas --</option>
                            {classes.map(c => c && <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
            <div className="p-5 border-t border-border shrink-0 flex justify-end gap-3 bg-muted/10">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted">
                Batal
              </button>
              <button type="submit" form="user-form" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
                <Check className="w-4 h-4" /> Simpan Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
