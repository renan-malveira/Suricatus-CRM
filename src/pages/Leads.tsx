import { useEffect, useMemo, useState } from 'react';
import type { Lead, StatusLead, TipoCliente } from '../lib/types';
import { createCliente, createLead, deleteLead, listClientes, listLeads, updateLead, agendarReuniaoLead } from '../lib/db';
import { usePodeEscrever } from '../lib/RoleContext';
import { TIPOS_CLIENTE } from '../lib/constants';

const STATUS: { id: StatusLead; label: string }[] = [
  { id: 'novo', label: 'Novo' }, { id: 'contatado', label: 'Primeiro contato feito' },
  { id: 'respondeu', label: 'Respondeu' }, { id: 'interessado', label: 'Demonstrou interesse' },
  { id: 'sem_interesse', label: 'Sem interesse' }, { id: 'convertido', label: 'Convertido em cliente' },
];
const dataCurta = (s: string | null) => s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export default function Leads() {
  const podeEscrever = usePodeEscrever();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [editando, setEditando] = useState<Lead | null | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<StatusLead | 'todos'>('todos');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const [ls, cs] = await Promise.all([listLeads(), listClientes()]);
      setLeads(ls); setClientes(cs.map(c => ({ id: c.id, nome: c.nome })));
    } catch (e) { setErro((e as Error).message); }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, []);

  const visiveis = useMemo(() => leads.filter(l =>
    (filtro === 'todos' || l.status === filtro) &&
    [l.empresa, l.contato_nome, l.contato_cargo, l.segmento].some(v => v?.toLowerCase().includes(busca.toLowerCase()))
  ), [leads, filtro, busca]);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Partial<Lead> = {
      empresa: String(fd.get('empresa')).trim(), site: String(fd.get('site') || '').trim() || null,
      tipo_cliente: String(fd.get('tipo_cliente')) as TipoCliente,
      cidade: String(fd.get('cidade') || '').trim() || null, uf: String(fd.get('uf') || '').trim().toUpperCase() || null,
      segmento: String(fd.get('segmento') || '').trim() || null, contato_nome: String(fd.get('contato_nome') || '').trim() || null,
      contato_cargo: String(fd.get('contato_cargo') || '').trim() || null, linkedin: String(fd.get('linkedin') || '').trim() || null,
      email: String(fd.get('email') || '').trim() || null, telefone: String(fd.get('telefone') || '').trim() || null,
      motivo_contato: String(fd.get('motivo_contato') || '').trim() || null, mensagem: String(fd.get('mensagem') || '').trim() || null,
      canal: String(fd.get('canal') || '').trim() || null, status: String(fd.get('status')) as StatusLead,
      primeiro_contato_em: String(fd.get('primeiro_contato_em') || '') || null,
      proximo_follow_up: String(fd.get('proximo_follow_up') || '') || null,
      reuniao_em: String(fd.get('reuniao_em') || '') || null, notas: String(fd.get('notas') || '').trim() || null,
    };
    try {
      if (editando?.id) await updateLead(editando.id, payload);
      else await createLead(payload);
      setEditando(undefined); setErro(''); await carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function alterarData(l: Lead, campo: 'primeiro_contato_em' | 'proximo_follow_up', valor: string) {
    const patch: Partial<Lead> = { [campo]: valor || null };
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
      await updateLead(l.id, { status: 'convertido', cliente_id: c.id });
      setErro(''); await carregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function agendarReuniao(l: Lead) {
    if (!l.cliente_id || !l.reuniao_em) return;
    try {
      await agendarReuniaoLead(l.id, l.reuniao_em.slice(0, 10));
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
      <span className="mini">Prospecção inicial · Clientes após interesse · Funil após reunião</span><div className="spacer" />
      {podeEscrever && <button className="btn cyan" onClick={() => setEditando(null)}>+ Novo lead</button>}
    </div>
    <div className="filtros"><input type="search" placeholder="Buscar empresa ou contato…" value={busca} onChange={e => setBusca(e.target.value)} />
      <select value={filtro} onChange={e => setFiltro(e.target.value as StatusLead | 'todos')}>
        <option value="todos">Todos os status</option>{STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select></div>
    {!visiveis.length ? <div className="empty">Nenhum lead nesta lista. Cadastre empresas que ainda estão na etapa de primeiro contato.</div> :
    <div className="tbl-wrap"><table className="leads-table"><thead><tr>
      <th>Empresa / contato</th><th>Segmento</th><th>Canal</th><th>Status</th><th>Último contato</th><th>Follow-up</th><th>Reunião</th><th>Gancho</th><th></th>
    </tr></thead><tbody>{visiveis.map(l => <tr key={l.id}>
      <td className="wrapcell"><b>{l.empresa}</b><div className="mini">{l.contato_nome || 'Contato a identificar'}{l.contato_cargo ? ` · ${l.contato_cargo}` : ''}</div>
        {l.linkedin && <a className="lk" href={l.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}</td>
      <td>{l.segmento || '—'}{l.cidade ? <div className="mini">{l.cidade}{l.uf ? `, ${l.uf}` : ''}</div> : null}</td>
      <td>{l.canal || '—'}</td><td><span className={`pill lead-${l.status}`}>{STATUS.find(s => s.id === l.status)?.label ?? l.status}</span></td>
      <td><input className="date-inline" type="date" aria-label={`Último contato — ${l.empresa}`} value={l.primeiro_contato_em?.slice(0,10) ?? ''} disabled={!podeEscrever} onChange={e => alterarData(l, 'primeiro_contato_em', e.target.value)} /></td>
      <td><input className="date-inline" type="date" aria-label={`Follow-up — ${l.empresa}`} value={l.proximo_follow_up?.slice(0,10) ?? ''} disabled={!podeEscrever} onChange={e => alterarData(l, 'proximo_follow_up', e.target.value)} /></td>
      <td>{dataCurta(l.reuniao_em)}</td><td className="wrapcell">{l.motivo_contato || l.notas || '—'}</td>
      <td className="nowrap">{podeEscrever && <>
        {l.status === 'interessado' && !l.cliente_id && <button className="btn" onClick={() => converter(l)}>Criar cliente</button>}
        {l.cliente_id && !l.negocio_id && l.reuniao_em && <button className="btn" onClick={() => agendarReuniao(l)}>Agendar reunião e incluir no funil</button>}
        {l.cliente_id && l.negocio_id && <span className="mini">No funil</span>}
        <button className="icobtn" title="Editar lead" onClick={() => setEditando(l)}>✎</button>
        <button className="icobtn" title="Remover lead" onClick={() => remover(l)}>🗑</button>
      </>}</td>
    </tr>)}</tbody></table></div>}
    {editando !== undefined && <div className="overlay" onClick={() => setEditando(undefined)}>
      <form className="modal lead-modal" onSubmit={salvar} onClick={e => e.stopPropagation()}>
        <h3>{editando ? 'Editar lead' : 'Novo lead'}</h3><div className="formgrid">
          <div className="full"><label>Empresa *</label><input name="empresa" defaultValue={editando?.empresa ?? ''} required autoFocus /></div>
          <div><label>Tipo de organização</label><select name="tipo_cliente" defaultValue={editando?.tipo_cliente ?? 'corporativo'}>{TIPOS_CLIENTE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label>Site</label><input name="site" type="url" placeholder="https://" defaultValue={editando?.site ?? ''} /></div>
          <div><label>Segmento</label><input name="segmento" defaultValue={editando?.segmento ?? ''} /></div>
          <div><label>Cidade</label><input name="cidade" defaultValue={editando?.cidade ?? ''} /></div><div><label>UF</label><input name="uf" maxLength={2} defaultValue={editando?.uf ?? ''} /></div>
          <div><label>Nome do contato</label><input name="contato_nome" defaultValue={editando?.contato_nome ?? ''} /></div><div><label>Cargo</label><input name="contato_cargo" defaultValue={editando?.contato_cargo ?? ''} /></div>
          <div className="full"><label>LinkedIn público</label><input name="linkedin" type="url" placeholder="https://linkedin.com/in/…" defaultValue={editando?.linkedin ?? ''} /></div>
          <div><label>E-mail confirmado</label><input name="email" type="email" defaultValue={editando?.email ?? ''} /></div><div><label>Telefone confirmado</label><input name="telefone" defaultValue={editando?.telefone ?? ''} /></div>
          <div><label>Canal do primeiro contato</label><select name="canal" defaultValue={editando?.canal ?? 'LinkedIn'}><option>LinkedIn</option><option>E-mail</option><option>Telefone</option><option>WhatsApp</option><option>Outro</option></select></div>
          <div><label>Status</label><select name="status" defaultValue={editando?.status ?? 'novo'}>{STATUS.filter(s => s.id !== 'convertido' || editando?.status === 'convertido').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label>Data do primeiro contato</label><input name="primeiro_contato_em" type="date" defaultValue={editando?.primeiro_contato_em?.slice(0,10) ?? ''} /></div>
          <div><label>Próximo follow-up</label><input name="proximo_follow_up" type="date" defaultValue={editando?.proximo_follow_up?.slice(0,10) ?? ''} /></div>
          <div><label>Reunião agendada</label><input name="reuniao_em" type="date" defaultValue={editando?.reuniao_em?.slice(0,10) ?? ''} /></div>
          <div className="full"><label>Motivo / gancho de contato</label><textarea name="motivo_contato" rows={2} defaultValue={editando?.motivo_contato ?? ''} /></div>
          <div className="full"><label>Mensagem enviada</label><textarea name="mensagem" rows={3} defaultValue={editando?.mensagem ?? ''} /></div>
          <div className="full"><label>Notas</label><textarea name="notas" rows={2} defaultValue={editando?.notas ?? ''} /></div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={() => setEditando(undefined)}>Cancelar</button><button className="btn primary">Salvar lead</button></div>
      </form>
    </div>}
  </div>;
}
