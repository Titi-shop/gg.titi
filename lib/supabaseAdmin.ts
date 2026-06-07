import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ SERVER ONLY
 * Dùng cho API route, không import vào client
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
