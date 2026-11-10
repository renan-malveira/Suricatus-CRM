import { useEffect, useMemo, useRef, useState } from 'react';
import type { EtapaLead, Lead, StatusLead, StatusResultadoLead, TipoCliente } from '../lib/types';
import { createCliente, createLead, deleteLead, listClientes, listLeads, updateLead } from '../lib/db';
import { usePodeEscrever } from '../lib/RoleContext';
import { calcularFollowUp } from '../lib/followUp';

const ETAPAS: { id: EtapaLead; label: string; legado: StatusLead }[] = [
  { id: 'novo', label: 'Novo', legado: 'novo' },
  { id: 'primeiro_contato', label: 'Primeiro contato', legado: 'contatado' },
  { id: 'follow_up', label: 'Follow-up', legado: 'contatado' },
  { id: 'respondeu', label: 'Respondeu', legado: 'respondeu' },
  { id: 'interessado', label: 'Demonstrou interesse', legado: 'interessado' },
];
const RESULTADOS: { id: StatusResultadoLead; label: string }[] = [
  { id: 'aberto', label: 'Em andamento' }, { id: 'ganho', label: 'Ganho' }, { id: 'perdido', label: 'Perdido' },
];
const dataCurta = (s: string | null) => s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';
type CampoDataLead = 'primeiro_contato_em';
type CalendarioAberto = { id: string; campo: CampoDataLead; mes: Date; ancora: HTMLButtonElement };

