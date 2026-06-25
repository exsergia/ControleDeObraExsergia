import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { HashRouter as BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  auth,
  supabase,
  setCurrentUser,
  SupabaseUser,
  logOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from './lib/supabase';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, db, query, where } from './lib/supabaseDb';
import { useCollection } from './lib/supabaseHooks';
import { Operator } from './types';
import {
  LayoutDashboard,
  HardHat,
  Package,
  ClipboardCheck,
  Hammer,
  Truck,
  Users,
  FileText,
  Receipt,
  Boxes,
  LogOut,
  Menu,
  X,
  Settings,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle,
  AlertOctagon,
  DollarSign,
  Mail,
  Phone,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { requestNotificationPermission, sendBrowserNotification } from './lib/services';

const AuthContext = createContext<{
  user: SupabaseUser | null;
  userProfile: Operator | null;
  loading: boolean;
  isAdmin: boolean;
  isEncarregado: boolean;
  encarregadoObraIds: string[];
  notify: (type: 'error' | 'success' | 'info' | 'warning', title: string, message?: string) => void;
}>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  isEncarregado: false,
  encarregadoObraIds: [],
  notify: () => {},
});

export const useAuth = () => useContext(AuthContext);

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 8000, label = 'Operação'): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

// Pages - to be implemented
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Obras = React.lazy(() => import('./pages/Obras'));
const Materiais = React.lazy(() => import('./pages/Materiais'));
const Checklist = React.lazy(() => import('./pages/Checklist'));
const Operadores = React.lazy(() => import('./pages/Operadores'));
const Financeiro = React.lazy(() => import('./pages/Financeiro'));
const Relatorios = React.lazy(() => import('./pages/Relatorios'));
const Progresso = React.lazy(() => import('./pages/Progresso'));
const Ferramentas = React.lazy(() => import('./pages/Ferramentas'));
const Frota = React.lazy(() => import('./pages/Frota'));
const NotasFiscais = React.lazy(() => import('./pages/NotasFiscais'));
const Equipamentos = React.lazy(() => import('./pages/Equipamentos'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));

// E-mails autorizados a ver a aba de NF/Cupom Fiscal (financeiro).
const FISCAL_EMAILS = ['contasapagar@gmail.com', 'nascimentoerick446@gmail.com'];

interface Notification {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message?: string;
}

