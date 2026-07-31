import { useState } from 'react';
import { MOTIVOS_PERDA } from '../lib/constants';

interface Props {
  titulo: string;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
}

export default function MotivoPerdaModal({ titulo, onCancel, onConfirm }: Props) {
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [detalhe, setDetalhe] = useState('');

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3>Marcar como perdido</h3>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: -8 }}>{titulo}</p>
        <label>Motivo da perda</label>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS_PERDA.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div style={{ marginTop: 12 }}>
          <label>Detalhe (opcional)</label>
          <input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Ex.: perdeu para fornecedor X" />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" onClick={() => onConfirm(detalhe ? `${motivo} — ${detalhe}` : motivo)}>Confirmar perda</button>
        </div>
      </div>
    </div>
  );
}
