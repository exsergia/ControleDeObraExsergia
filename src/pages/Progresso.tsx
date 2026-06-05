import React, { useState, useEffect, useRef } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, query, where, addDoc, updateDoc, setDoc, doc, serverTimestamp, deleteDoc } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Obra, Atividade, Operator } from '../types';
import {
  Activity,
  Plus,
  Search,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Users,
  Trash2,
  X,
  Target,
  DollarSign
} from 'lucide-react';
import { cn } from '../lib/utils';

import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';

export default function ProgressoFisico() {
  const { isAdmin, isEncarregado, encarregadoObraIds, notify } = useAuth();
  const [selectedObraId, setSelectedObraId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [operadoresSnap] = useCollection(collection(db, 'operadores'));
  
  const actividadesQuery = selectedObraId === 'all'
    ? collection(db, 'atividades')
    : query(collection(db, 'atividades'), where('obraId', '==', selectedObraId));
    
  const [atividadesSnap, loading] = useCollection(actividadesQuery);

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];
  const operadores = (operadoresSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]) || [];

  const filteredAtividades = atividades.filter(a =>
    a.descricao.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredAtividades.length / PAGE_SIZE));
  const pagedAtividades = filteredAtividades.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [formData, setFormData, limparRascunhoProgresso] = useAutoSaveForm('rascunho-progresso-fisico', {
    obraId: '',
    descricao: '',
    unidade: 'm',
    quantidadePrevista: 0,
    quantidadeExecutada: 0,
    valorUnitario: 0,
    equipeResponsavel: ''
  });

  const handleAddAtividade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'atividades'), {
        ...formData,
        percentual: formData.quantidadePrevista > 0 ? (formData.quantidadeExecutada / formData.quantidadePrevista) * 100 : 0,
        valorUnitario: Number(formData.valorUnitario),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      limparRascunhoProgresso();
      notify('success', 'Atividade Adicionada', 'A nova atividade de progresso físico foi registrada.');
    } catch (err: any) {
      notify('error', 'Erro ao Registrar', err.message || 'Não foi possível registrar a atividade.');
      handleFirestoreError(err, OperationType.WRITE, 'atividades');
    }
  };

  const handleUpdateProgress = async (id: string, currentVal: number, total: number) => {
    try {
      await updateDoc(doc(db, 'atividades', id), {
        quantidadeExecutada: currentVal,
        percentual: Math.min(100, (currentVal / total) * 100),
        updatedAt: serverTimestamp()
      });

      // Snapshot diário: calcula % global com o novo valor aplicado ao estado local
      const totalPrevisto = atividades.reduce((s, a) => s + Number(a.quantidadePrevista || 0), 0);
      const totalExecutado = atividades.reduce((s, a) =>
        s + (a.id === id ? currentVal : Number(a.quantidadeExecutada || 0)), 0);
      const newPerc = totalPrevisto > 0 ? Math.min(100, (totalExecutado / totalPrevisto) * 100) : 0;
      const today = new Date().toISOString().split('T')[0];

      await setDoc(doc(db, 'progresso_diario', today), {
        id: today,
        data: today,
        percentual: Number(newPerc.toFixed(4)),
        totalPrevisto,
        totalExecutado,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      const msg = (err as any)?.message || (err as any)?.details || JSON.stringify(err);
      notify('error', 'Erro ao Salvar', msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta atividade?')) return;
    try {
      await deleteDoc(doc(db, 'atividades', id));
      notify('success', 'Atividade Removida', 'O registro de progresso foi excluído com sucesso.');
    } catch (err) {
      notify('error', 'Erro ao Excluir', 'Não foi possível remover a atividade.');
      handleFirestoreError(err, OperationType.WRITE, 'atividades-delete');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Mão de Obra e Progresso Físico</h2>
          <p className="text-zinc-500 text-sm">Controle de execução e produtividade em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(isAdmin || isEncarregado) && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Adicionar Atividade
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar atividade..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm transition-all"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm">
          <Building2 className="w-4 h-4 text-zinc-400 ml-2" />
          <select
            className="bg-transparent border-none text-sm font-bold text-zinc-900 focus:ring-0 pr-8"
            value={selectedObraId}
            onChange={(e) => { setSelectedObraId(e.target.value); setPage(1); }}
          >
            <option value="all">Todas as Obras</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white animate-pulse rounded-[2.5rem] border border-zinc-100" />
          ))
        ) : filteredAtividades.length > 0 ? (
          pagedAtividades.map(ativ => (
            <ActivityCard
              key={ativ.id}
              ativ={ativ}
              obra={obras.find(o => o.id === ativ.obraId)}
              onUpdate={handleUpdateProgress}
              onDelete={() => handleDelete(ativ.id)}
              readOnly={!isAdmin && !isEncarregado}
            />
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-zinc-100">
            <Activity className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">Nenhuma atividade registrada.</p>
            {isAdmin && <button onClick={() => setIsModalOpen(true)} className="text-zinc-900 font-bold underline mt-2">Registrar agora</button>}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pb-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-bold bg-white border border-zinc-200 rounded-xl disabled:opacity-40 hover:bg-zinc-50 transition-all"
          >
            ← Anterior
          </button>
          <span className="text-sm font-medium text-zinc-500">
            {page} / {totalPages}
            <span className="ml-2 text-zinc-400">({filteredAtividades.length} atividades)</span>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-bold bg-white border border-zinc-200 rounded-xl disabled:opacity-40 hover:bg-zinc-50 transition-all"
          >
            Próxima →
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-zinc-100 rounded-t-[2rem]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Nova Atividade</h3>
                  <p className="text-zinc-500 text-sm">Cadastre uma nova tarefa de mão de obra.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddAtividade} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Vincular à Obra</label>
                <select
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                  value={formData.obraId}
                  onChange={(e) => setFormData({...formData, obraId: e.target.value})}
                >
                  <option value="">Selecione a Obra...</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Descrição da Atividade</label>
                <input
                  required
                  placeholder="Ex: Lançamento de Cabos, Pintura..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Quantidade Prevista</label>
                <div className="flex gap-2">
                  <input
                    required
                    type="number"
                    className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                    value={!formData.quantidadePrevista ? '' : formData.quantidadePrevista}
                    onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={(e) => setFormData({...formData, quantidadePrevista: Math.max(0, parseFloat(e.target.value) || 0)})}
                  />
                  <select
                    className="w-20 px-2 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold"
                    value={formData.unidade}
                    onChange={(e) => setFormData({...formData, unidade: e.target.value})}
                  >
                    <option value="m">m</option>
                    <option value="m²">m²</option>
                    <option value="un">un</option>
                    <option value="pt">pt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                    value={!formData.valorUnitario ? '' : formData.valorUnitario}
                    onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={(e) => setFormData({...formData, valorUnitario: Math.max(0, parseFloat(e.target.value) || 0)})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Equipe Resp.</label>
                  <input
                    placeholder="Ex: Equipe Alfa"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.equipeResponsavel}
                    onChange={(e) => setFormData({...formData, equipeResponsavel: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200"
                >
                  Criar Atividade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ ativ, obra, onUpdate, onDelete, readOnly = false }: {
  key?: string | number,
  ativ: Atividade,
  obra?: Obra,
  onUpdate: (id: string, current: number, total: number) => void | Promise<void>,
  onDelete: () => void | Promise<void>,
  readOnly?: boolean
}) {
  const [localValue, setLocalValue] = useState<string>(String(ativ.quantidadeExecutada ?? 0));
  const hasFocus = useRef(false);
  const localValueRef = useRef(localValue);
  const isDirty = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!hasFocus.current) {
      const v = String(ativ.quantidadeExecutada ?? 0);
      setLocalValue(v);
      localValueRef.current = v;
      isDirty.current = false;
    }
  }, [ativ.quantidadeExecutada]);

  // Salva ao sair da página se houver valor pendente
  useEffect(() => {
    return () => {
      if (isDirty.current && !readOnly) {
        const parsed = Math.max(0, parseFloat(localValueRef.current) || 0);
        onUpdate(ativ.id, parsed, ativ.quantidadePrevista);
      }
    };
  }, []);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    hasFocus.current = true;
    setSaveError(false);
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    localValueRef.current = e.target.value;
    isDirty.current = true;
    setLocalValue(e.target.value);
  };

  const commit = () => {
    hasFocus.current = false;
    if (readOnly) return;
    const parsed = Math.max(0, parseFloat(localValueRef.current) || 0);
    setLocalValue(String(parsed));
    localValueRef.current = String(parsed);
    isDirty.current = false;
    setSaving(true);
    setSaveError(false);
    Promise.resolve(onUpdate(ativ.id, parsed, ativ.quantidadePrevista))
      .catch(() => setSaveError(true))
      .finally(() => setSaving(false));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) { e.preventDefault(); return; }
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const displayedExec = parseFloat(localValue) || 0;
  const perc = Math.min(100, Math.round(ativ.quantidadePrevista > 0 ? (displayedExec / ativ.quantidadePrevista) * 100 : 0));
  const colorClass = perc < 50 ? 'bg-red-500' : perc < 100 ? 'bg-amber-500' : 'bg-green-500';
  const badgeClass = perc < 50 ? 'bg-red-50 text-red-600 border-red-100' : perc < 100 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100';
  const percTextClass = perc < 50 ? 'text-red-500' : perc < 100 ? 'text-amber-500' : 'text-green-500';

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {obra && (
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100 truncate max-w-[140px]">
                {obra.nome}
              </span>
            )}
            <span className={cn('text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', badgeClass)}>
              {perc}%
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-bold text-zinc-900 leading-snug">{ativ.descricao}</h4>
          {ativ.equipeResponsavel && (
            <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />{ativ.equipeResponsavel}
            </p>
          )}
        </div>
        {!readOnly && (
          <button onClick={onDelete} className="p-2 text-zinc-300 hover:text-red-500 transition-colors shrink-0 -mr-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="px-4 sm:px-5 py-1">
        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div className={cn('h-full transition-all duration-500 rounded-full', colorClass)} style={{ width: `${perc}%` }} />
        </div>
      </div>

      {/* Valores + Input */}
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3">
        {/* Previsto */}
        <div className="flex-1 text-center bg-zinc-50 rounded-xl py-2.5 px-2 border border-zinc-100">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Previsto</p>
          <p className="text-lg font-black text-zinc-700 leading-tight">{ativ.quantidadePrevista}</p>
          <p className="text-[9px] text-zinc-400">{ativ.unidade}</p>
        </div>

        {/* Input executado — principal área de interação */}
        <div className="flex-[1.4] text-center">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Executado {saving && <span className="text-amber-400">↑</span>}
          </p>
          <input
            type="number"
            inputMode="decimal"
            className={cn(
              'w-full py-3 border-2 rounded-xl text-xl font-black text-zinc-900 focus:outline-none transition-colors text-center',
              readOnly ? 'bg-zinc-50 cursor-not-allowed border-zinc-100'
                : saveError ? 'bg-red-50 border-red-400'
                : saving ? 'bg-white border-amber-300'
                : 'bg-white border-zinc-200 focus:border-zinc-900'
            )}
            value={localValue}
            min="0"
            readOnly={readOnly}
            onFocus={handleFocus}
            onChange={handleChange}
            onBlur={commit}
            onKeyDown={handleKeyDown}
          />
          <p className="text-[9px] text-zinc-400 mt-0.5">{ativ.unidade}</p>
        </div>

        {/* % avanço */}
        <div className="flex-1 text-center bg-zinc-50 rounded-xl py-2.5 px-2 border border-zinc-100">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Avanço</p>
          <p className={cn('text-lg font-black leading-tight', percTextClass)}>{perc}%</p>
          <p className="text-[9px] text-zinc-400 truncate">{displayedExec}/{ativ.quantidadePrevista}</p>
        </div>
      </div>

      {/* Rodapé financeiro — só se tiver valor unitário */}
      {(ativ.valorUnitario || 0) > 0 && (
        <div className="px-4 py-2 sm:px-5 border-t border-zinc-50 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Exec: <span className="font-bold text-zinc-700 ml-0.5">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayedExec * (ativ.valorUnitario || 0))}
            </span>
          </p>
          <p className="text-[10px] text-zinc-300">
            / Orç: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ativ.quantidadePrevista * (ativ.valorUnitario || 0))}
          </p>
        </div>
      )}
    </div>
  );
}
