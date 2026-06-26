import React, { useState } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType, auth } from '../lib/supabase';
import { FiscalDoc } from '../types';
import { useAuth } from '../App';
import { uploadPhoto } from '../lib/services';
import { CameraCapture } from '../components/CameraCapture';
import { CurrencyInput } from '../components/CurrencyInput';
import { parseDate } from '../lib/dateUtils';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import {
  Receipt, Plus, Camera, X, Search, CreditCard, Calendar,
  Building2, FileText, AlertCircle, Trash2, CheckCircle2, User,
  HardHat, Users,
} from 'lucide-react';
import { Obra, Operator } from '../types';

// E-mails autorizados a usar a aba (financeiro).
export const FISCAL_EMAILS = ['contasapagar@gmail.com', 'nascimentoerick446@gmail.com'];
export const podeVerFiscal = (email?: string | null) =>
  !!email && FISCAL_EMAILS.includes(email.toLowerCase());

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function NotasFiscais() {
  const { userProfile, isAdmin, notify } = useAuth();
  const [docsSnap, loading] = useCollection(query(collection(db, 'fiscal_docs'), orderBy('createdAt', 'desc')));
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const docs = (docsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as FiscalDoc[]) || [];

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    return (
      (d.fornecedor || '').toLowerCase().includes(q) ||
      (d.observacoes || '').toLowerCase().includes(q) ||
      (d.cartaoFinal || '').includes(q) ||
      (d.tipo || '').toLowerCase().includes(q)
    );
  });

  const total = filtered.reduce((acc, d) => acc + (d.valor || 0), 0);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await deleteDoc(doc(db, 'fiscal_docs', id));
      notify('success', 'Excluído', 'Lançamento removido.');
    } catch (err: any) {
      notify('error', 'Erro ao excluir', err.message || 'Não foi possível remover.');
      handleFirestoreError(err, OperationType.DELETE, 'fiscal_docs');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div data-tour="nf-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">NF / Cupom Fiscal</h2>
          <p className="text-zinc-500">Lançamento de notas e cupons com foto e cartão utilizado.</p>
        </div>
        <button
          data-tour="nf-new"
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div data-tour="nf-search" className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por fornecedor, cartão, tipo..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div data-tour="nf-total" className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total</span>
          <span className="text-sm font-black">{brl(total)}</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-48 bg-white rounded-2xl border border-zinc-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-zinc-100">
          <Receipt className="w-14 h-14 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-500">Nenhum lançamento</p>
          <p className="text-xs text-zinc-400">Adicione a primeira nota ou cupom fiscal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => {
            const dt = parseDate(d.data);
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden group">
                <a href={d.fotoUrl} target="_blank" rel="noreferrer" className="block relative aspect-video bg-zinc-100">
                  {d.fotoUrl
                    ? <img src={d.fotoUrl} className="w-full h-full object-cover" alt="Documento fiscal" />
                    : <div className="w-full h-full flex items-center justify-center"><Receipt className="w-8 h-8 text-zinc-300" /></div>}
                  <span className={cn(
                    'absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                    d.tipo === 'NF' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                  )}>{d.tipo}</span>
                </a>
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-black text-zinc-900">{brl(d.valor)}</span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{dt ? format(dt, 'dd/MM/yyyy') : '---'}
                    </span>
                  </div>
                  {d.fornecedor && <p className="text-xs text-zinc-600 break-words flex items-center gap-1"><Building2 className="w-3 h-3 text-zinc-400" />{d.fornecedor}</p>}
                  {d.cartaoFinal && (
                    <p className="text-xs text-zinc-600 flex items-center gap-1 font-mono"><CreditCard className="w-3 h-3 text-zinc-400" />•••• {d.cartaoFinal}</p>
                  )}
                  {d.obraNome && <p className="text-xs text-zinc-600 break-words flex items-center gap-1"><HardHat className="w-3 h-3 text-zinc-400" />{d.obraNome}</p>}
                  {(d.operadoresPresentes?.length || 0) > 0 && <p className="text-[11px] text-zinc-500 break-words flex items-center gap-1"><Users className="w-3 h-3 text-zinc-400" />{d.operadoresPresentes!.map(p => p.nome).join(', ')}</p>}
                  {d.observacoes && <p className="text-[11px] text-zinc-400 break-words">{d.observacoes}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 truncate"><User className="w-3 h-3" />{d.criadoPorNome || '—'}</span>
                    {isAdmin && (
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <FiscalModal
          userName={userProfile ? `${userProfile.nome} ${userProfile.sobrenome || ''}`.trim() : (auth.currentUser?.email || 'Usuário')}
          userId={userProfile?.id || auth.currentUser?.id || ''}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); notify('success', 'Lançado', 'Documento fiscal registrado.'); }}
        />
      )}
    </div>
  );
}

