import React, { useState, useEffect, useRef } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, serverTimestamp, query, where, updateDoc, doc, writeBatch } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType, auth } from '../lib/supabase';
import { Attachment, Obra, Material, Atividade, Checklist, Operator } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  ChevronRight, 
  CheckCircle2, 
  MapPin, 
  User, 
  Package, 
  Activity,
  ChevronDown,
  AlertCircle,
  Save,
  ArrowRight,
  Camera,
  FileText,
  Paperclip,
  X,
  Users,
  UserPlus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { uploadPhoto, uploadFile, sendBrowserNotification } from '../lib/services';
import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';

export default function ChecklistPage() {
  const { notify } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep, limparRascunhoEtapa] = useAutoSaveForm('rascunho-checklist-etapa', 1);
  const [selectedObraId, setSelectedObraId, limparRascunhoObraChecklist] = useAutoSaveForm('rascunho-checklist-obra', '');
  
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [operadoresSnap] = useCollection(collection(db, 'operadores'));
  const [materiaisSnap] = useCollection(
    selectedObraId 
      ? query(collection(db, 'materiais'), where('obraId', '==', selectedObraId), where('statusConferencia', '==', 'Pendente'))
      : null
  );
  const [atividadesSnap] = useCollection(
    selectedObraId 
      ? query(collection(db, 'atividades'), where('obraId', '==', selectedObraId))
      : null
  );

  const [conferencias, setConferencias, limparRascunhoConferencias] = useAutoSaveForm<Record<string, number>>('rascunho-checklist-conferencias', {});
  const [avancos, setAvancos, limparRascunhoAvancos] = useAutoSaveForm<Record<string, number>>('rascunho-checklist-avancos', {});
  const [selectedEquipeIds, setSelectedEquipeIds, limparRascunhoEquipe] = useAutoSaveForm<string[]>('rascunho-checklist-equipe', []);
  const [obs, setObs, limparRascunhoObs] = useAutoSaveForm('rascunho-checklist-observacoes', '');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const todasObras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const obras = todasObras.filter(o => o.status === 'Ativa');
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];
  const atividades = (atividadesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Atividade[]) || [];
  const todosOperadores = (operadoresSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]) || [];
  
  const selectedObra = obras.find(o => o.id === selectedObraId);
  const operadores = selectedObra?.operadoresIds?.length 
    ? todosOperadores.filter(op => selectedObra.operadoresIds?.includes(op.id))
    : todosOperadores;

  const handleFinish = async () => {
    if (!selectedObraId) return notify('warning', 'Atenção', 'Selecione uma obra antes de finalizar.');

    console.log('Iniciando finalização de checklist...', { selectedObraId, hasPhoto: !!photoFile });
    setUploading(true);
    try {
      let photoUrl = '';
      if (photoFile) {
        console.log('Enviando foto de campo...');
        photoUrl = await uploadPhoto(photoFile, 'checklists');
        console.log('Foto enviada:', photoUrl);
      }

      const batch = writeBatch(db);

      // 1. Create Checklist record
      const checklistData = {
        obraId: selectedObraId,
        operatorId: auth.currentUser?.id || 'anonymous',
        data: serverTimestamp(),
        nomeResponsavel: (auth.currentUser?.user_metadata?.name || auth.currentUser?.email) || 'Sistema',
        observacoes: obs,
        photoUrl: photoUrl || '',
        equipeIds: selectedEquipeIds,
        materiais: Object.entries(conferencias).map(([id, qty]) => ({ 
          materialId: id, 
          qtdConferida: Number(qty) || 0 
        })),
        progresso: Object.entries(avancos).map(([id, qty]) => ({ 
          atividadeId: id, 
          qtdExecutadaNoDia: Number(qty) || 0 
        }))
      };

      console.log('Dados do checklist:', checklistData);
      const checklistRef = doc(collection(db, 'checklists'));
      batch.set(checklistRef, checklistData);

      // 2. Update Materials status
      Object.entries(conferencias).forEach(([id, qty]) => {
        const mat = materiais.find(m => m.id === id);
        if (mat) {
          const matRef = doc(db, 'materiais', id);
          const conferredQty = Number(qty) || 0;
          batch.update(matRef, {
            statusConferencia: conferredQty >= mat.quantidade ? 'Conferido' : 'Divergente'
          });
        }
      });

      // 3. Update Atividades progress
      Object.entries(avancos).forEach(([id, qty]) => {
        const ativ = atividades.find(a => a.id === id);
        if (ativ) {
          const ativRef = doc(db, 'atividades', id);
          const addedQty = Number(qty) || 0;
          const newTotal = (ativ.quantidadeExecutada || 0) + addedQty;
          batch.update(ativRef, {
            quantidadeExecutada: newTotal,
            percentual: Math.min(100, (newTotal / ativ.quantidadePrevista) * 100)
          });
        }
      });

      console.log('Executando batch commit...');
      await batch.commit();
      console.log('Batch commit concluído com sucesso.');

      sendBrowserNotification('Checklist Enviado!', `Relatório da obra ${todasObras.find(o => o.id === selectedObraId)?.nome} finalizado.`);

      notify('success', 'Relatório Concluído', 'Checklist finalizado e enviado com sucesso!');
      limparRascunhoEtapa();
      limparRascunhoObraChecklist();
      limparRascunhoConferencias();
      limparRascunhoAvancos();
      limparRascunhoEquipe();
      limparRascunhoObs();
      navigate('/relatorios');
    } catch (err: any) {
      console.error('Erro detalhado no checklist:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      notify('error', 'Erro ao Finalizar', `Não foi possível concluir o checklist: ${errorMessage}`);
      handleFirestoreError(err, OperationType.WRITE, 'checklist-batch');
    } finally {
      setUploading(false);
    }
  };

  const applyPhotoFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      notify('warning', 'Arquivo Muito Grande', 'A foto deve ter no máximo 5MB.');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyPhotoFile(file);
    e.target.value = '';
  };

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    applyPhotoFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Checklist Diário</h2>
            <p className="text-zinc-500 text-sm">Registro de conferência e avanço de campo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(step => (
            <div 
              key={step} 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                activeStep >= step ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-400"
              )}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      {activeStep === 1 && (
        <section className="space-y-6 animate-in slide-in-from-right duration-300">
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Qual obra estamos acompanhando hoje?</h3>
              <p className="text-zinc-500 text-sm">Selecione a obra para carregar os materiais e atividades.</p>
            </div>
            
            <div className="grid gap-4">
              {obras.map(obra => (
                <button
                  key={obra.id}
                  onClick={() => setSelectedObraId(obra.id)}
                  className={cn(
                    "p-5 rounded-xl border text-left transition-all group flex items-center justify-between",
                    selectedObraId === obra.id 
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-200 scale-102" 
                      : "bg-zinc-50 border-zinc-200 hover:border-zinc-400 text-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", selectedObraId === obra.id ? "bg-zinc-800" : "bg-white border border-zinc-200")}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold tracking-tight">{obra.nome}</p>
                      <p className={cn("text-xs", selectedObraId === obra.id ? "text-zinc-400" : "text-zinc-500")}>
                        {obra.cliente} • CC: {obra.centroCusto}
                      </p>
                    </div>
                  </div>
                  {selectedObraId === obra.id && <CheckCircle2 className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>

            <div className="pt-4">
              <button
                disabled={!selectedObraId}
                onClick={() => setActiveStep(2)}
                className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group"
              >
                Próximo Passo
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>
      )}

      {activeStep === 2 && (
        <section className="space-y-6 animate-in slide-in-from-right duration-300">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-zinc-400" />
              Conferência de Materiais ({materiais.length})
            </h3>
            <p className="text-zinc-500 text-sm">Informe as quantidades recebidas e conferidas.</p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {materiais.length > 0 ? materiais.map(mat => (
                <div key={mat.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">#{mat.codigoEntrega}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{mat.categoria}</span>
                    </div>
                    <h4 className="font-bold text-zinc-900 tracking-tight">{mat.descricao}</h4>
                    <p className="text-xs text-zinc-500">Esperado: <span className="font-bold text-zinc-900">{mat.quantidade} {mat.unidade}</span> de {mat.fornecedor}</p>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
                     <button 
                      onClick={() => setConferencias(prev => ({ ...prev, [mat.id]: Math.max(0, (prev[mat.id] || 0) - 1) }))}
                      className="w-10 h-10 flex items-center justify-center bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 font-bold"
                    >-</button>
                    <input 
                      type="number"
                      className="w-20 bg-transparent text-center font-bold text-lg focus:outline-none"
                      value={!conferencias[mat.id] ? '' : conferencias[mat.id]}
                      min="0"
                      onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setConferencias(prev => ({ ...prev, [mat.id]: val }));
                      }}
                    />
                    <button 
                      onClick={() => setConferencias(prev => ({ ...prev, [mat.id]: (prev[mat.id] || 0) + 1 }))}
                      className="w-10 h-10 flex items-center justify-center bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-bold"
                    >+</button>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center space-y-4">
                  <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6 text-zinc-300" />
                  </div>
                  <p className="text-zinc-500 font-medium tracking-tight">Não há materiais pendentes para esta obra.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
             <button
                onClick={() => setActiveStep(1)}
                className="flex-1 py-4 bg-white text-zinc-600 rounded-xl font-bold border border-zinc-200 hover:bg-zinc-50 transition-all uppercase tracking-widest"
              >
                Voltar
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className="flex-[2] py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                Próximo Passo
                <ChevronRight className="w-5 h-5" />
              </button>
          </div>
        </section>
      )}

      {activeStep === 3 && (
        <section className="space-y-6 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-zinc-400" />
                Equipe em Campo
              </h3>
              <p className="text-zinc-500 text-sm">Quem está trabalhando na obra agora?</p>
            </div>
            <button 
              onClick={() => {
                if (selectedEquipeIds.length === operadores.length) {
                  setSelectedEquipeIds([]);
                } else {
                  setSelectedEquipeIds(operadores.map(o => o.id));
                }
              }}
              className="text-xs font-bold text-zinc-900 bg-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <UserPlus className="w-3 h-3" />
              {selectedEquipeIds.length === operadores.length ? 'Remover Todos' : 'Adicionar Todos'}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {operadores.map(op => {
              const isSelected = selectedEquipeIds.includes(op.id);
              return (
                <button
                  key={op.id}
                  onClick={() => {
                    setSelectedEquipeIds(prev => 
                      isSelected ? prev.filter(id => id !== op.id) : [...prev, op.id]
                    );
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex items-center gap-4 text-left relative",
                    isSelected 
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-lg scale-102" 
                      : "bg-white border-zinc-200 hover:border-zinc-400 text-zinc-900"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                    isSelected ? "bg-zinc-800" : "bg-zinc-100 text-zinc-400"
                  )}>
                    {op.nome[0]}{op.sobrenome?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{op.nome} {op.sobrenome}</p>
                    <p className={cn("text-[10px] uppercase tracking-widest font-bold", isSelected ? "text-zinc-400" : "text-zinc-500")}>
                      {op.funcao || 'Operador'}
                    </p>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    isSelected ? "bg-white border-white text-zinc-900" : "bg-white border-zinc-200 text-transparent"
                  )}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>

          {operadores.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-zinc-200">
              <Users className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">Nenhum operador {selectedObra?.operadoresIds?.length ? 'atribuído a esta obra' : 'cadastrado'}.</p>
              <a href="/equipe" className="text-sm font-bold text-zinc-900 underline block mt-2">Gerenciar Operadores</a>
            </div>
          )}

          <div className="flex gap-4">
             <button
                onClick={() => setActiveStep(2)}
                className="flex-1 py-4 bg-white text-zinc-600 rounded-xl font-bold border border-zinc-200 hover:bg-zinc-50 transition-all uppercase tracking-widest"
              >
                Voltar
              </button>
              <button
                onClick={() => setActiveStep(4)}
                className="flex-[2] py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                Próximo Passo
                <ChevronRight className="w-5 h-5" />
              </button>
          </div>
        </section>
      )}

      {activeStep === 4 && (
        <section className="space-y-6 animate-in slide-in-from-right duration-300">
           <div className="space-y-4">
            <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-zinc-400" />
              Avanço de Mão de Obra
            </h3>
            <p className="text-zinc-500 text-sm">Registre o quanto foi executado de cada serviço no dia.</p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {atividades.length > 0 ? atividades.map(ativ => (
                <div key={ativ.id} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-900 tracking-tight">{ativ.descricao}</h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                        <span>Total: <b>{ativ.quantidadePrevista} {ativ.unidade}</b></span>
                        <div className="w-1 h-1 rounded-full bg-zinc-300" />
                        <span>Executado: <b>{ativ.quantidadeExecutada} {ativ.unidade} ({Math.round(ativ.percentual)}%)</b></span>
                      </div>
                    </div>
                    <div className="w-32 bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          ativ.percentual < 50 ? "bg-red-500" : ativ.percentual < 100 ? "bg-amber-500" : "bg-green-500"
                        )}
                        style={{ width: `${ativ.percentual}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-zinc-50/50 p-4 rounded-xl border border-dashed border-zinc-300">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-2">Executado Hoje:</span>
                    <div className="flex-1 flex items-center gap-3">
                       <input 
                        type="number"
                        placeholder="Ex: 50"
                        className="flex-1 bg-white border border-zinc-200 px-4 py-2 rounded-lg text-lg font-bold focus:ring-2 focus:ring-zinc-900/10 outline-none"
                        value={!avancos[ativ.id] ? '' : avancos[ativ.id]}
                        min="0"
                        onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setAvancos(prev => ({ ...prev, [ativ.id]: val }));
                        }}
                      />
                      <span className="text-sm font-bold text-zinc-500">{ativ.unidade}</span>
                    </div>
                  </div>
                </div>
              )) : (
                 <div className="p-12 text-center flex flex-col items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-zinc-300" />
                  <p className="text-zinc-500 font-medium">Nenhuma atividade cadastrada para esta obra.</p>
                  <a href="/atividades" className="text-sm font-bold text-zinc-900 underline active:opacity-50">Cadastrar Atividades</a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 pl-1">
              <label className="text-sm font-bold text-zinc-600 uppercase tracking-widest">Foto de Evidência / Ocorrência</label>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Opcional</span>
            </div>
            {photoPreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-zinc-300">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-white border-2 border-dashed border-zinc-200 rounded-2xl hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                >
                  <Camera className="w-8 h-8 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tirar Foto</span>
                </button>
                <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-white border-2 border-dashed border-zinc-200 rounded-2xl hover:border-zinc-400 hover:bg-zinc-50 transition-all cursor-pointer">
                  <Paperclip className="w-8 h-8 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Da Galeria</span>
                  <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
            )}
          </div>
          {showCamera && (
            <ChecklistCamera onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
          )}

          <div className="space-y-4">
            <label className="text-sm font-bold text-zinc-600 uppercase tracking-widest pl-1">Observações do Fechamento</label>
            <textarea 
              className="w-full h-32 p-4 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900/10 outline-none text-sm resize-none"
              placeholder="Alguma divergência ou aviso importante?"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>

          <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 text-white space-y-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
               <ClipboardCheck className="w-32 h-32" />
            </div>
            
            <div>
              <h4 className="text-lg font-bold tracking-tight">Finalizar Relatório</h4>
              <p className="text-zinc-400 text-sm">Ao clicar em finalizar, os dados serão consolidados no banco de dados e enviados para o financeiro.</p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl border border-zinc-700">
               <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  {auth.currentUser?.user_metadata?.avatar_url ? (
                    <img src={auth.currentUser.user_metadata.avatar_url} className="w-10 h-10 rounded-full" />
                  ) : <User className="w-5 h-5 text-zinc-400" />}
               </div>
               <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Assinado por:</p>
                  <p className="text-sm font-bold">{(auth.currentUser?.user_metadata?.name || auth.currentUser?.email)}</p>
               </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setActiveStep(3)}
                className="flex-1 py-4 bg-zinc-800 text-white rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 transition-all uppercase tracking-widest"
              >
                Voltar
              </button>
              <button
                onClick={handleFinish}
                disabled={uploading}
                className="flex-[2] py-4 bg-white text-zinc-900 rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {uploading ? 'Enviando...' : 'Finalizar Checklist'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ChecklistCamera({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().then(() => setReady(true)); }
    }).catch((err: any) => {
      if (!mounted) return;
      setCamError(err?.name === 'NotAllowedError' ? 'Permissão de câmera negada. Libere nas configurações.' : 'Câmera não disponível neste dispositivo.');
    });
    return () => { mounted = false; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const stopStream = () => streamRef.current?.getTracks().forEach(t => t.stop());

  const handleCapture = () => {
    if (!videoRef.current || !ready) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stopStream();
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCapturedFile(file);
      setCaptured(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.88);
  };

  const handleConfirm = () => {
    if (capturedFile) { onCapture(capturedFile); if (captured) URL.revokeObjectURL(captured); }
  };

  const handleRetake = () => {
    if (captured) URL.revokeObjectURL(captured);
    setCaptured(null); setCapturedFile(null); setReady(false);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().then(() => setReady(true)); }
      }).catch(() => setCamError('Não foi possível reiniciar a câmera.'));
  };

  const handleClose = () => { stopStream(); if (captured) URL.revokeObjectURL(captured); onClose(); };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <button type="button" onClick={handleClose} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white text-sm font-bold uppercase tracking-widest">{captured ? 'Confirmar Foto' : 'Tirar Foto'}</span>
        <div className="w-10" />
      </div>
      <div className="flex-1 relative overflow-hidden bg-black">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400" />
            <p className="text-white text-sm">{camError}</p>
            <button type="button" onClick={handleClose} className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm">Fechar</button>
          </div>
        ) : captured ? (
          <img src={captured} className="w-full h-full object-contain" alt="Captura" />
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        )}
      </div>
      <div className="shrink-0 flex items-center justify-center gap-6 p-8 bg-black">
        {captured ? (
          <>
            <button type="button" onClick={handleRetake} className="flex-1 py-4 rounded-2xl border-2 border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-all">Tirar Novamente</button>
            <button type="button" onClick={handleConfirm} className="flex-1 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Usar Esta Foto
            </button>
          </>
        ) : (
          <button type="button" onClick={handleCapture} disabled={!ready} className="w-20 h-20 rounded-full bg-white border-4 border-zinc-400 shadow-2xl hover:scale-95 active:scale-90 transition-transform disabled:opacity-40" aria-label="Capturar foto" />
        )}
      </div>
    </div>
  );
}
