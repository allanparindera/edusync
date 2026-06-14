import React, { useState } from 'react';
import { Plus, Edit2, Trash2, BookOpen, Users, X, Check, Calendar, AlertTriangle } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { ClassData, Subject } from '../types.ts';

export const MasterData: React.FC = () => {
  const dbData = useRealtimeDB();
  const classes: ClassData[] = dbData.classes || [];
  const subjects: Subject[] = dbData.subjects || [];
  const academicYearsList = db.academicYears.getAll();

  const [activeTab, setActiveTab] = useState<'classes' | 'subjects' | 'academicYears'>('classes');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '' });

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);

  const openModal = (item?: {id: string, name: string}) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ id: item.id, name: item.name });
    } else {
      setEditingId(null);
      setFormData({ id: '', name: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'classes') {
      if (editingId) {
        db.master.updateClass(editingId, formData.name);
      } else {
        db.master.addClass({ id: formData.id || `C${Date.now()}`, name: formData.name });
      }
    } else if (activeTab === 'subjects') {
      if (editingId) {
        db.master.updateSubject(editingId, formData.name);
      } else {
        db.master.addSubject({ id: formData.id || `M${Date.now()}`, name: formData.name });
      }
    } else if (activeTab === 'academicYears') {
      // Validate format e.g. 2025/2026
      const yearPattern = /^\d{4}\/\d{4}$/;
      if (!yearPattern.test(formData.name)) {
        alert('Format Tahun Ajaran harus YYYY/YYYY (contoh: 2025/2026).');
        return;
      }
      db.academicYears.add(formData.name);
    }
    setIsModalOpen(false);
  };

  const handleDeleteClick = (item: { id: string, name: string }) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    const { id } = itemToDelete;
    if (activeTab === 'classes') {
      db.master.deleteClass(id);
    } else if (activeTab === 'subjects') {
      db.master.deleteSubject(id);
    } else if (activeTab === 'academicYears') {
      db.academicYears.remove(id);
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master Data</h2>
          <p className="text-muted-foreground text-sm">Kelola referensi Kelas dan Mata Pelajaran.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah {activeTab === 'classes' ? 'Kelas' : activeTab === 'subjects' ? 'Mapel' : 'Tahun Ajaran'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
        <button 
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'classes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Data Kelas</div>
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'subjects' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Data Mata Pelajaran</div>
        </button>
        <button 
          onClick={() => setActiveTab('academicYears')}
          className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'academicYears' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
        >
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Tahun Ajaran</div>
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3 font-medium w-32">ID</th>
                <th className="px-6 py-3 font-medium">
                  {activeTab === 'classes' ? 'Nama Kelas' : activeTab === 'subjects' ? 'Nama Mata Pelajaran' : 'Tahun Ajaran'}
                </th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(activeTab === 'classes' 
                ? classes 
                : activeTab === 'subjects' 
                  ? subjects 
                  : academicYearsList.map(y => ({ id: y, name: y }))
              ).map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-muted-foreground">{item.id}</td>
                  <td className="px-6 py-4 font-medium">{item.name}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {activeTab !== 'academicYears' && (
                        <button onClick={() => openModal(item)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteClick(item)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(activeTab === 'classes' 
                ? classes 
                : activeTab === 'subjects' 
                  ? subjects 
                  : academicYearsList
              ).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Data' : 'Tambah Data Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {!editingId && activeTab !== 'academicYears' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">ID (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Dibuat otomatis jika kosong"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {activeTab === 'classes' ? 'Nama Kelas' : activeTab === 'subjects' ? 'Nama Mata Pelajaran' : 'Tahun Ajaran (Contoh: 2025/2026)'}
                </label>
                <input 
                  required 
                  type="text" 
                  placeholder={activeTab === 'academicYears' ? '2025/2026' : ''}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Hapus Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Yakin ingin menghapus <strong>{itemToDelete.name}</strong>? Data yang terkait di kelas, siswa, atau nilai mungkin akan terpengaruh.
                </p>
              </div>
            </div>
            <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-3">
              <p className="text-xs text-destructive font-medium">⚠️ Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
