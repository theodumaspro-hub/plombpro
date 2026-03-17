import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://idsmjpcpzkzkxsjrtmrv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ejmSJnQNS-BrEFpuqGeBLA_BpIFMZfj';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
