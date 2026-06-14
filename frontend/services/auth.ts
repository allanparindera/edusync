import { User } from '../types.ts';
import { getSupabaseClient } from './supabase.ts';
import { getCookie, setCookie, deleteCookie } from '../utils/cookies.ts';
import { getDB } from './db.ts';

const AUTH_KEY = 'edusync_auth_session';
const JWT_KEY = 'edusync_supabase_jwt';

export const authService = {
  login: async (emailOrUsername: string, password: string): Promise<User> => {
    const supabase = getSupabaseClient();
    
    if (supabase) {
      // Try to login via Supabase Auth
      // Note: Supabase expects an email, so we append a dummy domain if it's a username
      const email = emailOrUsername.includes('@') ? emailOrUsername : `${emailOrUsername}@edusync.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (!error && data.session) {
        setCookie(JWT_KEY, data.session.access_token, 7);
      } else {
        console.warn('Supabase Auth failed:', error?.message);
        // Fallback to local DB check for demo purposes if Supabase is not fully configured by user
        const users: User[] = getDB().users || [];
        const userFallback = users.find(u => u.username === emailOrUsername && u.password === password);
        if (!userFallback) {
          throw new Error('Username/Email atau password salah!');
        }
        const { password: _, ...userWithoutPasswordFallback } = userFallback;
        setCookie(AUTH_KEY, JSON.stringify(userWithoutPasswordFallback), 7);
        return userWithoutPasswordFallback;
      }
    }

    // After Supabase login, fetch user profile from local memory/DB to match our User interface
    const users: User[] = getDB().users || [];
    let user = users.find(u => u.username === emailOrUsername || (u as any).email === emailOrUsername);
    
    // If not found in DB but logged in via Supabase, create a basic user object
    if (!user) {
       user = {
         id: emailOrUsername,
         username: emailOrUsername,
         name: emailOrUsername,
         role: 'Guru', // Default role
         status: 'Aktif',
         avatarUrl: '',
       };
    }

    const { password: _, ...userWithoutPassword } = user as any;
    setCookie(AUTH_KEY, JSON.stringify(userWithoutPassword), 7);
    
    return userWithoutPassword;
  },

  logout: () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.signOut();
    }
    deleteCookie(AUTH_KEY);
    deleteCookie(JWT_KEY);
  },

  getCurrentUser: (): User | null => {
    try {
      const session = getCookie(AUTH_KEY);
      return session ? JSON.parse(session) : null;
    } catch (e) {
      return null;
    }
  },
  
  getJwtToken: (): string | null => {
    return getCookie(JWT_KEY);
  },

  updateSession: (user: User) => {
    const { password: _, ...userWithoutPassword } = user;
    setCookie(AUTH_KEY, JSON.stringify(userWithoutPassword), 7);
    // Dispatch event to update UI across the app
    window.dispatchEvent(new Event('edusync-auth-update'));
  }
};
