import React, { useState, useEffect, useRef } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, limit, writeBatch, where, getDocs, deleteDoc } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType, auth } from '../lib/supabase';
import { Tool, ToolLog, Obra } from '../types';
import {
  Hammer,
  Wrench,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Plus,
  History,
  X,
  AlertCircle,
  QrCode,
  Edit2,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createSignedStorageUrl, uploadPhotoWithMetadata } from '../lib/services';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../App';

const MOVEMENT_TIME_ZONE = 'America/Sao_Paulo';

const parseMovementDate = (value: any): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  }

  return null;
};

const formatMovementDate = (date: Date | null) => {
  if (!date) return '--/--/----';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: MOVEMENT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatMovementTime = (date: Date | null) => {
  if (!date) return '--:--';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: MOVEMENT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const formatUsageDuration = (start: Date | null, end: Date | null) => {
  if (!start || !end) return null;

  const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
};

const getMovementTimestamp = () => new Date().toISOString();

<<<<<<< HEAD
=======
const createMovementActivityId = (prefix = 'mov') => {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return `${prefix}_${Date.now()}_${randomPart}`;
};

const normalizeHashValue = (value: any) => {
  if (value === undefined || value === null) return '';
  const parsedDate = parseMovementDate(value);
  if (parsedDate) return parsedDate.toISOString();
  return String(value).trim();
};

const createMovementScopeHash = (parts: any[]) => {
  const source = parts.map(normalizeHashValue).join('|');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return `mov_${Math.abs(hash).toString(36)}`;
};

const getMovementScopeKey = (log: ToolLog) => {
  return log.movementHash || createMovementScopeHash([
    log.activityId || log.id,
    log.toolId,
    log.obraId,
    log.dataSaida,
    log.dataDevolucao,
    log.statusLog
  ]);
};

>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
const sortLogsByMovementDateDesc = (items: ToolLog[]) => {
  return [...items].sort((a, b) => {
    const bDate = parseMovementDate(b.dataSaida)?.getTime() || 0;
    const aDate = parseMovementDate(a.dataSaida)?.getTime() || 0;
    return bDate - aDate;
  });
};

const findOpenLogForTool = (logs: ToolLog[], toolId: string) => {
  return sortLogsByMovementDateDesc(logs).find(log => log.toolId === toolId && log.statusLog === 'Aberta');
};

const exportToolsReport = (logs: ToolLog[], tools: Tool[], obras: Obra[]) => {
  const header = [
    'Ferramenta',
    'Código',
    'Responsável',
    'Obra',
    'Status',
    'Data Retirada',
    'Hora Retirada',
    'Data Devolução',
    'Hora Devolução',
    'Tempo em Uso'
  ];

  const rows = logs.map((log) => {
    const tool = tools.find(t => t.id === log.toolId);
    const obra = obras.find(o => o.id === log.obraId);

    const retirada = parseMovementDate(log.dataSaida);
    const devolucao = parseMovementDate(log.dataDevolucao);

    return [
      tool?.nome || 'Ferramenta Removida',
      tool?.codigo || '---',
      log.responsavelNome || '',
      obra?.nome || 'Obra Removida',
      log.statusLog || '',
      formatMovementDate(retirada),
      formatMovementTime(retirada),
      formatMovementDate(devolucao),
      formatMovementTime(devolucao),
      formatUsageDuration(retirada, devolucao) || ''
    ];
  });

  const csvContent = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `relatorio-movimentacao-ferramentas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


export default function Ferramentas() {
  const { isAdmin, notify } = useAuth();

  const [toolsSnap] = useCollection(query(collection(db, 'tools'), orderBy('nome', 'asc')));
  const [logsSnap] = useCollection(query(collection(db, 'toolLogs'), orderBy('dataSaida', 'desc')));
  const [obrasSnap] = useCollection(query(collection(db, 'obras'), orderBy('nome', 'asc')));

  const [showAddTool, setShowAddTool] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [showHistory, setShowHistory] = useState<Tool | null>(null);
  const [showCheckOut, setShowCheckOut] = useState<Tool | null>(null);
  const [showCheckIn, setShowCheckIn] = useState<ToolLog | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const tools = (toolsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Tool[]) || [];
  const logs = sortLogsByMovementDateDesc((logsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ToolLog[]) || []);
  const recentLogs = logs.slice(0, 50);
<<<<<<< HEAD
=======
  const renderedMovementScopes = new Set<string>();
>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];

  const handleScanSuccess = React.useCallback((decodedText: string) => {
    const tool = tools.find(t => t.codigo === decodedText || t.id === decodedText);

    if (!tool) {
      notify('error', 'Não Encontrado', `Equipamento com código "${decodedText}" não cadastrado no sistema.`);
      return;
    }

    setShowScanner(false);

    const activeLog = findOpenLogForTool(logs, tool.id);

    if (activeLog) {
      setShowCheckIn(activeLog);
      return;
    }

    if (tool.status === 'Disponível') {
      setShowCheckOut(tool);
      return;
    }

    notify('warning', 'Material Indisponível', `A ferramenta "${tool.nome}" já está sendo utilizada por outro colaborador.`);
  }, [tools, logs, notify]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Gestão de Ferramentas</h2>
          <p className="text-zinc-500">Controle de retirada e devolução de equipamentos.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            Escanear Código
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAddTool(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nova Ferramenta
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
            Inventário de Equipamentos
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onCheckOut={() => setShowCheckOut(tool)}
                activeLog={findOpenLogForTool(logs, tool.id)}
                onCheckIn={(log) => setShowCheckIn(log)}
                onEdit={() => setEditingTool(tool)}
                onViewHistory={() => setShowHistory(tool)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">
            Atividade Recente
          </h3>

          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-600">Logs de Movimentação</span>
            </div>

            <div className="p-4 border-b border-zinc-100">
              <button
                type="button"
                onClick={() => exportToolsReport(logs, tools, obras)}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all active:scale-95"
              >
                Baixar Relatório de Movimentação
              </button>
            </div>

            <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
<<<<<<< HEAD
              {recentLogs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  tool={tools.find(t => t.id === log.toolId)}
                  obra={obras.find(o => o.id === log.obraId)}
                />
              ))}
=======
              {recentLogs.map((log) => {
                const movementScopeKey = getMovementScopeKey(log);

                if (renderedMovementScopes.has(movementScopeKey)) return null;
                renderedMovementScopes.add(movementScopeKey);

                return (
                  <LogItem
                    key={movementScopeKey}
                    log={log}
                    tool={tools.find(t => t.id === log.toolId)}
                    obra={obras.find(o => o.id === log.obraId)}
                  />
                );
              })}
>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(showAddTool || editingTool) && (
          <AddToolModal
            tool={editingTool || undefined}
            onClose={() => {
              setShowAddTool(false);
              setEditingTool(null);
            }}
          />
        )}

        {showHistory && (
          <ToolHistoryModal
            tool={showHistory}
            obras={obras}
            onClose={() => setShowHistory(null)}
          />
        )}

        {showCheckOut && (
          <CheckOutModal
            tool={showCheckOut}
            obras={obras}
            onClose={() => setShowCheckOut(null)}
          />
        )}

        {showCheckIn && (
          <CheckInModal
            log={showCheckIn}
            tool={tools.find(t => t.id === showCheckIn.toolId) || {
              id: showCheckIn.toolId,
              nome: 'Ferramenta removida',
              codigo: '---',
              status: 'Em Uso'
            } as Tool}
            onClose={() => setShowCheckIn(null)}
          />
        )}

        {showScanner && (
          <ScannerModal
            onSuccess={handleScanSuccess}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScannerModal({ onSuccess, onClose }: { onSuccess: (text: string) => void, onClose: () => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { notify } = useAuth();

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        // Try environment first, then fallback to any camera
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            async (text) => {
              try {
                if (html5QrCode.getState() === 2) {
                  await html5QrCode.stop();
                  await html5QrCode.clear();
                }
              } catch (e) {
                console.error("Erro ao parar scanner no sucesso:", e);
              }
              onSuccess(text);
            },
            () => {}
          );
        } catch (firstErr: any) {
          console.warn("Câmera traseira não encontrada, tentando qualquer câmera...", firstErr);
          // Fallback: Use any available camera
          await html5QrCode.start(
            { facingMode: "user" }, // Try front as second option or just {}
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            async (text) => {
              try {
                if (html5QrCode.getState() === 2) {
                  await html5QrCode.stop();
                  await html5QrCode.clear();
                }
              } catch (e) {
                console.error("Erro ao parar scanner no sucesso:", e);
              }
              onSuccess(text);
            },
            () => {}
          );
        }
      } catch (err: any) {
        console.error("Erro fatal ao iniciar câmera:", err);
        let msg = "Não foi possível acessar a câmera.";
        if (err?.name === "NotAllowedError") msg = "Permissão de câmera negada pelo navegador.";
        if (err?.name === "NotFoundError") msg = "Nenhuma câmera encontrada neste dispositivo.";
        setCameraError(msg);
        notify('error', 'Erro de Câmera', msg);
      }
    };

    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      const scanner = scannerRef.current;
      if (scanner && scanner.getState() === 2) {
        scanner.stop().then(() => {
          scanner.clear();
        }).catch(err => console.error("Erro ao parar scanner:", err));
      }
    };
  }, [onSuccess, notify]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-zinc-900" />
            <h3 className="text-lg font-bold">Escanear Equipamento</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {cameraError ? (
            <div className="flex flex-col items-center justify-center aspect-square w-full rounded-2xl bg-red-50 border border-red-100 p-8 text-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-red-600">{cameraError}</p>
                <p className="text-[10px] text-red-400 uppercase tracking-widest leading-relaxed">
                  Verifique as permissões do navegador ou tente usar outro dispositivo.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all"
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-zinc-200 bg-black">
                <div id="reader" className="w-full h-full" />
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-white/50 border-dashed rounded-lg" />
                </div>
              </div>
              <div className="mt-6 flex flex-col items-center text-center space-y-2">
                <p className="text-sm font-medium text-zinc-600">Posicione o código QR no centro do quadro.</p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
                  Sistema identificará automaticamente a ferramenta cadastrada.
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ToolCard({ tool, onCheckOut, activeLog, onCheckIn, onEdit, onViewHistory }: {
  key?: string | number,
  tool: Tool,
  onCheckOut: () => void,
  activeLog?: ToolLog,
  onCheckIn: (log: ToolLog) => void,
  onEdit?: () => void,
  onViewHistory?: () => void
}) {
  const { isAdmin, notify } = useAuth();
  const isAvailable = tool.status === 'Disponível';

  return (
    <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group relative">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-900 group-hover:scale-110 transition-transform">
          {(tool.nome || '').toLowerCase().includes('furadeira') ? <Wrench className="w-6 h-6" /> : <Hammer className="w-6 h-6" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onViewHistory?.(); }}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Ver Histórico"
            >
              <History className="w-4 h-4" />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                  className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar Ferramenta"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Deseja remover a ferramenta "${tool.nome}"?`)) {
                      try {
                        await deleteDoc(doc(db, 'tools', tool.id));
                        notify('success', 'Sucesso', 'Ferramenta removida do estoque.');
                      } catch (err: any) {
                        notify('error', 'Erro ao Excluir', err.message || 'Não foi possível remover a ferramenta.');
                        handleFirestoreError(err, OperationType.DELETE, 'tools');
                      }
                    }
                  }}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir Ferramenta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            isAvailable ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
          )}>
            {tool.status}
          </div>
        </div>
      </div>

      <div className="space-y-1 mb-6">
        <h4 className="font-bold text-zinc-900 truncate">{tool.nome}</h4>
        <p className="text-xs text-zinc-500 font-mono">{tool.codigo || 'S/C'}</p>
        <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-zinc-600">
          <p><span className="font-bold text-zinc-700">Modelo:</span> {tool.modelo || 'Não informado'}</p>
          <p><span className="font-bold text-zinc-700">Valor:</span> {typeof tool.valor === 'number' ? tool.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado'}</p>
          <p><span className="font-bold text-zinc-700">Compra:</span> {tool.dataCompra ? new Date(`${tool.dataCompra}T00:00:00`).toLocaleDateString('pt-BR') : 'Não informado'}</p>
        </div>
      </div>

      {activeLog ? (
        <div className="space-y-4">
          <div className="p-3 bg-zinc-50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
              <User className="w-3 h-3" />
              {activeLog.responsavelNome}
            </div>
          </div>
          <button
            onClick={() => onCheckIn(activeLog)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Devolver
          </button>
        </div>
      ) : (
        <button
          onClick={onCheckOut}
          disabled={!isAvailable}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
            isAvailable ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
          )}
        >
          <ArrowUpRight className="w-4 h-4" />
          Retirar
        </button>
      )}
    </div>
  );
}

