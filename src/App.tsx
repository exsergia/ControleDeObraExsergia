import React, { useState, useEffect, useContext, createContext } from 'react';
import { HashRouter as BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  auth,
  supabase,
  setCurrentUser,
  SupabaseUser,
  logOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from './lib/supabase';
import { doc, getDoc, setDoc, updateDoc, db } from './lib/supabaseDb';
import { Operator } from './types';
import {
  LayoutDashboard,
  HardHat,
  Package,
  ClipboardCheck,
  Hammer,
  Users,
  FileText,
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
  Layers,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { requestNotificationPermission } from './lib/services';

const AuthContext = createContext<{
  user: SupabaseUser | null;
  userProfile: Operator | null;
  loading: boolean;
  isAdmin: boolean;
  notify: (type: 'error' | 'success' | 'info' | 'warning', title: string, message?: string) => void;
}>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
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
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const Atividades = React.lazy(() => import('./pages/Atividades'));

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
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

      const [adminEmailSnap, adminCpfSnap] = await withTimeout(
        Promise.all([
          emailLower ? getDoc(doc(db, 'admin_access', `email:${emailLower}`)) : Promise.resolve(null),
          cpfLimpo ? getDoc(doc(db, 'admin_access', `cpf:${cpfLimpo}`)) : Promise.resolve(null),
        ]),
        8000,
        'Consulta de perfil no Supabase'
      );

      const emailAdminAtivo = adminEmailSnap?.exists()
        ? adminEmailSnap.data()?.ativo !== false
        : false;

      const cpfAdminAtivo = adminCpfSnap?.exists()
        ? adminCpfSnap.data()?.ativo !== false
        : false;

      const isAdminByRegistry = emailAdminAtivo || cpfAdminAtivo;

      const opRef = doc(db, 'operadores', u.id);
      const opSnap = await withTimeout(getDoc(opRef), 8000, 'Consulta do operador no Supabase');

      if (!opSnap.exists()) {
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
        await withTimeout(setDoc(opRef, newProfile), 8000, 'Criação do perfil no Supabase');
        setUserProfile(newProfile);
      } else {
        const data = opSnap.data() as Operator;
        const nextRole = isAdminByRegistry ? 'admin' : 'operator';
        const nextProfile = { ...data, role: nextRole } as Operator;
        if (data.role !== nextRole) {
          await withTimeout(updateDoc(opRef, { role: nextRole }), 8000, 'Atualização do perfil no Supabase');
        }
        setUserProfile(nextProfile);
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      if (!mounted) return;
      if (u) {
        setLoading(true);
        resolveUserProfile(u);
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

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, notify }}>
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

        {!user ? (
          <LoginView />
        ) : (
          <BrowserRouter>
            <Layout>
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/obras" element={isAdmin ? <Obras /> : <Navigate to="/" replace />} />
                  <Route path="/materiais" element={<Materiais />} />
                  <Route path="/checklist" element={isAdmin ? <Checklist /> : <Navigate to="/" replace />} />
                  <Route path="/operadores" element={isAdmin ? <Operadores /> : <Navigate to="/" replace />} />
                  <Route path="/financeiro" element={isAdmin ? <Financeiro /> : <Navigate to="/" replace />} />
                  <Route path="/relatorios" element={<Relatorios />} />
                  <Route path="/progresso" element={<Progresso />} />
                  <Route path="/ferramentas" element={<Ferramentas />} />
                  <Route path="/atividades" element={isAdmin ? <Atividades /> : <Navigate to="/" replace />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
            </Layout>
          </BrowserRouter>
        )}
      </div>
    </AuthContext.Provider>
  );
}

function LoginView() {
  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

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

    setLoadingAuth(true);
    try {
      const cpfRef = doc(db, 'cpfs', cpfLimpo);
      const cpfSnap = await getDoc(cpfRef);

      if (cpfSnap.exists()) {
        alert('Este CPF já está cadastrado. Faça login ou use outro CPF.');
        return;
      }

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
        const cpfLimpo = somenteNumeros(emailLogin);
        const cpfSnap = await getDoc(doc(db, 'cpfs', cpfLimpo));

        if (!cpfSnap.exists()) {
          alert('CPF não encontrado. Verifique o número ou faça o cadastro.');
          return;
        }

        emailLogin = cpfSnap.data().email;
      }

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
            CONTROLE DE OBRA <br /> DE ALTA PRECISÃO.
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
              {mode === 'login' ? 'Bem-vindo ao Sistema' : 'Criar novo usuário'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {mode === 'login'
                ? 'Entre com e-mail ou CPF para acessar o painel'
                : 'Preencha os dados abaixo para cadastrar seu acesso'}
            </p>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="E-mail ou CPF"
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
              <button
                type="submit"
                disabled={loadingAuth}
                className="w-full h-12 flex items-center justify-center bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingAuth ? 'Cadastrando...' : 'Cadastrar usuário'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'cadastro' : 'login')}
            className="w-full text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {mode === 'login' ? 'Criar cadastro padrão' : 'Já tenho cadastro. Fazer login'}
          </button>
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
  const { userProfile, isAdmin } = useAuth();
 
  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Obras', icon: HardHat, path: '/obras', adminOnly: true },
    { label: 'Materiais', icon: Package, path: '/materiais' },
    { label: 'Checklist Diário', icon: ClipboardCheck, path: '/checklist', adminOnly: true },
    { label: 'Operadores', icon: Users, path: '/operadores', adminOnly: true },
    { label: 'Atividades', icon: Layers, path: '/atividades', adminOnly: true },
    { label: 'Progresso Físico', icon: Activity, path: '/progresso' },
    { label: 'Financeiro', icon: DollarSign, path: '/financeiro', adminOnly: true },
    { label: 'Relatórios', icon: FileText, path: '/relatorios' },
    { label: 'Ferramentas', icon: Hammer, path: '/ferramentas' },
    { label: 'Configurações', icon: Settings, path: '/settings' },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (isAdmin) return true;
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
            EXSERGIA
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
                {userProfile?.role || 'Visitante'}
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
