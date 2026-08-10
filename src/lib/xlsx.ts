/**
 * Leitor mínimo de .xlsx, só o que a base de prospecção precisa.
 *
 * Um .xlsx é um zip de XMLs. Aqui a gente descompacta (fflate) e lê as células
 * de texto e número. NÃO trata datas seriais nem fórmulas — a planilha do robô
 * grava tudo como string ou número (verificado: zero células com formato de data),
 * então converter serial de data seria código morto esperando pra errar.
 *
 * Existe pra evitar a dependência do SheetJS: a versão publicada no npm está
 * parada numa release com CVE de prototype pollution, e a versão corrigida só
 * sai no CDN próprio deles, o que quebraria o build na Vercel.
 */
import { unzipSync, strFromU8 } from 'fflate';

export type Linha = Record<string, string | number | null>;

/** Descompacta e devolve os XMLs como texto, indexados pelo caminho interno. */
function abrirZip(buf: ArrayBuffer): Record<string, string> {
  const arquivos = unzipSync(new Uint8Array(buf));
  const out: Record<string, string> = {};
  for (const caminho of Object.keys(arquivos)) {
    if (caminho.endsWith('.xml') || caminho.endsWith('.rels')) {
      out[caminho] = strFromU8(arquivos[caminho]);
    }
  }
  return out;
}

const ENTIDADES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

function desescapar(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|apos);|&#x?[0-9a-fA-F]+;/g, (m) => {
    if (ENTIDADES[m]) return ENTIDADES[m];
    const hex = m[2] === 'x' || m[2] === 'X';
    const cod = parseInt(m.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isFinite(cod) ? String.fromCodePoint(cod) : m;
  });
}

/**
 * Junta o texto de todos os <t> de um trecho.
 * Uma célula pode vir quebrada em vários <r> (rich text) — o Excel faz isso
 * quando parte do texto tem formatação diferente. Concatenar é o certo.
 */
function textoDeT(xml: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/t>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += m[1] ? desescapar(m[1]) : '';
  return out;
}

/** xl/sharedStrings.xml: tabela de strings referenciada por índice pelas células t="s". */
function lerSharedStrings(xmls: Record<string, string>): string[] {
  const xml = xmls['xl/sharedStrings.xml'];
  if (!xml) return [];
  const out: string[] = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] ? textoDeT(m[1]) : '');
  return out;
}

/** Nome da aba -> caminho do XML da planilha, via workbook.xml + seus rels. */
function mapaDeAbas(xmls: Record<string, string>): Record<string, string> {
  const wb = xmls['xl/workbook.xml'] ?? '';
  const rels = xmls['xl/_rels/workbook.xml.rels'] ?? '';

  const alvoPorRid: Record<string, string> = {};
  const reRel = /<Relationship\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = reRel.exec(rels))) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const alvo = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (!id || !alvo) continue;
    const limpo = alvo.replace(/^\/?xl\//, '').replace(/^\//, '');
    alvoPorRid[id] = `xl/${limpo}`;
  }

  const out: Record<string, string> = {};
  const reSheet = /<sheet\b[^>]*>/g;
  while ((m = reSheet.exec(wb))) {
    const nome = /\bname="([^"]*)"/.exec(m[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (nome && rid && alvoPorRid[rid]) out[desescapar(nome)] = alvoPorRid[rid];
  }
  return out;
}

/** "BC12" -> 54 (índice 0). */
function colunaDeRef(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Lê uma aba como matriz de células (linhas x colunas). */
function lerMatriz(xml: string, shared: string[]): (string | number | null)[][] {
  const linhas: (string | number | null)[][] = [];
  const reRow = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const reCell = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let mRow: RegExpExecArray | null;

  while ((mRow = reRow.exec(xml))) {
    const cells: (string | number | null)[] = [];
    let mCell: RegExpExecArray | null;
    reCell.lastIndex = 0;
    while ((mCell = reCell.exec(mRow[1]))) {
      const attrs = mCell[1];
      const corpo = mCell[2] ?? '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
      const idx = ref ? colunaDeRef(ref) : cells.length;

      let valor: string | number | null = null;
      if (tipo === 's') {
        const i = Number(/<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1]);
        valor = shared[i] ?? '';
      } else if (tipo === 'inlineStr') {
        valor = textoDeT(corpo);
      } else if (tipo === 'str' || tipo === 'e') {
        valor = desescapar(/<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1] ?? '');
      } else if (tipo === 'b') {
        valor = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1] === '1' ? 'sim' : 'nao';
      } else {
        const bruto = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
        valor = bruto == null || bruto === '' ? null : Number(bruto);
        if (typeof valor === 'number' && !Number.isFinite(valor)) valor = null;
      }

      while (cells.length < idx) cells.push(null);
      cells[idx] = valor;
    }
    linhas.push(cells);
  }
  return linhas;
}

export interface Planilha {
  abas: string[];
  /** Lê uma aba usando a linha 1 como cabeçalho. Devolve [] se a aba não existir. */
  ler(aba: string): Linha[];
}

export function abrirXlsx(buf: ArrayBuffer): Planilha {
  const xmls = abrirZip(buf);
  const shared = lerSharedStrings(xmls);
  const mapa = mapaDeAbas(xmls);

  return {
    abas: Object.keys(mapa),
    ler(aba: string): Linha[] {
      const caminho = mapa[aba];
      if (!caminho || !xmls[caminho]) return [];
      const matriz = lerMatriz(xmls[caminho], shared);
      if (!matriz.length) return [];
      const cabecalho = matriz[0].map((c) => String(c ?? '').trim());
      return matriz.slice(1).map((linha) => {
        const obj: Linha = {};
        cabecalho.forEach((nome, i) => {
          if (nome) obj[nome] = linha[i] ?? null;
        });
        return obj;
      });
    },
  };
}
