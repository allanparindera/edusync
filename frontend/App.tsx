import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, FileSpreadsheet, Settings, 
  Bell, Menu, Moon, Sun, LogOut, BookOpen,
  CalendarCheck, Award, Wifi, ShieldAlert, ShieldCheck, Database, Activity
} from 'lucide-react';
import { Dashboard } from './components/Dashboard.tsx';
import { StudentManagement } from './components/StudentManagement.tsx';
import { BulkGrading } from './components/BulkGrading.tsx';
import { AttendanceTracker } from './components/AttendanceTracker.tsx';
import { BehaviorLogger } from './components/BehaviorLogger.tsx';
import { UserManagement } from './components/UserManagement.tsx';
import { MasterData } from './components/MasterData.tsx';
import { ProfileSettings } from './components/ProfileSettings.tsx';
import { SystemLogs } from './components/SystemLogs.tsx';
import { Login } from './components/Login.tsx';
import { useRealtimeDB } from './hooks/useRealtimeDB.ts';
import { db, initCloudSync } from './services/db.ts';
import { authService } from './services/auth.ts';
import { User } from './types.ts';

type ViewState = 'dashboard' | 'attendance' | 'behavior' | 'students' | 'grading' | 'users' | 'master' | 'settings' | 'system-logs';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [preselectStudentId, setPreselectStudentId] = useState<string | null>(null);
  
  // Subscribe to real-time DB
  const dbData = useRealtimeDB();
  const notifications = dbData.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Check session on mount and listen for auth updates
  useEffect(() => {
    const loadUser = () => {
      const user = authService.getCurrentUser();
      if (user) setCurrentUser(user);
    };
    loadUser();
    window.addEventListener('edusync-auth-update', loadUser);
    return () => window.removeEventListener('edusync-auth-update', loadUser);
  }, []);

  // Initialize Cloud Sync Automatically
  useEffect(() => {
    initCloudSync();
  }, []);

  // Listen for custom navigation events
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.view) {
        setCurrentView(customEvent.detail.view);
        if (customEvent.detail.studentId) {
          setPreselectStudentId(customEvent.detail.studentId);
        }
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  // Toggle dark mode class on html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      db.notifications.markAllRead();
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('dashboard'); // Reset view
  };

  // If not logged in, show Login page
  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  // Role-based access checks
  const isAdmin = currentUser.role === 'Admin';
  const isGuru = currentUser.role === 'Guru';
  const isSiswa = currentUser.role === 'Ortu/Siswa';

  const canViewAttendance = isAdmin || isGuru;
  const canViewBehavior = isAdmin || isGuru;
  const canViewStudents = isAdmin || isGuru;
  const canViewGrading = isAdmin || isGuru;
  const canViewUsers = isAdmin;
  const canViewMaster = isAdmin;
  const canViewLogs = isAdmin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted text-foreground flex overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 glass border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">EduSync</span>
        </div>
        
        <div className="p-4 space-y-1 flex-1 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2">Menu Utama</p>
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Dashboard Analitik" 
            isActive={currentView === 'dashboard'} 
            onClick={() => { setCurrentView('dashboard'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          />
          
          {canViewAttendance && (
            <>
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6">Aktivitas Harian (Mobile)</p>
              <NavItem 
                icon={<CalendarCheck className="w-5 h-5" />} 
                label="Presensi Kelas" 
                isActive={currentView === 'attendance'} 
                onClick={() => { setCurrentView('attendance'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              />
              <NavItem 
                icon={<Award className="w-5 h-5" />} 
                label="Log Perilaku" 
                isActive={currentView === 'behavior'} 
                onClick={() => { setCurrentView('behavior'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              />
            </>
          )}

          {canViewStudents && (
            <>
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6">Administrasi (Web)</p>
              <NavItem 
                icon={<Users className="w-5 h-5" />} 
                label="Manajemen Siswa" 
                isActive={currentView === 'students'} 
                onClick={() => { setCurrentView('students'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              />
              <NavItem 
                icon={<FileSpreadsheet className="w-5 h-5" />} 
                label="Bulk Grading" 
                isActive={currentView === 'grading'} 
                onClick={() => { setCurrentView('grading'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              />
            </>
          )}
          
          <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6">Pengaturan</p>
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Pengaturan Akun" 
            isActive={currentView === 'settings'} 
            onClick={() => { setCurrentView('settings'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
          />

          {(canViewMaster || canViewUsers || canViewLogs) && (
            <>
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-6">Sistem & Keamanan</p>
              {canViewMaster && (
                <NavItem 
                  icon={<Database className="w-5 h-5" />} 
                  label="Master Data" 
                  isActive={currentView === 'master'} 
                  onClick={() => { setCurrentView('master'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                />
              )}
              {canViewUsers && (
                <NavItem 
                  icon={<ShieldCheck className="w-5 h-5" />} 
                  label="Manajemen Akun" 
                  isActive={currentView === 'users'} 
                  onClick={() => { setCurrentView('users'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                />
              )}
              {canViewLogs && (
                <NavItem 
                  icon={<Activity className="w-5 h-5" />} 
                  label="Log Sistem" 
                  isActive={currentView === 'system-logs'} 
                  onClick={() => { setCurrentView('system-logs'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                />
              )}
            </>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <img src={currentUser.avatarUrl} alt="User" className="w-10 h-10 rounded-full border border-border object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-primary' : isGuru ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                {currentUser.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header */}
        <header className="h-16 glass border-b border-white/10 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-muted lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold hidden sm:block">
              {currentView === 'dashboard' && (isSiswa ? 'Dashboard Siswa' : 'Dashboard Kelas')}
              {currentView === 'attendance' && 'Presensi Harian'}
              {currentView === 'behavior' && 'Log Perilaku & Prestasi'}
              {currentView === 'students' && 'Manajemen Siswa'}
              {currentView === 'grading' && 'Bulk Grading'}
              {currentView === 'users' && 'Manajemen Akun'}
              {currentView === 'master' && 'Master Data'}
              {currentView === 'settings' && 'Pengaturan Akun'}
              {currentView === 'system-logs' && 'Log Sistem'}
            </h1>
            
            {/* Real-time Indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-medium border border-green-500/20">
              <Wifi className="w-3 h-3 animate-pulse" />
              Cloud Sync Active
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notifications */}
            <div className="relative">
              <button onClick={handleNotificationClick} className="p-2 rounded-full hover:bg-muted relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in slide-in-from-top-2">
                  <div className="p-3 border-b border-border bg-muted/30 font-semibold text-sm flex justify-between items-center">
                    Notifikasi Real-time
                    <span className="text-xs font-normal text-muted-foreground">Cross-device sync</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Belum ada aktivitas.</div>
                    ) : (
                      notifications.map((n: any) => (
                        <div key={n.id} className={`p-3 border-b border-border text-sm ${!n.read ? 'bg-primary/5' : ''}`}>
                          <p className="text-foreground">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted">
              {isDarkMode ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
            </button>
            <div className="h-6 w-px bg-border mx-1"></div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-md transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-muted/10">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'settings' && <ProfileSettings />}
          
          {/* Protected Routes Rendering */}
          {currentView === 'attendance' && (canViewAttendance ? <AttendanceTracker /> : <Unauthorized />)}
          {currentView === 'behavior' && (canViewBehavior ? <BehaviorLogger preselectStudentId={preselectStudentId} onClearPreselect={() => setPreselectStudentId(null)} /> : <Unauthorized />)}
          {currentView === 'students' && (canViewStudents ? <StudentManagement /> : <Unauthorized />)}
          {currentView === 'grading' && (canViewGrading ? <BulkGrading /> : <Unauthorized />)}
          {currentView === 'users' && (canViewUsers ? <UserManagement /> : <Unauthorized />)}
          {currentView === 'master' && (canViewMaster ? <MasterData /> : <Unauthorized />)}
          {currentView === 'system-logs' && (canViewLogs ? <SystemLogs /> : <Unauthorized />)}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// Helper Components
const NavItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
      ${isActive 
        ? 'bg-primary/10 text-primary' 
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }
    `}
  >
    {icon}
    {label}
  </button>
);

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in">
    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
      <ShieldAlert className="w-8 h-8 text-destructive" />
    </div>
    <div>
      <h2 className="text-2xl font-bold">Akses Ditolak</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">
        Role Anda saat ini tidak memiliki izin untuk melihat halaman ini.
      </p>
    </div>
  </div>
);
