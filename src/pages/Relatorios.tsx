import React, { useState } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Attachment, Checklist, Obra, Material, Atividade, Operator, Tool, ToolLog } from '../types';
import {
  FileText,
  Calendar,
  User,
  MapPin,
  Search,
  ChevronRight,
  ExternalLink,
  Users,
  Box,
  Activity,
  Image as ImageIcon,
  Copy,
  Plus,
  FileDown,
  Paperclip,
  X as XIcon,
  Trash2,
  Hammer,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { uploadFile } from '../lib/services';
import { utils, read, writeFile } from 'xlsx';
import { useAuth } from '../App';

const parseDate = (d: any): Date => {
  if (!d) return new Date();
  if (typeof d?.toDate === 'function') return d.toDate();
  if (typeof d === 'string' && d) return new Date(d);
  if (d instanceof Date) return d;
  return new Date();
};

export default function Relatorios() {
  const { isAdmin, notify } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'diarios' | 'ferramentas'>('diarios');

  const [checklistsSnap, loading] = useCollection(
    query(collection(db, 'checklists'), orderBy('data', 'desc'))
  );
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap] = useCollection(collection(db, 'materiais'));
  const [atividadesSnap] = useCollection(collection(db, 'atividades'));
  const [operadoresSnap] = useCollection(collection(db, 'operadores'));
  const [toolsSnap] = useCollection(collection(db, 'tools'));
  const [toolLogsSnap, loadingLogs] = useCollection(
    query(collection(db, 'toolLogs'), orderBy('dataSaida', 'desc'))
  );

  const [search, setSearch] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);

  const checklists = (checklistsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Checklist[]) || [];
  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];
  const operadores = (operadoresSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]) || [];
  const tools = (toolsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Tool[]) || [];
  const toolLogs = (toolLogsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ToolLog[]) || [];

  const filteredToolLogs = toolLogs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    const tool = tools.find(t => t.id === l.toolId);
    const obra = obras.find(o => o.id === l.obraId);
    return (
      (tool?.nome || '').toLowerCase().includes(q) ||
      (tool?.codigo || '').toLowerCase().includes(q) ||
      (obra?.nome || '').toLowerCase().includes(q) ||
      (l.responsavelNome || '').toLowerCase().includes(q)
    );
  });

  const handleExportFerramentas = () => {
    const wb = utils.book_new();
    const data = toolLogs.map(l => {
      const tool = tools.find(t => t.id === l.toolId);
      const obra = obras.find(o => o.id === l.obraId);
      const saida = parseDate(l.dataSaida);
      const devolucao = l.dataDevolucao ? parseDate(l.dataDevolucao) : null;
      return {
        'ID Retirada': l.id,
        'ID Ferramenta': l.toolId,
        'Ferramenta': tool?.nome || '---',
        'Código': tool?.codigo || '---',
        'Responsável': l.responsavelNome,
        'Obra': obra?.nome || '---',
        'Data Saída': format(saida, 'dd/MM/yyyy'),
        'Hora Saída': format(saida, 'HH:mm:ss'),
        'Data Devolução': devolucao ? format(devolucao, 'dd/MM/yyyy') : '---',
        'Hora Devolução': devolucao ? format(devolucao, 'HH:mm:ss') : '---',
        'Status': l.statusLog,
        'Foto Devolução': l.fotoDevolucaoUrl || '---'
      };
    });
    const ws = utils.json_to_sheet(data);
    utils.book_append_sheet(wb, ws, 'MOVIMENTACAO_FERRAMENTAS');
    writeFile(wb, `Ferramentas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    notify('success', 'Excel Exportado', 'Histórico completo de movimentação gerado com sucesso!');
  };

  const filteredChecklists = checklists.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const obra = obras.find(o => o.id === c.obraId);
    return (
      (obra?.nome || '').toLowerCase().includes(q) ||
      (c.nomeResponsavel || '').toLowerCase().includes(q)
    );
  });

  const handleExportBI = () => {
    const workbook = utils.book_new();

    // 1. Raw Data Table (Checklists)
    const rawData = checklists.map(c => {
      const obra = obras.find(o => o.id === c.obraId);
      const date = parseDate(c.data);
      return {
        ID: c.id,
        Obra: obra?.nome || 'N/A',
        Data: format(date, 'yyyy-MM-dd'),
        Hora: format(date, 'HH:mm'),
        Responsavel: c.nomeResponsavel,
        Observacoes: c.observacoes || '',
        QtdMateriais: c.materiais.length,
        QtdProgresso: c.progresso.length,
        QtdEquipe: c.equipeIds?.length || 0
      };
    });

    // 2. Exploded Materials Table (for many-to-many analysis)
    const materialsData: any[] = [];
    checklists.forEach(c => {
      const obra = obras.find(o => o.id === c.obraId);
      const date = parseDate(c.data);
      c.materiais.forEach(mItem => {
        const mat = materiais.find(m => m.id === mItem.materialId);
        materialsData.push({
          RelatorioID: c.id,
          Data: format(date, 'yyyy-MM-dd'),
          Obra: obra?.nome || 'N/A',
          Material: mat?.descricao || 'N/A',
          Quantidade: mItem.qtdConferida,
          Unidade: mat?.unidade || ''
        });
      });
    });

    // 3. Exploded Progress Table
    const progressData: any[] = [];
    checklists.forEach(c => {
      const obra = obras.find(o => o.id === c.obraId);
      const date = parseDate(c.data);
      c.progresso.forEach(pItem => {
        const ativ = atividades.find(a => a.id === pItem.atividadeId);
        progressData.push({
          RelatorioID: c.id,
          Data: format(date, 'yyyy-MM-dd'),
          Obra: obra?.nome || 'N/A',
          Atividade: ativ?.descricao || 'N/A',
          QuantidadeExecutada: pItem.qtdExecutadaNoDia,
          Unidade: ativ?.unidade || ''
        });
      });
    });

    utils.book_append_sheet(workbook, utils.json_to_sheet(rawData), "CHECKLISTS");
    utils.book_append_sheet(workbook, utils.json_to_sheet(materialsData), "DADOS_MATERIAIS");
    utils.book_append_sheet(workbook, utils.json_to_sheet(progressData), "DADOS_PROGRESSO");

    writeFile(workbook, `BI_Consolidado_Obras_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    notify('success', 'Excel Gerado', 'Base de dados para Power BI exportada com sucesso!');
  };

  const handleDuplicate = async (report: Checklist) => {
    if (!confirm('Deseja usar este relatório como base para um novo? Todos os dados (exceto a data) serão copiados.')) return;
    
    try {
      const { id, ...dataToCopy } = report;
      const newReport = {
        ...dataToCopy,
        data: serverTimestamp(),
        nomeResponsavel: `${dataToCopy.nomeResponsavel} (Base)`,
      };

      await addDoc(collection(db, 'checklists'), newReport);
      notify('success', 'Relatório Duplicado', 'O novo relatório já está disponível no seu histórico.');
    } catch (err: any) {
      notify('error', 'Erro ao Duplicar', err.message || 'Não foi possível duplicar o relatório.');
      handleFirestoreError(err, OperationType.WRITE, 'checklists-duplicate');
    }
  };

  const handleImportTemplate = () => {
    const jsonString = JSON.stringify({
      obraId: "ID_DA_OBRA",
      nomeResponsavel: "NOME",
      materiais: [{ materialId: "ID", qtdConferida: 0 }],
      progresso: [{ atividadeId: "ID", qtdExecutadaNoDia: 0 }],
      equipeIds: [],
      observacoes: "Base de exemplo para replicação."
    }, null, 2);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'base_exemplo_relatorio.json';
    a.click();
    notify('info', 'Download Iniciado', 'Use o modelo para organizar dados antes de inserir manualmente.');
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Relatórios</h2>
          <p className="text-zinc-500">Checklists diários e movimentação de ferramentas.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'diarios' && isAdmin && (
            <>
              <button
                onClick={handleExportBI}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-all shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                Consolidado BI
              </button>
              <button
                onClick={handleImportTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                Base Exemplo
              </button>
              <button
                onClick={() => navigate('/checklist')}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Novo Registro
              </button>
            </>
          )}
          {activeTab === 'ferramentas' && isAdmin && (
            <button
              onClick={handleExportFerramentas}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-all shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-zinc-200 w-fit shadow-sm">
        {([
          { id: 'diarios', label: 'Relatórios Diários', icon: FileText },
          { id: 'ferramentas', label: 'Movimentação de Ferramentas', icon: Hammer },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(''); setSelectedChecklist(null); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
              activeTab === tab.id
                ? 'bg-zinc-900 text-white shadow-md'
                : 'text-zinc-500 hover:bg-zinc-50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder={activeTab === 'diarios' ? 'Buscar por obra ou responsável...' : 'Buscar por ferramenta, obra ou responsável...'}
          className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── FERRAMENTAS TAB ── */}
      {activeTab === 'ferramentas' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ferramenta / ID</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Responsável</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Obra</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Saída</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Devolução</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loadingLogs ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-5 py-6"><div className="h-4 bg-zinc-100 rounded w-full" /></td>
                    </tr>
                  ))
                ) : filteredToolLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <Hammer className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                      <p className="text-zinc-400 text-sm font-medium">Nenhuma movimentação encontrada.</p>
                    </td>
                  </tr>
                ) : filteredToolLogs.map(log => {
                  const tool = tools.find(t => t.id === log.toolId);
                  const obra = obras.find(o => o.id === log.obraId);
                  const saida = parseDate(log.dataSaida);
                  const devolucao = log.dataDevolucao ? parseDate(log.dataDevolucao) : null;
                  const isPending = log.statusLog === 'Aberta';
                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-zinc-900">{tool?.nome || 'Ferramenta removida'}</p>
                        <p className="text-[10px] font-mono text-zinc-400 mt-0.5">ID: {log.id.slice(0, 12)}…</p>
                        {tool?.codigo && <p className="text-[10px] font-bold text-zinc-500">#{tool.codigo}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-zinc-800">{log.responsavelNome}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-zinc-600">{obra?.nome || '---'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-zinc-900">{format(saida, 'dd/MM/yyyy')}</p>
                            <p className="text-[10px] text-zinc-500">{format(saida, 'HH:mm:ss')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {devolucao ? (
                          <div className="flex items-center gap-1.5">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-zinc-900">{format(devolucao, 'dd/MM/yyyy')}</p>
                              <p className="text-[10px] text-zinc-500">{format(devolucao, 'HH:mm:ss')}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Pendente</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide',
                          isPending
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        )}>
                          {isPending ? <Clock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                          {isPending ? 'Em Uso' : 'Devolvida'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DIÁRIOS TAB ── */}
      {activeTab === 'diarios' && <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Relatórios Recentes</h3>
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-white animate-pulse rounded-2xl border border-zinc-100" />
            ))
          ) : filteredChecklists.length > 0 ? (
            filteredChecklists.map(report => (
              <ReportCard 
                key={report.id} 
                report={report} 
                obra={obras.find(o => o.id === report.obraId)}
                isSelected={selectedChecklist?.id === report.id}
                onClick={() => setSelectedChecklist(report)}
              />
            ))
          ) : (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-zinc-200">
              <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500">Nenhum relatório encontrado.</p>
            </div>
          )}
        </div>

        <div className="sticky top-6">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1 mb-4">Detalhes do Relatório</h3>
          {selectedChecklist ? (
            <div className="space-y-4">
              <ReportDetails 
                report={selectedChecklist}
                obra={obras.find(o => o.id === selectedChecklist.obraId)}
                materiais={materiais}
                atividades={atividades}
                operadores={operadores}
              />
              {isAdmin && (
                <button 
                  onClick={() => handleDuplicate(selectedChecklist)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-all border border-zinc-200"
                >
                  <Copy className="w-5 h-5" />
                  Usar como Base (Replicar)
                </button>
              )}
            </div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200 text-center px-8">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                <ChevronRight className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-zinc-500 font-medium">Selecione um relatório ao lado para visualizar os detalhes completos.</p>
            </div>
          )}
        </div>
      </div>}

    </div>
  );
}

function ReportCard({ report, obra, isSelected, onClick }: {
  key?: string | number,
  report: Checklist,
  obra?: Obra,
  isSelected: boolean,
  onClick: () => void
}) {
  const date = parseDate(report.data);

  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-5 rounded-2xl border transition-all text-left flex items-start gap-4",
        isSelected 
          ? "bg-zinc-900 border-zinc-900 text-white shadow-xl scale-[1.02]" 
          : "bg-white border-zinc-100 hover:border-zinc-300 shadow-sm"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        isSelected ? "bg-zinc-800" : "bg-zinc-50"
      )}>
        <FileText className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-bold truncate text-sm">
            {obra?.nome || 'Obra Removida'}
          </h4>
          <span className={cn("text-[10px] font-bold uppercase", isSelected ? "text-zinc-400" : "text-zinc-400")}>
            {format(date, "HH:mm", { locale: ptBR })}
          </span>
        </div>
        <p className={cn("text-xs mb-2", isSelected ? "text-zinc-400" : "text-zinc-500")}>
          {format(date, "eeee, d 'de' MMMM", { locale: ptBR })}
        </p>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5">
             <User className="w-3 h-3" />
             <span className="text-[10px] font-bold truncate">{report.nomeResponsavel}</span>
           </div>
           <div className="flex items-center gap-1.5">
             <Box className="w-3 h-3" />
             <span className="text-[10px] font-bold">{report.materiais.length} Itens</span>
           </div>
        </div>
      </div>
      <ChevronRight className={cn("w-5 h-5 shrink-0 mt-3", isSelected ? "text-zinc-600" : "text-zinc-300")} />
    </button>
  );
}

