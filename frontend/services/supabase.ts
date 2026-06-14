import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================================================================
// KREDENSIAL SUPABASE PERMANEN & DINAMIS
// Semua device (PC Admin, HP Guru, HP Siswa) akan otomatis menggunakan kunci ini
// atau kredensial yang diset secara dinamis di local storage.
// ==============================================================================

const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : ({} as any);

const DEFAULT_URL = env.VITE_SUPABASE_URL || "https://zvbrkxgyabihgxskpdfi.supabase.co";
const DEFAULT_KEY = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YnJreGd5YWJpaGd4c2twZGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTY0NjcsImV4cCI6MjA5NTg3MjQ2N30.srBXEnwZG45Mf0_k-85IdK2Aa7KeKDqTho830EzIjck";

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseCredentials = () => {
  const url = localStorage.getItem('supabase_url') || DEFAULT_URL;
  const key = localStorage.getItem('supabase_anon_key') || DEFAULT_KEY;
  return { url, key };
};

export const updateSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', key);
  try {
    supabaseInstance = createClient(url, key);
    console.log("Supabase Client Berhasil Diperbarui");
  } catch (e) {
    console.error("Gagal memperbarui Supabase Client", e);
    supabaseInstance = null;
  }
};

export const initSupabase = () => {
  if (!supabaseInstance) {
    try {
      const { url, key } = getSupabaseCredentials();
      supabaseInstance = createClient(url, key);
      console.log("Supabase Client Berhasil Diinisialisasi");
    } catch (e) {
      console.error("Kredensial Supabase tidak valid", e);
      supabaseInstance = null;
    }
  }
  return supabaseInstance;
};

// Initialize on load
initSupabase();

export const getSupabaseClient = () => supabaseInstance;
