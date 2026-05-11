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
  Calendar, 
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { uploadPhoto } from '../lib/services';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../App';

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
    if (tool) {
      setShowScanner(false);
      const activeLog = logs.find(l => l.id === tool.lastLogId && l.statusLog === 'Aberta');
      if (activeLog) {
        setShowCheckIn(activeLog);
      } else if (tool.status === 'Disponível') {
        setShowCheckOut(tool);
      } else {
        notify('warning', 'Material Indisponível', `A ferramenta "${tool.nome}" já está sendo utilizada por outro colaborador.`);
      }
    } else {
      notify('error', 'Não Encontrado', `Equipamento com código "${decodedText}" não cadastrado no sistema.`);
    }
  }, [tools, logs]);

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
        {/* Tool Inventory */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Inventário de Equipamentos</h3>
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

        {/* Recent History */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Atividade Recente</h3>
          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-600">Logs de Movimentação</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <LogItem key={log.id} log={log} tool={tools.find(t => t.id === log.toolId)} obra={obras.find(o => o.id === log.obraId)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(showAddTool || editingTool) && (
          <AddToolModal 
            tool={editingTool || undefined} 
            onClose={() => { setShowAddTool(false); setEditingTool(null); }} 
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
            tool={tools.find(t => t.id === showCheckIn.toolId)!}
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
          {tool.nome.toLowerCase().includes('furadeira') ? <Wrench className="w-6 h-6" /> : <Hammer className="w-6 h-6" />}
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

function LogItem({ log, tool, obra, showToolInfo = true }: { key?: string | number, log: ToolLog, tool?: Tool, obra?: Obra, showToolInfo?: boolean }) {
  const isPending = log.statusLog === 'Aberta';
  const outDate = log.dataSaida?.toDate ? log.dataSaida.toDate() : new Date();
  const inDate = log.dataDevolucao?.toDate ? log.dataDevolucao.toDate() : null;
  
  return (
    <div className="p-5 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {showToolInfo && (
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-2 h-2 rounded-full", isPending ? "bg-orange-500 animate-pulse" : "bg-green-500")} />
                <span className="text-sm font-bold text-zinc-900 truncate">{tool?.nome || 'Ferramenta Removida'}</span>
                <span className="text-[10px] text-zinc-400 font-mono">#{tool?.codigo || '---'}</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Responsável</p>
                  <p className="text-xs font-bold text-zinc-900 truncate">{log.responsavelNome}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">Obra / Local</p>
                  <p className="text-xs font-bold text-zinc-900 truncate">{obra?.nome || 'Obra Removida'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Saída em</div>
            <div className="text-xs font-bold text-zinc-900">{format(outDate, "dd/MM/yyyy")}</div>
            <div className="text-[10px] text-zinc-500 font-medium">{format(outDate, "HH:mm")}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight flex items-center gap-1",
              isPending ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
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
          </div>

          {!isPending && inDate && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-xl border border-green-100">
              <ArrowDownLeft className="w-3 h-3 text-green-600" />
              <div className="text-left">
                <span className="block text-[8px] font-bold text-green-600 uppercase tracking-tighter leading-none">Devolvido em</span>
                <span className="text-[10px] font-bold text-green-700">{format(inDate, "dd/MM HH:mm")}</span>
              </div>
            </div>
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
              {history.map((log) => (
                <LogItem 
                  key={log.id} 
                  log={log} 
                  obra={obras.find(o => o.id === log.obraId)} 
                  showToolInfo={false} 
                />
              ))}
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

function AddToolModal({ tool, onClose }: { tool?: Tool, onClose: () => void }) {
  const [nome, setNome] = useState(tool?.nome || '');
  const [codigo, setCodigo] = useState(tool?.codigo || '');
  const [modelo, setModelo] = useState(tool?.modelo || '');
  const [valor, setValor] = useState(tool?.valor !== undefined ? String(tool.valor) : '');
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
    const parsedValor = Number(String(valor).replace(',', '.'));

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
                type="number"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none"
                placeholder="Ex: 850.00"
                value={valor === '0' ? '' : valor}
                onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                onChange={e => setValor(String(Math.max(0, parseFloat(e.target.value) || 0)))}
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
    if (!obraId) {
      notify('warning', 'Atenção', 'Selecione uma obra de destino antes de confirmar.');
      return;
    }
    setLoading(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Create Log
      const logRef = doc(collection(db, 'toolLogs'));
      batch.set(logRef, {
        toolId: tool.id,
        obraId,
        responsavelNome: responsavel,
        dataSaida: serverTimestamp(),
        statusLog: 'Aberta'
      });

      // 2. Update Tool
      const toolRef = doc(db, 'tools', tool.id);
      batch.update(toolRef, {
        status: 'Em Uso',
        lastLogId: logRef.id,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      notify('success', 'Retirada Concluída', `O material "${tool.nome}" foi registrado para a obra selecionada.`);
      if (!tool) localStorage.removeItem('rascunho-nova-ferramenta');
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!photoFile) {
      setError('A foto da devolução é obrigatória para comprovar o estado do material.');
      return;
    }
    setLoading(true);
    setUploadProgress(0);

    try {
      console.log("Iniciando processo de devolução...");
      
      // 1. Upload photo
      const photoUrl = await uploadPhoto(
        photoFile, 
        `tools/${tool.id}/returns`,
        (progress) => setUploadProgress(progress)
      );
      console.log("Foto enviada com sucesso:", photoUrl);
      
      const batch = writeBatch(db);
      
      // 2. Update Log
      const logRef = doc(db, 'toolLogs', log.id);
      batch.update(logRef, {
        dataDevolucao: serverTimestamp(),
        fotoDevolucaoUrl: photoUrl,
        statusLog: 'Concluída'
      });

      // 3. Update Tool
      const toolRef = doc(db, 'tools', tool.id);
      batch.update(toolRef, {
        status: 'Disponível',
        updatedAt: serverTimestamp()
      });

      console.log("Enviando lote (batch) para o Firestore...");
      await batch.commit();
      console.log("Banco de dados atualizado com sucesso.");
      
      notify('success', 'Devolução Concluída', 'Material entregue e já está disponível para retirada.');
      if (!tool) localStorage.removeItem('rascunho-nova-ferramenta');
      onClose();
    } catch (err: any) {
      console.error("ERRO CRÍTICO NA DEVOLUÇÃO:", err);
      let errorMsg = 'Falha ao processar devolução.';
      if (err.code === 'permission-denied') {
        errorMsg = 'Permissão negada pelo banco de dados. Verifique se você está logado corretamente.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      handleFirestoreError(err, OperationType.WRITE, 'tool-checkin');
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
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCheckIn} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Foto do Estado do Material (Obrigatório)</label>
            {photoPreview ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                <img src={photoPreview} className="w-full h-full object-cover" alt="Estado do material" />
                <button 
                  type="button"
                  onClick={() => { setPhotoPreview(null); setPhotoFile(null); setError(null); }}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className={cn(
                "flex flex-col items-center justify-center aspect-video bg-zinc-50 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-zinc-100 transition-all group",
                error ? "border-red-200 bg-red-50/30" : "border-zinc-200"
              )}>
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                  <Camera className={cn("w-6 h-6", error ? "text-red-400" : "text-zinc-400")} />
                </div>
                <span className={cn("text-xs font-bold", error ? "text-red-500" : "text-zinc-500")}>TIRAR FOTO DO MATERIAL</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                      setError(null);
                    }
                  }}
                />
              </label>
            )}
            <div className="flex items-start gap-2 text-zinc-400 italic">
              <AlertCircle className="w-3 h-3 mt-0.5" />
              <p className="text-[10px] leading-tight">Certifique-se que o equipamento está visível e em bom estado antes de confirmar.</p>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
              loading ? "bg-zinc-100 text-zinc-300 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-zinc-800"
            )}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest">{uploadProgress > 0 && uploadProgress < 100 ? `Enviando Foto... ${uploadProgress.toFixed(0)}%` : 'Finalizando...'}</span>
                <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-white transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                Confirmar Devolução
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
