// In-memory auth store wrapping Supabase Auth
// No localStorage/cookies — sandboxed iframe
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

type AuthListener = () => void;

class AuthStore {
  private session: Session | null = null;
  private user: User | null = null;
  private listeners: Set<AuthListener> = new Set();
  private initialized = false;

  constructor() {
    // Listen for auth state changes from Supabase
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session = session;
      this.user = session?.user ?? null;
      this.notify();
    });
  }

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session = data.session;
    this.user = data.user;
    this.notify();
    return data;
  }

  async register(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || '' } },
    });
    if (error) throw error;
    this.session = data.session;
    this.user = data.user;
    this.notify();
    return data;
  }

  async logout() {
    await supabase.auth.signOut();
    this.session = null;
    this.user = null;
    this.notify();
  }

  getToken(): string | null {
    return this.session?.access_token ?? null;
  }

  getUser() {
    if (!this.user) return null;
    return {
      id: this.user.id,
      email: this.user.email || '',
      name: this.user.user_metadata?.name || this.user.email || '',
    };
  }

  isAuthenticated(): boolean {
    return !!this.session;
  }

  clear() {
    this.session = null;
    this.user = null;
    this.notify();
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const authStore = new AuthStore();
