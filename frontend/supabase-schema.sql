-- PANDUAN SETUP DATABASE CLOUD (SUPABASE)
-- 1. Buat akun dan project gratis di https://supabase.com
-- 2. Masuk ke menu "SQL Editor" di dashboard Supabase Anda
-- 3. Copy dan Paste semua kode di bawah ini, lalu klik "Run"

-- Membuat tabel untuk menyimpan seluruh state aplikasi secara terpusat
CREATE TABLE IF NOT EXISTS edusync_store (
    id text PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- PENTING: Matikan RLS agar aplikasi bisa membaca dan menulis data tanpa login Supabase Auth
ALTER TABLE edusync_store DISABLE ROW LEVEL SECURITY;

-- Mengaktifkan fitur Realtime untuk tabel ini agar sinkronisasi antar device (HP & PC) berjalan instan
ALTER PUBLICATION supabase_realtime ADD TABLE edusync_store;

-- Memasukkan data awal (opsional, aplikasi akan otomatis membuatnya jika kosong)
INSERT INTO edusync_store (id, data) 
VALUES ('main', '{}')
ON CONFLICT (id) DO NOTHING;

-- Selesai! Sekarang masuk ke menu "Project Settings" -> "API" di Supabase
-- Copy "Project URL" dan "anon public key"
-- Masukkan kedua kunci tersebut di file src/services/supabase.ts
