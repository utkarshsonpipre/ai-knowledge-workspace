import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Only ever used for `uploadToSignedUrl`, which authorises via the one-time
 * token minted by our backend — the anon key alone grants nothing, and no
 * Supabase auth session is involved.
 */
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

export const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'knowledge-files';
