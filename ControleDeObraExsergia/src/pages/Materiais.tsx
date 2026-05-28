import React, { useState } from 'react';
import { useCollection } from '../lib/supabaseHooks';
import { collection, addDoc, serverTimestamp, query, orderBy } from '../lib/supabaseDb';
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Material, Obra, MaterialStatus } from '../types';
import { Plus, Package, Truck, Calendar, Hash, Tag, DollarSign, FileText, Search, ChevronDown, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { uploadPhoto, sendBrowserNotification } from '../lib/services';
import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';

export default function Materiais() {
  const { isAdmin, notify } = useAuth();
  const [obrasSnap] = useCollection(collection(db, 'obras'));
  const [materiaisSnap, loading] = useCollection(query(collection(db, 'materiais'), orderBy('dataEntrega', 'desc')));
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

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
    statusConferencia: 'Pendente'
  });

  const obras = (obrasSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Obra[]) || [];
  const materiais = (materiaisSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[]) || [];

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.obraId) return notify('warning', 'Atenção', 'Por favor, selecione uma obra de destino.');
    
    console.log('Iniciando registro de material...', { formData, hasPhoto: !!photoFile });
    setUploading(true);
    try {
      let photoUrl = '';
      if (photoFile) {
        console.log('Enviando foto ao Storage...');
        photoUrl = await uploadPhoto(photoFile, 'materiais');
        console.log('Foto enviada com sucesso:', photoUrl);
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

      console.log('Enviando payload para Firestore:', payload);
      await addDoc(collection(db, 'materiais'), payload);
      console.log('Material registrado com sucesso no Firestore.');

      sendBrowserNotification('Novo Material!', `Lançamento de ${formData.descricao} concluído.`);

      notify('success', 'Sucesso', 'Material registrado com sucesso!');
      setIsModalOpen(false);
      limparRascunhoMaterial();
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err: any) {
      console.error('Erro detalhado no registro:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      notify('error', 'Erro no Registro', `Não foi possível registrar o material: ${errorMessage}`);
      handleFirestoreError(err, OperationType.WRITE, 'materiais');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        notify('warning', 'Arquivo Muito Grande', 'A foto deve ter no máximo 5MB.');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const filtered = materiais.filter(m => 
    m.descricao.toLowerCase().includes(search.toLowerCase()) || 
    m.codigoEntrega.toLowerCase().includes(search.toLowerCase()) ||
    m.fornecedor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Materiais Entregues</h2>
          <p className="text-zinc-500">Controle de tudo que chega nas obras.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-lg font-semibold hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Registrar Entrega
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Buscar material, código ou fornecedor..." 
          className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Entrega</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Material</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Qtd</th>
                {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Valor Total</th>}
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
                filtered.map(mat => (
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
                          {mat.dataEntrega?.seconds ? format(mat.dataEntrega.toDate(), 'dd/MM/yy HH:mm') : 'Pendente'}
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
                      <span className="text-sm text-zinc-600 font-medium">{mat.fornecedor}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-zinc-900">{mat.quantidade}</span>
                        <span className="text-xs text-zinc-400">{mat.unidade}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-zinc-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.valorTotal)}
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
                ))
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
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div className="p-5 sm:p-6 border-b border-zinc-100 flex items-start sm:items-center justify-between gap-4 bg-zinc-50 shrink-0">
              <h3 className="text-lg font-bold text-zinc-900 uppercase tracking-widest">Lançar Material</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-zinc-500" />
              </button>
            </div>
            <form onSubmit={handleAddMaterial} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Preço Un.</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-2 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-center font-bold"
                        value={!formData.precoUnitario ? '' : formData.precoUnitario}
                        onKeyDown={(e) => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setFormData({...formData, precoUnitario: val});
                        }}
                      />
                    </div>
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
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Foto da NF / Material</label>
                  <div className="relative group/photo">
                    {photoPreview ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-zinc-300">
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 transition-all group-hover/photo:scale-[1.01]">
                        <Camera className="w-8 h-8 text-zinc-400 mb-2 group-hover:text-zinc-600 transition-colors" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Capturar Foto</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Observações</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                      placeholder="Opcional..."
                      value={formData.observacoes}
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
    </div>
  );
}
