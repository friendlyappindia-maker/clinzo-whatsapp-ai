import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://sdaynypgtyfniukmqcfh.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYXlueXBndHlmbml1a21xY2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODc5NjksImV4cCI6MjA4ODM2Mzk2OX0.05CBVkWI6D2_cbg5gRpPXHCdm4Bh8ZJTpmiFuzIiUNM";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Client-side Supabase features may not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
