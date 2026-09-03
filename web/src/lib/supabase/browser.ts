import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { publicEnv } from '../env';

export function createBrowserClient() {
  return createSupabaseBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
