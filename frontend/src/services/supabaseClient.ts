import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fuqwtslyggadkdfpwise.supabase.co';
const supabaseAnonKey = 'sb_publishable_qyNucYJ8A_k8OX3q_w5LDw_a_jStu9v';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);