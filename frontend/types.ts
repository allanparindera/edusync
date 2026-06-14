export interface ClassData {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  nis: string;
  name: string;
  classId: string;
  status: 'Aktif' | 'Non-Aktif' | 'Lulus' | 'Pindah';
  avatarUrl?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
  timeIn?: string;
  minutesLate: number;
  notes?: string;
}

export interface GradeComponent {
  id: string;
  classId: string;
  subjectName: string;
  type: 'Tugas' | 'Kuis' | 'Formatif' | 'Sumatif' | 'Praktik';
  weight: number; // Percentage
}

export interface DailyGradeColumn {
  id: string;
  name: string;
}

export interface DailyGrades {
  columns: DailyGradeColumn[];
  records: Record<string, Record<string, number | ''>>; // { [studentId]: { [columnId]: score } }
  isLocked: boolean;
}

export interface StudentGrade {
  id: string;
  studentId: string;
  componentId: string;
  score: number;
}

export interface BehaviorLog {
  id: string;
  studentId: string;
  date: string;
  type: 'Positif' | 'Negatif';
  points: number;
  description: string;
  academicYear?: string;
  semester?: string;
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  timestamp: string;
}

// Period Statistics Type
export interface PeriodStat {
  averageGrade: number;
  totalScore: number;
  rank: number;
  behaviorScore: number;
  attendanceRate: number;
  totalLateMinutes: number;
  competencies: { subject: string; score: number; fullMark: number }[];
  attendanceDetails: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    total: number;
  };
}

// Aggregated data types for UI
export interface StudentSummary extends Student {
  averageGrade: number;
  totalScore: number; // Total akumulasi nilai akhir
  rank: number; // Peringkat di kelas
  behaviorScore: number;
  attendanceRate: number;
  totalLateMinutes: number;
  competencies: { subject: string; score: number; fullMark: number }[];
  attendanceDetails?: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    total: number;
  };
  periodStats?: Record<string, PeriodStat>;
}

export interface DashboardMetrics {
  totalActiveStudents: number;
  todayAttendanceRate: number;
  weeklyTardinessTrend: number; // positive means increased tardiness, negative means decreased
  averageClassGrade: number;
}

export interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

// --- Auth Types ---
export type Role = 'Admin' | 'Guru' | 'Ortu/Siswa';

export interface User {
  id: string;
  username: string;
  password?: string; // Added for account management
  name: string;
  role: Role;
  avatarUrl: string;
  classId?: string; // To restrict Guru to specific classes
  subjectId?: string; // To restrict Guru to specific subjects
  studentId?: string; // To restrict Ortu/Siswa to a specific student
  status?: 'Aktif' | 'Suspend'; // Added for account activation/suspension
}
