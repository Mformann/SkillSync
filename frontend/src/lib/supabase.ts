import { createClient } from '@supabase/supabase-js';
import { supabaseConfigurationError } from './supabase-config';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const configurationError = supabaseConfigurationError(supabaseUrl, supabasePublicKey);
if (configurationError) throw new Error(`Supabase is not configured: ${configurationError}`);

export const supabase = createClient(supabaseUrl, supabasePublicKey);
