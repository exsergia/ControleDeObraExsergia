import React, { useState, useMemo } from 'react';
import { usePersistedTab } from '../hooks/usePersistedTab';
import { useCollection } from '../lib/supabaseHooks';
import { collection, query, orderBy } from '../lib/supabaseDb';
import { db } from '../lib/supabase';
import { Obra, Material, Atividade } from '../types';
import {
  FileText,
  TrendingUp,
  DollarSign,
  PieChart,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  Activity,
  Package,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Financeiro() {
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap, loading] = useCollection(query(collection(db, 'materiais'), orderBy('dataEntrega', 'desc')));
  const [atividadesSnap] = useCollection(collection(db, 'atividades'));
  
  const [search, setSearch] = useState('');
  const [selectedObraId, setSelectedObraId] = useState('Todas');
  const [activeTab, setActiveTab] = usePersistedTab<'materiais' | 'atividades'>('tab-financeiro', 'materiais');

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];

  const stats = useMemo(() => {
    const filterMat = materiais.filter(m => selectedObraId === 'Todas' || m.obraId === selectedObraId);
    const filterAtiv = atividades.filter(a => selectedObraId === 'Todas' || a.obraId === selectedObraId);
    
    const matTotal = filterMat.reduce((acc, m) => acc + (m.valorTotal || 0), 0);
    const ativTotalPrevisto = filterAtiv.reduce((acc, a) => acc + (a.quantidadePrevista * (a.valorUnitario || 0)), 0);
    const ativTotalExecutado = filterAtiv.reduce((acc, a) => acc + (a.quantidadeExecutada * (a.valorUnitario || 0)), 0);
    
    const conferidos = filterMat.filter(m => m.statusConferencia === 'Conferido').length;
    const pendentes = filterMat.filter(m => m.statusConferencia === 'Pendente').length;
    
    return { 
      matTotal, 
      ativTotalPrevisto, 
      ativTotalExecutado,
      totalGeral: matTotal + ativTotalExecutado,
      conferidos, 
      pendentes, 
      count: filterMat.length + filterAtiv.length 
    };
  }, [materiais, atividades, selectedObraId]);

  const filteredMateriais = materiais.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch = (m.descricao || '').toLowerCase().includes(q) || (m.fornecedor || '').toLowerCase().includes(q);
    const matchesObra = selectedObraId === 'Todas' || m.obraId === selectedObraId;
    return matchesSearch && matchesObra;
  });

  const filteredAtividades = atividades.filter(a => {
    const matchesSearch = (a.descricao || '').toLowerCase().includes(search.toLowerCase());
    const matchesObra = selectedObraId === 'Todas' || a.obraId === selectedObraId;
    return matchesSearch && matchesObra;
  });

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 uppercase tracking-widest">Painel Financeiro</h2>
          <p className="text-zinc-500 text-sm font-medium">Consolidação de custos e auditoria de entregas.</p>
        </div>
      </div>

      {/* Finance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4 sm:gap-6">
           <div className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
             <DollarSign className="w-6 h-6 sm:w-7 sm:h-7" />
           </div>
           <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Custo Total Executado</p>
              <p className="text-lg sm:text-3xl font-black text-zinc-900 tracking-tighter truncate">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalGeral)}
              </p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
           <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Auditoria de Campo</span>
              <PieChart className="w-4 h-4 text-zinc-300" />
           </div>
           <div className="flex items-end justify-between">
              <div className="space-y-1">
                 <p className="text-xl sm:text-2xl font-bold text-zinc-800">{stats.conferidos}</p>
                 <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded inline-block">Conferidos</p>
              </div>
              <div className="space-y-1 text-right">
                 <p className="text-xl sm:text-2xl font-bold text-zinc-800">{stats.pendentes}</p>
                 <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded inline-block">Pendentes</p>
              </div>
           </div>
           <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden flex border border-zinc-50">
              <div className="bg-green-500 h-full" style={{ width: `${(stats.conferidos/stats.count || 0) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(stats.pendentes/stats.count || 0) * 100}%` }} />
           </div>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
           <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-zinc-800 opacity-50" />
           <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest relative z-10">Total de Entregas</p>
           <p className="text-2xl sm:text-4xl font-black tracking-tighter relative z-10">{stats.count}</p>
           <div className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded inline-block self-start mt-2 border border-zinc-700 relative z-10">
              SISTEMA INTEGRADO
           </div>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-zinc-200 w-full sm:w-fit">
        {[
          { id: 'materiais', label: 'Insumos / Materiais', labelMobile: 'Materiais', icon: Package },
          { id: 'atividades', label: 'Atividades (Mão de Obra)', labelMobile: 'Atividades', icon: Activity }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all",
              activeTab === tab.id
                ? "bg-zinc-900 text-white shadow-md border-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 border-transparent"
            )}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="sm:hidden truncate">{tab.labelMobile}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Filtrar lançamentos..." 
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 min-w-0">
           <Filter className="w-4 h-4 text-zinc-400 shrink-0" title="Filtrar por Obra" />
           <select
            className="bg-white border border-zinc-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider focus:outline-none truncate w-full sm:w-auto sm:max-w-[220px]"
            value={selectedObraId}
            onChange={(e) => setSelectedObraId(e.target.value)}
           >
              <option value="Todas">Todas as Obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
           </select>
        </div>
      </div>

      {/* Consolidation Table / Cards */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-zinc-100">
          {activeTab === 'materiais' ? filteredMateriais.map(mat => (
            <div key={mat.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 leading-tight">{mat.descricao}</p>
                  <p className="text-xs text-zinc-400 uppercase mt-0.5">{obras.find(o => o.id === mat.obraId)?.nome || '---'}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black uppercase border shrink-0",
                  mat.statusConferencia === 'Conferido' ? "bg-green-50 text-green-700 border-green-200" :
                  mat.statusConferencia === 'Pendente' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-700 border-red-200"
                )}>{mat.statusConferencia}</span>
              </div>
              <p className="text-xs text-zinc-500">{mat.codigoEntrega}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Un: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.precoUnitario || 0)}</p>
                <p className="text-sm font-bold font-mono text-zinc-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal || 0)}</p>
              </div>
            </div>
          )) : filteredAtividades.map(ativ => {
            const orçado = ativ.quantidadePrevista * (ativ.valorUnitario || 0);
            const executado = ativ.quantidadeExecutada * (ativ.valorUnitario || 0);
            return (
              <div key={ativ.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-800 leading-tight">{ativ.descricao}</p>
                    <p className="text-xs text-zinc-400 uppercase mt-0.5">{obras.find(o => o.id === ativ.obraId)?.nome || '---'}</p>
                  </div>
                  <span className="text-sm font-black text-zinc-400 shrink-0">{ativ.percentual.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full">
                  <div className="bg-zinc-900 h-full rounded-full" style={{ width: `${ativ.percentual}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <p className="text-zinc-400">{ativ.quantidadeExecutada}/{ativ.quantidadePrevista} {ativ.unidade}</p>
                  <p className="font-bold font-mono text-zinc-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(executado)}</p>
                </div>
              </div>
            );
          })}
          {(activeTab === 'materiais' ? filteredMateriais : filteredAtividades).length === 0 && (
            <div className="p-12 text-center text-zinc-400 italic">Nenhum lançamento encontrado.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
           {activeTab === 'materiais' ? (
             <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Obra</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Item / NF</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custo Un.</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Custo Total</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Status Auditoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredMateriais.map(mat => (
                    <tr key={mat.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-zinc-900 uppercase">
                          {obras.find(o => o.id === mat.obraId)?.nome || '---'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center border border-zinc-200">
                              <FileText className="w-4 h-4 text-zinc-400" />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-zinc-800 tracking-tight">{mat.descricao}</p>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase">{mat.codigoEntrega}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.precoUnitario || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-mono font-bold text-zinc-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal || 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <span className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border",
                            mat.statusConferencia === 'Conferido' ? "bg-green-50 text-green-700 border-green-200" :
                            mat.statusConferencia === 'Pendente' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {mat.statusConferencia}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           ) : (
             <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Obra</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Atividade / Progresso</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custo Orçado</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Custo Executado</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Percentual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredAtividades.map(ativ => {
                    const orçado = ativ.quantidadePrevista * (ativ.valorUnitario || 0);
                    const executado = ativ.quantidadeExecutada * (ativ.valorUnitario || 0);
                    return (
                      <tr key={ativ.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-zinc-900 uppercase">
                            {obras.find(o => o.id === ativ.obraId)?.nome || '---'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center border border-zinc-200">
                                <Activity className="w-4 h-4 text-zinc-400" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-zinc-800 tracking-tight">{ativ.descricao}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase">{ativ.quantidadeExecutada} / {ativ.quantidadePrevista} {ativ.unidade}</p>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orçado)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-mono font-bold text-zinc-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(executado)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                             <span className="text-[10px] font-black text-zinc-400 mb-1">{ativ.percentual.toFixed(0)}%</span>
                             <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-50">
                               <div className="bg-zinc-900 h-full" style={{ width: `${ativ.percentual}%` }} />
                             </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
}
