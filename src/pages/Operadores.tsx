import React, { useState, useMemo } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, updateDoc, deleteDoc, setDoc, doc, serverTimestamp, getDocs } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Operator, Obra } from '../types';
import { useAuth } from '../App';
import {
  Mail,
  UserCircle2,
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  UserPlus,
  ShieldCheck,
  User,
  HardHat,
  CheckSquare,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Operadores ──────────────────────────────────────────────────────────────

const OP_DRAFT = 'operador-form-draft';
const emptyOp = { nome: '', sobrenome: '', funcao: '', email: '', role: 'operator' as 'admin' | 'operator' };

function OperadoresTab({ isAdmin }: { isAdmin: boolean }) {
  const [operadoresSnap, loading] = useCollection(collection(db, 'operadores'));
  const [encarregadosSnap] = useCollection(collection(db, 'encarregados'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operator | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(emptyOp);
  const { notify } = useAuth();

  const encarregadoIds = new Set(
    (encarregadosSnap?.docs.map(d => d.id) || [])
  );

  // Operadores = registros em operadores que NÃO estão na tabela encarregados
  const operators = (
    (operadoresSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) || []) as Operator[]
  ).filter(op => !encarregadoIds.has(op.id) && op.role !== 'admin');

  const filtered = operators.filter(op =>
    (op.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (op.sobrenome || '').toLowerCase().includes(search.toLowerCase()) ||
    (op.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (op.funcao || '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    const saved = localStorage.getItem(OP_DRAFT);
    setFormData(saved ? JSON.parse(saved) : emptyOp);
    setEditingOp(null);
    setIsModalOpen(true);
  };

  const handleEdit = (op: Operator) => {
    setEditingOp(op);
    setFormData({ nome: op.nome, sobrenome: op.sobrenome || '', funcao: op.funcao || '', email: op.email, role: 'operator' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOp) {
        await updateDoc(doc(db, 'operadores', editingOp.id), { ...formData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'operadores'), { ...formData, role: 'operator', createdAt: serverTimestamp() });
      }
      closeModal();
      notify('success', 'Operador salvo', '');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'operadores');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este operador?')) return;
    try { await deleteDoc(doc(db, 'operadores', id)); } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'operadores-delete');
    }
  };

  const closeModal = () => {
    localStorage.removeItem(OP_DRAFT);
    setIsModalOpen(false);
    setEditingOp(null);
    setFormData(emptyOp);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Buscar operador..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
            <UserPlus className="w-4 h-4" /> Novo Operador
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-36 bg-white animate-pulse rounded-2xl border border-zinc-100" />
        )) : filtered.length > 0 ? filtered.map(op => (
          <div key={op.id} className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-50 group-hover:bg-zinc-900 group-hover:text-white flex items-center justify-center font-bold text-lg transition-colors text-zinc-400">
                {op.nome[0]}{op.sobrenome?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-bold text-zinc-900 truncate">{op.nome} {op.sobrenome}</p>
                  <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded-md">
                  {op.funcao || 'Operador'}
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-300" />{op.email}
            </p>
            {isAdmin && (
              <div className="flex gap-2">
                <button onClick={() => handleEdit(op)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold transition-all">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => handleDelete(op.id)}
                  className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )) : (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-zinc-200">
            <UserCircle2 className="w-12 h-12 text-zinc-100 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-medium">Nenhum operador encontrado.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-7 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">{editingOp ? 'Editar Operador' : 'Novo Operador'}</h3>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nome</label>
                    <input required className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                      value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sobrenome</label>
                    <input className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                      value={formData.sobrenome} onChange={e => setFormData({ ...formData, sobrenome: e.target.value })} /></div>
                </div>
                <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Função</label>
                  <input placeholder="Ex: Eletricista" className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.funcao} onChange={e => setFormData({ ...formData, funcao: e.target.value })} /></div>
                <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">E-mail</label>
                  <input required type="email" className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 py-3 bg-zinc-100 rounded-2xl font-bold text-sm">Cancelar</button>
                  <button type="submit" className="flex-[2] py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">{editingOp ? 'Salvar' : 'Cadastrar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Encarregados ────────────────────────────────────────────────────────────

const emptyEnc = { nome: '', sobrenome: '', funcao: 'Encarregado de Obra', email: '', obraIds: [] as string[] };

function EncarregadosTab({ isAdmin }: { isAdmin: boolean }) {
  const [encarregadosSnap, loading] = useCollection(collection(db, 'encarregados'));
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [operadoresSnap] = useCollection(collection(db, 'operadores'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnc, setEditingEnc] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(emptyEnc);
  const [submitting, setSubmitting] = useState(false);
  const [optimisticEncs, setOptimisticEncs] = useState<any[]>([]);
  const { notify } = useAuth();

  // Merge lista real com itens otimistas (aparece instantâneo antes do Realtime confirmar)
  const encarregados = useMemo(() => {
    const real = (encarregadosSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) as any[]) || [];
    const realIds = new Set(real.map((e: any) => e.id));
    return [...real, ...optimisticEncs.filter(e => !realIds.has(e.id))];
  }, [encarregadosSnap, optimisticEncs]);

  const obras = (obrasSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) as Obra[]) || [];
  const operadores = (operadoresSnap?.docs?.map(d => ({ id: d.id, ...d.data() })) as Operator[]) || [];

  const filtered = encarregados.filter(e =>
    (e.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditingEnc(null); setFormData(emptyEnc); setIsModalOpen(true); };

  const handleEdit = (enc: any) => {
    setEditingEnc(enc);
    setFormData({ nome: enc.nome || '', sobrenome: enc.sobrenome || '', funcao: enc.funcao || 'Encarregado de Obra', email: enc.email || '', obraIds: enc.obraIds || [] });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    let savedId = '';
    try {
      let operadorId = editingEnc?.id || editingEnc?.operadorId || '';
      if (!operadorId) {
        const op = operadores.find(o => (o.email || '').toLowerCase() === formData.email.toLowerCase());
        operadorId = op?.id || '';
      }

      const id = operadorId || `enc_${Date.now()}`;
      savedId = id;

      const payload = {
        id,
        operadorId: id,
        nome: formData.nome,
        sobrenome: formData.sobrenome,
        funcao: formData.funcao,
        email: formData.email,
        obraIds: formData.obraIds,
        ativo: true,
        updatedAt: serverTimestamp(),
        ...(editingEnc ? {} : { createdAt: serverTimestamp() }),
      };

      // Atualiza lista imediatamente (resposta rápida) — Realtime confirma logo depois
      setOptimisticEncs(prev => [...prev.filter(e => e.id !== id), { ...payload }]);

      await setDoc(doc(db, 'encarregados', id), payload);

      closeModal();
      notify('success', 'Encarregado salvo', 'As obras atribuídas foram atualizadas.');
    } catch (err) {
      // Remove item otimista se a gravação falhou
      if (savedId) setOptimisticEncs(prev => prev.filter(e => e.id !== savedId));
      const msg = err instanceof Error ? err.message : String(err);
      notify('error', 'Erro ao salvar encarregado', msg);
      console.error('Erro encarregados:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este encarregado?')) return;
    try { await deleteDoc(doc(db, 'encarregados', id)); } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'encarregados-delete');
    }
  };

  const closeModal = () => { setIsModalOpen(false); setEditingEnc(null); setFormData(emptyEnc); };

  const toggleObra = (obraId: string) =>
    setFormData(f => ({ ...f, obraIds: f.obraIds.includes(obraId) ? f.obraIds.filter(id => id !== obraId) : [...f.obraIds, obraId] }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" placeholder="Buscar encarregado..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-lg active:scale-95">
            <UserPlus className="w-4 h-4" /> Novo Encarregado
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array(2).fill(0).map((_, i) => (
          <div key={i} className="h-44 bg-white animate-pulse rounded-2xl border border-zinc-100" />
        )) : filtered.length > 0 ? filtered.map(enc => {
          const encObras = obras.filter(o => (enc.obraIds || []).includes(o.id));
          return (
            <div key={enc.id} className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center font-bold text-lg transition-colors text-amber-500">
                  {(enc.nome || '?')[0]}{(enc.sobrenome || '')[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-zinc-900 truncate">{enc.nome} {enc.sobrenome}</p>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md">
                    {enc.funcao || 'Encarregado'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-300" />{enc.email || '—'}
              </p>
              {encObras.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Obras</p>
                  <div className="flex flex-wrap gap-1">
                    {encObras.slice(0, 3).map(o => (
                      <span key={o.id} className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <HardHat className="w-2.5 h-2.5" />{o.nome.length > 18 ? o.nome.substring(0, 18) + '…' : o.nome}
                      </span>
                    ))}
                    {encObras.length > 3 && <span className="text-[10px] text-zinc-400">+{encObras.length - 3}</span>}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(enc)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold transition-all">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => handleDelete(enc.id)}
                    className="w-9 h-9 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-amber-200">
            <ShieldCheck className="w-12 h-12 text-amber-100 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-medium">Nenhum encarregado cadastrado.</p>
            {isAdmin && <p className="text-xs text-zinc-400 mt-1">Clique em "Novo Encarregado" para adicionar.</p>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-7 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{editingEnc ? 'Editar Encarregado' : 'Novo Encarregado'}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Informe o e-mail de login para vincular o acesso.</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nome</label>
                    <input required className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                      value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sobrenome</label>
                    <input className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                      value={formData.sobrenome} onChange={e => setFormData({ ...formData, sobrenome: e.target.value })} /></div>
                </div>
                <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Função</label>
                  <input className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.funcao} onChange={e => setFormData({ ...formData, funcao: e.target.value })} /></div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">E-mail de Login</label>
                  <input required type="email" placeholder="E-mail usado para entrar no sistema"
                    className="w-full mt-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  <p className="text-[10px] text-zinc-400 mt-1">Deve ser o mesmo e-mail que o encarregado usa para entrar.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                    Obras Atribuídas <span className="text-zinc-300">({formData.obraIds.length} selecionadas)</span>
                  </label>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 divide-y divide-zinc-100">
                    {obras.length === 0 ? (
                      <p className="text-xs text-zinc-400 p-3 text-center">Nenhuma obra cadastrada.</p>
                    ) : obras.map(obra => (
                      <label key={obra.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-zinc-100 transition-colors">
                        <input type="checkbox" className="w-4 h-4 accent-amber-500"
                          checked={formData.obraIds.includes(obra.id)}
                          onChange={() => toggleObra(obra.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{obra.nome}</p>
                          <p className="text-[10px] text-zinc-400">{(obra as any).status} · {(obra as any).centroCusto || 'Sem centro'}</p>
                        </div>
                        {formData.obraIds.includes(obra.id) && <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} disabled={submitting}
                    className="flex-1 py-3 bg-zinc-100 rounded-2xl font-bold text-sm disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-[2] py-3 bg-amber-500 text-white rounded-2xl font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Salvando...
                      </>
                    ) : editingEnc ? 'Salvar Alterações' : 'Cadastrar Encarregado'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Operadores() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'operadores' | 'encarregados'>('operadores');

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Gerenciar Equipe</h2>
        <p className="text-zinc-500 text-sm">Operadores de campo e encarregados de obra — tabelas separadas.</p>
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-zinc-200 w-fit shadow-sm">
        {([
          { id: 'operadores', label: 'Operadores', icon: User },
          { id: 'encarregados', label: 'Encarregados', icon: ShieldCheck },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all',
              tab === t.id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'
            )}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'operadores' ? <OperadoresTab isAdmin={isAdmin} /> : <EncarregadosTab isAdmin={isAdmin} />}
    </div>
  );
}
