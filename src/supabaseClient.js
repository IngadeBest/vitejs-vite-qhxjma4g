import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://hpfixcuxayjkfyhqbbnn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZml4Y3V4YXlqa2Z5aHFiYm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODEyOTEsImV4cCI6MjA2NjQ1NzI5MX0.VFaO3lzLbxHAmNOrHjyKOd3q3Pa_4buRcNSosq3FZDQ'
export const supabase = createClient(supabaseUrl, supabaseKey);
