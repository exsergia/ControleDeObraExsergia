import React, { useState, useEffect, useCallback, memo } from 'react';
import { supabase, handleFirestoreError, OperationType } from '../lib/supabase';
import { Obra, Atividade } from '../types';
import {
  Activity,
  Plus,
  Download,
  Search,
  Building2,
  Users,
  Trash2,
  X,
  Target,
  DollarSign
} from 'lucide-react';
import { cn } from '../lib/utils';
import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../App';
import { useAutoSaveForm } from '../hooks/useAutoSaveForm';

const formatNumberBR = (value: number | undefined | null) => {
  const numero = Number(value || 0);

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const parseNumberBR = (value: string) => {
  if (!value) return 0;

  const cleanValue = value
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  return Math.max(0, parseFloat(cleanValue) || 0);
};

export default function ProgressoFisico() {
  const { isAdmin, notify } = useAuth();

  const [obras, setObras] = useState<Obra[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedObraId, setSelectedObraId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData, limparRascunhoProgresso] = useAutoSaveForm(
    'rascunho-progresso-fisico',
    {
      obraId: '',
      descricao: '',
      unidade: 'm',
      quantidadePrevista: 0,
      quantidadeExecutada: 0,
      valorUnitario: 0,
      equipeResponsavel: ''
    }
  );

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);

      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('*')
        .order('nome', { ascending: true });

      if (obrasError) throw obrasError;

      let atividadesQuery = supabase
        .from('atividades')
        .select('*')
        .order('createdAt', { ascending: false });

      if (selectedObraId !== 'all') {
        atividadesQuery = atividadesQuery.eq('obraId', selectedObraId);
      }

      const { data: atividadesData, error: atividadesError } = await atividadesQuery;

      if (atividadesError) throw atividadesError;

      setObras((obrasData || []) as Obra[]);
      setAtividades((atividadesData || []) as Atividade[]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'progresso-fisico-load');
    } finally {
      setLoading(false);
    }
  }, [selectedObraId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const filteredAtividades = atividades.filter(a =>
    a.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportBI = () => {
    const workbook = utils.book_new();

    const data = atividades.map(a => {
      const obra = obras.find(o => o.id === a.obraId);

      return {
        ID: a.id,
        Obra: obra?.nome || 'N/A',
        Atividade: a.descricao,
        Unidade: a.unidade,
        Previsto: a.quantidadePrevista,
        Executado: a.quantidadeExecutada,
        Percentual: Number(a.percentual || 0).toFixed(2) + '%',
        'Valor Unitário': a.valorUnitario || 0,
        'Valor Total Orçado': a.quantidadePrevista * (a.valorUnitario || 0),
        'Valor Total Executado': a.quantidadeExecutada * (a.valorUnitario || 0),
        'Equipe Responsável': a.equipeResponsavel || 'N/A'
      };
    });

    const ws = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, ws, 'PROGRESSO_FISICO_BI');
    writeFile(workbook, `BI_Progresso_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    notify('success', 'Relatório de Progresso', 'Dados consolidados para Power BI exportados com sucesso!');
  };

  const handleAddAtividade = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const quantidadePrevista = Number(formData.quantidadePrevista || 0);
      const quantidadeExecutada = Number(formData.quantidadeExecutada || 0);
      const valorUnitario = Number(formData.valorUnitario || 0);

      const { error } = await supabase.from('atividades').insert({
        obraId: formData.obraId,
        descricao: formData.descricao,
        unidade: formData.unidade,
        quantidadePrevista,
        quantidadeExecutada,
        valorUnitario,
        equipeResponsavel: formData.equipeResponsavel,
        percentual:
          quantidadePrevista > 0
            ? Math.min(100, (quantidadeExecutada / quantidadePrevista) * 100)
            : 0,
        createdAt: new Date().toISOString()
      });

      if (error) throw error;

      setIsModalOpen(false);
      limparRascunhoProgresso();
      notify('success', 'Atividade Adicionada', 'A nova atividade de progresso físico foi registrada.');
      carregarDados();
    } catch (err: any) {
      notify('error', 'Erro ao Registrar', err.message || 'Não foi possível registrar a atividade.');
      handleFirestoreError(err, OperationType.WRITE, 'atividades');
    }
  };

  const handleUpdateProgress = useCallback(
    async (id: string, currentVal: number, total: number) => {
      try {
        const valorFinal = Number(currentVal.toFixed(2));

        const { error } = await supabase
          .from('atividades')
          .update({
            quantidadeExecutada: valorFinal,
            percentual: total > 0 ? Math.min(100, (valorFinal / total) * 100) : 0
          })
          .eq('id', id);

        if (error) throw error;

        setAtividades(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  quantidadeExecutada: valorFinal,
                  percentual: total > 0 ? Math.min(100, (valorFinal / total) * 100) : 0
                }
              : item
          )
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'atividades-update');
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja excluir esta atividade?')) return;

      try {
        const { error } = await supabase
          .from('atividades')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setAtividades(prev => prev.filter(item => item.id !== id));
        notify('success', 'Atividade Removida', 'O registro de progresso foi excluído com sucesso.');
      } catch (err) {
        notify('error', 'Erro ao Excluir', 'Não foi possível remover a atividade.');
        handleFirestoreError(err, OperationType.WRITE, 'atividades-delete');
      }
    },
    [notify]
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Mão de Obra e Progresso Físico
          </h2>
          <p className="text-zinc-500 text-sm">
            Controle de execução e produtividade em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBI}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-5 h-5" />
            Exportar BI
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Adicionar Atividade
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />

          <input
            type="text"
            placeholder="Buscar atividade..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-sm transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-sm">
          <Building2 className="w-4 h-4 text-zinc-400 ml-2" />

          <select
            className="bg-transparent border-none text-sm font-bold text-zinc-900 focus:ring-0 pr-8"
            value={selectedObraId}
            onChange={(e) => setSelectedObraId(e.target.value)}
          >
            <option value="all">Todas as Obras</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-white animate-pulse rounded-[2.5rem] border border-zinc-100"
            />
          ))
        ) : filteredAtividades.length > 0 ? (
          filteredAtividades.map(ativ => (
            <ActivityCard
              key={ativ.id}
              ativ={ativ}
              obra={obras.find(o => o.id === ativ.obraId)}
              onUpdate={handleUpdateProgress}
              onDelete={handleDelete}
              readOnly={!isAdmin}
            />
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-zinc-100">
            <Activity className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">Nenhuma atividade registrada.</p>

            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-zinc-900 font-bold underline mt-2"
              >
                Registrar agora
              </button>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
            <div className="p-6 sm:p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
                    Nova Atividade
                  </h3>
                  <p className="text-zinc-500 text-sm">
                    Cadastre uma nova tarefa de mão de obra.
                  </p>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleAddAtividade} className="space-y-5 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                    Vincular à Obra
                  </label>

                  <select
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.obraId}
                    onChange={(e) => setFormData({ ...formData, obraId: e.target.value })}
                  >
                    <option value="">Selecione a Obra...</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                    Descrição da Atividade
                  </label>

                  <input
                    required
                    placeholder="Ex: Lançamento de Cabos, Pintura..."
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                      Quantidade Prevista
                    </label>

                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                        value={!formData.quantidadePrevista ? '' : formatNumberBR(formData.quantidadePrevista)}
                        onChange={(e) => {
                          const numero = parseNumberBR(e.target.value);
                          setFormData({ ...formData, quantidadePrevista: numero });
                        }}
                      />

                      <select
                        className="w-20 px-2 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold"
                        value={formData.unidade}
                        onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                      >
                        <option value="m">m</option>
                        <option value="m²">m²</option>
                        <option value="un">un</option>
                        <option value="pt">pt</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                      Valor Unitário (R$)
                    </label>

                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                      value={!formData.valorUnitario ? '' : formatNumberBR(formData.valorUnitario)}
                      onChange={(e) => {
                        const numero = parseNumberBR(e.target.value);
                        setFormData({ ...formData, valorUnitario: numero });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                      Equipe Resp.
                    </label>

                    <input
                      placeholder="Ex: Equipe Alfa"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:border-zinc-900"
                      value={formData.equipeResponsavel}
                      onChange={(e) => setFormData({ ...formData, equipeResponsavel: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold uppercase tracking-widest"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                  >
                    Criar Atividade
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

const ActivityCard = memo(function ActivityCard({
  ativ,
  obra,
  onUpdate,
  onDelete,
  readOnly = false
}: {
  ativ: Atividade;
  obra?: Obra;
  onUpdate: (id: string, current: number, total: number) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const perc = Math.round(ativ.percentual || 0);

  const status =
    perc < 50
      ? 'Abaixo de 50%'
      : perc < 100
        ? 'Entre 50% e 99%'
        : 'Concluído';

  const colorClass =
    perc < 50
      ? 'bg-red-500'
      : perc < 100
        ? 'bg-amber-500'
        : 'bg-green-500';

  const badgeClass =
    perc < 50
      ? 'bg-red-50 text-red-600 border-red-100'
      : perc < 100
        ? 'bg-amber-50 text-amber-600 border-amber-100'
        : 'bg-green-50 text-green-600 border-green-100';

<<<<<<< HEAD
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Mantém o input sincronizado com o valor do banco apenas quando NÃO está
  // sendo editado. Durante a digitação o input é "não controlado" (lê do DOM),
  // então cada tecla é instantânea, sem re-render do React.
  useEffect(() => {
    if (!isEditing && inputRef.current) {
      inputRef.current.value = ativ.quantidadeExecutada
        ? formatNumberBR(ativ.quantidadeExecutada)
        : '';
=======
  const [executadoInput, setExecutadoInput] = useState(
    ativ.quantidadeExecutada ? formatNumberBR(ativ.quantidadeExecutada) : ''
  );

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setExecutadoInput(
        ativ.quantidadeExecutada ? formatNumberBR(ativ.quantidadeExecutada) : ''
      );
>>>>>>> 630441aa2b73e6e2882d07b0068219b71c1481e8
    }
  }, [ativ.quantidadeExecutada, isEditing]);

  const salvarExecutado = useCallback(() => {
<<<<<<< HEAD
    if (readOnly || !inputRef.current) return;

    const numero = parseNumberBR(inputRef.current.value);

    setIsEditing(false);
    inputRef.current.value = numero ? formatNumberBR(numero) : '';

    onUpdate(ativ.id, numero, ativ.quantidadePrevista);
  }, [readOnly, onUpdate, ativ.id, ativ.quantidadePrevista]);
=======
    if (readOnly) return;

    const numero = parseNumberBR(executadoInput);

    setIsEditing(false);
    setExecutadoInput(numero ? formatNumberBR(numero) : '');

    onUpdate(ativ.id, numero, ativ.quantidadePrevista);
  }, [readOnly, executadoInput, onUpdate, ativ.id, ativ.quantidadePrevista]);
>>>>>>> 630441aa2b73e6e2882d07b0068219b71c1481e8

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-zinc-100 transition-all flex flex-col gap-8 relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em]">
              ATIVIDADE
            </span>

            {obra && (
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100 uppercase tracking-tighter">
                {obra.nome}
              </span>
            )}
          </div>

          <h4 className="text-2xl font-black text-zinc-900 leading-tight pr-10">
            {ativ.descricao}
          </h4>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-zinc-500 font-medium leading-relaxed flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Equipe:
              <span className="font-bold text-zinc-800">
                {ativ.equipeResponsavel || 'Não atribuída'}
              </span>
            </p>

            <p className="text-sm text-zinc-400 font-medium flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              Meta Total:
              <span className="font-bold">
                {formatNumberBR(ativ.quantidadePrevista)} {ativ.unidade}
              </span>
            </p>

            <p className="text-sm text-zinc-400 font-medium flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" />
              Executado:
              <span className="font-bold text-zinc-900">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format((ativ.quantidadeExecutada || 0) * (ativ.valorUnitario || 0))}
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">
                / Orçado:{' '}
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(ativ.quantidadePrevista * (ativ.valorUnitario || 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full sm:w-32">
          <div className="text-center space-y-2 order-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              Executado ({ativ.unidade})
            </span>

            <input
<<<<<<< HEAD
              ref={inputRef}
=======
>>>>>>> 630441aa2b73e6e2882d07b0068219b71c1481e8
              type="text"
              inputMode="decimal"
              className={cn(
                'w-full py-4 border-2 border-zinc-100 rounded-3xl text-xl font-black text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors text-center shadow-lg',
                readOnly ? 'bg-zinc-50 cursor-not-allowed' : 'bg-white'
              )}
<<<<<<< HEAD
              defaultValue={ativ.quantidadeExecutada ? formatNumberBR(ativ.quantidadeExecutada) : ''}
              readOnly={readOnly}
              placeholder="0"
              onFocus={() => setIsEditing(true)}
              onInput={(e) => {
                // Sanitiza diretamente no DOM, sem disparar re-render do React.
                const el = e.currentTarget;
                const limpo = el.value.replace(/[^0-9.,]/g, '');
                if (el.value !== limpo) el.value = limpo;
=======
              value={executadoInput}
              readOnly={readOnly}
              placeholder="0"
              onFocus={() => setIsEditing(true)}
              onChange={(e) => {
                const valor = e.target.value.replace(/[^0-9.,]/g, '');
                setExecutadoInput(valor);
>>>>>>> 630441aa2b73e6e2882d07b0068219b71c1481e8
              }}
              onBlur={salvarExecutado}
              onKeyDown={(e) => {
                if (['-', '+', 'e', 'E'].includes(e.key)) {
                  e.preventDefault();
                }

                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
          </div>

          <div className="text-center space-y-2 order-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              Total ({ativ.unidade})
            </span>

            <div className="w-full py-4 bg-zinc-50 border border-zinc-100 rounded-3xl text-xl font-black text-zinc-900 shadow-inner">
              {formatNumberBR(ativ.quantidadePrevista)}
            </div>
          </div>

          <div className="text-center space-y-2 order-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              Resumo
            </span>

            <div className="px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-3xl text-xs font-black text-zinc-400 leading-tight">
              {formatNumberBR(ativ.quantidadeExecutada)}
              {' / '}
              <br />
              {formatNumberBR(ativ.quantidadePrevista)} {ativ.unidade}
            </div>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() => onDelete(ativ.id)}
            className="absolute top-8 right-8 p-2 text-zinc-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.1em] border-2',
              badgeClass
            )}
          >
            {status}
          </span>

          <span className="text-xs font-black text-zinc-400">
            {perc}%
          </span>
        </div>

        <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden shadow-inner">
          <div
            className={cn('h-full transition-all duration-1000 ease-out', colorClass)}
            style={{ width: `${Math.min(100, perc)}%` }}
          />
        </div>
      </div>
    </div>
  );
});