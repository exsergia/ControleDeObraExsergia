import React, { useState, useMemo } from 'react';
import { usePersistedTab } from '../hooks/usePersistedTab';
import { useCollection } from '../lib/supabaseHooks';
import { collection, query, orderBy } from '../lib/supabaseDb';
import { db } from '../lib/supabase';
import { Obra, Material, Atividade } from '../types';
import { 
  FileText, 
  Download, 
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

import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../App';
import { parseDate } from '../lib/dateUtils';

export default function Financeiro() {
  const { notify, isAdmin } = useAuth();
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap, loading] = useCollection(query(collection(db, 'materiais'), orderBy('dataEntrega', 'desc')));
  const [atividadesSnap] = useCollection(collection(db, 'atividades'));
  
  const [search, setSearch] = useState('');
  const [selectedObraId, setSelectedObraId] = useState('Todas');
  const [activeTab, setActiveTab] = usePersistedTab<'materiais' | 'atividades'>('tab-financeiro', 'materiais');

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];

  const handleExport = () => {
    const wb = utils.book_new();
    const BRL_FMT = '"R$"\\ #,##0.00';

    const applyFmt = (ws: any, cols: string[], rowCount: number, fmt: string) => {
      for (let r = 2; r <= rowCount + 1; r++) {
        cols.forEach(c => {
          const ref = `${c}${r}`;
          if (ws[ref]) ws[ref].z = fmt;
        });
      }
    };

    // 1. Current View Tab
    const currentData = activeTab === 'materiais'
      ? filteredMateriais.map(m => ({
          Obra: obras.find(o => o.id === m.obraId)?.nome || '---',
          Material: m.descricao,
          Entrega: m.codigoEntrega,
          Fornecedor: m.fornecedor || '---',
          Quantidade: m.quantidade,
          Unidade: m.unidade,
          'Preço Unitário': m.precoUnitario,
          'Valor Total': m.valorTotal,
          Status: m.statusConferencia,
          Data: (() => { const dt = parseDate(m.dataEntrega); return dt ? format(dt, 'dd/MM/yyyy') : '---'; })()
        }))
      : filteredAtividades.map(a => ({
          Obra: obras.find(o => o.id === a.obraId)?.nome || '---',
          Atividade: a.descricao,
          Unidade: a.unidade,
          Prevista: a.quantidadePrevista,
          Executada: a.quantidadeExecutada,
          Percentual: `${a.percentual.toFixed(2)}%`,
          'Preço Unitário': a.valorUnitario || 0,
          'Valor Orçado': a.quantidadePrevista * (a.valorUnitario || 0),
          'Valor Executado': a.quantidadeExecutada * (a.valorUnitario || 0)
        }));

    const ws = utils.json_to_sheet(currentData);

    if (activeTab === 'materiais') {
      ws['!cols'] = [
        { wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 22 },
        { wch: 11 }, { wch: 9 }, { wch: 17 }, { wch: 17 }, { wch: 13 }, { wch: 13 }
      ];
      applyFmt(ws, ['G', 'H'], currentData.length, BRL_FMT);
    } else {
      ws['!cols'] = [
        { wch: 22 }, { wch: 32 }, { wch: 9 }, { wch: 11 },
        { wch: 11 }, { wch: 11 }, { wch: 17 }, { wch: 17 }, { wch: 17 }
      ];
      applyFmt(ws, ['G', 'H', 'I'], currentData.length, BRL_FMT);
    }

    utils.book_append_sheet(wb, ws, activeTab === 'materiais' ? "Relatórios Materiais" : "Progresso Financeiro");

    // 2. BI CONSOLIDATED DATA (Flat Table for Power BI)
    const biData = [
      ...materiais.map(m => ({
        CATEGORIA: 'MATERIAL',
        OBRA: obras.find(o => o.id === m.obraId)?.nome || 'N/A',
        ITEM: m.descricao,
        DATA: (() => { const dt = parseDate(m.dataEntrega); return dt ? format(dt, 'yyyy-MM-dd') : 'N/A'; })(),
        VALOR_UN: m.precoUnitario,
        QUANTIDADE: m.quantidade,
        TOTAL: m.valorTotal,
        STATUS: m.statusConferencia,
        UNIDADE: m.unidade
      })),
      ...atividades.map(a => ({
        CATEGORIA: 'ATIVIDADE',
        OBRA: obras.find(o => o.id === a.obraId)?.nome || 'N/A',
        ITEM: a.descricao,
        DATA: 'ORÇADO',
        VALOR_UN: a.valorUnitario || 0,
        QUANTIDADE: a.quantidadeExecutada,
        TOTAL: a.quantidadeExecutada * (a.valorUnitario || 0),
        STATUS: 'PROCESSO',
        UNIDADE: a.unidade
      }))
    ];

    const biWs = utils.json_to_sheet(biData);
    biWs['!cols'] = [
      { wch: 13 }, { wch: 26 }, { wch: 36 }, { wch: 13 },
      { wch: 17 }, { wch: 13 }, { wch: 17 }, { wch: 13 }, { wch: 11 }
    ];
    applyFmt(biWs, ['E', 'G'], biData.length, BRL_FMT);

    utils.book_append_sheet(wb, biWs, "DADOS_BI_POWER_BI");

    writeFile(wb, `Financeiro_BI_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    notify('success', 'Relatório Exportado', 'A base financeira para Power BI foi gerada com sucesso.');
  };

  const handleExportBoletim = () => {
    const wb = utils.book_new();
    const BRL_FMT = '"R$"\\ #,##0.00';
    const PCT_FMT = '0.00%';
    const QTY_FMT = '#,##0.00';

    const obrasToProcess = selectedObraId === 'Todas'
      ? obras
      : obras.filter(o => o.id === selectedObraId);

    let hasData = false;

    for (const obra of obrasToProcess) {
      const obraAtividades = atividades.filter(a => a.obraId === obra.id);
      if (obraAtividades.length === 0) continue;
      hasData = true;

      const hoje = new Date();
      const periodoInicio = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'dd/MM/yyyy');
      const periodoFim = format(hoje, 'dd/MM/yyyy');

      const aoa: any[][] = [];

      // Row 0: Título
      aoa.push([
        'Boletim de Medição Mensal - Detalhado',
        '', '', '', '', '', '', '', '', '', '',
        'Data de início de Contrato:', '',
        'Data de término de Contrato:', '',
        'Data:', format(hoje, 'dd/MM/yy'), 'Revisão:', 1
      ]);

      // Row 1: Dados do contrato
      aoa.push([
        'Contrato N.°', '', obra.centroCusto || '0', '',
        'Contratada:', '', 'EXSERGIA LTDA', '',
        'Objeto:', '', obra.nome || '---',
        'Período:', `${periodoInicio} a ${periodoFim}`, '',
        'Medição:', 'BM-XXXX-YYYY-01',
        '', '', ''
      ]);

      // Row 2: Cabeçalho de grupos (mesclados)
      aoa.push([
        'CC / PEP', 'CLASS. CONT.', 'ITEM', 'DESCRIÇÃO', 'UNID.',
        'REAIS', '',
        'QUANTIDADES', '', '',
        'VALORES EM REAIS', '', '', '', '',
        'EXEC. %'
      ]);

      // Row 3: Sub-cabeçalhos
      aoa.push([
        '', '', '', '', '',
        'PREÇO UNITÁRIO', 'TOTAL PREVISTO',
        'ACUMULADO ANTERIOR', 'DO MÊS', 'TOTAL ACUMULADO',
        'ACUMULADO ANTERIOR', 'DO MÊS', 'TOTAL ACUMULADO', 'PREVISTO CONTRATO', 'SALDO',
        ''
      ]);

      // Row 4: Cabeçalho da obra (seção)
      aoa.push([
        obra.centroCusto || '', '', '',
        obra.nome.toUpperCase(),
        '', '', '', '', '', '', '', '', '', '', '', ''
      ]);

      // Linhas de atividades
      obraAtividades.forEach((ativ, idx) => {
        const precoUnit = ativ.valorUnitario || 0;
        const prevContrato = ativ.quantidadePrevista * precoUnit;
        const doMesQty = ativ.quantidadeExecutada;
        const doMesValor = doMesQty * precoUnit;
        const saldo = prevContrato - doMesValor;
        const execPct = ativ.percentual / 100;

        aoa.push([
          obra.centroCusto || '',
          '',
          String(idx + 1),
          ativ.descricao,
          ativ.unidade,
          precoUnit,
          ativ.quantidadePrevista,
          0,
          doMesQty,
          doMesQty,
          0,
          doMesValor,
          doMesValor,
          prevContrato,
          saldo,
          execPct
        ]);
      });

      // Linha de totais
      const totPrevContrato = obraAtividades.reduce((acc, a) => acc + a.quantidadePrevista * (a.valorUnitario || 0), 0);
      const totExecutado = obraAtividades.reduce((acc, a) => acc + a.quantidadeExecutada * (a.valorUnitario || 0), 0);
      const totPct = totPrevContrato > 0 ? totExecutado / totPrevContrato : 0;
      aoa.push([
        '', '', '', 'TOTAL GERAL', '',
        '', '', '', '', '',
        0, totExecutado, totExecutado, totPrevContrato, totPrevContrato - totExecutado, totPct
      ]);

      const ws = utils.aoa_to_sheet(aoa);

      ws['!cols'] = [
        { wch: 12 }, { wch: 13 }, { wch: 10 }, { wch: 52 }, { wch: 8 },
        { wch: 17 }, { wch: 15 }, { wch: 19 }, { wch: 12 }, { wch: 19 },
        { wch: 19 }, { wch: 17 }, { wch: 19 }, { wch: 19 }, { wch: 17 }, { wch: 10 }
      ];

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },   // Título
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },    // CC/PEP
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },    // CLASS. CONT.
        { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },    // ITEM
        { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } },    // DESCRIÇÃO
        { s: { r: 2, c: 4 }, e: { r: 3, c: 4 } },    // UNID.
        { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },    // REAIS
        { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },    // QUANTIDADES
        { s: { r: 2, c: 10 }, e: { r: 2, c: 14 } },  // VALORES EM REAIS
        { s: { r: 2, c: 15 }, e: { r: 3, c: 15 } },  // EXEC. %
        { s: { r: 4, c: 3 }, e: { r: 4, c: 15 } },   // Nome da obra
      ];

      // Aplicar formatos numéricos a partir da linha 6 (Excel) = índice 5 (0-based)
      for (let excelRow = 6; excelRow <= aoa.length; excelRow++) {
        ['F', 'K', 'L', 'M', 'N', 'O'].forEach(col => {
          const ref = `${col}${excelRow}`;
          if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = BRL_FMT;
        });
        const pctRef = `P${excelRow}`;
        if (ws[pctRef] && typeof ws[pctRef].v === 'number') ws[pctRef].z = PCT_FMT;
        ['G', 'H', 'I', 'J'].forEach(col => {
          const ref = `${col}${excelRow}`;
          if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = QTY_FMT;
        });
      }

      const safeSheetName = obra.nome.replace(/[/\\*?:[\]]/g, '-').slice(0, 31);
      utils.book_append_sheet(wb, ws, safeSheetName);
    }

    if (!hasData) {
      notify('error', 'Sem dados', 'Nenhuma atividade encontrada para gerar o boletim.');
      return;
    }

    writeFile(wb, `Boletim_Medicao_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    notify('success', 'Boletim Exportado', 'O Boletim de Medição Mensal foi gerado com sucesso.');
  };

  const stats = useMemo(() => {
    const filterMat = materiais.filter(m => selectedObraId === 'Todas' || m.obraId === selectedObraId);
    const filterAtiv = atividades.filter(a => selectedObraId === 'Todas' || a.obraId === selectedObraId);
    
    const matTotal = filterMat.reduce((acc, m) => acc + m.valorTotal, 0);
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
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
            <button
              onClick={handleExportBoletim}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-700 text-white rounded-xl font-bold hover:bg-zinc-600 transition-all shadow-xl shadow-zinc-200 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              Boletim de Medição
            </button>
          </div>
        )}
      </div>

      {/* Finance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-6">
           <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
             <DollarSign className="w-7 h-7" />
           </div>
           <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Custo Total Executado</p>
              <p className="text-3xl font-black text-zinc-900 tracking-tighter">
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
                 <p className="text-2xl font-bold text-zinc-800">{stats.conferidos}</p>
                 <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded inline-block">Conferidos</p>
              </div>
              <div className="space-y-1 text-right">
                 <p className="text-2xl font-bold text-zinc-800">{stats.pendentes}</p>
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
           <p className="text-4xl font-black tracking-tighter relative z-10">{stats.count}</p>
           <div className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded inline-block self-start mt-2 border border-zinc-700 relative z-10">
              SISTEMA INTEGRADO
           </div>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-zinc-200 w-fit">
        {[
          { id: 'materiais', label: 'Insumos / Materiais', icon: Package },
          { id: 'atividades', label: 'Atividades (Mão de Obra)', icon: Activity }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-zinc-900 text-white shadow-md border-zinc-900" 
                : "text-zinc-500 hover:bg-zinc-50 border-transparent"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
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
        <div className="flex items-center gap-3">
           <Filter className="w-4 h-4 text-zinc-400" title="Filtrar por Obra" />
           <select 
            className="bg-white border border-zinc-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider focus:outline-none"
            value={selectedObraId}
            onChange={(e) => setSelectedObraId(e.target.value)}
           >
              <option value="Todas">Todas as Obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
           </select>
        </div>
      </div>

      {/* Consolidation Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.precoUnitario)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-mono font-bold text-zinc-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal)}
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
