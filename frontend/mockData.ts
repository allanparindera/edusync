import { StudentSummary, DashboardMetrics, ChartDataPoint } from './types.ts';

export const mockMetrics: DashboardMetrics = {
  totalActiveStudents: 142,
  todayAttendanceRate: 96.5,
  weeklyTardinessTrend: -12.5, // Decreased by 12.5%
  averageClassGrade: 84.2,
};

export const mockAttendanceData: ChartDataPoint[] = [
  { name: 'Senin', Hadir: 130, Terlambat: 8, Izin: 2, Sakit: 2, Alpa: 0 },
  { name: 'Selasa', Hadir: 135, Terlambat: 5, Izin: 1, Sakit: 1, Alpa: 0 },
  { name: 'Rabu', Hadir: 125, Terlambat: 10, Izin: 3, Sakit: 2, Alpa: 2 },
  { name: 'Kamis', Hadir: 132, Terlambat: 7, Izin: 1, Sakit: 2, Alpa: 0 },
  { name: 'Jumat', Hadir: 138, Terlambat: 3, Izin: 0, Sakit: 1, Alpa: 0 },
];

export const mockTardinessData: ChartDataPoint[] = [
  { name: 'Minggu 1', Menit: 120 },
  { name: 'Minggu 2', Menit: 150 },
  { name: 'Minggu 3', Menit: 90 },
  { name: 'Minggu 4', Menit: 110 },
  { name: 'Minggu 5', Menit: 75 },
  { name: 'Minggu 6', Menit: 60 },
];

export const mockGradeDistribution: ChartDataPoint[] = [
  { name: '< 60', Jumlah: 5 },
  { name: '60-70', Jumlah: 15 },
  { name: '71-80', Jumlah: 45 },
  { name: '81-90', Jumlah: 55 },
  { name: '> 90', Jumlah: 22 },
];

export const mockStudents: StudentSummary[] = [
  {
    id: 'S001',
    nis: '2023001',
    name: 'Ahmad Budi Santoso',
    classId: 'C001',
    status: 'Aktif',
    avatarUrl: 'https://picsum.photos/150/150?random=1',
    attendanceRate: 98,
    totalLateMinutes: 15,
    averageGrade: 88.5,
    totalScore: 88.5,
    rank: 1,
    behaviorScore: 10,
    competencies: [
      { subject: 'Tugas', score: 90, fullMark: 100 },
      { subject: 'Kuis', score: 85, fullMark: 100 },
      { subject: 'UTS', score: 88, fullMark: 100 },
      { subject: 'UAS', score: 92, fullMark: 100 },
      { subject: 'Praktik', score: 85, fullMark: 100 },
    ]
  },
  {
    id: 'S002',
    nis: '2023002',
    name: 'Siti Aminah',
    classId: 'C001',
    status: 'Aktif',
    avatarUrl: 'https://picsum.photos/150/150?random=2',
    attendanceRate: 92,
    totalLateMinutes: 45,
    averageGrade: 76.0,
    totalScore: 76.0,
    rank: 2,
    behaviorScore: -5,
    competencies: [
      { subject: 'Tugas', score: 75, fullMark: 100 },
      { subject: 'Kuis', score: 70, fullMark: 100 },
      { subject: 'UTS', score: 80, fullMark: 100 },
      { subject: 'UAS', score: 78, fullMark: 100 },
      { subject: 'Praktik', score: 72, fullMark: 100 },
    ]
  }
];
