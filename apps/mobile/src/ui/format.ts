const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Hoje, 14:32", "Ontem, 20:15" ou "28 de out., 09:40". */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return `Hoje, ${time}`;
  if (diff === 1) return `Ontem, ${time}`;
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : ''}, ${time}`;
}

export function formatDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
}

export const matches = (query: string, ...fields: string[]) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some(f => f.toLowerCase().includes(q));
};