function FiscalModal({ userName, userId, onClose, onSaved }: { userName: string; userId: string; onClose: () => void; onSaved: () => void }) {
  const { notify } = useAuth();
  const [obrasSnap] = useCollection(query(collection(db, 'obras'), orderBy('nome', 'asc')));
  const [operadoresSnap] = useCollection(query(collection(db, 'operadores'), orderBy('nome', 'asc')));
  const obras = (obrasSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as Obra[]) || [];
  const operadores = (operadoresSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as Operator[]) || [];

  const [tipo, setTipo] = useState<'NF' | 'Cupom'>('Cupom');
  const [valor, setValor] = useState<number | ''>('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fornecedor, setFornecedor] = useState('');
  const [cartaoFinal, setCartaoFinal] = useState('');
  const [obraId, setObraId] = useState('');
  const [operadoresPresentes, setOperadoresPresentes] = useState<string[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Equipe da obra selecionada — os operadores presentes saem DAQUI, não de todos.
  const obraSelecionada = obras.find(o => o.id === obraId);
  const idsEquipe = obraSelecionada
    ? (obraSelecionada.operadoresIds?.length ? obraSelecionada.operadoresIds : (obraSelecionada.equipe || []).map(e => e.operatorId))
    : [];
  const operadoresDaObra = operadores.filter(o => idsEquipe.includes(o.id));

  const setFoto = (file: File) => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
    setShowCamera(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!fotoFile) { setError('A foto do documento é obrigatória.'); return; }
    const valorNum = typeof valor === 'number' ? valor : NaN;
    if (!Number.isFinite(valorNum) || valorNum <= 0) { setError('Informe um valor válido.'); return; }

    setLoading(true);
    try {
      const fotoUrl = await uploadPhoto(fotoFile, 'fiscal');
      const obraSel = obras.find(o => o.id === obraId);
      const presentes = operadores
        .filter(o => operadoresPresentes.includes(o.id))
        .map(o => ({ id: o.id, nome: `${o.nome} ${o.sobrenome || ''}`.trim() }));
      await addDoc(collection(db, 'fiscal_docs'), {
        tipo,
        fotoUrl,
        valor: valorNum,
        data: data ? new Date(`${data}T12:00:00`).toISOString() : serverTimestamp(),
        fornecedor: fornecedor.trim(),
        cartaoFinal: cartaoFinal.replace(/\D/g, '').slice(-4),
        obraId: obraId || '',
        obraNome: obraSel?.nome || '',
        operadoresPresentes: presentes,
        criadoPorNome: userName,
        criadoPorId: userId,
        createdAt: serverTimestamp(),
      });
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar.');
      handleFirestoreError(err, OperationType.WRITE, 'fiscal_docs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-bold">Novo Lançamento Fiscal</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(['Cupom', 'NF'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn('py-2.5 rounded-xl text-sm font-bold border transition-all',
                  tipo === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100')}>
                {t === 'NF' ? 'Nota Fiscal' : 'Cupom Fiscal'}
              </button>
            ))}
          </div>

          {/* Foto obrigatória */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Foto do documento (obrigatório)</label>
            {fotoPreview ? (
              <div className="space-y-2">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-zinc-200">
                  <img src={fotoPreview} className="w-full h-full object-cover" alt="Pré-visualização" />
                </div>
                <button type="button" onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-600 hover:bg-zinc-100"><Camera className="w-4 h-4" /> Nova foto</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCamera(true)} className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-400 transition-all">
                <Camera className="w-6 h-6 text-zinc-500" /><span className="text-xs font-bold text-zinc-700">Tirar Foto</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Valor</label>
              <CurrencyInput value={valor} onChange={setValor} required
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:outline-none focus:border-zinc-900" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Data</label>
              <input type="date" required className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Fornecedor</label>
              <input type="text" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900"
                placeholder="Opcional" value={fornecedor} onChange={e => setFornecedor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Cartão (4 últimos)</label>
              <input type="text" inputMode="numeric" maxLength={4}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-zinc-900"
                placeholder="1234" value={cartaoFinal}
                onChange={e => setCartaoFinal(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
          </div>

          {/* Obra vinculada */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Obra vinculada</label>
            <div className="relative">
              <HardHat className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={obraId} onChange={e => { setObraId(e.target.value); setOperadoresPresentes([]); }}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-900 appearance-none">
                <option value="">Nenhuma</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Operadores presentes (multi-seleção) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" />Quem estava presente</label>
              {operadoresPresentes.length > 0 && <span className="text-[10px] font-bold text-zinc-500">{operadoresPresentes.length} selecionado(s)</span>}
            </div>
            {!obraId ? (
              <p className="text-xs text-zinc-400 px-1">Selecione uma obra acima para ver a equipe.</p>
            ) : operadoresDaObra.length === 0 ? (
              <p className="text-xs text-zinc-400 px-1">Nenhum operador atribuído a esta obra. Atribua a equipe em Obras &gt; Equipe Atribuída.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {operadoresDaObra.map(o => {
                  const nome = `${o.nome} ${o.sobrenome || ''}`.trim();
                  const sel = operadoresPresentes.includes(o.id);
                  return (
                    <button key={o.id} type="button"
                      onClick={() => setOperadoresPresentes(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                        sel ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100')}>
                      {nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading}
            className={cn('w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
              loading ? 'bg-zinc-100 text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800')}>
            {loading ? 'Salvando...' : <>Lançar <CheckCircle2 className="w-5 h-5" /></>}
          </button>
        </form>
      </div>

      {showCamera && <CameraCapture onCapture={setFoto} onClose={() => setShowCamera(false)} />}
    </div>
  );
}
