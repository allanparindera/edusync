import React, { useState, useRef } from 'react';
import { 
  Save, Lock, User as UserIcon, CheckCircle2, Camera, AlertCircle,
  Database, Download, UploadCloud, AlertTriangle, RefreshCw, Server
} from 'lucide-react';
import { authService } from '../services/auth.ts';
import { db } from '../services/db.ts';
import { User } from '../types.ts';
import { CloudSetup } from './CloudSetup.tsx';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';

export const ProfileSettings: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // State Tab Navigasi (hanya aktif untuk Admin)
  const [activeTab, setActiveTab] = useState<'profile' | 'cloud' | 'backup'>('profile');

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'Admin';
  const canChangeAvatar = currentUser.role === 'Admin' || currentUser.role === 'Guru';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setErrorMsg('Ukuran file maksimal 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAvatarUrl(evt.target?.result as string);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password && password !== confirmPassword) {
      setErrorMsg('Password baru dan konfirmasi password tidak cocok!');
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      const updates: Partial<User> = {};
      if (password) updates.password = password;
      if (canChangeAvatar && avatarUrl !== currentUser.avatarUrl) updates.avatarUrl = avatarUrl;

      // Update in DB
      db.users.update(currentUser.id, updates);

      // Update local session
      const updatedUser = { ...currentUser, ...updates };
      authService.updateSession(updatedUser);

      setSuccessMsg('Profil berhasil diperbarui!');
      setPassword('');
      setConfirmPassword('');
      setIsSaving(false);
      
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 500);
  };

  const renderProfileForm = () => (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border bg-muted/10 flex items-center gap-4">
        <div className="relative group">
          <img 
            src={avatarUrl} 
            alt="Profile" 
            className="w-20 h-20 rounded-full border-4 border-background shadow-sm object-cover"
          />
          {canChangeAvatar && (
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
          )}
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </div>
        <div>
          <h3 className="text-xl font-bold">{currentUser.name}</h3>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <span className={`inline-flex w-2 h-2 rounded-full ${currentUser.role === 'Admin' ? 'bg-primary' : currentUser.role === 'Guru' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
            {currentUser.role}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <UserIcon className="w-4 h-4 text-primary" /> Informasi Dasar
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nama Lengkap</label>
              <input 
                type="text" 
                disabled
                value={currentUser.name}
                className="w-full px-3 py-2 bg-muted/50 border border-input rounded-md text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <input 
                type="text" 
                disabled
                value={currentUser.username}
                className="w-full px-3 py-2 bg-muted/50 border border-input rounded-md text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">* Nama dan Username hanya dapat diubah oleh Admin.</p>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
            <Lock className="w-4 h-4 text-primary" /> Keamanan (Ubah Password)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password Baru</label>
              <input 
                type="password" 
                placeholder="Kosongkan jika tidak ingin mengubah"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Konfirmasi Password Baru</label>
              <input 
                type="password" 
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={isSaving || (!password && avatarUrl === currentUser.avatarUrl)}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pengaturan Akun</h2>
        <p className="text-muted-foreground text-sm">Kelola profil, koneksi database cloud, dan cadangan data Anda.</p>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg p-4 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Admin Tabs */}
      {isAdmin && (
        <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <div className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> Profil & Keamanan</div>
          </button>
          <button 
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'cloud' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <div className="flex items-center gap-2"><Server className="w-4 h-4" /> Koneksi Cloud</div>
          </button>
          <button 
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'backup' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <div className="flex items-center gap-2"><Database className="w-4 h-4" /> Cadangan & Pemulihan</div>
          </button>
        </div>
      )}

      {/* Conditionally Render Tabs */}
      {(!isAdmin || activeTab === 'profile') && renderProfileForm()}
      {isAdmin && activeTab === 'cloud' && <CloudSetup />}
      {isAdmin && activeTab === 'backup' && <BackupRestoreSection />}
    </div>
  );
};

// --- SUB-COMPONENT: Backup & Restore Section ---
const BackupRestoreSection: React.FC = () => {
  const dbData = useRealtimeDB();
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  const stats = {
    users: dbData.users?.length || 0,
    classes: dbData.classes?.length || 0,
    subjects: dbData.subjects?.length || 0,
    students: dbData.students?.length || 0,
    attendance: Object.keys(dbData.attendance || {}).reduce((acc, date) => acc + Object.keys(dbData.attendance[date] || {}).length, 0),
    behavior: dbData.behaviorLogs?.length || 0
  };

  const handleExport = () => {
    try {
      const backupData = (db as any).system.getBackupData();
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `edusync_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e: any) {
      alert("Gagal melakukan ekspor data: " + e.message);
    }
  };

  const handleImportFile = async (file: File) => {
    setFileName(file.name);
    setImportStatus('importing');
    setImportMessage('Membaca berkas cadangan...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsedData = JSON.parse(text);
        
        setImportMessage('Memvalidasi dan mengunggah data ke Cloud Supabase...');
        await (db as any).system.importBackup(parsedData);
        
        setImportStatus('success');
        setImportMessage('Database berhasil dipulihkan dari berkas cadangan! Semua data telah diperbarui secara real-time.');
      } catch (err: any) {
        setImportStatus('error');
        setImportMessage(`Gagal memulihkan database: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setImportStatus('error');
      setImportMessage('Gagal membaca berkas.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImportFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Database className="w-5 h-5 text-primary" /> Ringkasan Statistik Database Saat Ini
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Akun Pengguna</span>
            <span className="text-xl font-bold">{stats.users}</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Kelas</span>
            <span className="text-xl font-bold">{stats.classes}</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Mata Pelajaran</span>
            <span className="text-xl font-bold">{stats.subjects}</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Siswa Aktif</span>
            <span className="text-xl font-bold">{stats.students}</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Log Presensi</span>
            <span className="text-xl font-bold">{stats.attendance}</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-border/55 text-center shadow-xs">
            <span className="text-xs text-muted-foreground block mb-1">Log Perilaku</span>
            <span className="text-xl font-bold">{stats.behavior}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" /> Ekspor & Cadangkan Data
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Unduh seluruh salinan data aplikasi Edusync saat ini sebagai berkas <code>.json</code>. Anda dapat menyimpan berkas ini secara lokal di komputer Anda untuk keamanan cadangan tambahan.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm flex justify-center items-center gap-2"
          >
            <Download className="w-4 h-4" /> Unduh Berkas Cadangan (.json)
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" /> Pulihkan & Impor Data
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Unggah berkas cadangan <code>.json</code> untuk memulihkan seluruh database ke titik cadangan sebelumnya.
          </p>

          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 text-xs flex gap-2 items-start mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-medium">
              PERINGATAN: Tindakan ini bersifat destruktif. Seluruh data aktif di cloud database saat ini akan ditimpa sepenuhnya oleh data dari berkas cadangan!
            </p>
          </div>

          {importStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="flex-1 text-xs">{importMessage}</div>
            </div>
          )}

          {importStatus === 'error' && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">{importMessage}</div>
            </div>
          )}

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors relative ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
            } ${importStatus === 'importing' ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {importStatus === 'importing' ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground font-medium">{importMessage}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto" />
                <div className="text-sm">
                  <label className="text-primary hover:underline cursor-pointer font-medium">
                    Pilih berkas
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImportFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>{' '}
                  atau seret berkas ke sini
                </div>
                <p className="text-xs text-muted-foreground">Format yang didukung: berkas JSON (.json)</p>
                {fileName && <p className="text-xs text-primary font-mono bg-primary/10 py-1 px-2 rounded inline-block mt-2">{fileName}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
