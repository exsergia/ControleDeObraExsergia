import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, HardHat, Package, ClipboardCheck, Users, Activity,
  DollarSign, FileText, Hammer, Truck, Boxes, Receipt, Settings,
  X, HelpCircle, CheckCircle2,
} from 'lucide-react';

// Sobe a versão para reapresentar os introdutórios depois de mudar o conteúdo.
const INTRO_VERSION = 'v1';

type Intro = { title: string; icon: React.ComponentType<any>; resumo: string; itens: string[] };

// Introdutório de CADA aba — explica o que é a tela e o que dá pra fazer nela.
const INTROS: Record<string, Intro> = {
  '/': {
    title: 'Dashboard',
    icon: LayoutDashboard,
    resumo: 'Sua visão geral da operação assim que entra no app.',
    itens: [
      'Saudação e o papel com que você está logado (Operador, Encarregado ou Administrador).',
      'Indicadores do dia: obras, materiais, ferramentas e progresso, em cartões.',
      'Gráfico de "Entregas da Semana" (materiais) e de "Progresso Geral" (% de mão de obra).',
      'Lista das últimas entregas registradas.',
      'É a tela inicial — use-a pra ter o panorama antes de entrar nas áreas.',
    ],
  },
  '/obras': {
    title: 'Cadastro de Obras',
    icon: HardHat,
    resumo: 'Onde as obras nascem e onde você define a equipe de cada uma.',
    itens: [
      'Cadastre e edite obras: nome, cliente, endereço, centro de custo e status.',
      'Abra uma obra para ver 3 abas: Progresso, Equipe Atribuída e Informações.',
      'Em "Equipe Atribuída" você escolhe os operadores daquela obra — essa lista é usada em outras telas (Checklist, Lançamento Fiscal).',
      'Na aba Progresso dá pra cadastrar atividades e acompanhar o avanço por serviço.',
      'Acesso: Administrador e Encarregado.',
    ],
  },
  '/materiais': {
    title: 'Materiais Entregues',
    icon: Package,
    resumo: 'Controle de tudo que chega nas obras.',
    itens: [
      'Registre cada entrega: descrição, categoria, quantidade, fornecedor, valor e foto.',
      'Cada entrega ganha um código e um status de conferência: Conferido, Divergente ou Pendente.',
      'Busque por material, código ou fornecedor.',
      'Os valores aparecem apenas para quem tem acesso financeiro.',
    ],
  },
  '/checklist': {
    title: 'Checklist Diário',
    icon: ClipboardCheck,
    resumo: 'A rotina de campo do dia, em 4 passos guiados.',
    itens: [
      'Passo 1: escolha a obra que está acompanhando hoje.',
      'Passo 2: confira os materiais recebidos (quantidades recebidas e conferidas).',
      'Passo 3: marque quem está trabalhando na obra agora.',
      'Passo 4: lance o quanto foi executado de cada serviço no dia.',
      'Use todo dia — é o que alimenta o progresso e a presença da equipe.',
      'Acesso: Administrador e Encarregado.',
    ],
  },
  '/operadores': {
    title: 'Gerenciar Equipe',
    icon: Users,
    resumo: 'Cadastro de operadores de campo e encarregados de obra.',
    itens: [
      'Duas tabelas separadas: operadores de campo e encarregados.',
      'Cadastre, edite dados, função e acesso de cada pessoa.',
      'Importante: cadastrar aqui NÃO cria o login — a pessoa cria a própria conta com o mesmo e-mail.',
      'Acesso: Administrador e Encarregado.',
    ],
  },
  '/progresso': {
    title: 'Mão de Obra e Progresso Físico',
    icon: Activity,
    resumo: 'Acompanhamento da execução e produtividade de cada serviço.',
    itens: [
      'Veja cada atividade com previsto x executado e o percentual concluído.',
      'Adicione atividades e atualize o quanto já foi feito.',
      'Filtre por obra e busque pela atividade.',
      'Operador visualiza; Administrador e Encarregado editam.',
    ],
  },
  '/financeiro': {
    title: 'Painel Financeiro',
    icon: DollarSign,
    resumo: 'Consolidação de custos e auditoria das entregas de materiais.',
    itens: [
      'Veja o total consolidado de custos.',
      'Acompanhe materiais conferidos x pendentes.',
      'Auditoria das entregas para fechar valores.',
      'Acesso: somente Administrador.',
    ],
  },
  '/relatorios': {
    title: 'Relatórios',
    icon: FileText,
    resumo: 'Relatórios e indicadores gerenciais do que acontece em campo.',
    itens: [
      'Checklists diários, ferramentas, frota e indicadores gerais.',
      'Selecione um relatório na lista para ver os detalhes completos.',
      'Útil pra prestar contas e analisar a operação por obra.',
      'Acesso: somente Administrador.',
    ],
  },
  '/ferramentas': {
    title: 'Gestão de Ferramentas',
    icon: Hammer,
    resumo: 'Controle de retirada e devolução de equipamentos, com foto e QR.',
    itens: [
      'Escaneie o QR code para retirar ou devolver rápido.',
      'Na retirada você informa a obra e por quantos dias vai usar; na devolução, foto do estado é obrigatória.',
      'Acompanhe o tempo de uso e o selo de "Atraso"; renove o prazo quando precisar.',
      'Você recebe aviso quando uma ferramenta sua passa do prazo de devolução.',
    ],
  },
  '/frota': {
    title: 'Controle de Frota',
    icon: Truck,
    resumo: 'Retirada e devolução de veículos com foto e localização.',
    itens: [
      'Mesma lógica das Ferramentas, agora para veículos.',
      'Foto do painel obrigatória e geolocalização na retirada e na devolução.',
      'Registre avarias do veículo.',
      'Histórico de quem usou cada veículo.',
    ],
  },
  '/equipamentos': {
    title: 'Equipamentos',
    icon: Boxes,
    resumo: 'Cada máquina como um centro de custo e receita.',
    itens: [
      'Cadastre o ativo (nome, código, categoria, valor de aquisição, status, foto).',
      'Lance manutenções (mão de obra, peças e outros custos) e locações/receitas.',
      'Veja KPIs por ativo: receita, custo de manutenção, resultado e margem.',
      'Gráfico de custo × receita e rankings (mais lucrativos / maior custo).',
      'Use o status para sinalizar quando o equipamento está Em Manutenção, Locado, etc.',
      'Acesso: somente Administrador.',
    ],
  },
  '/notas-fiscais': {
    title: 'NF / Cupom Fiscal',
    icon: Receipt,
    resumo: 'Lançamento de notas e cupons das compras feitas em campo.',
    itens: [
      'Foto do documento é obrigatória e tirada na hora pela câmera.',
      'Informe tipo (NF ou Cupom), valor, data, fornecedor e os 4 últimos dígitos do cartão.',
      'Vincule o lançamento à obra.',
      'Marque quem estava presente — a lista mostra só a equipe daquela obra.',
      'Acesso restrito a usuários autorizados.',
    ],
  },
  '/settings': {
    title: 'Configurações',
    icon: Settings,
    resumo: 'Suas preferências e segurança da conta.',
    itens: [
      'Ative as notificações push neste aparelho.',
      'Altere sua senha.',
      'Administradores autorizados gerenciam quem é admin (adicionar, ativar, remover).',
    ],
  },
};

