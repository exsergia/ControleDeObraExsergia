import React, { useState, useRef } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, serverTimestamp, query, orderBy } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Material, Obra } from '../types';
import { Plus, Package, Calendar, Hash, FileText, Search, ChevronDown, Camera, X, Building2, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { uploadPhoto, sendBrowserNotification } from '../lib/services';
import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';
import { parseDate } from '../lib/dateUtils';
import { usePhotoCapture } from '../hooks/usePhotoCapture';
import { CameraCapture } from '../components/CameraCapture';
import { CurrencyInput } from '../components/CurrencyInput';

export default function Materiais() {
  const { isAdmin, isEncarregado, notify } = useAuth();
  const canEdit = isAdmin || isEncarregado;
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap, loading] = useCollection(query(collection(db, 'materiais'), orderBy('dataEntrega', 'desc')));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { photoFile, photoPreview, applyPhotoFile, clearPhoto } = usePhotoCapture(
    () => notify('warning', 'Arquivo Muito Grande', 'A foto deve ter no máximo 25MB.')
  );
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData, limparRascunhoMaterial] = useAutoSaveForm<Partial<Material>>('rascunho-novo-material', {
    obraId: '',
    codigoEntrega: '',
    descricao: '',
    unidade: 'un',
    categoria: 'Civil',
    fornecedor: '',
    quantidade: 0,
    precoUnitario: 0,
    valorTotal: 0,
    statusConferencia: 'Pendente',
    observacoes: ''
  });

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.obraId) return notify('warning', 'Atenção', 'Por favor, selecione uma obra de destino.');

    setUploading(true);
    try {
      let photoUrl = '';
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, 'materiais');
      }

      const qty = Number(formData.quantidade) || 0;
      const price = Number(formData.precoUnitario) || 0;
      const total = qty * price;

      const payload = {
        ...formData,
        unidade: 'un',
        quantidade: qty,
        precoUnitario: price,
        valorTotal: total,
        dataEntrega: serverTimestamp(),
        createdAt: serverTimestamp(),
        photoUrl: photoUrl || ''
      };

      await addDoc(collection(db, 'materiais'), payload);

      sendBrowserNotification('Novo Material!', `Lançamento de ${formData.descricao} concluído.`);

      notify('success', 'Sucesso', 'Material registrado com sucesso!');
      setIsModalOpen(false);
      limparRascunhoMaterial();
      clearPhoto();
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      notify('error', 'Erro no Registro', `Não foi possível registrar o material: ${errorMessage}`);
      handleFirestoreError(err, OperationType.WRITE, 'materiais');
    } finally {
      setUploading(false);
    }
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

  const filtered = materiais.filter(m => {
    const q = search.toLowerCase();
    return (
      (m.descricao || '').toLowerCase().includes(q) ||
      (m.codigoEntrega || '').toLowerCase().includes(q) ||
      (m.fornecedor || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div data-tour="mat-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Materiais Entregues</h2>
          <p className="text-zinc-500">Controle de tudo que chega nas obras.</p>
        </div>
        {canEdit && (
          <button
            data-tour="mat-new"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-lg font-semibold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Registrar Entrega
          </button>
        )}
      </div>

      {/* Search */}
      <div data-tour="mat-search" className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar material, código ou fornecedor..."
          className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table / Cards */}
      <div data-tour="mat-list" className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-zinc-100">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="p-4 animate-pulse"><div className="h-12 bg-zinc-100 rounded" /></div>
            ))
          ) : filtered.length > 0 ? filtered.map(mat => {
            const dt = parseDate(mat.dataEntrega);
            return (
              <div key={mat.id} className="p-4 flex gap-3">
                {mat.photoUrl ? (
                  <img src={mat.photoUrl} alt="Material" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-zinc-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{mat.descricao}</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 border",
                      mat.statusConferencia === 'Conferido' ? "bg-green-50 text-green-600 border-green-200" :
                      mat.statusConferencia === 'Divergente' ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-zinc-50 text-zinc-400 border-zinc-200"
                    )}>{mat.statusConferencia}</span>
                  </div>
                  <p className="text-xs text-zinc-500">#{mat.codigoEntrega} · {mat.categoria}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-400 break-words">{mat.fornecedor || '---'} · {mat.quantidade} un</p>
                    {canEdit && (
                      <p className="text-xs font-bold font-mono text-zinc-900 shrink-0">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal || 0)}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400">{dt ? format(dt, 'dd/MM/yy HH:mm') : '---'}</p>
                </div>
              </div>
            );
          }) : (
            <div className="p-12 text-center text-zinc-400 italic">Nenhum registro encontrado.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Entrega</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Material</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Qtd</th>
                {canEdit && <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Valor Total</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-zinc-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map(mat => {
                  const dt = parseDate(mat.dataEntrega);
                  return (
                    <tr key={mat.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        {mat.photoUrl ? (
                          <img src={mat.photoUrl} alt="Material" className="w-10 h-10 rounded object-cover shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-zinc-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-900 group-hover:text-zinc-600 transition-colors uppercase">#{mat.codigoEntrega}</span>
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dt ? format(dt, 'dd/MM/yy HH:mm') : '---'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-zinc-800">{mat.descricao}</span>
                          <span className="text-xs text-zinc-500">{mat.categoria}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-zinc-600 font-medium">{mat.fornecedor || '---'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-zinc-900">{mat.quantidade}</span>
                          <span className="text-xs text-zinc-400">{mat.unidade}</span>
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-mono font-bold text-zinc-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal || 0)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          mat.statusConferencia === 'Conferido' ? "bg-green-50 text-green-600 border-green-200" :
                          mat.statusConferencia === 'Divergente' ? "bg-red-50 text-red-600 border-red-200" :
                          "bg-zinc-50 text-zinc-400 border-zinc-200"
                        )}>
                          {mat.statusConferencia}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registration */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <h3 className="text-lg font-bold text-zinc-900 uppercase tracking-widest">Lançar Material</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>
            <form onSubmit={handleAddMaterial} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Obra de Destino</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      value={formData.obraId}
                      onChange={(e) => setFormData({...formData, obraId: e.target.value})}
                    >
                      <option value="">Selecione a Obra...</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cód. Entrega / NF</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                    <input
                      required
                      type="text"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                      placeholder="Ex: NF-00123"
                      value={formData.codigoEntrega}
                      onChange={(e) => setFormData({...formData, codigoEntrega: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Descrição do Material</label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    required
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                    placeholder="Nome detalhado do produto"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Fornecedor</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                    placeholder="Nome do fornecedor (opcional)"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({...formData, fornecedor: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Unidade</label>
                  <div className="w-full px-4 py-2.5 bg-zinc-100 border border-zinc-200 rounded-lg text-sm text-center font-bold text-zinc-700 cursor-default select-none">
                    UN
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quantidade</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center font-bold"
                    value={!formData.quantidade ? '' : formData.quantidade}
                    onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setFormData({...formData, quantidade: val});
                    }}
                  />
                </div>
                {canEdit && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Preço Un.</label>
                    <CurrencyInput
                      value={formData.precoUnitario || ''}
                      onChange={(v) => setFormData({ ...formData, precoUnitario: typeof v === 'number' ? v : 0 })}
                      className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                )}
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Categoria</label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                    >
                      <option value="Civil">Civil</option>
                      <option value="Elétrica">Elétrica</option>
                      <option value="Outros">Outros</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Foto da NF / Material</label>
                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Opcional</span>
                  </div>
                  {photoPreview ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-zinc-300">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-100 transition-all"
                      >
                        <Camera className="w-8 h-8 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tirar Foto</span>
                      </button>
                      <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer">
                        <Paperclip className="w-8 h-8 text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Da Galeria</span>
                        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Observações</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                    <textarea
                      rows={4}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm resize-none"
                      placeholder="Opcional..."
                      value={formData.observacoes || ''}
                      onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-[2] py-4 text-sm font-semibold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 uppercase tracking-widest disabled:opacity-50"
                >
                  {uploading ? 'Processando...' : 'Registrar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Câmera renderizada FORA do modal para escapar do stacking context do backdrop-blur */}
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
}
