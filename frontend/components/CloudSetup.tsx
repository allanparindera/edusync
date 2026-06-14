import React, { useState } from 'react';
import { Database, Save, CheckCircle2, AlertCircle, Server, Key, Link as LinkIcon, Copy, Info } from 'lucide-react';
import { getSupabaseCredentials, updateSupabaseCredentials, getSupabaseClient } from '../services/supabase.ts';
import { initCloudSync } from '../services/db.ts';

export const CloudSetup: React.FC = () => {
  const creds = getSupabaseCredentials();
  const [url, setUrl] = useState(creds.url);
  const [key, setKey] = useState(creds.key);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('testing');
    setMessage('Menguji koneksi ke Supabase...');

    updateSupabaseCredentials(url, key);
    window.dispatchEvent(new Event('edusync-cloud-update'));

    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Client gagal diinisialisasi. Periksa format URL dan Key.");

      // Test connection by trying to select from the table
      const { error } = await client.from('edusync_store').select('id').limit(1);
      
      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('Berhasil terhubung ke Cloud Database! Sinkronisasi aktif.');
      
      // Initialize sync to pull existing data or start pushing
      await initCloudSync();

    } catch (err: any) {
      setStatus('error');
      setMessage(`Gagal terhubung: ${err.message || 'Pastikan tabel edusync_store sudah dibuat di Supabase dan RLS dimatikan.'}`);
    }
  };

  const sqlScript = `CREATE TABLE edusync_store (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- PENTING: Matikan RLS
ALTER TABLE edusync_store DISABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime 
ADD TABLE edusync_store;

INSERT INTO edusync_store (id, data) 
VALUES ('main', '{}') 
ON CONFLICT DO NOTHING;`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cloud Database Setup</h2>
        <p className="text-muted-foreground text-sm">Hubungkan aplikasi ke Supabase untuk sinkronisasi data antar perangkat secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Instructions */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Panduan Setup (Gratis)
            </h3>
            <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
              <li>Buat akun dan project baru di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">supabase.com</a>.</li>
              <li>Masuk ke menu <strong>SQL Editor</strong> di dashboard Supabase Anda.</li>
              <li>Copy dan jalankan script SQL di bawah ini untuk membuat tabel penyimpanan:</li>
            </ol>
            
            <div className="mt-4 relative group">
              <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border text-foreground">
{sqlScript}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(sqlScript)}
                className="absolute top-2 right-2 p-2 bg-background border border-border rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                title="Copy SQL"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              4. Masuk ke menu <strong>Project Settings &gt; API</strong>.<br/>
              5. Copy <strong>Project URL</strong> dan <strong>anon public key</strong> ke form di samping.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> Kredensial Koneksi
            </h3>
            
            {status === 'success' && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {message}
              </div>
            )}

            {status === 'error' && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project URL</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="url" 
                    required
                    placeholder="https://xxxx.supabase.co"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Anon Public Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea 
                    required
                    rows={4}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status === 'testing'}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {status === 'testing' ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {status === 'testing' ? 'Menghubungkan...' : 'Simpan & Hubungkan'}
              </button>
            </form>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3 mt-4">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-600 dark:text-blue-400">Info Arsitektur Database</h4>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                Aplikasi ini menggunakan arsitektur <strong>Single-Row JSON Blob</strong>. Artinya, seluruh data (Siswa, Akun, Nilai, dll) disimpan di dalam <strong>satu baris (row)</strong> pada tabel <code>edusync_store</code> dengan ID <code>main</code>. <br/><br/>
                <strong>Jangan khawatir jika jumlah baris (rows) di Supabase tidak bertambah.</strong> Yang bertambah adalah ukuran data JSON di dalam baris tersebut. Ini dirancang agar aplikasi sangat cepat dan mudah di-deploy tanpa perlu setup puluhan tabel relasional.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