export function PageIntro() {
  const location = useLocation();
  const path = location.pathname;
  const intro = INTROS[path];
  const [open, setOpen] = useState(false);

  const storageKey = `intro-seen-${INTRO_VERSION}:${path}`;

  // Abre automaticamente apenas na 1ª visita de cada página.
  useEffect(() => {
    if (!intro) { setOpen(false); return; }
    let seen = false;
    try { seen = localStorage.getItem(`intro-seen-${INTRO_VERSION}:${path}`) === '1'; } catch {}
    setOpen(!seen);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!intro) return null;

  const fechar = () => {
    try { localStorage.setItem(storageKey, '1'); } catch {}
    setOpen(false);
  };

  const Icon = intro.icon;

  return (
    <>
      {/* Botão de ajuda flutuante — reabre o introdutório da página atual.
          z abaixo dos modais (z-50) para não cobrir telas em uso. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="O que é esta tela?"
        aria-label="O que é esta tela?"
        className="fixed bottom-4 left-4 z-30 w-11 h-11 rounded-full bg-zinc-900 text-white shadow-lg flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition-all"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm" onClick={fechar}>
          <div
            className="bg-white w-full sm:max-w-md rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Introdução</p>
                    <h3 className="text-lg font-bold text-zinc-900 leading-tight">{intro.title}</h3>
                  </div>
                </div>
                <button type="button" onClick={fechar} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <p className="text-sm text-zinc-600">{intro.resumo}</p>

              <ul className="space-y-2">
                {intro.itens.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>

              <button type="button" onClick={fechar} className="w-full py-3 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all active:scale-95">
                Entendi
              </button>
              <p className="text-[11px] text-zinc-400 text-center flex items-center justify-center gap-1">
                Pode reabrir depois no botão <HelpCircle className="w-3 h-3 inline" /> no canto da tela.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
