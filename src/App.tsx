import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { supabase, supabaseConfigurado } from './lib/supabase';
import { getMeuProfile } from './lib/db';
import { RoleContext } from './lib/RoleContext';
import type { Role } from './lib/types';
import Login from './components/Login';
import Setup from './components/Setup';
import DefinirSenha from './components/DefinirSenha';
import Funil from './pages/Funil';
import Valores from './pages/Valores';
import Clientes from './pages/Clientes';
import NegocioDetalhe from './pages/NegocioDetalhe';
import Agenda from './pages/Agenda';
import Admin from './pages/Admin';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('editor');
  const [carregando, setCarregando] = useState(true);
  // Chegou por um link de convite ou de recuperação de senha? -> mostrar "Definir senha".
  const [definirSenha, setDefinirSenha] = useState(() => {
    const h = window.location.hash;
    return h.includes('type=invite') || h.includes('type=recovery');
  });

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      setSession(s);
      if (ev === 'PASSWORD_RECOVERY') setDefinirSenha(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    getMeuProfile()
      .then((p) => setRole(p?.role ?? 'editor'))
      .catch(() => setRole('editor'));
  }, [session]);

  if (!supabaseConfigurado) return <Setup />;
  if (definirSenha) return <DefinirSenha onDone={() => setDefinirSenha(false)} />;
  if (carregando) return <div className="center-msg">Carregando…</div>;
  if (!session) return <Login />;

  return (
    <RoleContext.Provider value={role}>
      <BrowserRouter>
        <Shell email={session.user.email ?? ''} role={role} />
      </BrowserRouter>
    </RoleContext.Provider>
  );
}

function Shell({ email, role }: { email: string; role: Role }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const fechar = () => setMenuAberto(false);

  return (
    <div className="app">
      {menuAberto && <div className="scrim" onClick={fechar} />}
      <aside className={`side ${menuAberto ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <b>Suricatus</b>
            <span>CRM Comercial</span>
          </div>
        </div>
        <div className="nav-h">Comercial</div>
        <NavLink to="/" end className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} onClick={fechar}>
          <span className="ic">▦</span> Funil de vendas
        </NavLink>
        <NavLink to="/valores" className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} onClick={fechar}>
          <span className="ic">◫</span> Valores
        </NavLink>
        <NavLink to="/clientes" className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} onClick={fechar}>
          <span className="ic">☺</span> Clientes
        </NavLink>
        <NavLink to="/agenda" className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} onClick={fechar}>
          <span className="ic">◷</span> Agenda
        </NavLink>
        {role === 'admin' && (
          <>
            <div className="nav-h">Gestão</div>
            <NavLink to="/admin" className={({ isActive }) => `nav ${isActive ? 'on' : ''}`} onClick={fechar}>
              <span className="ic">⚙</span> Equipe
            </NavLink>
          </>
        )}
        <div className="side-foot">
          <div style={{ fontSize: 11, color: 'var(--dim)', padding: '4px 10px 2px', wordBreak: 'break-all' }}>{email}</div>
          <div style={{ fontSize: 10.5, color: 'var(--cyan)', padding: '0 10px 8px', textTransform: 'uppercase', letterSpacing: '.4px' }}>{role}</div>
          <button className="nav" onClick={() => supabase.auth.signOut()}>
            <span className="ic">⎋</span> Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="top">
          <button className="burger" aria-label="Menu" onClick={() => setMenuAberto(true)}>☰</button>
          <h1>Comercial Suricatus</h1>
          <div className="search">⌕ Pesquisar…</div>
          <div className="spacer" />
        </div>

        <Routes>
          <Route path="/" element={<Funil />} />
          <Route path="/valores" element={<Valores />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/negocio/:id" element={<NegocioDetalhe />} />
          <Route path="/admin" element={role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