function ReportDetails({ report, obra, materiais, atividades, operadores }: { 
  report: Checklist, 
  obra?: Obra,
  materiais: Material[],
  atividades: Atividade[],
  operadores: Operator[]
}) {
  const { isAdmin, notify } = useAuth();
  const date = parseDate(report.data);
  const [uploading, setUploading] = useState(false);

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of files) {
        const url = await uploadFile(file, 'checklists/attachments');
        newAttachments.push({
          name: file.name,
          url,
          type: file.type,
          size: file.size
        });
      }

      const reportRef = doc(db, 'checklists', report.id);
      await updateDoc(reportRef, {
        attachments: arrayUnion(...newAttachments)
      });
      
      notify('success', 'Anexos Adicionados', `${newAttachments.length} arquivo(s) subido(s) com sucesso.`);
    } catch (err: any) {
      notify('error', 'Erro no Upload', 'Ocorreu um erro ao subir os arquivos de anexo.');
      handleFirestoreError(err, OperationType.WRITE, 'checklists-add-attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (file: Attachment) => {
    if (!confirm('Deseja remover este anexo?')) return;

    try {
      const reportRef = doc(db, 'checklists', report.id);
      await updateDoc(reportRef, {
        attachments: arrayRemove(file)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'checklists-remove-attachment');
    }
  };

  const handleFillTemplate = async (file: Attachment) => {
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Erro ao baixar o arquivo.');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });

      // Replace placeholders in all sheets
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        const range = utils.decode_range(sheet['!ref'] || 'A1:Z100');

        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = utils.encode_cell({ r: R, c: C });
            const cell = sheet[cellAddress];

            if (cell && cell.v && typeof cell.v === 'string') {
              let val = cell.v;
              
              // Basic replacements
              val = val.replace('{{OBRA}}', obra?.nome || '');
              val = val.replace('{{DATA}}', format(date, "dd/MM/yyyy"));
              val = val.replace('{{HORA}}', format(date, "HH:mm"));
              val = val.replace('{{RESPONSAVEL}}', report.nomeResponsavel);
              val = val.replace('{{OBSERVACOES}}', report.observacoes || '');

              // Check for table markers
              if (val.includes('[[TABELA_MATERIAIS]]')) {
                // Remove marker
                cell.v = val.replace('[[TABELA_MATERIAIS]]', '');
                
                // Write materials starting from this cell
                report.materiais.forEach((item, idx) => {
                  const m = materiais.find(mat => mat.id === item.materialId);
                  const rowAddr = utils.encode_cell({ r: R + idx + 1, c: C });
                  const qtyAddr = utils.encode_cell({ r: R + idx + 1, c: C + 1 });
                  
                  sheet[rowAddr] = { t: 's', v: m?.descricao || 'Material Removido' };
                  sheet[qtyAddr] = { t: 'n', v: item.qtdConferida };
                });
                
                // Update range if needed
                const newEndRow = Math.max(range.e.r, R + report.materiais.length);
                sheet['!ref'] = utils.encode_range({ s: range.s, e: { r: newEndRow, c: Math.max(range.e.c, C + 1) } });
              }

              if (val.includes('[[TABELA_ATIVIDADES]]')) {
                cell.v = val.replace('[[TABELA_ATIVIDADES]]', '');
                
                report.progresso.forEach((item, idx) => {
                  const a = atividades.find(ativ => ativ.id === item.atividadeId);
                  const rowAddr = utils.encode_cell({ r: R + idx + 1, c: C });
                  const valAddr = utils.encode_cell({ r: R + idx + 1, c: C + 1 });
                  
                  sheet[rowAddr] = { t: 's', v: a?.descricao || 'Atividade Removida' };
                  sheet[valAddr] = { t: 'n', v: item.qtdExecutadaNoDia };
                });

                const newEndRow = Math.max(range.e.r, R + report.progresso.length);
                sheet['!ref'] = utils.encode_range({ s: range.s, e: { r: newEndRow, c: Math.max(range.e.c, C + 1) } });
              }

              cell.v = val;
            }
          }
        }
      });

      // Add BI Data Sheet
      const biData = [
        ['ID_RELATORIO', 'DATA', 'OBRA', 'RESPONSAVEL', 'CATEGORIA', 'ITEM', 'VALOR', 'UNIDADE'],
        ...report.materiais.map(item => {
          const m = materiais.find(mat => mat.id === item.materialId);
          return [report.id, format(date, "yyyy-MM-dd"), obra?.nome || '', report.nomeResponsavel, 'MATERIAL', m?.descricao || '', item.qtdConferida, m?.unidade || ''];
        }),
        ...report.progresso.map(item => {
          const a = atividades.find(ativ => ativ.id === item.atividadeId);
          return [report.id, format(date, "yyyy-MM-dd"), obra?.nome || '', report.nomeResponsavel, 'PROGRESSO', a?.descricao || '', item.qtdExecutadaNoDia, a?.unidade || ''];
        })
      ];

      const biSheet = utils.aoa_to_sheet(biData);
      utils.book_append_sheet(workbook, biSheet, "DADOS_BI");

      // Add simple Dashboard Sheet
      const dashboardData = [
        ['RESUMO DE INDICADORES (BI)', ''],
        ['Obra', obra?.nome || 'N/A'],
        ['Data', format(date, "dd/MM/yyyy")],
        ['Responsável', report.nomeResponsavel],
        ['', ''],
        ['TOTAIS', 'QTD'],
        ['Itens Materiais', report.materiais.length],
        ['Etapas de Progresso', report.progresso.length],
        ['Equipe Presente', report.equipeIds?.length || 0]
      ];
      const dashSheet = utils.aoa_to_sheet(dashboardData);
      utils.book_append_sheet(workbook, dashSheet, "DASHBOARD");

      writeFile(workbook, `BI_Relatorio_${obra?.nome.replace(/\s+/g, '_')}_${format(date, "dd_MM_yyyy")}.xlsx`);
      notify('success', 'Excel com BI Gerado', 'Verifique as novas abas (DADOS_BI e DASHBOARD) no arquivo baixado.');

    } catch (err: any) {
      console.error('Erro ao preencher template:', err);
      notify('error', 'Erro no Processamento', 'Verifique se o arquivo é um Excel válido (.xlsx).');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="p-8 bg-zinc-900 text-white">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">RELATÓRIO DIÁRIO</span>
            <h3 className="text-2xl font-bold tracking-tight">{obra?.nome}</h3>
          </div>
          <FileText className="w-10 h-10 text-zinc-700" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">DATA E HORA</p>
            <p className="text-sm font-medium">{format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">RESPONSÁVEL</p>
            <p className="text-sm font-medium">{report.nomeResponsavel}</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 max-h-[600px] overflow-y-auto">
        {/* Equipe */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4" />
            Equipe Presente
          </h4>
          <div className="flex flex-wrap gap-2">
            {report.equipeIds?.map(id => {
              const op = operadores.find(o => o.id === id);
              return op ? (
                <div key={id} className="px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-bold text-zinc-700">
                  {op.nome} {op.sobrenome}
                </div>
              ) : null;
            }) || <p className="text-xs text-zinc-400">Nenhum operador registrado.</p>}
          </div>
        </div>

        {/* Materiais */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Box className="w-4 h-4" />
            Materiais Conferidos
          </h4>
          <div className="space-y-2">
            {report.materiais.map(item => {
              const mat = materiais.find(m => m.id === item.materialId);
              return (
                <div key={item.materialId} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <span className="text-sm font-bold text-zinc-700">{mat?.descricao || 'Material Removido'}</span>
                  <span className="text-xs font-bold text-zinc-900 bg-white px-2 py-1 rounded border border-zinc-200">
                    Qtd: {item.qtdConferida} {mat?.unidade}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Produção */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Produção do Dia
          </h4>
          <div className="space-y-2">
            {report.progresso.map(item => {
              const ativ = atividades.find(a => a.id === item.atividadeId);
              return (
                <div key={item.atividadeId} className="space-y-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-zinc-700">{ativ?.descricao || 'Atividade Removida'}</span>
                     <span className="text-xs font-bold text-green-600">+{item.qtdExecutadaNoDia} {ativ?.unidade}</span>
                   </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Observações */}
        {report.observacoes && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Observações</h4>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl italic text-zinc-600 text-sm">
              "{report.observacoes}"
            </div>
          </div>
        )}

        {/* Anexos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Documentos e Anexos
            </h4>
            {isAdmin && (
              <label className="flex items-center gap-1 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 cursor-pointer transition-all">
                <Plus className="w-3 h-3" />
                {uploading ? 'ENVIANDO...' : 'ADICIONAR'}
                <input type="file" multiple className="hidden" onChange={handleAddAttachment} disabled={uploading} />
              </label>
            )}
          </div>
          
          <div className="grid gap-2">
            {report.attachments && report.attachments.length > 0 ? report.attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:bg-zinc-100 transition-colors group">
                <a 
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center gap-3 min-w-0"
                >
                  <div className="w-8 h-8 rounded bg-white flex items-center justify-center border border-zinc-200 group-hover:border-zinc-900 transition-colors">
                    <FileText className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-800 truncate">{file.name}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </a>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {(file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) && (
                    <button 
                      onClick={() => handleFillTemplate(file)}
                      className="p-2 text-zinc-400 hover:text-green-600 flex items-center gap-1"
                      title="Preencher Template"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-[10px] font-bold">PREENCHER</span>
                    </button>
                  )}
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-400 hover:text-zinc-900">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {isAdmin && (
                    <button 
                      onClick={() => handleRemoveAttachment(file)}
                      className="p-2 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <Paperclip className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Nenhum anexo encontrado</p>
              </div>
            )}
          </div>
        </div>

        {/* Foto */}
        {report.photoUrl && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Evidência Fotográfica
            </h4>
            <div className="rounded-2xl overflow-hidden border border-zinc-200">
              <img 
                src={report.photoUrl} 
                alt="Evidência" 
                className="w-full h-auto"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
