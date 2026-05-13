import { supabase } from './supabase';

export type WhereFilter = { type: 'where'; field: string; op: string; value: any };
export type OrderFilter = { type: 'orderBy'; field: string; direction?: 'asc' | 'desc' };
export type LimitFilter = { type: 'limit'; count: number };
export type QueryConstraint = WhereFilter | OrderFilter | LimitFilter;
export type CollectionRef = { table: string; constraints: QueryConstraint[] };
export type DocRef = { table: string; id: string };

const normalizeTable = (table: string) => table;
const newId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const db = {};

export function collection(_dbOrCollection: unknown, table?: string): CollectionRef {
  if (typeof _dbOrCollection === 'string') return { table: normalizeTable(_dbOrCollection), constraints: [] };
  if (!table) throw new Error('Nome da tabela não informado.');
  return { table: normalizeTable(table), constraints: [] };
}

export function doc(dbOrCollection: unknown, tableOrId?: string, maybeId?: string): DocRef {
  if (typeof dbOrCollection === 'object' && dbOrCollection && 'table' in (dbOrCollection as any)) {
    const col = dbOrCollection as CollectionRef;
    return { table: col.table, id: tableOrId || newId() };
  }
  if (!tableOrId) throw new Error('Tabela não informada.');
  return { table: normalizeTable(tableOrId), id: maybeId || newId() };
}

export function where(field: string, op: string, value: any): WhereFilter {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderFilter {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number): LimitFilter {
  return { type: 'limit', count };
}

export function query(ref: CollectionRef, ...constraints: QueryConstraint[]): CollectionRef {
  return { ...ref, constraints: [...(ref.constraints || []), ...constraints] };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

function unwrap(row: any) {
  return { id: row.id, ...(row.data || {}) };
}

function docSnap(id: string, data: any | null) {
  return {
    id,
    exists: () => !!data,
    data: () => data,
  };
}

function docsSnap(items: any[]) {
  return {
    empty: items.length === 0,
    size: items.length,
    docs: items.map((item) => ({ id: item.id, data: () => item })),
  };
}

function getNested(obj: any, field: string) {
  return field.split('.').reduce((acc, key) => acc?.[key], obj);
}

function applyConstraints(items: any[], constraints: QueryConstraint[] = []) {
  let result = [...items];
  for (const c of constraints) {
    if (c.type === 'where') {
      result = result.filter((item) => {
        const actual = getNested(item, c.field);
        if (c.op === '==') return actual === c.value;
        if (c.op === '!=') return actual !== c.value;
        if (c.op === 'array-contains') return Array.isArray(actual) && actual.includes(c.value);
        return actual === c.value;
      });
    }
  }
  for (const c of constraints) {
    if (c.type === 'orderBy') {
      result.sort((a, b) => {
        const av = getNested(a, c.field) ?? '';
        const bv = getNested(b, c.field) ?? '';
        if (av === bv) return 0;
        const order = av > bv ? 1 : -1;
        return c.direction === 'desc' ? -order : order;
      });
    }
  }
  const limitConstraint = constraints.find((c): c is LimitFilter => c.type === 'limit');
  if (limitConstraint) result = result.slice(0, limitConstraint.count);
  return result;
}

export async function getDoc(ref: DocRef) {
  const { data, error } = await supabase.from(ref.table).select('id,data').eq('id', ref.id).maybeSingle();
  if (error) throw error;
  return docSnap(ref.id, data ? unwrap(data) : null);
}

export async function getDocs(ref: CollectionRef) {
  const { data, error } = await supabase.from(ref.table).select('id,data');
  if (error) throw error;
  const items = applyConstraints((data || []).map(unwrap), ref.constraints);
  return docsSnap(items);
}

export async function setDoc(ref: DocRef, value: any) {
  const payload = { ...value, id: ref.id };
  const response = await supabase.from(ref.table).upsert({ id: ref.id, data: payload }).select('id').single();
  if (response.error) throw response.error;
  return response;
}

export async function addDoc(ref: CollectionRef, value: any) {
  const id = newId();
  await setDoc({ table: ref.table, id }, { ...value, id });
  return { id };
}

export async function updateDoc(ref: DocRef, value: any) {
  const current = await getDoc(ref);
  const existing = current.exists() ? current.data() : { id: ref.id };
  const next = { ...existing };
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'object' && val && '__op' in (val as any)) {
      const op = val as any;
      if (op.__op === 'arrayUnion') next[key] = [...(Array.isArray(next[key]) ? next[key] : []), ...op.values];
      if (op.__op === 'arrayRemove') next[key] = (Array.isArray(next[key]) ? next[key] : []).filter((x: any) => !op.values.some((v: any) => JSON.stringify(v) === JSON.stringify(x)));
    } else {
      next[key] = val;
    }
  }
  return await setDoc(ref, next);
}

export async function deleteDoc(ref: DocRef) {
  const { error } = await supabase.from(ref.table).delete().eq('id', ref.id);
  if (error) throw error;
}

export function arrayUnion(...values: any[]) {
  return { __op: 'arrayUnion', values };
}

export function arrayRemove(...values: any[]) {
  return { __op: 'arrayRemove', values };
}

export function writeBatch(_db: unknown) {
  const ops: Array<() => Promise<unknown>> = [];
  return {
    set: (ref: DocRef, value: any) => ops.push(() => setDoc(ref, value)),
    update: (ref: DocRef, value: any) => ops.push(() => updateDoc(ref, value)),
    delete: (ref: DocRef) => ops.push(() => deleteDoc(ref)),
    commit: async () => { for (const op of ops) await op(); },
  };
}