function LogItem({
  log,
  tool,
  obra,
  showToolInfo = true
}: {
  key?: string | number;
  log: ToolLog;
  tool?: Tool;
  obra?: Obra;
  showToolInfo?: boolean;
}) {
  const isPending = log.statusLog === 'Aberta';

  const outDate = parseMovementDate(log.dataSaida);
  const inDate = parseMovementDate(log.dataDevolucao);
  const usageDuration = formatUsageDuration(outDate, inDate);
  const [returnPhotoUrl, setReturnPhotoUrl] = useState(log.fotoDevolucaoUrl || '');

  useEffect(() => {
    let alive = true;

    if (!log.fotoDevolucaoPath) {
      setReturnPhotoUrl(log.fotoDevolucaoUrl || '');
      return () => {
        alive = false;
      };
    }

    createSignedStorageUrl(log.fotoDevolucaoBucket || 'ferramentas', log.fotoDevolucaoPath)
      .then((url) => {
        if (alive) setReturnPhotoUrl(url);
      })
      .catch(() => {
        if (alive) setReturnPhotoUrl(log.fotoDevolucaoUrl || '');
      });

    return () => {
      alive = false;
    };
  }, [log.fotoDevolucaoBucket, log.fotoDevolucaoPath, log.fotoDevolucaoUrl]);

  return (
    <div className="p-5 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {showToolInfo && (
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isPending ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
                )} />

                <span className="text-sm font-bold text-zinc-900 truncate">
                  {tool?.nome || 'Ferramenta Removida'}
                </span>

                <span className="text-[10px] text-zinc-400 font-mono">
                  #{tool?.codigo || '---'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                </div>

                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">
                    Responsável
                  </p>
                  <p className="text-xs font-bold text-zinc-900 truncate">
                    {log.responsavelNome}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                </div>

                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">
                    Obra / Local
                  </p>
                  <p className="text-xs font-bold text-zinc-900 truncate">
                    {obra?.nome || 'Obra Removida'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 min-w-[110px] space-y-2">
            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
                Retirada em
              </div>
              <div className="text-xs font-bold text-zinc-900">
                {formatMovementDate(outDate)}
              </div>
              <div className="text-[10px] text-blue-600 font-bold">
                {formatMovementTime(outDate)}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">
                Devolução em
              </div>
              <div className="text-xs font-bold text-zinc-900">
                {formatMovementDate(inDate)}
              </div>
              <div className="text-[10px] text-green-600 font-bold">
                {formatMovementTime(inDate)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className={cn(
            'text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight flex items-center gap-1',
            isPending ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
          )}>
            {isPending ? (
              <>
                <Clock className="w-2.5 h-2.5" />
                Pendente
              </>
            ) : (
              <>
                <CheckCircle2 className="w-2.5 h-2.5" />
                Concluído
              </>
            )}
          </span>

          {!isPending && inDate && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-xl border border-green-100">
              <ArrowDownLeft className="w-3 h-3 text-green-600" />
              <div className="text-left">
                <span className="block text-[9px] font-bold text-green-700 uppercase tracking-tight">
                  Devolução registrada
                </span>
                {usageDuration && (
                  <span className="block text-[9px] text-green-600 font-semibold">
                    Tempo em uso: {usageDuration}
                  </span>
                )}
              </div>
            </div>
          )}

          {!isPending && returnPhotoUrl && (
            <a
              href={returnPhotoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100 text-[9px] font-bold text-blue-700 uppercase tracking-tight hover:bg-blue-100 transition-colors"
            >
              <Camera className="w-3 h-3" />
              Foto da devolucao
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolHistoryModal({ tool, obras, onClose }: { tool: Tool, obras: Obra[], onClose: () => void }) {
  const [historySnap, loading] = useCollection(
    query(
      collection(db, 'toolLogs'),
      where('toolId', '==', tool.id),
      orderBy('dataSaida', 'desc'),
      limit(20)
    )
  );

  const history = historySnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ToolLog[] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Histórico de Movimentação</h3>
              <p className="text-xs text-zinc-400">{tool.nome} • {tool.codigo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-zinc-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center">
                <History className="w-8 h-8 opacity-20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-900">Nenhum registro encontrado</p>
                <p className="text-xs">Esta ferramenta ainda não possui movimentações registradas.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
<<<<<<< HEAD
              {history.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  obra={obras.find(o => o.id === log.obraId)}
                  showToolInfo={false}
                />
              ))}
=======
              {history.map((log) => {
                const movementScopeKey = getMovementScopeKey(log);

                return (
                  <LogItem
                    key={movementScopeKey}
                    log={log}
                    obra={obras.find(o => o.id === log.obraId)}
                    showToolInfo={false}
                  />
                );
              })}
>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
            </div>
          )}
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-300 transition-all"
          >
            Fechar Histórico
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const formatBRLCurrencyInput = (input: string | number | undefined | null): string => {
  const rawValue = String(input ?? '');
  const onlyDigits = rawValue.replace(/\D/g, '');
  const cents = Number(onlyDigits || '0');

  if (!cents) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatBRLFromNumber = (value: number | undefined): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseBRLCurrencyToNumber = (formattedValue: string): number => {
  const onlyDigits = formattedValue.replace(/\D/g, '');
  return Number(onlyDigits || '0') / 100;
};

function AddToolModal({ tool, onClose }: { tool?: Tool, onClose: () => void }) {
  const [nome, setNome] = useState(tool?.nome || '');
  const [codigo, setCodigo] = useState(tool?.codigo || '');
  const [modelo, setModelo] = useState(tool?.modelo || '');
  const [valor, setValor] = useState(formatBRLFromNumber(tool?.valor));
  const [dataCompra, setDataCompra] = useState(tool?.dataCompra || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const draftLoadedRef = useRef(Boolean(tool));
  const skipFirstSaveRef = useRef(!tool);

  useEffect(() => {
    if (tool) return;
    try {
      const saved = localStorage.getItem('rascunho-nova-ferramenta');
      if (!saved) { draftLoadedRef.current = true; return; }
      const draft = JSON.parse(saved);
      if (typeof draft.nome === 'string') setNome(draft.nome);
      if (typeof draft.codigo === 'string') setCodigo(draft.codigo);
      if (typeof draft.modelo === 'string') setModelo(draft.modelo);
      if (typeof draft.valor === 'string') setValor(draft.valor);
      if (typeof draft.dataCompra === 'string') setDataCompra(draft.dataCompra);
      draftLoadedRef.current = true;
    } catch {
      draftLoadedRef.current = true;
      // Ignora rascunhos inválidos.
    }
  }, [tool]);

  useEffect(() => {
    if (tool || !draftLoadedRef.current) return;
    if (skipFirstSaveRef.current) { skipFirstSaveRef.current = false; return; }
    try {
      localStorage.setItem('rascunho-nova-ferramenta', JSON.stringify({ nome, codigo, modelo, valor, dataCompra }));
    } catch {
      // Ignora bloqueio de localStorage.
    }
  }, [tool, nome, codigo, modelo, valor, dataCompra]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNome = nome.trim();
    const trimmedCodigo = codigo.trim();
    const trimmedModelo = modelo.trim();
    const parsedValor = parseBRLCurrencyToNumber(valor);

    if (!trimmedNome || !trimmedCodigo || !trimmedModelo || !valor || !dataCompra) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      if (Number.isNaN(parsedValor) || parsedValor < 0) {
        setError('Informe um valor válido para a ferramenta.');
        setLoading(false);
        return;
      }

      const standardizedCodigo = trimmedCodigo.toUpperCase();

      // Check for unique code (only if changed)
      if (standardizedCodigo !== tool?.codigo?.toUpperCase()) {
        const q = query(collection(db, 'tools'), where('codigo', '==', standardizedCodigo));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setError(`Já existe uma ferramenta cadastrada com o código "${standardizedCodigo}".`);
          setLoading(false);
          return;
        }
      }

      if (tool) {
        await updateDoc(doc(db, 'tools', tool.id), {
          nome: trimmedNome,
          codigo: standardizedCodigo,
          modelo: trimmedModelo,
          valor: parsedValor,
          dataCompra,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'tools'), {
          nome: trimmedNome,
          codigo: standardizedCodigo,
          modelo: trimmedModelo,
          valor: parsedValor,
          dataCompra,
          status: 'Disponível',
          createdAt: serverTimestamp()
        });
      }
      if (!tool) localStorage.removeItem('rascunho-nova-ferramenta');
      onClose();
    } catch (err: any) {
      if (err?.message?.includes('permission')) {
        setError('Você não tem permissão para realizar esta operação. Contate o administrador.');
      } else {
        setError(err?.message || 'Ocorreu um erro ao salvar a ferramenta. Tente novamente.');
      }
      console.error("Erro em tools:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-bold">{tool ? 'Editar Ferramenta' : 'Cadastrar Ferramenta'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome da Ferramenta</label>
            <input
              required
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none"
              placeholder="Ex: Furadeira Makita 18V"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Código de Identificação (QR/Barras)</label>
            <div className="flex gap-2">
              <input
                required
                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none uppercase placeholder:normal-case font-mono"
                placeholder="Ex: FR-001"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="px-4 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                title="Escanear Código"
              >
                <QrCode className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Modelo</label>
            <input
              required
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none"
              placeholder="Ex: DHP482Z 18V"
              value={modelo}
              onChange={e => setModelo(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Valor da Ferramenta</label>
              <input
                required
                type="text"
                inputMode="numeric"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none"
                placeholder="R$ 0,00"
                value={valor}
                onKeyDown={(e) => ['-', '+', 'e', 'E', '.'].includes(e.key) && e.preventDefault()}
                onChange={e => setValor(formatBRLCurrencyInput(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Data da Compra</label>
              <input
                required
                type="date"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none"
                value={dataCompra}
                onChange={e => setDataCompra(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            {loading ? 'Salvando...' : tool ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {showScanner && (
          <ScannerModal
            onSuccess={(text) => { setCodigo(text); setShowScanner(false); }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckOutModal({ tool, obras, onClose }: { tool: Tool, obras: Obra[], onClose: () => void }) {
  const { userProfile, notify } = useAuth();
  const [obraId, setObraId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const userName = userProfile ? `${userProfile.nome} ${userProfile.sobrenome || ''}`.trim() : ((auth.currentUser?.user_metadata?.name || auth.currentUser?.email) || 'Usuário');
  const [responsavel] = useState(userName);
  const [loading, setLoading] = useState(false);

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!obraId) {
      notify('warning', 'Atenção', 'Selecione uma obra de destino antes de confirmar.');
      return;
    }
    setLoading(true);

    try {
      const openLogsSnap = await getDocs(query(
        collection(db, 'toolLogs'),
        where('toolId', '==', tool.id),
        where('statusLog', '==', 'Aberta')
      ));

      if (!openLogsSnap.empty) {
        notify('warning', 'Ferramenta em uso', 'Esta ferramenta ja possui uma retirada aberta. Devolva o registro atual antes de retirar novamente.');
        return;
      }

      if (tool.status !== 'Dispon\u00edvel') {
        notify('warning', 'Ferramenta indisponivel', 'Esta ferramenta nao esta disponivel para retirada.');
        return;
      }

      const batch = writeBatch(db);
      const retiradaEm = getMovementTimestamp();

      // 1. Create Log
      const logRef = doc(collection(db, 'toolLogs'));
<<<<<<< HEAD
      batch.set(logRef, {
=======
      const activityId = createMovementActivityId('tool_activity');
      const movementHash = createMovementScopeHash([
        activityId,
        logRef.id,
        tool.id,
        obraId,
        retiradaEm,
        null,
        'Aberta'
      ]);

      batch.set(logRef, {
        id: logRef.id,
        activityId,
        movementHash,
>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
        toolId: tool.id,
        obraId,
        responsavelNome: responsavel,
        dataSaida: retiradaEm,
        dataDevolucao: null,
        fotoDevolucaoUrl: null,
        fotoDevolucaoBucket: null,
        fotoDevolucaoPath: null,
        statusLog: 'Aberta'
      });

      // 2. Update Tool
      const toolRef = doc(db, 'tools', tool.id);
      batch.update(toolRef, {
        status: 'Em Uso',
        lastLogId: logRef.id,
        updatedAt: retiradaEm
      });

      await batch.commit();
      notify('success', 'Retirada Concluída', `O material "${tool.nome}" foi registrado para a obra selecionada.`);
      onClose();
    } catch (err: any) {
      notify('error', 'Erro na Retirada', err.message || 'Não foi possível registrar a saída.');
      handleFirestoreError(err, OperationType.WRITE, 'tool-checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleScanObra = (text: string) => {
    const foundObra = obras.find(o =>
      o.id === text ||
      (o.centroCusto && o.centroCusto.toUpperCase() === text.toUpperCase())
    );
    if (foundObra) {
      setObraId(foundObra.id);
      notify('success', 'Obra Identificada', foundObra.nome);
      setShowScanner(false);
    } else {
      notify('error', 'Obra Não Encontrada', 'O código lido não corresponde a nenhuma obra ativa.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Retirada de Material</h3>
              <p className="text-xs text-zinc-400">{tool.nome}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCheckOut} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Quem está retirando?</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                readOnly
                className="w-full pl-11 pr-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl outline-none cursor-not-allowed text-zinc-500 font-medium"
                value={responsavel}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Destinado para qual obra?</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <select
                  required
                  className="w-full pl-11 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl appearance-none focus:ring-2 focus:ring-zinc-900/10 outline-none truncate"
                  value={obraId}
                  onChange={e => setObraId(e.target.value)}
                >
                  <option value="">Selecione a obra...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ArrowDownLeft className="w-3 h-3 text-zinc-400 rotate-45" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="aspect-square w-[50px] bg-zinc-100 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-sm"
                title="Escanear QR da Obra"
              >
                <QrCode className="w-5 h-5 text-zinc-700" />
              </button>
            </div>
          </div>

          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
            <Clock className="w-5 h-5 text-orange-500 shrink-0" />
            <p className="text-[11px] text-orange-700 font-medium leading-relaxed">
              O horário e data da operação serão registrados automaticamente conforme o horário oficial de Brasília.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? 'Processando...' : (
              <>
                Confirmar Retirada
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {showScanner && (
          <ScannerModal
            onSuccess={handleScanObra}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckInModal({ log, tool, onClose }: { log: ToolLog, tool: Tool, onClose: () => void }) {
  const { notify } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      stopCamera();
    };
  }, [photoPreview]);

  const startCamera = async () => {
    setError(null);

    // Em celular, o caminho mais estável é usar o seletor nativo com capture.
    // getUserMedia em PWA/Safari/WebView pode falhar, ficar preto ou perder permissão.
    if (isMobileDevice()) {
      mobileCameraInputRef.current?.click();
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error('[CAMERA_DEVOLUCAO] Falha ao iniciar preview:', err);
            setError('Não foi possível abrir a câmera. Use a opção de selecionar foto.');
            stopCamera();
          });
        }
      }, 0);
    } catch (err: any) {
      console.error('[CAMERA_DEVOLUCAO] Erro ao acessar câmera:', err);
      setError(err?.message || 'Não foi possível acessar a câmera. Use a opção de selecionar foto.');
      fileInputRef.current?.click();
    }
  };

  const captureCameraPhoto = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      setError('Câmera não inicializada. Tente novamente.');
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setError('Não foi possível capturar a imagem da câmera.');
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Não foi possível gerar o arquivo da foto.');
        return;
      }

      const file = new File([blob], `devolucao-${tool.id}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError(null);
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida para a devolução.');
      event.target.value = '';
      return;
    }

    if (photoPreview) URL.revokeObjectURL(photoPreview);

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const clearPhoto = () => {
    stopCamera();
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCheckIn = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setError(null);

    if (loading) return;

    if (!photoFile) {
      setError('A foto da devolução é obrigatória para comprovar o estado do material.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    console.group('[DEVOLUCAO_FERRAMENTA] Iniciando devolução');
    console.log('Ferramenta:', { id: tool.id, nome: tool.nome, status: tool.status });
    console.log('Log:', { id: log.id, toolId: log.toolId, statusLog: log.statusLog });
    console.log('Arquivo selecionado:', {
      name: photoFile.name,
      type: photoFile.type,
      size: photoFile.size,
      lastModified: photoFile.lastModified,
    });

    try {
      console.log('Enviando imagem para Supabase Storage...');
      const photoUpload = await uploadPhotoWithMetadata(
        photoFile,
        `tools/${tool.id}/returns`,
        (progress) => {
          console.log('Progresso upload devolução:', progress);
          setUploadProgress(progress);
        }
      );
      console.log('Foto salva no Supabase Storage:', photoUpload);

      const devolucaoEm = getMovementTimestamp();
<<<<<<< HEAD
      console.log('Atualizando log de devolução no banco...', { logId: log.id, dataSaidaOriginal: log.dataSaida, dataDevolucao: devolucaoEm });
      const updateLogResponse = await updateDoc(doc(db, 'toolLogs', log.id), {
=======
      const activityId = log.activityId || createMovementActivityId('tool_activity');
      const movementHash = createMovementScopeHash([
        activityId,
        log.id,
        log.toolId,
        log.obraId,
        log.dataSaida,
        devolucaoEm,
        'Concluída'
      ]);

      console.log('Atualizando log de devolução no banco...', { logId: log.id, activityId, movementHash, dataSaidaOriginal: log.dataSaida, dataDevolucao: devolucaoEm });
      const updateLogResponse = await updateDoc(doc(db, 'toolLogs', log.id), {
        activityId,
        movementHash,
>>>>>>> b4cf358 (Ajusta logs de movimentação com IDs únicos)
        dataDevolucao: devolucaoEm,
        fotoDevolucaoUrl: photoUpload.url,
        fotoDevolucaoBucket: photoUpload.bucket,
        fotoDevolucaoPath: photoUpload.path,
        statusLog: 'Concluída'
      });
      console.log('UPDATE LOG RESPONSE:', updateLogResponse);
      if (!updateLogResponse?.data?.id) {
        throw new Error('updateLogResponse não retornou confirmação ao atualizar toolLogs.');
      }
      console.log('Log de devolução atualizado com sucesso.');

      console.log('Atualizando status da ferramenta...', { toolId: tool.id });
      const updateToolResponse = await updateDoc(doc(db, 'tools', tool.id), {
        status: 'Dispon\u00edvel',
        lastLogId: null,
        updatedAt: devolucaoEm
      });
      console.log('UPDATE TOOL RESPONSE:', updateToolResponse);
      if (!updateToolResponse?.data?.id) {
        throw new Error('updateToolResponse não retornou confirmação ao atualizar tools.');
      }
      console.log('Ferramenta atualizada com sucesso.');

      notify('success', 'Devolução Concluída', 'Material entregue e já está disponível para retirada.');
      clearPhoto();
      onClose();
    } catch (err: any) {
      console.error('[DEVOLUCAO_FERRAMENTA] Erro completo:', err);
      const errorMsg = err?.message || err?.error_description || 'Falha ao processar devolução.';
      setError(errorMsg);
      handleFirestoreError(err, OperationType.WRITE, 'tool-checkin');
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Devolução de Material</h3>
              <p className="text-xs text-zinc-400">{tool.nome}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="p-2 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Foto do Estado do Material (Obrigatório)</label>

            <input
              ref={mobileCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onClick={(event) => event.stopPropagation()}
              onChange={handlePhotoChange}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onClick={(event) => event.stopPropagation()}
              onChange={handlePhotoChange}
            />

            <button
              type="button"
              disabled={loading}
              onClick={startCamera}
              className={cn(
                'relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-dashed transition-all group disabled:opacity-60 disabled:cursor-not-allowed',
                photoPreview ? 'border-zinc-200 bg-zinc-100' : error ? 'border-red-200 bg-red-50/30 hover:bg-red-50' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
              )}
            >
              {cameraActive ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover bg-black" playsInline muted autoPlay />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-xs font-bold text-left">
                    Câmera aberta. Use o botão abaixo para capturar.
                  </div>
                </>
              ) : photoPreview ? (
                <>
                  <img src={photoPreview} className="w-full h-full object-cover" alt="Pré-visualização da devolução" />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-xs font-bold text-left">
                    Foto selecionada. Clique para tirar outra.
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                    <Camera className={cn('w-6 h-6', error ? 'text-red-400' : 'text-zinc-400')} />
                  </div>
                  <span className={cn('text-xs font-bold', error ? 'text-red-500' : 'text-zinc-500')}>TIRAR FOTO DO MATERIAL</span>
                </div>
              )}
            </button>

            {cameraActive && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={captureCameraPhoto}
                  disabled={loading}
                  className="py-3 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50"
                >
                  Capturar Foto
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  disabled={loading}
                  className="py-3 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 disabled:opacity-50"
                >
                  Cancelar Câmera
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || cameraActive}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
Selecionar foto da galeria/arquivo
            </button>

            {photoPreview && (
              <button
                type="button"
                onClick={clearPhoto}
                disabled={loading}
                className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Remover foto
              </button>
            )}

            <div className="flex items-start gap-2 text-zinc-400 italic">
              <AlertCircle className="w-3 h-3 mt-0.5" />
              <p className="text-[10px] leading-tight">Certifique-se que o equipamento está visível e em bom estado antes de confirmar.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => handleCheckIn(event)}
            disabled={loading || cameraActive}
            className={cn(
              'w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
              loading || cameraActive ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-zinc-800'
            )}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest">{uploadProgress > 0 && uploadProgress < 100 ? `Enviando Foto... ${uploadProgress.toFixed(0)}%` : 'Finalizando...'}</span>
                <div className="w-32 h-1 bg-zinc-300 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-zinc-900 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                Devolver Ferramenta
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
