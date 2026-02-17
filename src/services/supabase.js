import { createClient } from "@supabase/supabase-js";

// Reemplaza esto con tus datos del Dashboard (Project Settings > API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Creamos una única instancia de la conexión
export const supabase = createClient(supabaseUrl, supabaseKey);
