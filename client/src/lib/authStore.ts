// In-memory auth store (no localStorage/cookies in sandboxed iframe)
// Stores Supabase session token and user info

type AuthListener = () => void;

class AuthStore {
  private accessToken: string | null = null;
  private user: { id: string; email: string; name: string } | null = null;
  private listeners: Set<AuthListener> = new Set();

  setSession(session: { access_token: string; refresh_token?: string } | null, user?: { id: string; email: string; name: string } | null) {
    this.accessToken = session?.access_token || null;
    this.user = user || null;
    this.notify();
  }

  getToken(): string | null {
    return this.accessToken;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  clear() {
    this.accessToken = null;
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
