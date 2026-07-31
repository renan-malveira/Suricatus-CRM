export function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export function moedaCurta(valor: number): string {
  const v = valor || 0;
  if (v >= 1000) return `R$ ${Math.round(v / 1000)} mil`;
  return moeda(v);
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function dataCurta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  const s = ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
  return s || '?';
}
