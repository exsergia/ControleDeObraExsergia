import { useState, useMemo, ReactNode } from 'react';
import { usePersistedTab } from '../hooks/usePersistedTab';
import { useCollection } from '../lib/supabaseHooks';
import { collection, query, orderBy } from '../lib/supabaseDb';
import { db } from '../lib/supabase';
import { Obra, Material, Atividade, FiscalDoc, Tool, Equipamento, EquipamentoManutencao, EquipamentoLocacao } from '../types';
import {
  FileText,
  TrendingUp,
  DollarSign,
  PieChart,
  Search,
  Filter,
  Activity,
  Package,
  Receipt,
  Hammer,
  Wrench,
} from 'lucide-react';
import { cn } from '../lib/utils';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value || 0);

export default function Financeiro() {
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap] = useCollection(query(collection(db, 'materiais'), orderBy('dataEntrega', 'desc')));
  const [atividadesSnap] = useCollection(collection(db, 'atividades'));
  const [fiscalSnap] = useCollection(query(collection(db, 'fiscal_docs'), orderBy('data', 'desc')));
  const [toolsSnap] = useCollection(query(collection(db, 'tools'), orderBy('nome', 'asc')));
  const [equipamentosSnap] = useCollection(query(collection(db, 'equipamentos'), orderBy('nome', 'asc')));
  const [manutencoesSnap] = useCollection(collection(db, 'equipamento_manutencoes'));
  const [locacoesSnap] = useCollection(collection(db, 'equipamento_locacoes'));
  
  const [search, setSearch] = useState('');
  const [selectedObraId, setSelectedObraId] = useState('Todas');
  const [activeTab, setActiveTab] = usePersistedTab<'materiais' | 'atividades'>('tab-financeiro', 'materiais');

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];
  const fiscalDocs = (fiscalSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FiscalDoc[]) || [];
  const tools = (toolsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Tool[]) || [];
  const equipamentos = (equipamentosSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Equipamento[]) || [];
  const manutencoes = (manutencoesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EquipamentoManutencao[]) || [];
  const locacoes = (locacoesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EquipamentoLocacao[]) || [];

  const stats = useMemo(() => {
    const filterMat = materiais.filter(m => selectedObraId === 'Todas' || m.obraId === selectedObraId);
    const filterAtiv = atividades.filter(a => selectedObraId === 'Todas' || a.obraId === selectedObraId);
    const filterFiscal = fiscalDocs.filter(f => selectedObraId === 'Todas' || f.obraId === selectedObraId);
    const includeGlobalAssets = selectedObraId === 'Todas';
    
    const matTotal = filterMat.reduce((acc, m) => acc + (m.valorTotal || 0), 0);
    const ativTotalPrevisto = filterAtiv.reduce((acc, a) => acc + (a.quantidadePrevista * (a.valorUnitario || 0)), 0);
    const ativTotalExecutado = filterAtiv.reduce((acc, a) => acc + (a.quantidadeExecutada * (a.valorUnitario || 0)), 0);
    const fiscalTotal = filterFiscal.reduce((acc, f) => acc + (f.valor || 0), 0);
    const ferramentasPatrimonio = includeGlobalAssets ? tools.reduce((acc, t) => acc + (t.valor || 0), 0) : 0;
    const equipamentosPatrimonio = includeGlobalAssets ? equipamentos.reduce((acc, e) => acc + (e.valorAquisicao || 0), 0) : 0;
    const manutencaoEquipamentos = includeGlobalAssets ? manutencoes.reduce((acc, m) => acc + (m.custoTotal || 0), 0) : 0;
    const receitaLocacoes = includeGlobalAssets ? locacoes.reduce((acc, l) => acc + (l.valorLocacao || 0), 0) : 0;
    const custoOperacional = matTotal + ativTotalExecutado + manutencaoEquipamentos;
    const patrimonio = ferramentasPatrimonio + equipamentosPatrimonio;
    const resultadoOperacional = receitaLocacoes - custoOperacional;
    
    const conferidos = filterMat.filter(m => m.statusConferencia === 'Conferido').length;
    const pendentes = filterMat.filter(m => m.statusConferencia === 'Pendente').length;
    const divergentes = filterMat.filter(m => m.statusConferencia === 'Divergente').length;
    
    return { 
      matTotal, 
      ativTotalPrevisto, 
      ativTotalExecutado,
      fiscalTotal,
      manutencaoEquipamentos,
      receitaLocacoes,
      patrimonio,
      custoOperacional,
      resultadoOperacional,
      conferidos, 
      pendentes, 
      divergentes,
      count: filterMat.length + filterAtiv.length + filterFiscal.length,
      ativosCount: includeGlobalAssets ? tools.length + equipamentos.length : 0,
      includeGlobalAssets,
    };
  }, [materiais, atividades, fiscalDocs, tools, equipamentos, manutencoes, locacoes, selectedObraId]);

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
      <div data-tour="fin-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 uppercase tracking-widest">Painel Financeiro</h2>
          <p className="text-zinc-500 text-sm font-medium">Consolidação de custos, receitas, patrimônio e auditoria de entregas.</p>
        </div>
      </div>

      {/* Finance Stats */}
      <div data-tour="fin-stats" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4 sm:gap-6">
           <div className="w-12 h-12 sm:w-14 sm:h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
             <DollarSign className="w-6 h-6 sm:w-7 sm:h-7" />
           </div>
           <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Custo Operacional</p>
              <p className="text-lg sm:text-3xl font-black text-zinc-900 tracking-tighter truncate">{brl(stats.custoOperacional)}</p>
           </div>
        </div>
        <div className="bg-white p-4 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4 sm:gap-6">
           <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
             <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
           </div>
           <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Receita Registrada</p>
              <p className="text-lg sm:text-3xl font-black text-zinc-900 tracking-tighter truncate">{brl(stats.receitaLocacoes)}</p>
           </div>
        </div>
        <div className={cn(
          "p-4 sm:p-8 rounded-2xl border shadow-sm flex items-center gap-4 sm:gap-6",
          stats.resultadoOperacional >= 0 ? "bg-white border-zinc-200" : "bg-red-50 border-red-100"
        )}>
           <div className={cn(
             "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0",
             stats.resultadoOperacional >= 0 ? "bg-zinc-900" : "bg-red-600"
           )}>
             <PieChart className="w-6 h-6 sm:w-7 sm:h-7" />
           </div>
           <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Resultado Operacional</p>
              <p className={cn(
                "text-lg sm:text-3xl font-black tracking-tighter truncate",
                stats.resultadoOperacional >= 0 ? "text-zinc-900" : "text-red-700"
              )}>{brl(stats.resultadoOperacional)}</p>
           </div>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
           <Hammer className="absolute -right-4 -bottom-4 w-24 h-24 text-zinc-800 opacity-50" />
           <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest relative z-10">Patrimônio Cadastrado</p>
           <p className="text-xl sm:text-3xl font-black tracking-tighter relative z-10">{brl(stats.patrimonio)}</p>
           <div className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded inline-block self-start mt-2 border border-zinc-700 relative z-10">
              {stats.includeGlobalAssets ? `${stats.ativosCount} ativos` : 'fora do filtro por obra'}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <div className="bg-green-500 h-full" style={{ width: `${(stats.conferidos/(stats.conferidos + stats.pendentes + stats.divergentes) || 0) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(stats.pendentes/(stats.conferidos + stats.pendentes + stats.divergentes) || 0) * 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${(stats.divergentes/(stats.conferidos + stats.pendentes + stats.divergentes) || 0) * 100}%` }} />
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Resumo por Origem</p>
              <p className="text-xs text-zinc-500 mt-1">Valores com obra respeitam o filtro; patrimônio e equipamentos aparecem apenas em Todas as Obras.</p>
            </div>
            <span className="text-xs font-black text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">{stats.count} lançamentos</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <SummaryItem icon={<Package className="w-4 h-4" />} label="Materiais" value={stats.matTotal} tone="red" />
            <SummaryItem icon={<Activity className="w-4 h-4" />} label="Atividades Executadas" value={stats.ativTotalExecutado} tone="amber" sub={`orçado: ${brl(stats.ativTotalPrevisto)}`} />
            <SummaryItem icon={<Receipt className="w-4 h-4" />} label="NF / Cupom Fiscal" value={stats.fiscalTotal} tone="zinc" sub="referencia fiscal, nao soma no custo" />
            <SummaryItem icon={<Wrench className="w-4 h-4" />} label="Manutenção de Equipamentos" value={stats.manutencaoEquipamentos} tone="red" muted={!stats.includeGlobalAssets} />
            <SummaryItem icon={<Hammer className="w-4 h-4" />} label="Ferramentas + Equipamentos" value={stats.patrimonio} tone="zinc" muted={!stats.includeGlobalAssets} sub="patrimônio, não custo operacional" />
            <SummaryItem icon={<TrendingUp className="w-4 h-4" />} label="Locações de Equipamentos" value={stats.receitaLocacoes} tone="green" muted={!stats.includeGlobalAssets} />
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
           <Filter className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
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

function SummaryItem({
  icon,
  label,
  value,
  sub,
  tone,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  sub?: string;
  tone: 'red' | 'amber' | 'green' | 'zinc';
  muted?: boolean;
}) {
  const toneClass = {
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    green: 'text-green-600 bg-green-50',
    zinc: 'text-zinc-700 bg-zinc-100',
  }[tone];

  return (
    <div className={cn('rounded-xl border border-zinc-100 p-3', muted ? 'opacity-50 bg-zinc-50' : 'bg-white')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">{label}</p>
          <p className="text-sm font-black text-zinc-900 mt-1">{brl(value)}</p>
          {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', toneClass)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
