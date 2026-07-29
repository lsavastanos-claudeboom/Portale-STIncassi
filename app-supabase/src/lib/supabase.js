import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurato = Boolean(url && key && !url.includes('xxxxxxxx'))

export const supabase = configurato
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
