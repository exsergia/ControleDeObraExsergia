import { createClient, Session, User } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normalizeSupabaseUrl(url?: string) {
  if (!url) return undefined;
  return url.trim().replace(/\/?rest\/v1\/?$/i, '').replace(/\/$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type SupabaseUser = User;
export type SupabaseSession = Session;

export const auth = {
  currentUser: null as User | null,
};

export function setCurrentUser(user: User | null) {
  auth.currentUser = user;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithEmailAndPassword(_auth: unknown, email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user };
}

export async function createUserWithEmailAndPassword(_auth: unknown, email: string, password: string, metadata?: Record<string, unknown>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata || {} },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Usuário não foi criado no Supabase Auth.');
  return { user: data.user };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.id,
      email: auth.currentUser?.email,
    },
  };
  console.error('Supabase Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const handleFirestoreError = handleSupabaseError;

export const db = {};
