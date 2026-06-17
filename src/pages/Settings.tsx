import React, { useState } from 'react';
import { Bell, Save, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { requestNotificationPermission, sendBrowserNotification } from '../lib/services';
import { changePassword } from '../lib/supabase';
import { useAuth } from '../App';

export default function Settings() {
  const { notify } = useAuth();
  const [notifications, setNotifications] = useState({
    materials: true,
    checklist: true,
    financial: false,
    updates: true
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    requestNotificationPermission();
    sendBrowserNotification('Configurações Salvas', 'Suas preferências de notificação foram atualizadas.');
    notify('success', 'Preferências Salvas', 'Suas configurações de sistema foram atualizadas com sucesso.');
  };

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      notify('error', 'Campos obrigatórios', 'Preencha todos os campos para alterar a senha.');
      return;
    }
    if (novaSenha.length < 6) {
      notify('error', 'Senha muito curta', 'A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      notify('error', 'Senhas não conferem', 'A nova senha e a confirmação precisam ser iguais.');
      return;
    }
    if (novaSenha === senhaAtual) {
      notify('error', 'Senha repetida', 'A nova senha precisa ser diferente da atual.');
      return;
    }
    setSalvandoSenha(true);
    try {
      await changePassword(senhaAtual, novaSenha);
      notify('success', 'Senha alterada!', 'Sua senha foi atualizada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err: any) {
      notify('error', 'Erro ao alterar senha', err?.message || 'Não foi possível alterar a senha.');
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Configurações</h2>
        <p className="text-zinc-500 text-sm">Gerencie suas preferências de sistema e notificações.</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold text-zinc-900 uppercase tracking-widest text-xs">Notificações Push</h3>
          </div>
        </div>
        
        <div className="divide-y divide-zinc-100">
          <NotificationItem 
            title="Entrada de Materiais" 
            desc="Receba avisos quando novos materiais forem registrados em qualquer obra."
            active={notifications.materials}
            onClick={() => handleToggle('materials')}
          />
          <NotificationItem 
            title="Pendências de Checklist" 
            desc="Lembretes diários para o preenchimento do Checklist Diário."
            active={notifications.checklist}
            onClick={() => handleToggle('checklist')}
          />
          <NotificationItem 
            title="Alertas Financeiros" 
            desc="Avisos sobre aprovações e pagamentos de medições."
            active={notifications.financial}
            onClick={() => handleToggle('financial')}
          />
          <NotificationItem 
            title="Status das Obras" 
            desc="Notificações sobre alterações significativas no cronograma."
            active={notifications.updates}
            onClick={() => handleToggle('updates')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200"
        >
          <Save className="w-5 h-5" />
          Salvar Preferências
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-zinc-400" />
              <h3 className="font-bold text-zinc-900 uppercase tracking-widest text-xs">Alterar Senha</h3>
            </div>
            <button
              type="button"
              onClick={() => setMostrarSenhas(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {mostrarSenhas ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Senha Atual</label>
            <input
              type={mostrarSenhas ? 'text' : 'password'}
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
              className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nova Senha</label>
              <input
                type={mostrarSenhas ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
                className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Confirmar Nova Senha</label>
              <input
                type={mostrarSenhas ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={salvandoSenha}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {salvandoSenha ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
              {salvandoSenha ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotificationItem({ title, desc, active, onClick }: { title: string, desc: string, active: boolean, onClick: () => void }) {
  return (
    <div className="p-6 flex items-center justify-between gap-6 hover:bg-zinc-50/50 transition-colors">
      <div className="space-y-1">
        <h4 className="font-bold text-zinc-900 tracking-tight">{title}</h4>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">{desc}</p>
      </div>
      <button 
        onClick={onClick}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${active ? 'bg-zinc-900' : 'bg-zinc-200'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
