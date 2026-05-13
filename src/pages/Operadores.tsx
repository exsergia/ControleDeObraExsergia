import React, { useState } from 'react';
import { useCollection } from '../lib/supabaseHooks';
<<<<<<< HEAD
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from '../lib/supabaseDb';
=======
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../lib/supabaseDb';
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
import { db, handleFirestoreError, OperationType } from '../lib/supabase';
import { Operator } from '../types';
import { useAuth } from '../App';
import { 
  Mail, 
  UserCircle2, 
  Briefcase, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  UserPlus,
  ArrowLeft,
  ShieldCheck,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Operadores() {
  const { isAdmin } = useAuth();
  const [operadoresSnap, loading] = useCollection(collection(db, 'operadores'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    funcao: '',
    email: '',
<<<<<<< HEAD
    cpf: '',
    telefone: '',
=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
    role: 'operator' as 'admin' | 'operator'
  });

  const operators = (operadoresSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]) || [];

  const filteredOperators = operators.filter(op => 
    op.nome?.toLowerCase().includes(search.toLowerCase()) ||
    op.sobrenome?.toLowerCase().includes(search.toLowerCase()) ||
    op.email?.toLowerCase().includes(search.toLowerCase()) ||
<<<<<<< HEAD
    op.cpf?.toLowerCase().includes(search.toLowerCase()) ||
    op.telefone?.toLowerCase().includes(search.toLowerCase()) ||
=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
    op.funcao?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOperator) {
        await updateDoc(doc(db, 'operadores', editingOperator.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'operadores'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      handleCloseModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'operadores');
    }
  };

  const handleEdit = (op: Operator) => {
    setEditingOperator(op);
    setFormData({
      nome: op.nome,
      sobrenome: op.sobrenome || '',
      funcao: op.funcao || '',
      email: op.email,
<<<<<<< HEAD
      cpf: op.cpf || '',
      telefone: op.telefone || '',
=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
      role: op.role || 'operator'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Deseja realmente remover este operador?')) return;
    try {
<<<<<<< HEAD
      const obrasSnap = await getDocs(collection(db, 'obras'));
      await Promise.all(obrasSnap.docs.map(async (obraDoc: any) => {
        const obra = obraDoc.data();
        const operadoresIds = Array.isArray(obra.operadoresIds) ? obra.operadoresIds.filter((opId: string) => opId !== id) : [];
        const equipe = Array.isArray(obra.equipe) ? obra.equipe.filter((e: any) => e.operatorId !== id) : [];
        if ((obra.operadoresIds || []).includes(id) || (obra.equipe || []).some((e: any) => e.operatorId === id)) {
          await updateDoc(doc(db, 'obras', obraDoc.id), { operadoresIds, equipe });
        }
      }));
=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
      await deleteDoc(doc(db, 'operadores', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'operadores-delete');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOperator(null);
<<<<<<< HEAD
    setFormData({ nome: '', sobrenome: '', funcao: '', email: '', cpf: '', telefone: '', role: 'operator' });
=======
    setFormData({ nome: '', sobrenome: '', funcao: '', email: '', role: 'operator' });
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Gerenciar Operadores</h2>
          <p className="text-zinc-500 text-sm">Controle sua equipe de campo e atribua funções.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            Adicionar Operador
          </button>
        )}
      </div>

      <div className="relative bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input 
          type="text" 
<<<<<<< HEAD
          placeholder="Buscar por nome, CPF, telefone, função ou email..." 
=======
          placeholder="Buscar por nome, função ou email..." 
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
          className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-white animate-pulse rounded-3xl border border-zinc-100 shadow-sm" />
          ))
        ) : filteredOperators.length > 0 ? (
          filteredOperators.map(op => (
            <div key={op.id} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-zinc-200 transition-all flex flex-col gap-6 group relative">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl transition-colors",
                  "bg-zinc-50 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white"
                )}>
                  {op.nome[0]}{op.sobrenome?.[0] || ''}
                </div>
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-zinc-900 tracking-tight text-lg truncate">
                      {op.nome} {op.sobrenome}
                    </h4>
                    {op.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                    ) : (
                      <User className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-zinc-200">
                    <Briefcase className="w-3 h-3" />
                    {op.funcao || 'Operador'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                  <Mail className="w-4 h-4 text-zinc-300" />
                  <span className="truncate">{op.email}</span>
                </div>
<<<<<<< HEAD
                {op.telefone && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                    <span className="w-4 h-4 text-zinc-300 flex items-center justify-center">☎</span>
                    <span className="truncate">{op.telefone}</span>
                  </div>
                )}
                {op.cpf && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                    <span className="w-4 h-4 text-zinc-300 flex items-center justify-center">#</span>
                    <span className="truncate">CPF: {op.cpf}</span>
                  </div>
                )}
                <div className="text-[10px] text-zinc-400 font-mono truncate pt-1">ID: {op.id}</div>
=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 pt-2">
                  <button 
                    onClick={() => handleEdit(op)}
                    className="flex-1 flex items-center justify-center gap-2 h-10 px-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(op.id)}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-zinc-200">
             <UserCircle2 className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
             <p className="text-zinc-500 font-medium">Nenhum operador encontrado.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
                    {editingOperator ? 'Editar Operador' : 'Novo Operador'}
                  </h3>
                  <p className="text-zinc-500 text-sm">Preencha os dados básicos do colaborador.</p>
                </div>
                <button onClick={handleCloseModal} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Nome</label>
                    <input 
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Sobrenome</label>
                    <input 
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                      value={formData.sobrenome}
                      onChange={(e) => setFormData({...formData, sobrenome: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Função</label>
                  <input 
                    placeholder="Ex: Eletricista, Encarregado..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                    value={formData.funcao}
                    onChange={(e) => setFormData({...formData, funcao: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Email</label>
                  <input 
                    required
                    type="email"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

<<<<<<< HEAD
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Telefone</label>
                    <input
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">CPF</label>
                    <input
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                </div>

=======
>>>>>>> 971fc88 (verificação de código completo e resolução do problema de devolutiva da foto da parte de ferramenta)
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Tipo de Acesso (Role)</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  >
                    <option value="operator">Operador (Acesso Limitado)</option>
                    <option value="admin">Administrador (Acesso Total)</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    {editingOperator ? 'Salvar Alterações' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
