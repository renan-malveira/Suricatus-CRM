import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True quando as duas chaves do Supabase foram configuradas no .env. */
export const supabaseConfigurado = Boolean(url && anonKey);

/**
 * Cliente Supabase. Se as chaves não estiverem configuradas ainda, criamos um
 * cliente com valores placeholder só para o app carregar e mostrar a tela de
 * "configure o Supabase" em vez de quebrar.
 */
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
);

export const BUCKET_ANEXOS = 'anexos';
