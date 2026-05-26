import React, { useState } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, serverTimestamp, query, where } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Atividade, Obra } from '../types';
import { 
  Plus, 
  Settings2, 
  BarChart3, 
  ArrowRight,
  Search,
  ChevronDown,
  Activity,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';

export default function Atividades() {
  const { isAdmin, notify } = useAuth();
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [selectedObraId, setSelectedObraId] = useState('');
  
  const [atividadesSnap, loading] = useCollection(
    selectedObraId ? query(collection(db, 'atividades'), where('obraId', '==', selectedObraId)) : null
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData, limparRascunhoAtividade] = useAutoSaveForm<Partial<Atividade>>('rascunho-atividade', {
    descricao: '',
    unidade: 'm',
    quantidadePrevista: 0,
    quantidadeExecutada: 0,
    percentual: 0
  });

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];

  const handleAddAtividade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObraId) return notify('warning', 'Atenção', 'Selecione uma obra primeiro.');
    
    try {
      await addDoc(collection(db, 'atividades'), {
        ...formData,
        obraId: selectedObraId,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      limparRascunhoAtividade();
      notify('success', 'Atividade Cadastrada', 'O novo escopo de serviço foi adicionado com sucesso.');
    } catch (err: any) {
      notify('error', 'Erro ao Salvar', err.message || 'Não foi possível cadastrar a atividade.');
      handleFirestoreError(err, OperationType.WRITE, 'atividades');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Configuração de Atividades</h2>
          <p className="text-zinc-500 text-sm">Defina o escopo de serviços para cada obra.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative w-full sm:min-w-[240px]">
            <select 
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm"
              value={selectedObraId}
              onChange={(e) => setSelectedObraId(e.target.value)}
            >
              <option value="">Selecione uma Obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
          {isAdmin && (
            <button 
              disabled={!selectedObraId}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              <Plus className="w-5 h-5" />
              Nova Atividade
            </button>
          )}
        </div>
      </div>

      {!selectedObraId ? (
        <div className="py-32 text-center bg-white rounded-2xl border-2 border-dashed border-zinc-200">
           <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100">
             <Layers className="w-8 h-8 text-zinc-300" />
           </div>
           <p className="text-zinc-500 font-medium tracking-tight">Selecione uma obra acima para gerenciar suas atividades.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {atividades.length > 0 ? atividades.map(ativ => (
            <div key={ativ.id} className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 group">
              <div className="flex items-center gap-5 flex-1">
                <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center border border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="flex-1">
                   <h4 className="font-bold text-zinc-900 tracking-tight text-lg leading-tight uppercase tracking-wider">{ativ.descricao}</h4>
                   <div className="flex items-center gap-4 text-xs font-semibold text-zinc-500 mt-1">
                      <span className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5 text-zinc-300" /> {ativ.unidade.toUpperCase()}</span>
                      <div className="w-1 h-1 rounded-full bg-zinc-200" />
                      <span className="flex items-center gap-1.5 text-zinc-900"><BarChart3 className="w-3.5 h-3.5 text-zinc-400" /> TOTAL: {ativ.quantidadePrevista} {ativ.unidade}</span>
                   </div>
                </div>
              </div>

              <div className="w-64 space-y-2">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                  <span className="text-zinc-400">{Math.round(ativ.percentual)}% CONCLUÍDO</span>
                  <span className={cn(
                    "text-xs",
                    ativ.percentual < 50 ? "text-red-500" : ativ.percentual < 100 ? "text-amber-500" : "text-green-500"
                  )}>
                    {ativ.quantidadeExecutada} {ativ.unidade}
                  </span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded-full border border-zinc-200 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      ativ.percentual < 50 ? "bg-red-500" : ativ.percentual < 100 ? "bg-amber-500" : "bg-green-500"
                    )}
                    style={{ width: `${ativ.percentual}%` }}
                  />
                </div>
              </div>
            </div>
          )) : (
            <div className="py-20 text-center bg-zinc-50 rounded-2xl border border-zinc-200">
               <p className="text-zinc-500 text-sm">Nenhuma atividade cadastrada para esta obra.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal New Activity */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-zinc-100 flex items-start sm:items-center justify-between gap-4 bg-zinc-50">
              <h3 className="text-lg font-bold text-zinc-900 uppercase tracking-widest">Nova Atividade</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-zinc-500" />
              </button>
            </div>
            <form onSubmit={handleAddAtividade} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Descrição do Serviço</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold"
                  placeholder="Ex: Lançamento de Cabos 50mm²"
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Unidade</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-center"
                    placeholder="Ex: metros, un, m²"
                    value={formData.unidade}
                    onChange={(e) => setFormData({...formData, unidade: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Qtd Prevista</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-center"
                    value={!formData.quantidadePrevista ? '' : formData.quantidadePrevista}
                    onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setFormData({...formData, quantidadePrevista: val});
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 text-sm font-semibold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-all shadow-xl uppercase tracking-widest shadow-zinc-200"
                >
                  Confirmar Escopo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
