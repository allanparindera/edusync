# Panduan Deployment EduSync

Halo! Aplikasi ini dibangun menggunakan **React dan TypeScript (`.tsx`)** dengan **Vite**.

## PENTING: Setup Database Cloud (Supabase)
Agar aplikasi ini bisa digunakan oleh banyak orang (Admin di PC, Guru & Siswa di HP) dan datanya tersinkronisasi, Anda **WAJIB** menghubungkannya ke Supabase.

1. Buat akun gratis di [Supabase](https://supabase.com).
2. Buat Project baru.
3. Masuk ke menu **SQL Editor** dan jalankan script berikut:
   ```sql
   CREATE TABLE edusync_store (
     id text PRIMARY KEY,
     data jsonb NOT NULL,
     updated_at timestamptz DEFAULT now()
   );
   ALTER PUBLICATION supabase_realtime ADD TABLE edusync_store;
   INSERT INTO edusync_store (id, data) VALUES ('main', '{}') ON CONFLICT DO NOTHING;
   ```
4. Masuk ke menu **Project Settings > API**.
5. Buka file `src/services/supabase.ts` di kode aplikasi ini.
6. Ganti tulisan `"PASTE_URL_DISINI"` dengan **Project URL** Anda.
7. Ganti tulisan `"PASTE_KEY_DISINI"` dengan **anon public key** Anda.

*Catatan: Aplikasi ini menggunakan arsitektur "Single Row JSON Blob" untuk kemudahan deployment tanpa perlu setup puluhan tabel relasional. Semua data tersimpan di dalam kolom `data` pada baris `id='main'`.*

## Cara Deploy ke Google Cloud Run (Docker)
Karena Anda menggunakan Google Cloud Run, aplikasi ini membutuhkan `Dockerfile` untuk dibungkus menjadi container image. File `Dockerfile`, `.dockerignore`, dan `nginx.conf` sudah ditambahkan.

Langkah deploy ke Cloud Run via Google Cloud CLI (gcloud):
1. Buka terminal/Cloud Shell dan arahkan ke folder project ini.
2. Jalankan perintah build dan deploy:
   ```bash
   gcloud run deploy edusync-app --source . --port 80 --allow-unauthenticated
   ```
3. Pilih region yang diinginkan (misal: `asia-southeast2` untuk Jakarta).
4. Tunggu proses build Docker selesai. Cloud Run akan memberikan URL publik untuk aplikasi Anda.

## Cara Deploy ke Vercel (Alternatif Paling Mudah & Gratis)
1. Upload semua file aplikasi ini ke repository GitHub.
2. Buka [Vercel](https://vercel.com/) dan login menggunakan akun GitHub Anda.
3. Klik tombol **"Add New..."** lalu pilih **"Project"**.
4. Pilih repository GitHub yang baru saja Anda buat.
5. Vercel akan otomatis mendeteksi bahwa ini adalah project **Vite**.
6. Biarkan semua pengaturan default, lalu klik **"Deploy"**.

## Cara Menjalankan di Komputer Lokal (Localhost)
1. Pastikan Anda sudah menginstall [Node.js](https://nodejs.org/).
2. Buka Terminal / Command Prompt, arahkan ke folder aplikasi ini.
3. Ketik perintah: `npm install`
4. Ketik perintah: `npm run dev`
5. Buka browser dan akses alamat yang muncul (biasanya `http://localhost:5173`).
