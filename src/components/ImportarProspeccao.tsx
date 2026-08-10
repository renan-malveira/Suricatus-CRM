import { useRef, useState } from 'react';
import { abrirXlsx } from '../lib/xlsx';
import { ABAS, ErroImport, validar, mapearEvento, mapearMarca, mapearContato } from '../lib/prospeccao';
import { importarProspeccao } from '../lib/db';
import type { ResultadoImport } from '../lib/db';

interface Props {
  autor: string | null;
  onFechar(): void;
  onPronto(r: ResultadoImport): void;
}

type Fase = { tipo: 'parado' } | { tipo: 'lendo' } | { tipo: 'enviando'; etapa: string; feitas: number; total: number };

export default function ImportarProspeccao({ autor, onFechar, onPronto }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: 'parado' });
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ocupado = fase.tipo !== 'parado';

  async function processar(file: File) {
    setErro('');
    setFase({ tipo: 'lendo' });
    try {
      const planilha = abrirXlsx(await file.arrayBuffer());

      const brutos = {
        [ABAS.eventos]: planilha.ler(ABAS.eventos),
        [ABAS.marcas]: planilha.ler(ABAS.marcas),
        [ABAS.contatos]: planilha.ler(ABAS.contatos),
      };
      validar(planilha.abas, brutos);

      const payload = {
        eventos: brutos[ABAS.eventos].map(mapearEvento).filter((e) => e.id),
        marcas: brutos[ABAS.marcas].map(mapearMarca).filter((m) => m.id),
        contatos: brutos[ABAS.contatos].map(mapearContato).filter((c) => c.id),
      };

      const r = await importarProspeccao(payload, file.name, autor, (etapa, feitas, total) =>
        setFase({ tipo: 'enviando', etapa, feitas, total }));
      onPronto(r);
    } catch (e) {
      setFase({ tipo: 'parado' });
      if (e instanceof ErroImport) setErro(e.message);
      else if (e instanceof Error && /zip|invalid|signature/i.test(e.message)) {
        setErro('Não consegui abrir o arquivo. Ele é mesmo um .xlsx? (arquivos .xls antigos não servem)');
      } else setErro(e instanceof Error ? e.message : 'Falhou ao importar.');
    }
  }

  function escolher(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setErro('Precisa ser o arquivo .xlsx da prospecção.');
      return;
    }
    void processar(f);
  }

  return (
    <div className="overlay" onClick={() => !ocupado && onFechar()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Importar a planilha do robô</h3>

        {erro && <div className="err">{erro}</div>}

        {fase.tipo === 'parado' && (
          <>
            <div
              className={`dropzone ${arrastando ? 'on' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
            >
              <b>Arraste o base_prospeccao.xlsx aqui</b>
              <span>ou clique para escolher</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={(e) => escolher(e.target.files)}
            />
            <div className="note">
              O arquivo é lido aqui no navegador — não sobe pra lugar nenhum além do banco da Suricatus.
              As colunas de pesquisa do robô são atualizadas; <b>status, responsável e notas que você já
              preencheu aqui não são tocados</b>.
            </div>
          </>
        )}

        {fase.tipo === 'lendo' && <div className="center-msg">Lendo a planilha…</div>}

        {fase.tipo === 'enviando' && (
          <div className="center-msg">
            Enviando {fase.etapa.toLowerCase()}… {fase.feitas.toLocaleString('pt-BR')} de{' '}
            {fase.total.toLocaleString('pt-BR')}
            <div className="barra"><div style={{ width: `${(fase.feitas / Math.max(fase.total, 1)) * 100}%` }} /></div>
          </div>
        )}

        <div className="modal-foot">
          <button className="btn" onClick={onFechar} disabled={ocupado}>
            {ocupado ? 'Importando…' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
