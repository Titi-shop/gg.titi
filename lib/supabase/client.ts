// lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

/**
 * ✅ CLIENT ONLY
 * Dùng cho:
 * - Upload ảnh trực tiếp từ browser
 * - Lấy public URL
 *
 * ⚠️ KHÔNG dùng cho:
 * - Database
 * - Logic bảo mật
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
}

export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: {
    persistSession: false, // không dùng auth của supabase
    autoRefreshToken: false,
  },
});
