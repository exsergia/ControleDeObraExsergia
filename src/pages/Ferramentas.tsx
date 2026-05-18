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
import { uploadPhoto } from '../lib/services';
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

export default function Ferramentas() {
  const { isAdmin, notify } = useAuth();

  const [toolsSnap] = useCollection(query(collection(db, 'tools'), orderBy('nome', 'asc')));
  const [logsSnap] = useCollection(query(collection(db, 'toolLogs'), orderBy('dataSaida', 'desc'), limit(50)));
  const [obrasSnap] = useCollection(query(collection(db, 'obras'), orderBy('nome', 'asc')));

  const [showAddTool, setShowAddTool] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [showHistory, setShowHistory] = useState<Tool | null>(null);
  const [showCheckOut, setShowCheckOut] = useState<Tool | null>(null);
  const [showCheckIn, setShowCheckIn] = useState<ToolLog | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const tools = (toolsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Tool[]) || [];
  const logs = (logsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ToolLog[]) || [];
  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];

  const handleScanSuccess = React.useCallback((decodedText: string) => {
    const tool = tools.find(t => t.codigo === decodedText || t.id === decodedText);

    if (!tool) {
      notify('error', 'Não Encontrado', `Equipamento com código "${decodedText}" não cadastrado no sistema.`);
      return;
    }

    setShowScanner(false);

    const activeLog = logs.find(l => l.id === tool.lastLogId && l.statusLog === 'Aberta');

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
                activeLog={logs.find(l => l.id === tool.lastLogId && l.statusLog === 'Aberta')}
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

            <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  tool={tools.find(t => t.id === log.toolId)}
                  obra={obras.find(o => o.id === log.obraId)}
                />
              ))}
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
        </div>
      </div>
    </div>
  );
}