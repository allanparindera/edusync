import React, { useState } from 'react';
import { Search, Activity, Trash2 } from 'lucide-react';
import { useRealtimeDB } from '../hooks/useRealtimeDB.ts';
import { db } from '../services/db.ts';
import { SystemLog } from '../types.ts';

export const SystemLogs: React.FC = () => {
  const dbData = useRealtimeDB();
  const logs: SystemLog[] = dbData.systemLogs || [];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearLogs = () => {
    if (window.confirm('Apakah Anda yakin ingin membersihkan semua log sistem? Tindakan ini tidak dapat dibatalkan.')) {
      db.systemLogs.clearAll();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Log Sistem</h2>
          <p className="text-muted-foreground text-sm">Jejak audit aktivitas pengguna di dalam sistem.</p>
        </div>
        <button 
          onClick={handleClearLogs}
          disabled={logs.length === 0}
          className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>Bersihkan Log</span>
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama pengguna atau aktivitas..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3 font-medium w-48">Waktu</th>
                <th className="px-6 py-3 font-medium w-48">Pengguna</th>
                <th className="px-6 py-3 font-medium w-32">Role</th>
                <th className="px-6 py-3 font-medium">Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-3 font-medium">{log.userName}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                        log.userRole === 'Admin' ? 'bg-primary/10 text-primary' : 
                        log.userRole === 'Guru' ? 'bg-blue-500/10 text-blue-600' : 
                        'bg-green-500/10 text-green-600'
                      }`}>
                        {log.userRole}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-primary shrink-0" />
                        {log.action}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Tidak ada log aktivitas yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-muted/10">
          <span>Menampilkan {paginatedLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} hingga {Math.min(currentPage * itemsPerPage, filteredLogs.length)} dari {filteredLogs.length} entri</span>
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
    </div>
  );
};
