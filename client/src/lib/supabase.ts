import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://idsmjpcpzkzkxsjrtmrv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ejmSJnQNS-BrEFpuqGeBLA_BpIFMZfj';

// Detect if running inside a sandboxed iframe (localStorage blocked)
let canPersist = true;
try {
  localStorage.setItem('__test__', '1');
  localStorage.removeItem('__test__');
} catch {
  canPersist = false;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: canPersist,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
