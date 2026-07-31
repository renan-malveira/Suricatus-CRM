import { useEffect, useState } from 'react';
import type { Cliente, Negocio, Etapa, Linha } from '../lib/types';
import { ETAPAS, LINHAS, SOLUCOES, PROBABILIDADE_PADRAO, MOTIVOS_PERDA } from '../lib/constants';
import { createNegocio, updateNegocio, registrarHistorico, listProfiles } from '../lib/db';
import { nomeProfile } from './ClienteForm';

interface Props {
  negocio?: Negocio | null;
  clientes: Cliente[];
  onClose: () => void;
  onSaved: () => void;
}

export default function NegocioForm({ negocio, clientes, onClose, onSaved }: Props) {
  const [f, setF] = useState<Partial<Negocio>>(
    negocio ?? { linha: 'corporativo', etapa: 'lead', probabilidade: 15, valor: 0 },
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    listProfiles().then((ps) => setResponsaveis(ps.map(nomeProfile))).catch(() => setResponsaveis([]));
  }, []);

  const opcoesResp = f.responsavel && !responsaveis.includes(f.responsavel)
    ? [f.responsavel, ...responsaveis]
    : responsaveis;

  function set<K extends keyof Negocio>(k: K, v: Negocio[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function mudarEtapa(etapa: Etapa) {
    setF((p) => ({ ...p, etapa, probabilidade: PROBABILIDADE_PADRAO[etapa] }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titulo) return;
    setSalvando(true);
    setErro('');
    try {
      const fechou = f.etapa === 'ganho' || f.etapa === 'perdido';
      if (negocio) {
        const mudouEtapa = f.etapa !== negocio.etapa;
        const payload: Partial<Negocio> = { ...f };
        if (mudouEtapa) {
          payload.fechado_em = fechou ? new Date().toISOString() : null;
          if (f.etapa !== 'perdido') payload.motivo_perda = null;
        }
        await updateNegocio(negocio.id, payload);
        if (mudouEtapa) await registrarHistorico(negocio.id, negocio.etapa, f.etapa!, f.responsavel ?? null);
      } else {
        const criado = await createNegocio({ ...f, fechado_em: fechou ? new Date().toISOString() : null });
        await registrarHistorico(criado.id, null, criado.etapa, f.responsavel ?? null);
      }
      onSaved();
    } catch (err) {
      setErro((err as Error).message ?? 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <h3>{negocio ? 'Editar negócio' : 'Novo negócio'}</h3>
        {erro && <div className="err">{erro}</div>}
        <div className="formgrid">
          <div className="full">
            <label>Título do negócio *</label>
            <input value={f.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} required autoFocus placeholder="Ex.: IAUPE — trilha gamificada UPE" />
          </div>
          <div>
            <label>Cliente</label>
            <select value={f.cliente_id ?? ''} onChange={(e) => set('cliente_id', e.target.value || null)}>
              <option value="">— sem cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Linha de negócio</label>
            <select value={f.linha} onChange={(e) => set('linha', e.target.value as Linha)}>
              {LINHAS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Solução</label>
            <select value={f.solucao ?? ''} onChange={(e) => set('solucao', e.target.value)}>
              <option value="">—</option>
              {SOLUCOES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Valor estimado (R$)</label>
            <input type="number" min={0} step={100} value={f.valor ?? 0} onChange={(e) => set('valor', Number(e.target.value))} />
          </div>
          <div>
            <label>Etapa</label>
            <select value={f.etapa} onChange={(e) => mudarEtapa(e.target.value as Etapa)}>
              {ETAPAS.map((et) => (
                <option key={et.id} value={et.id}>{et.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Probabilidade (%)</label>
            <input type="number" min={0} max={100} value={f.probabilidade ?? 0} onChange={(e) => set('probabilidade', Number(e.target.value))} />
          </div>
          <div>
            <label>Responsável</label>
            <select value={f.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value || null)}>
              <option value="">— escolha —</option>
              {opcoesResp.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Previsão de fechamento</label>
            <input type="date" value={f.previsao_fechamento ?? ''} onChange={(e) => set('previsao_fechamento', e.target.value || null)} />
          </div>
          <div className="full">
            <label>Próxima ação</label>
            <input value={f.proxima_acao ?? ''} onChange={(e) => set('proxima_acao', e.target.value)} placeholder="Ex.: Enviar escopo do quiz até 04/ago" />
          </div>
          {f.etapa === 'perdido' && (
            <div className="full">
              <label>Motivo da perda</label>
              <select value={f.motivo_perda ?? MOTIVOS_PERDA[0]} onChange={(e) => set('motivo_perda', e.target.value)}>
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}
