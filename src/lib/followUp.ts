const pad = (n: number) => String(n).padStart(2, '0');

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function feriadosSaoPaulo(year: number): Set<string> {
  const fixed = [
    [1, 1], [1, 25], [4, 21], [5, 1], [7, 9], [9, 7], [10, 12],
    [11, 2], [11, 15], [11, 20], [12, 25],
  ];
  const dates = new Set(fixed.map(([month, day]) => `${year}-${pad(month)}-${pad(day)}`));
  const easter = easterSunday(year);
  const goodFriday = new Date(year, easter.getMonth(), easter.getDate() - 2);
  const corpusChristi = new Date(year, easter.getMonth(), easter.getDate() + 60);
  for (const date of [goodFriday, corpusChristi]) {
    dates.add(`${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return dates;
}

/** Adds business days in São Paulo, excluding the contact day and public holidays. */
export function calcularFollowUp(dataContato: string | null | undefined, diasUteis = 5): string | null {
  if (!dataContato) return null;
  const [year, month, day] = dataContato.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day || diasUteis <= 0) return null;
  const date = new Date(year, month - 1, day, 12);
  let added = 0;
  while (added < diasUteis) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (feriadosSaoPaulo(date.getFullYear()).has(key)) continue;
    added += 1;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
