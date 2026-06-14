import React from 'react';
import { X, AlertTriangle, CheckCircle, Clock, Award, TrendingUp, Info, Trophy, Sigma } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { StudentSummary, ClassData, Subject } from '../types.ts';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';

interface StudentModalProps {
  student: StudentSummary | null;
  onClose: () => void;
  isEmbedded?: boolean;
  classStudentCount?: number;
  classAverageGrade?: number;
  academicYear?: string;
  semester?: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({ 
  student, 
  onClose, 
  isEmbedded = false,
  classStudentCount,
  classAverageGrade,
  academicYear,
  semester
}) => {
  const dbData = useRealtimeDB();
  
  if (!student) return null;

  // Helper for period stats
  const getPeriodStats = () => {
    if (!student) return null;
    
    if (academicYear && semester === 'Satu Tahun') {
      const ganjilKey = `${academicYear}_Ganjil`;
      const genapKey = `${academicYear}_Genap`;
      const ganjilStats = student.periodStats?.[ganjilKey];
      const genapStats = student.periodStats?.[genapKey];
      
      if (!ganjilStats && !genapStats) {
        return {
          averageGrade: 0, totalScore: 0, rank: 0, behaviorScore: 0, attendanceRate: 100, totalLateMinutes: 0,
          competencies: [], attendanceDetails: { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
        };
      }
      
      const attDetails = {
        hadir: (ganjilStats?.attendanceDetails?.hadir || 0) + (genapStats?.attendanceDetails?.hadir || 0),
        terlambat: (ganjilStats?.attendanceDetails?.terlambat || 0) + (genapStats?.attendanceDetails?.terlambat || 0),
        izin: (ganjilStats?.attendanceDetails?.izin || 0) + (genapStats?.attendanceDetails?.izin || 0),
        sakit: (ganjilStats?.attendanceDetails?.sakit || 0) + (genapStats?.attendanceDetails?.sakit || 0),
        alpa: (ganjilStats?.attendanceDetails?.alpa || 0) + (genapStats?.attendanceDetails?.alpa || 0),
        total: (ganjilStats?.attendanceDetails?.total || 0) + (genapStats?.attendanceDetails?.total || 0),
      };
      
      const attendanceRate = attDetails.total > 0 
        ? Math.round(((attDetails.hadir + attDetails.terlambat) / attDetails.total) * 100) 
        : 100;
        
      const compMap: Record<string, { scoreSum: number; count: number }> = {};
      const addComps = (comps: any[]) => {
        if (!comps) return;
        comps.forEach(c => {
          if (!compMap[c.subject]) compMap[c.subject] = { scoreSum: 0, count: 0 };
          compMap[c.subject].scoreSum += c.score;
          compMap[c.subject].count++;
        });
      };
      addComps(ganjilStats?.competencies || []);
      addComps(genapStats?.competencies || []);
      
      const competencies = Object.keys(compMap).map(subject => ({
        subject,
        score: Math.round(compMap[subject].scoreSum / compMap[subject].count),
        fullMark: 100
      }));
      
      const totalScore = competencies.reduce((acc, c) => acc + c.score, 0);
      const averageGrade = competencies.length > 0 ? parseFloat((totalScore / competencies.length).toFixed(1)) : 0;
      
      return {
        averageGrade,
        totalScore,
        rank: 0,
        behaviorScore: (ganjilStats?.behaviorScore || 0) + (genapStats?.behaviorScore || 0),
        attendanceRate,
        totalLateMinutes: (ganjilStats?.totalLateMinutes || 0) + (genapStats?.totalLateMinutes || 0),
        competencies,
        attendanceDetails: attDetails
      };
    }

    if (academicYear && semester) {
      const periodKey = `${academicYear}_${semester}`;
      if (student.periodStats && student.periodStats[periodKey]) {
        return student.periodStats[periodKey];
      }
    }
    // Fallback if not specified or not found
    const DEFAULT_PERIOD = '2023/2024_Ganjil';
    return student.periodStats?.[DEFAULT_PERIOD] || student;
  };
  const stats = getPeriodStats();

  const classes: ClassData[] = dbData.classes || [];
  const behaviorLogs = dbData.behaviorLogs || [];
  const subjects: Subject[] = dbData.subjects || [];
  const grades = dbData.grades || {};
  
  const className = classes.find((c: any) => c.id === student.classId)?.name || student.classId;
  
  // Ambil 5 log terbaru khusus untuk siswa ini (difilter berdasarkan waktu jika period dipilih)
  const studentLogs = behaviorLogs
    .filter((log: any) => {
      if (log.studentId !== student.id) return false;
      if (academicYear && semester) {
        if (semester === 'Satu Tahun') {
          return log.academicYear === academicYear;
        }
        if (log.academicYear && log.semester) {
          return log.academicYear === academicYear && log.semester === semester;
        }
        // Fallback for legacy data (they are default 2023/2024_Ganjil)
        const periodKey = `${academicYear}_${semester}`;
        return periodKey === '2023/2024_Ganjil';
      }
      return true;
    })
    .sort((a: any, b: any) => b.id.localeCompare(a.id)) // Sort descending by ID (timestamp based)
    .slice(0, 5);

  // Analisis Capaian Murid
  const hasCompetencies = stats && stats.competencies && stats.competencies.length > 0;
  const bestSubject = hasCompetencies 
    ? stats.competencies.reduce((prev: any, current: any) => (prev.score > current.score) ? prev : current) 
    : null;
  const needsImprovement = hasCompetencies 
    ? stats.competencies.reduce((prev: any, current: any) => (prev.score < current.score) ? prev : current) 
    : null;

  // Analisis Kehadiran & Warning
  const att = stats?.attendanceDetails || { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 };
  const warnings: string[] = [];
  
  if (att.alpa >= 3) {
    warnings.push(`Siswa memiliki ${att.alpa} ketidakhadiran tanpa keterangan (Alpa). Mohon segera hubungi wali kelas.`);
  } else if (att.alpa > 0) {
    warnings.push(`Siswa memiliki ${att.alpa} ketidakhadiran tanpa keterangan (Alpa).`);
  }
  
  if (att.sakit + att.izin >= 5) {
    warnings.push(`Siswa cukup sering tidak hadir karena sakit/izin (${att.sakit + att.izin} kali). Mohon perhatikan kondisi kesehatan dan belajarnya.`);
  }
  
  if ((stats?.attendanceRate || 0) < 80 && att.total > 5) {
    warnings.push(`Tingkat kehadiran di bawah 80%. Ini dapat mempengaruhi nilai akhir dan syarat kenaikan kelas.`);
  }

  const handleInputCatatan = () => {
    window.dispatchEvent(new CustomEvent('navigate', { 
      detail: { view: 'behavior', studentId: student.id } 
    }));
    onClose();
  };

  const content = (
    <div id="student-modal-content" className={`bg-card text-card-foreground w-full flex flex-col ${isEmbedded ? 'h-full' : 'max-w-4xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh]'}`}>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #student-modal-content, #student-modal-content * { visibility: visible; }
          #student-modal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            box-shadow: none;
            border: none;
            background: white;
            color: black;
          }
          .print-hide { display: none !important; }
          .print-header { 
            display: block !important; 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid black; 
            padding-bottom: 10px; 
          }
          .print-header h1 { font-size: 24px; font-weight: bold; margin: 0; }
          .print-header p { font-size: 14px; color: #555; margin: 5px 0 0 0; }
        }
        .print-header { display: none; }
      `}</style>

      <div className="print-header">
        <h1>Laporan Hasil Belajar & Kedisiplinan Siswa</h1>
        <p>EduSync - Hybrid Class Management {academicYear && semester ? `| Periode: ${academicYear} (${semester})` : ''}</p>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-border bg-muted/10">
        <div className="flex items-center gap-4">
          <img src={student.avatarUrl} alt={student.name} className="w-16 h-16 rounded-full border-2 border-primary object-cover bg-background" />
          <div>
            <h2 className="text-2xl font-bold">{student.name}</h2>
            <p className="text-muted-foreground font-medium">
              NIS: {student.nis} | Kelas: {className}
              {academicYear && semester && ` | Periode: ${academicYear} (${semester})`}
            </p>
          </div>
        </div>
        {!isEmbedded && (
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors print-hide">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Stats & Logs */}
        <div className="space-y-6">
          
          {/* Warning Banner */}
          {warnings.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-destructive font-bold mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Perhatian Orang Tua / Wali</span>
              </div>
              <ul className="list-disc list-inside text-sm text-destructive/90 space-y-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <h3 className="text-lg font-semibold border-b border-border pb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Ringkasan Performa
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Peringkat</span>
              </div>
              <p className="text-3xl font-bold">#{stats?.rank || '-'}{classStudentCount ? ` / ${classStudentCount}` : ''}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Sigma className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Total Nilai</span>
              </div>
              <p className="text-3xl font-bold">{stats?.totalScore || '0'}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Rata-rata</span>
              </div>
              <p className="text-3xl font-bold">{stats?.averageGrade || '0'}</p>
              {classAverageGrade !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Rata-rata Kelas: {classAverageGrade}
                </p>
              )}
            </div>
            
            {/* Kehadiran Card with Details */}
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm col-span-2 sm:col-span-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Kehadiran</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <p className="text-3xl font-bold">
                  {att.total === 0 ? 'N/A' : `${stats?.attendanceRate || 0}%`}
                </p>
                <p className="text-xs text-muted-foreground mb-1">dari {att.total} pertemuan</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="bg-green-500/10 text-green-600 px-2 py-1 rounded">Hadir: {att.hadir}</span>
                <span className="bg-blue-500/10 text-blue-600 px-2 py-1 rounded">Izin: {att.izin}</span>
                <span className="bg-purple-500/10 text-purple-600 px-2 py-1 rounded">Sakit: {att.sakit}</span>
                <span className="bg-destructive/10 text-destructive px-2 py-1 rounded">Alpa: {att.alpa}</span>
              </div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Terlambat</span>
              </div>
              <p className="text-3xl font-bold">{stats?.totalLateMinutes || 0} <span className="text-sm font-normal text-muted-foreground">mnt</span></p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm col-span-1 sm:col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <AlertTriangle className={`w-4 h-4 ${(stats?.behaviorScore || 0) < 0 ? 'text-destructive' : 'text-green-500'}`} />
                <span className="text-sm font-medium">Poin Perilaku</span>
              </div>
              <p className={`text-3xl font-bold ${(stats?.behaviorScore || 0) < 0 ? 'text-destructive' : 'text-green-500'}`}>
                {(stats?.behaviorScore || 0) > 0 ? '+' : ''}{stats?.behaviorScore || 0}
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center border-b border-border pb-2 mb-4">
              <h3 className="text-lg font-semibold">Riwayat Perilaku Terbaru</h3>
            </div>
            <ul className="space-y-3">
              {studentLogs.length > 0 ? (
                studentLogs.map((log: any) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className={`mt-0.5 p-1.5 rounded-full ${log.type === 'Positif' ? 'bg-green-500/20 text-green-600' : 'bg-destructive/20 text-destructive'}`}>
                      {log.type === 'Positif' ? <Award className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{log.description}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-muted-foreground text-xs">{log.timestamp}</p>
                        <span className={`font-bold text-xs ${log.type === 'Positif' ? 'text-green-600' : 'text-destructive'}`}>
                          {log.type === 'Positif' ? '+' : '-'}{log.points} Poin
                        </span>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg border border-dashed border-border">
                  Belum ada catatan perilaku untuk siswa ini.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Right Column: Radar Chart & Insights */}
        <div className="flex flex-col space-y-4">
          <h3 className="text-lg font-semibold border-b border-border pb-2 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Capaian Akademik (Kompetensi)
          </h3>
          
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex-1 flex flex-col">
            {hasCompetencies ? (
              <>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {(stats?.competencies || []).length >= 3 ? (
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats?.competencies || []}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                        />
                        <Radar
                          name="Nilai Akhir"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.4}
                        />
                      </RadarChart>
                    ) : (
                      <BarChart data={stats?.competencies || []} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                        />
                        <Bar
                          dataKey="score"
                          name="Nilai Akhir"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
                
                {/* AI-like Insight based on data */}
                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary mb-1">Analisis Kompetensi:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• <strong>Kekuatan Utama:</strong> {bestSubject?.subject} (Nilai: {bestSubject?.score})</li>
                        <li>• <strong>Perlu Ditingkatkan:</strong> {needsImprovement?.subject} (Nilai: {needsImprovement?.score})</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Tabel Rincian Nilai Lengkap */}
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Rincian Nilai Lengkap</p>
                  <div className="overflow-x-auto border border-border rounded-lg bg-muted/10">
                    <div className="overflow-y-auto max-h-[200px]">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Mata Pelajaran</th>
                            <th className="px-3 py-2 font-semibold text-center">Tugas (50%)</th>
                            <th className="px-3 py-2 font-semibold text-center">UTS (25%)</th>
                            <th className="px-3 py-2 font-semibold text-center">UAS (25%)</th>
                            <th className="px-3 py-2 font-semibold text-center">Akhir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {subjects.map((subj) => {
                            if (!subj || !subj.id) return null;
                            let finalTugas = '';
                            let finalUts = '';
                            let finalUas = '';
                            let finalScore = null;
                            
                            if (semester === 'Satu Tahun') {
                              const ganjilKey = `${academicYear}_Ganjil_${subj.id}`;
                              const genapKey = `${academicYear}_Genap_${subj.id}`;
                              const ganjilGrade = grades[ganjilKey]?.[student.id] || { tugas: '', uts: '', uas: '' };
                              const genapGrade = grades[genapKey]?.[student.id] || { tugas: '', uts: '', uas: '' };
                              
                              const tugasVals = [ganjilGrade.tugas, genapGrade.tugas].filter(v => v !== '').map(Number);
                              const utsVals = [ganjilGrade.uts, genapGrade.uts].filter(v => v !== '').map(Number);
                              const uasVals = [ganjilGrade.uas, genapGrade.uas].filter(v => v !== '').map(Number);
                              
                              if (tugasVals.length > 0) finalTugas = Math.round(tugasVals.reduce((a, b) => a + b, 0) / tugasVals.length).toString();
                              if (utsVals.length > 0) finalUts = Math.round(utsVals.reduce((a, b) => a + b, 0) / utsVals.length).toString();
                              if (uasVals.length > 0) finalUas = Math.round(uasVals.reduce((a, b) => a + b, 0) / uasVals.length).toString();
                            } else {
                              const periodKey = academicYear && semester ? `${academicYear}_${semester}` : '2023/2024_Ganjil';
                              const subjKey = `${periodKey}_${subj.id}`;
                              const subjGrade = grades[subjKey]?.[student.id] || grades[subj.id]?.[student.id] || { tugas: '', uts: '', uas: '' };
                              finalTugas = subjGrade.tugas;
                              finalUts = subjGrade.uts;
                              finalUas = subjGrade.uas;
                            }
                            
                            const tugasVal = finalTugas !== '' ? Number(finalTugas) : null;
                            const utsVal = finalUts !== '' ? Number(finalUts) : null;
                            const uasVal = finalUas !== '' ? Number(finalUas) : null;
                            
                            if (tugasVal !== null || utsVal !== null || uasVal !== null) {
                              finalScore = Math.round((tugasVal || 0) * 0.5 + (utsVal || 0) * 0.25 + (uasVal || 0) * 0.25);
                            }
                            
                            const isUnderKKM = finalScore !== null && finalScore < 75;

                            return (
                              <tr key={subj.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-2 font-medium text-foreground">{subj.name}</td>
                                <td className="px-3 py-2 text-center tabular-nums">{tugasVal !== null ? tugasVal : '-'}</td>
                                <td className="px-3 py-2 text-center tabular-nums">{utsVal !== null ? utsVal : '-'}</td>
                                <td className="px-3 py-2 text-center tabular-nums">{uasVal !== null ? uasVal : '-'}</td>
                                <td className="px-3 py-2 text-center font-bold">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {isUnderKKM && (
                                      <span className="bg-destructive/10 text-destructive text-[8px] px-1 py-0.2 rounded-full font-bold border border-destructive/20 animate-pulse">
                                        KKM
                                      </span>
                                    )}
                                    <span className={isUnderKKM ? 'text-destructive font-extrabold' : 'text-primary'}>
                                      {finalScore !== null ? finalScore : '-'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Award className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium text-foreground">Belum Ada Data Nilai</p>
                <p className="text-sm mt-1">Grafik kompetensi akan muncul setelah guru memasukkan nilai pada menu Bulk Grading.</p>
              </div>
            )}
          </div>
        </div>

        {/* Signature Area (Visible only on print/PDF) */}
        <div className="hidden print:grid grid-cols-3 gap-4 text-center mt-12 text-xs pt-8 border-t border-black">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold mt-1">Orang Tua / Wali</p>
            <div className="h-16"></div>
            <p className="underline font-bold">___________________</p>
          </div>
          <div>
            <p>Menyetujui,</p>
            <p className="font-semibold mt-1">Kepala Sekolah</p>
            <div className="h-16"></div>
            <p className="underline font-bold">Dr. H. Ahmad Fauzi, M.Pd</p>
            <p className="text-[10px]">NIP. 19750812 200003 1 002</p>
          </div>
          <div>
            <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-semibold mt-1">Wali Kelas</p>
            <div className="h-16"></div>
            <p className="underline font-bold">Sri Wahyuni, S.Pd</p>
            <p className="text-[10px]">NIP. 19820405 200801 2 015</p>
          </div>
        </div>

      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 print-hide shrink-0">
        {isEmbedded ? (
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            Download Rapor PDF
          </button>
        ) : (
          <>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate', { 
                  detail: { view: 'grading' } 
                }));
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium border border-border bg-background rounded-md hover:bg-muted transition-colors shadow-sm"
            >
              Lihat Detail Penuh
            </button>
            <button 
              onClick={handleInputCatatan}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
            >
              + Tambah Catatan Perilaku
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {content}
    </div>
  );
};