function NotificationToast({ notification, onClose, key }: { notification: Notification; onClose: () => void; key?: string }) {
  const bgColor = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }[notification.type];

  const Icon = {
    error: AlertOctagon,
    success: CheckCircle,
    info: Info,
    warning: AlertTriangle,
  }[notification.type];

  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={cn(
        "flex w-full max-w-sm pointer-events-auto border rounded-2xl shadow-xl overflow-hidden mb-3",
        bgColor
      )}
    >
      <div className="flex-1 p-4">
        <div className="flex items-start">
          <div className="shrink-0 pt-0.5">
            <Icon className="h-5 w-5" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-black tracking-tight">{notification.title}</p>
            {notification.message && <p className="mt-1 text-xs font-medium opacity-80 leading-relaxed">{notification.message}</p>}
          </div>
          <div className="ml-4 flex shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-md p-1 hover:bg-black/5 focus:outline-none transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [encarregadoObraIds, setEncarregadoObraIds] = useState<string[]>([]);

  const notify = (type: 'error' | 'success' | 'info' | 'warning', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, type, title, message }]);
  };

  const resolveUserProfile = async (u: SupabaseUser) => {
    setCurrentUser(u);
    setUser(u);

    try {
      const meta = u.user_metadata || {};
      const emailLower = (u.email || '').toLowerCase();
      const cpfLimpo = String(meta.cpf || '').replace(/\D/g, '');

      const opRef = doc(db, 'operadores', u.id);
      const encRef = doc(db, 'encarregados', u.id);

      // Todas as consultas em paralelo — reduz latência de login de 3 round-trips para 1
      const [adminEmailSnap, adminCpfSnap, opSnap, encSnap] = await withTimeout(
        Promise.all([
          emailLower ? getDoc(doc(db, 'admin_access', `email:${emailLower}`)) : Promise.resolve(null),
          cpfLimpo ? getDoc(doc(db, 'admin_access', `cpf:${cpfLimpo}`)) : Promise.resolve(null),
          getDoc(opRef),
          getDoc(encRef),
        ]),
        10000,
        'Consulta de perfil'
      );

      const emailAdminAtivo = adminEmailSnap?.exists()
        ? adminEmailSnap.data()?.ativo !== false
        : false;

      const cpfAdminAtivo = adminCpfSnap?.exists()
        ? adminCpfSnap.data()?.ativo !== false
        : false;

      const isAdminByRegistry = emailAdminAtivo || cpfAdminAtivo;
      const isEncarregadoByRegistry = !isAdminByRegistry && encSnap.exists() && encSnap.data()?.ativo !== false;

      if (isEncarregadoByRegistry) {
        const encData = encSnap.data();
        setUserProfile({
          id: u.id,
          nome: encData.nome || String(meta.nome || u.email?.split('@')[0] || 'Encarregado'),
          sobrenome: encData.sobrenome || String(meta.sobrenome || ''),
          telefone: encData.telefone || String(meta.telefone || ''),
          cpf: encData.cpf || cpfLimpo,
          email: encData.email || emailLower,
          funcao: encData.funcao || 'Encarregado de Obra',
          role: 'encarregado',
        });
        setEncarregadoObraIds(encData.obraIds || []);
      } else if (!opSnap.exists()) {
        const newProfile: Operator = {
          id: u.id,
          nome: String(meta.nome || meta.name || u.email?.split('@')[0] || 'Usuário'),
          sobrenome: String(meta.sobrenome || ''),
          telefone: String(meta.telefone || ''),
          cpf: cpfLimpo,
          email: emailLower,
          funcao: isAdminByRegistry ? 'Administrador' : 'Operador de Campo',
          role: isAdminByRegistry ? 'admin' : 'operator',
        };
        await withTimeout(setDoc(opRef, newProfile), 5000, 'Criação do perfil');
        setUserProfile(newProfile);
        setEncarregadoObraIds([]);
      } else {
        const data = opSnap.data() as Operator;
        const nextRole = isAdminByRegistry ? 'admin' : 'operator';
        const nextProfile = { ...data, role: nextRole } as Operator;
        if (data.role !== nextRole) {
          await withTimeout(updateDoc(opRef, { role: nextRole }), 5000, 'Atualização do perfil');
        }
        setUserProfile(nextProfile);
        setEncarregadoObraIds([]);
      }
    } catch (e) {
      console.error('Error fetching/registering user profile', e);
      setCurrentUser(null);
      setUser(null);
      setUserProfile(null);
      notify('error', 'Erro de conexão com Supabase', 'Verifique o arquivo .env, a URL, a chave publishable e se você rodou o schema.sql.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    withTimeout(supabase.auth.getSession(), 5000, 'Inicialização do Supabase')
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user || null;
        if (u) {
          resolveUserProfile(u);
        } else {
          setCurrentUser(null);
          setUser(null);
          setUserProfile(null);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Erro ao iniciar sessão Supabase', error);
        if (!mounted) return;
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        notify('error', 'Supabase não respondeu', 'Confira se o .env está correto e reinicie o npm run dev.');
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user || null;
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        if (u) { setCurrentUser(u); setUser(u); }
        setLoading(false);
        return;
      }

      if (u) {
        if (event === 'SIGNED_IN') {
          setLoading(true);
          resolveUserProfile(u);
        } else {
          setCurrentUser(u);
          setUser(u);
        }
      } else {
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const isEncarregado = userProfile?.role === 'encarregado';
  const canFiscal = userProfile?.role === 'operator' || FISCAL_EMAILS.includes((userProfile?.email || user?.email || '').toLowerCase());

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, isEncarregado, encarregadoObraIds, notify }}>
      <div className="relative">
        {/* Global Notifications Container */}
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end pointer-events-none w-full max-w-sm px-4">
          <AnimatePresence>
            {notifications.map(n => (
              <NotificationToast 
                key={n.id} 
                notification={n} 
                onClose={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
              />
            ))}
          </AnimatePresence>
        </div>

        {isRecovery ? (
          <NovaSenhaView
            notify={notify}
            onComplete={async () => {
              setIsRecovery(false);
              setUser(null);
              setUserProfile(null);
              setCurrentUser(null);
              await logOut();
            }}
          />
        ) : !user ? (
          <LoginView />
        ) : (
          <BrowserRouter>
            <RouteTracker />
            <OverdueToolsAlert />
            <ErrorBoundary>
              <Layout>
                <React.Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/obras" element={(isAdmin || isEncarregado) ? <Obras /> : <Navigate to="/" replace />} />
                    <Route path="/materiais" element={<Materiais />} />
                    <Route path="/checklist" element={(isAdmin || isEncarregado) ? <Checklist /> : <Navigate to="/" replace />} />
                    <Route path="/operadores" element={(isAdmin || isEncarregado) ? <Operadores /> : <Navigate to="/" replace />} />
                    <Route path="/financeiro" element={isAdmin ? <Financeiro /> : <Navigate to="/" replace />} />
                    <Route path="/relatorios" element={isAdmin ? <Relatorios /> : <Navigate to="/" replace />} />
                    <Route path="/progresso" element={<Progresso />} />
                    <Route path="/ferramentas" element={<Ferramentas />} />
                    <Route path="/frota" element={<Frota />} />
                    <Route path="/equipamentos" element={isAdmin ? <Equipamentos /> : <Navigate to="/" replace />} />
                    <Route path="/notas-fiscais" element={canFiscal ? <NotasFiscais /> : <Navigate to="/" replace />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
              </Layout>
            </ErrorBoundary>
          </BrowserRouter>
        )}
      </div>
    </AuthContext.Provider>
  );
}

// Alerta global de ferramentas em atraso: dispara UMA vez quando o usuário entra
// no app (em qualquer página), avisando sobre as ferramentas dele fora do prazo.
// Fica montado dentro da área autenticada, então roda a cada login/refresh.
function OverdueToolsAlert() {
  const { userProfile, user, notify } = useAuth();
  const meuId = userProfile?.id || user?.id || '';
  const [logsSnap] = useCollection(
    meuId ? query(collection(db, 'toolLogs'), where('responsavelId', '==', meuId)) : null
  );
  const alertedRef = useRef(false);

  useEffect(() => {
    if (alertedRef.current || !logsSnap) return;
    const now = Date.now();
    const atrasados = (logsSnap.docs || [])
      .map((d: any) => d.data())
      .filter((l: any) =>
        l?.statusLog === 'Aberta' &&
        l?.previsaoDevolucao &&
        new Date(l.previsaoDevolucao).getTime() < now
      );
    if (atrasados.length === 0) return;

    alertedRef.current = true; // garante 1 alerta por entrada no app
    const n = atrasados.length;
    notify(
      'warning',
      'Ferramenta em atraso',
      `Você tem ${n} ferramenta(s) fora do prazo de devolução. Renove ou devolva o quanto antes.`
    );
    sendBrowserNotification(
      'Ferramenta em atraso',
      `Você tem ${n} ferramenta(s) fora do prazo. Renove ou devolva.`
    );
  }, [logsSnap, notify]);

  return null;
}

const LAST_ROUTE_KEY = 'last-route';

function RouteTracker() {
  const location = useLocation();
  const navigate = useNavigate();

  // Ao montar, se o app abriu na raiz mas havia uma rota salva, restaura.
  // Cobre tanto o refresh quanto reabrir o navegador (localStorage persiste).
  useEffect(() => {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved && saved !== '/' && location.pathname === '/') {
      navigate(saved, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva a rota atual (incluindo a Dashboard) sempre que ela muda.
  useEffect(() => {
    localStorage.setItem(LAST_ROUTE_KEY, location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}

// Versão do termo aceito — incrementar quando o texto do termo mudar
const TERMO_LGPD_VERSAO = 'v1';

function TermoLGPDModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  const [podeAceitar, setPodeAceitar] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPodeAceitar(false);
    // Se o conteúdo couber sem rolagem, libera o aceite direto
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setPodeAceitar(true);
  }, [open]);

  if (!open) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setPodeAceitar(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Termo de Uso e Privacidade (LGPD)</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-5 text-sm text-slate-600 leading-relaxed space-y-3"
        >
          <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Documento provisório — sujeito a alterações</p>

          <p><strong>1. Aceite e Objeto.</strong> Ao criar uma conta e utilizar o aplicativo Controle de Obras Exsergia ("Aplicativo"), você declara ter lido, compreendido e concordado com este Termo de Uso e com a Política de Privacidade, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).</p>

          <p><strong>2. Dados Coletados.</strong> Para o funcionamento do serviço, coletamos e tratamos dados pessoais como nome, sobrenome, e-mail, telefone e CPF, além de dados operacionais inseridos no uso do Aplicativo (obras, materiais, atividades, fotos, registros de ferramentas e checklists).</p>

          <p><strong>3. Finalidade do Tratamento.</strong> Os dados são utilizados exclusivamente para autenticação, identificação do usuário, controle operacional das obras, rastreabilidade das atividades e geração de relatórios gerenciais. Não comercializamos seus dados pessoais.</p>

          <p><strong>4. Compartilhamento.</strong> Os dados são armazenados em infraestrutura de nuvem (Supabase) e podem ser acessados por usuários autorizados da organização conforme o nível de permissão. Não há compartilhamento com terceiros para fins de marketing.</p>

          <p><strong>5. Segurança.</strong> Adotamos medidas técnicas e administrativas para proteger os dados, incluindo controle de acesso, criptografia em trânsito (HTTPS) e regras de segurança no banco de dados.</p>

          <p><strong>6. Direitos do Titular.</strong> Você pode, a qualquer momento, solicitar acesso, correção, portabilidade ou exclusão dos seus dados pessoais, bem como revogar este consentimento, mediante contato com o responsável pelo tratamento na organização.</p>

          <p><strong>7. Retenção.</strong> Os dados serão mantidos pelo período necessário ao cumprimento das finalidades e das obrigações legais aplicáveis.</p>

          <p><strong>8. Consentimento.</strong> Ao confirmar o aceite abaixo, você consente livre e expressamente com o tratamento dos seus dados pessoais nos termos aqui descritos.</p>

          <p className="text-slate-400">Este é um texto provisório e será substituído pela versão oficial do termo. Em caso de dúvidas, procure o responsável pela área.</p>

          <p className="text-[11px] text-slate-400">— Fim do documento —</p>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          {!podeAceitar && (
            <p className="text-[11px] text-amber-600 font-medium mb-2 text-center">
              Role o texto até o final para habilitar o aceite.
            </p>
          )}
          <button
            type="button"
            disabled={!podeAceitar}
            onClick={onAccept}
            className="w-full h-12 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-5 h-5" /> Li e aceito o termo
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginView() {
  const [mode, setMode] = useState<'login' | 'cadastro' | 'recuperar'>('login');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [recuperarInput, setRecuperarInput] = useState('');
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [loadingRecuperar, setLoadingRecuperar] = useState(false);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarTermo, setMostrarTermo] = useState(false);
  const [aceitouTermo, setAceitouTermo] = useState(false);

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = recuperarInput.trim();
    if (!input) { alert('Informe seu e-mail, CPF ou celular.'); return; }

    setLoadingRecuperar(true);
    try {
      let emailTarget = '';

      if (input.includes('@')) {
        emailTarget = input.toLowerCase();
      } else {
        const digits = input.replace(/\D/g, '');
        const cpfSnap = await getDoc(doc(db, 'cpfs', digits));
        if (cpfSnap.exists()) {
          emailTarget = cpfSnap.data()?.email || '';
        } else {
          const opSnap = await getDocs(collection(db, 'operadores'));
          const match = opSnap.docs.find(d => {
            const data = d.data() as any;
            return (data.telefone || '').replace(/\D/g, '') === digits;
          });
          if (match) emailTarget = (match.data() as any).email;
        }
      }

      if (!emailTarget) {
        alert('Nenhuma conta encontrada com esse dado. Verifique e tente novamente.');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(emailTarget, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
      setRecuperarEnviado(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar link de recuperação.');
    } finally {
      setLoadingRecuperar(false);
    }
  };

  const somenteNumeros = (value: string) => value.replace(/\D/g, '');

  const formatarCpf = (value: string) => {
    const digits = somenteNumeros(value).slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatarTelefone = (value: string) => {
    const digits = somenteNumeros(value).slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleCadastro = async (event: React.FormEvent) => {
    event.preventDefault();

    const cpfLimpo = somenteNumeros(cpf);
    const emailLimpo = email.trim().toLowerCase();

    if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !emailLimpo || !cpfLimpo || !senha) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    if (cpfLimpo.length !== 11) {
      alert('Informe um CPF com 11 números.');
      return;
    }

    if (senha.length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      alert('As senhas não conferem.');
      return;
    }

    if (!aceitouTermo) {
      alert('Para criar a conta, abra e aceite o Termo de Uso e Privacidade (LGPD).');
      setMostrarTermo(true);
      return;
    }

    setLoadingAuth(true);
    try {
      const cpfRef = doc(db, 'cpfs', cpfLimpo);
      const cpfSnap = await getDoc(cpfRef);

      if (cpfSnap.exists()) {
        alert('Este CPF já está cadastrado. Faça login ou use outro CPF.');
        return;
      }

      // Cadastro também já loga: começa no Dashboard.
      localStorage.removeItem(LAST_ROUTE_KEY);
      const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha, {
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        telefone: somenteNumeros(telefone),
        cpf: cpfLimpo,
      });

      const perfil: Operator = {
        id: cred.user.id,
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        telefone: somenteNumeros(telefone),
        cpf: cpfLimpo,
        email: emailLimpo,
        funcao: 'Operador de Campo',
        role: 'operator',
        lgpdAceite: { versao: TERMO_LGPD_VERSAO, data: new Date().toISOString() },
      };

      await setDoc(doc(db, 'operadores', cred.user.id), perfil);
      await setDoc(cpfRef, {
        uid: cred.user.id,
        email: emailLimpo,
      });
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/email-already-in-use') {
        alert('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
      } else if (code === 'auth/invalid-email') {
        alert('Informe um e-mail válido.');
      } else if (code === 'auth/weak-password') {
        alert('A senha é muito fraca. Use pelo menos 6 caracteres.');
      } else {
        alert(error?.message || 'Erro ao cadastrar usuário.');
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!login.trim() || !senha) {
      alert('Informe e-mail/CPF e senha.');
      return;
    }

    setLoadingAuth(true);
    try {
      let emailLogin = login.trim().toLowerCase();

      if (!emailLogin.includes('@')) {
        const digits = somenteNumeros(emailLogin);

        // 1. Tabela cpfs (cadastro via app)
        const cpfSnap = await getDoc(doc(db, 'cpfs', digits));
        if (cpfSnap.exists()) {
          emailLogin = cpfSnap.data()?.email || '';
        } else {
          // 2. Busca direta em operadores por CPF ou telefone (admin-created users)
          const opSnap = await getDocs(collection(db, 'operadores'));
          const match = opSnap.docs.find(d => {
            const data = d.data() as any;
            return (data.cpf || '').replace(/\D/g, '') === digits ||
                   (data.telefone || '').replace(/\D/g, '') === digits;
          });
          if (match) {
            emailLogin = (match.data() as any).email;
          } else {
            alert('CPF, celular ou e-mail não encontrado. Verifique os dados ou faça o cadastro.');
            return;
          }
        }
      }

      // Login novo sempre começa no Dashboard (não restaura a rota do uso anterior).
      localStorage.removeItem(LAST_ROUTE_KEY);
      await signInWithEmailAndPassword(auth, emailLogin, senha);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        alert('Login ou senha inválidos.');
      } else if (code === 'auth/invalid-email') {
        alert('Informe um e-mail ou CPF válido.');
      } else {
        alert(error?.message || 'Erro ao fazer login.');
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 font-sans">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white border-r border-slate-800">
        <div>
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <HardHat className="text-white w-5 h-5 shadow-sm" />
            </div>
            EXSERGIA
          </div>
        </div>
        <div>
          <h1 className="text-5xl font-black tracking-tighter mb-6">
            EXSERGIA HUB
          </h1>
          <p className="text-slate-400 max-w-md text-lg leading-relaxed font-medium">
            Centralize materiais, conferência de campo, avanço de mão de obra e integração financeira em um único lugar.
          </p>
        </div>
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
          &copy; 2024 Exsergia Tecnologia em Engenharia
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white lg:bg-slate-50">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
              <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center">
                <HardHat className="text-white w-5 h-5" />
              </div>
              EXSERGIA
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Bem-vindo ao Sistema' : mode === 'recuperar' ? 'Recuperar senha' : 'Criar novo usuário'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {mode === 'login'
                ? 'Entre com e-mail ou CPF para acessar o painel'
                : mode === 'recuperar'
                ? 'Enviaremos um link de redefinição para o seu e-mail'
                : 'Preencha os dados abaixo para cadastrar seu acesso'}
            </p>
          </div>

          {mode === 'recuperar' ? (
            recuperarEnviado ? (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Link enviado!</p>
                  <p className="text-sm text-slate-500 mt-1">Verifique sua caixa de entrada e clique no link para criar uma nova senha.</p>
                </div>
                <button
                  onClick={() => { setMode('login'); setRecuperarEnviado(false); setRecuperarInput(''); }}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecuperar} className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">Informe seu e-mail, CPF ou número de celular cadastrado.</p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={recuperarInput}
                    onChange={(e) => setRecuperarInput(e.target.value)}
                    placeholder="E-mail, CPF ou celular"
                    className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingRecuperar}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingRecuperar ? 'Enviando...' : <><Mail className="w-4 h-4" /> Enviar link de recuperação</>}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full flex items-center justify-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>
              </form>
            )
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="E-mail, CPF ou celular"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loadingAuth}
                className="w-full h-12 flex items-center justify-center bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingAuth ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => setMode('recuperar')}
                className="w-full text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors text-right"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleCadastro} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome"
                  className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  value={sobrenome}
                  onChange={(e) => setSobrenome(e.target.value)}
                  placeholder="Sobrenome"
                  className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <input
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="Telefone"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                placeholder="CPF"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Confirmar senha"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {aceitouTermo ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-green-700">
                    <CheckCircle className="w-4 h-4 shrink-0" /> Termo de Uso e Privacidade aceito
                  </span>
                  <button type="button" onClick={() => setMostrarTermo(true)} className="text-[11px] text-green-700 underline shrink-0">
                    Reler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarTermo(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 p-3 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <FileText className="w-4 h-4" /> Abrir e aceitar o Termo de Uso e Privacidade (LGPD)
                </button>
              )}

              <button
                type="submit"
                disabled={loadingAuth || !aceitouTermo}
                className="w-full h-12 flex items-center justify-center bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingAuth ? 'Cadastrando...' : 'Cadastrar usuário'}
              </button>
            </form>
          )}

          <TermoLGPDModal
            open={mostrarTermo}
            onClose={() => setMostrarTermo(false)}
            onAccept={() => { setAceitouTermo(true); setMostrarTermo(false); }}
          />

          {mode !== 'recuperar' && (
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'cadastro' : 'login')}
              className="w-full text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {mode === 'login' ? 'Criar cadastro padrão' : 'Já tenho cadastro. Fazer login'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function NovaSenhaView({ onComplete, notify }: { onComplete: () => void; notify: (type: 'error' | 'success' | 'info' | 'warning', title: string, message?: string) => void }) {
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loadingSave, setLoadingSave] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) { alert('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmar) { alert('As senhas não conferem.'); return; }

    setLoadingSave(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      notify('success', 'Senha alterada!', 'Sua nova senha foi salva. Faça login para continuar.');
      onComplete();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar nova senha.');
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 font-sans">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white border-r border-slate-800">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <HardHat className="text-white w-5 h-5" />
          </div>
          EXSERGIA
        </div>
        <div>
          <h1 className="text-5xl font-black tracking-tighter mb-6">CRIE SUA<br />NOVA SENHA.</h1>
          <p className="text-slate-400 max-w-md text-lg leading-relaxed font-medium">
            Escolha uma senha segura para proteger o acesso ao sistema.
          </p>
        </div>
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
          &copy; 2024 Exsergia Tecnologia em Engenharia
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-white lg:bg-slate-50">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
              <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center">
                <HardHat className="text-white w-5 h-5" />
              </div>
              EXSERGIA
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Criar nova senha</h2>
            <p className="text-slate-500 text-sm font-medium">Digite e confirme sua nova senha de acesso</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar nova senha"
              className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loadingSave}
              className="w-full h-12 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingSave ? 'Salvando...' : <><KeyRound className="w-4 h-4" /> Salvar nova senha</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ComingSoonPage() {
  return (
    <div className="min-h-[calc(100vh-7rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-sm p-8 text-center">
        <img
          src="/em-breve-exsergia.png"
          alt="Exsergia"
          className="w-44 h-44 sm:w-56 sm:h-56 object-cover rounded-3xl mx-auto shadow-lg border border-slate-100"
        />
        <h2 className="mt-8 text-3xl font-black tracking-tight text-slate-900">
          Disponível em Breve
        </h2>
        <p className="mt-3 text-sm font-medium text-slate-500 leading-relaxed">
          Este módulo está em desenvolvimento. Por enquanto, utilize os módulos Dashboard, Obras, Checklist Diário, Operadores, Progresso Físico e Ferramentas.
        </p>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center p-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Carregando...</span>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { userProfile, user, isAdmin, isEncarregado } = useAuth();
  const canFiscal = userProfile?.role === 'operator' || FISCAL_EMAILS.includes((userProfile?.email || user?.email || '').toLowerCase());

  const menuItems: {
    label: string; icon: any; path: string;
    adminOnly?: boolean; soAdmin?: boolean; fiscalOnly?: boolean;
  }[] = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Obras', icon: HardHat, path: '/obras', adminOnly: true },
    { label: 'Materiais', icon: Package, path: '/materiais' },
    { label: 'Checklist Diário', icon: ClipboardCheck, path: '/checklist', adminOnly: true },
    { label: 'Operadores', icon: Users, path: '/operadores', adminOnly: true },
    { label: 'Progresso Físico', icon: Activity, path: '/progresso' },
    { label: 'Financeiro', icon: DollarSign, path: '/financeiro', adminOnly: true, soAdmin: true },
    { label: 'Relatórios', icon: FileText, path: '/relatorios', adminOnly: true, soAdmin: true },
    { label: 'Ferramentas', icon: Hammer, path: '/ferramentas' },
    { label: 'Controle de Frota', icon: Truck, path: '/frota' },
    { label: 'Equipamentos', icon: Boxes, path: '/equipamentos', adminOnly: true, soAdmin: true },
    { label: 'NF / Cupom Fiscal', icon: Receipt, path: '/notas-fiscais', fiscalOnly: true },
    { label: 'Configurações', icon: Settings, path: '/settings' },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.fiscalOnly) return canFiscal;     // só os e-mails autorizados (independe do papel)
    if (isAdmin) return true;
    if (isEncarregado) return !item.soAdmin;  // encarregado vê tudo exceto financeiro e relatórios
    return !item.adminOnly;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-12 flex items-center px-4 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold tracking-tighter text-white">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <HardHat className="text-white w-3.5 h-3.5" />
            </div>
            EXSERGIA HUB
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-2 tracking-wider">Módulos</div>
          {filteredMenuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all group",
                  active 
                    ? "bg-blue-600/10 text-blue-400 border-l-2 border-blue-500" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-blue-400" : "text-slate-600 group-hover:text-slate-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 p-2 rounded bg-slate-800/40 border border-slate-800 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-600 relative">
              {auth.currentUser?.user_metadata?.avatar_url ? (
                <img src={auth.currentUser.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Users className="text-slate-400 w-4 h-4" />
              )}
              {isAdmin && (
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-0.5" title="Administrador">
                  <ShieldCheck className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                {userProfile?.nome} {userProfile?.sobrenome}
              </p>
              <p className="text-[9px] text-slate-500 truncate font-mono uppercase tracking-tighter">
                {({ admin: 'Administrador', encarregado: 'Encarregado', operator: 'Operador' }[userProfile?.role || ''] || 'Visitante')}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => logOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1 -ml-1 lg:hidden text-slate-600 hover:bg-slate-100 rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Painel'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Sistema Online</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
