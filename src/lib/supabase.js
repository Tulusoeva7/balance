import { createClient } from '@supabase/supabase-js';
import { validateConnection } from '@/config/environment';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configurationError = validateConnection(url, key);
export const supabase = configurationError ? null : createClient(url, key);