export default function Leads() {
  const podeEscrever = usePodeEscrever();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [editando, setEditando] = useState<Lead | null | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<StatusResultadoLead | 'todos'>('todos');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [calendario, setCalendario] = useState<CalendarioAberto | null>(null);
  const calendarioRef = useRef<HTMLDivElement>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [ls, cs] = await Promise.all([listLeads(), listClientes()]);
      setLeads(ls); setClientes(cs.map(c => ({ id: c.id, nome: c.nome })));
    } catch (e) { setErro((e as Error).message); }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!calendario) return;
    const fecharFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!calendarioRef.current?.contains(alvo) && !calendario.ancora.contains(alvo)) setCalendario(null);
    };
    const fecharEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalendario(null); };
    const fecharAoMover = () => setCalendario(null);
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    window.addEventListener('scroll', fecharAoMover, true);
    window.addEventListener('resize', fecharAoMover);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
      window.removeEventListener('scroll', fecharAoMover, true);
      window.removeEventListener('resize', fecharAoMover);
    };
  }, [calendario]);

  const visiveis = useMemo(() => leads.filter(l =>
    (filtro === 'todos' || l.status_resultado === filtro) &&
    [l.empresa, l.contato_nome, l.contato_cargo, l.segmento, l.evento_prioritario].some(v => v?.toLowerCase().includes(busca.toLowerCase()))
  ), [leads, filtro, busca]);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const etapa = String(fd.get('etapa')) as EtapaLead;
    const statusResultado = String(fd.get('status_resultado')) as StatusResultadoLead;
    const statusLegado: StatusLead = editando?.cliente_id ? editando.status :
      statusResultado === 'perdido' ? 'sem_interesse' : ETAPAS.find(s => s.id === etapa)?.legado ?? 'novo';
    const payload: Partial<Lead> = {
      empresa: String(fd.get('empresa')).trim(), tipo_cliente: editando?.tipo_cliente ?? 'corporativo' as TipoCliente,
      segmento: String(fd.get('segmento') || '').trim() || null,
      contato_nome: String(fd.get('contato_nome') || '').trim() || null,
      contato_cargo: String(fd.get('contato_cargo') || '').trim() || null,
      evento_prioritario: String(fd.get('evento_prioritario') || '').trim() || null,
      linkedin: String(fd.get('linkedin') || '').trim() || null,
      motivo_contato: String(fd.get('motivo_contato') || '').trim() || null,
      status: statusLegado,
      etapa,
      status_resultado: statusResultado,
      primeiro_contato_em: String(fd.get('primeiro_contato_em') || '') || null,
      proximo_follow_up: calcularFollowUp(String(fd.get('primeiro_contato_em') || '') || null),
    };
    try {
      if (editando?.id) await updateLead(editando.id, payload);
      else await createLead(payload);
      setEditando(undefined); setErro(''); await carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function alterarData(l: Lead, campo: CampoDataLead, valor: string) {
    const patch: Partial<Lead> = { [campo]: valor || null, proximo_follow_up: calcularFollowUp(valor || null) };
    try {
      await updateLead(l.id, patch);
      setLeads(current => current.map(item => item.id === l.id ? { ...item, ...patch } : item));
      setErro('');
      return true;
    } catch (e) { setErro((e as Error).message); }
    return false;
  }

  function abrirCalendario(e: React.MouseEvent<HTMLButtonElement>, l: Lead, campo: CampoDataLead) {
    const valor = l[campo];
    const base = valor ? new Date(`${valor.slice(0, 10)}T12:00:00`) : new Date();
    setCalendario({ id: l.id, campo, mes: new Date(base.getFullYear(), base.getMonth(), 1), ancora: e.currentTarget });
  }

  async function escolherData(l: Lead, campo: CampoDataLead, valor: string) {
    if (await alterarData(l, campo, valor)) setCalendario(null);
  }

  async function alterarEtapa(l: Lead, etapa: EtapaLead) {
    const patch: Partial<Lead> = { etapa, status: l.cliente_id ? l.status : ETAPAS.find(e => e.id === etapa)?.legado ?? l.status };
    try {
      await updateLead(l.id, patch);
      setLeads(current => current.map(item => item.id === l.id ? { ...item, ...patch } : item));
      setErro('');
    } catch (e) { setErro((e as Error).message); }
  }

  async function alterarResultado(l: Lead, status_resultado: StatusResultadoLead) {
    const status = l.cliente_id ? l.status : status_resultado === 'perdido' ? 'sem_interesse' :
      status_resultado === 'aberto' && ['sem_interesse', 'convertido'].includes(l.status)
        ? ETAPAS.find(e => e.id === l.etapa)?.legado ?? 'contatado' : l.status;
    const patch: Partial<Lead> = { status_resultado, status };
    try {
      await updateLead(l.id, patch);
      setLeads(current => current.map(item => item.id === l.id ? { ...item, ...patch } : item));
      setErro('');
    } catch (e) { setErro((e as Error).message); }
  }

  async function converter(l: Lead) {
    if (clientes.some(c => c.nome.trim().toLowerCase() === l.empresa.trim().toLowerCase())) {
      setErro(`Já existe um cliente chamado ${l.empresa}. Abra Clientes e vincule o registro existente antes de converter.`);
      return;
    }
    try {
      const c = await createCliente({ nome: l.empresa, tipo: l.tipo_cliente, segmento: l.segmento, contato_nome: l.contato_nome,
        contato_cargo: l.contato_cargo, email: l.email, telefone: l.telefone, uf: l.uf,
        origem: 'Prospecção ativa', status: 'Cliente potencial' });
      await updateLead(l.id, { status: 'convertido', status_resultado: 'ganho', cliente_id: c.id });
      setErro(''); await carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function remover(l: Lead) {
    if (!confirm(`Remover o lead ${l.empresa}?`)) return;
    try { await deleteLead(l.id); await carregar(); } catch (e) { setErro((e as Error).message); }
  }

  if (carregando) return <div className="center-msg">Carregando leads…</div>;
  return <div className="view">
    {erro && <div className="err">{erro}</div>}
    <div className="subbar"><span className="chip on">{leads.length} lead(s)</span>
      <span className="mini">Prospecção inicial · Clientes após interesse</span><div className="spacer" />
      {podeEscrever && <button className="btn cyan" onClick={() => setEditando(null)}>+ Novo lead</button>}
    </div>
    <div className="lead-kpis">
      <div className="lead-kpi"><span>Em andamento</span><b>{leads.filter(l => l.status_resultado === 'aberto').length}</b></div>
      <div className="lead-kpi ganho"><span>Ganhos</span><b>{leads.filter(l => l.status_resultado === 'ganho').length}</b></div>
      <div className="lead-kpi perdido"><span>Perdidos</span><b>{leads.filter(l => l.status_resultado === 'perdido').length}</b></div>
    </div>
    <div className="filtros"><input type="search" placeholder="Buscar empresa ou contato…" value={busca} onChange={e => setBusca(e.target.value)} />
      <select value={filtro} onChange={e => setFiltro(e.target.value as StatusResultadoLead | 'todos')}>
        <option value="todos">Todos os status</option>{RESULTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select></div>
    {!visiveis.length ? <div className="empty">Nenhum lead nesta lista. Cadastre empresas que ainda estão na etapa de primeiro contato.</div> :
    <div className="tbl-wrap"><table className="leads-table"><thead><tr>
      <th>Empresa</th><th>Nome</th><th>Segmento</th><th>Cargo</th><th>Evento prioritário</th><th>LinkedIn</th><th>Etapa</th><th>Status</th><th>Contato / follow-up</th><th>Gancho</th><th></th>
    </tr></thead><tbody>{visiveis.map(l => <tr key={l.id}>
      <td className="wrapcell"><b>{l.empresa}</b></td>
      <td className="wrapcell">{l.contato_nome || '—'}</td>
      <td className="wrapcell">{l.segmento || '—'}</td>
      <td className="wrapcell">{l.contato_cargo || '—'}</td>
      <td className="wrapcell lead-event-cell" title={l.evento_prioritario || ''}>{(() => {
        const eventos = l.evento_prioritario?.split('\n').filter(Boolean) ?? [];
        if (!eventos.length) return '—';
        return <><div>{eventos[0]}</div>{eventos.length > 1 && <details><summary>+ {eventos.length - 1} evento(s)</summary>{eventos.slice(1).map((evento, i) => <div key={`${evento}-${i}`}>{evento}</div>)}</details>}</>;
      })()}</td>
      <td>{l.linkedin && <a className="lk" href={l.linkedin} target="_blank" rel="noreferrer">Abrir perfil ↗</a>}</td>
      <td><select className={`lead-select etapa-${l.etapa}`} aria-label={`Etapa — ${l.empresa}`} value={l.etapa} disabled={!podeEscrever} onChange={e => alterarEtapa(l, e.target.value as EtapaLead)}>{ETAPAS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
      <td><select className={`lead-select resultado-${l.status_resultado}`} aria-label={`Status — ${l.empresa}`} value={l.status_resultado} disabled={!podeEscrever} onChange={e => alterarResultado(l, e.target.value as StatusResultadoLead)}>{RESULTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
      <td><div className="lead-date-stack"><div><span className="lead-date-label">Último contato</span><button type="button" className="date-inline" aria-label={`Último contato — ${l.empresa}`} aria-haspopup="dialog" aria-expanded={calendario?.id === l.id && calendario.campo === 'primeiro_contato_em'} disabled={!podeEscrever} onClick={e => abrirCalendario(e, l, 'primeiro_contato_em')}><span>{dataCurta(l.primeiro_contato_em)}</span><span aria-hidden="true">▾</span></button></div><div><span className="lead-date-label">Follow-up · automático</span><span className="date-inline date-auto"><span>{dataCurta(l.proximo_follow_up)}</span><span aria-hidden="true">Auto</span></span></div></div></td>
      <td className="wrapcell lead-hook-cell" title={l.motivo_contato || ''}>{l.motivo_contato || '—'}</td>
      <td className="nowrap">{podeEscrever && <>
        {l.etapa === 'interessado' && l.status_resultado !== 'perdido' && !l.cliente_id && <button className="btn" onClick={() => converter(l)}>Criar cliente</button>}
        <button className="icobtn" title="Editar lead" onClick={() => setEditando(l)}>✎</button>
        <button className="icobtn" title="Remover lead" onClick={() => remover(l)}>🗑</button>
      </>}</td>
    </tr>)}</tbody></table></div>}
    {calendario && (() => {
      const lead = leads.find(item => item.id === calendario.id);
      if (!lead) return null;
      const primeiroDia = new Date(calendario.mes.getFullYear(), calendario.mes.getMonth(), 1);
      const inicio = (primeiroDia.getDay() + 6) % 7;
      const diasNoMes = new Date(calendario.mes.getFullYear(), calendario.mes.getMonth() + 1, 0).getDate();
      const valorAtual = lead[calendario.campo]?.slice(0, 10);
      const posicao = calendario.ancora.getBoundingClientRect();
      const top = Math.max(8, Math.min(posicao.bottom + 6, window.innerHeight - 430));
      const left = Math.max(8, Math.min(posicao.left, window.innerWidth - 280));
      const escolherHoje = () => {
        const hoje = new Date();
        escolherData(lead, calendario.campo, `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`);
      };
      return <div ref={calendarioRef} className="date-calendar" role="dialog" aria-label="Selecionar data" style={{ top, left }}>
        <div className="date-calendar-head">
          <button type="button" className="date-nav" aria-label="Mês anterior" onClick={() => setCalendario(c => c ? { ...c, mes: new Date(c.mes.getFullYear(), c.mes.getMonth() - 1, 1) } : c)}>‹</button>
          <strong>{calendario.mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
          <button type="button" className="date-nav" aria-label="Próximo mês" onClick={() => setCalendario(c => c ? { ...c, mes: new Date(c.mes.getFullYear(), c.mes.getMonth() + 1, 1) } : c)}>›</button>
        </div>
        <div className="date-calendar-grid">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span className="date-weekday" key={`${d}-${i}`}>{d}</span>)}
          {Array.from({ length: inicio }, (_, i) => <span className="date-empty" key={`v-${i}`} />)}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = i + 1;
            const value = `${calendario.mes.getFullYear()}-${String(calendario.mes.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            return <button type="button" key={value} className={`date-day${valorAtual === value ? ' selected' : ''}`} aria-pressed={valorAtual === value} onClick={() => escolherData(lead, calendario.campo, value)}>{dia}</button>;
          })}
        </div>
        <div className="date-calendar-foot">
          <button type="button" className="date-today" onClick={escolherHoje}>Hoje</button>
          {valorAtual && <button type="button" className="date-clear" onClick={() => escolherData(lead, calendario.campo, '')}>Limpar data</button>}
        </div>
      </div>;
    })()}
    {editando !== undefined && <div className="overlay" onClick={() => setEditando(undefined)}>
      <form className="modal lead-modal" onSubmit={salvar} onClick={e => e.stopPropagation()}>
        <h3>{editando ? 'Editar lead' : 'Novo lead'}</h3><div className="formgrid">
          <div><label>Empresa *</label><input name="empresa" defaultValue={editando?.empresa ?? ''} required autoFocus /></div>
          <div><label>Nome</label><input name="contato_nome" defaultValue={editando?.contato_nome ?? ''} /></div>
          <div className="full"><label>Segmento</label><input name="segmento" defaultValue={editando?.segmento ?? ''} /></div>
          <div><label>Cargo</label><input name="contato_cargo" defaultValue={editando?.contato_cargo ?? ''} /></div>
          <div><label>Evento prioritário</label><textarea name="evento_prioritario" rows={3} defaultValue={editando?.evento_prioritario ?? ''} /></div>
          <div className="full"><label>LinkedIn</label><input name="linkedin" type="url" placeholder="https://linkedin.com/in/…" defaultValue={editando?.linkedin ?? ''} /></div>
          <div><label>Etapa</label><select name="etapa" defaultValue={editando?.etapa ?? 'novo'}>{ETAPAS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label>Status</label><select name="status_resultado" defaultValue={editando?.status_resultado ?? 'aberto'}>{RESULTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label>Último contato</label><input name="primeiro_contato_em" type="date" defaultValue={editando?.primeiro_contato_em?.slice(0,10) ?? ''} /></div>
          <div><label>Follow-up</label><div className="lead-followup-hint">Calculado para 5 dias úteis após o último contato. Fins de semana e feriados de São Paulo são ignorados.</div></div>
          <div className="full"><label>Gancho</label><textarea name="motivo_contato" rows={3} defaultValue={editando?.motivo_contato ?? ''} /></div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={() => setEditando(undefined)}>Cancelar</button><button className="btn primary">Salvar lead</button></div>
      </form>
    </div>}
  </div>;
}
