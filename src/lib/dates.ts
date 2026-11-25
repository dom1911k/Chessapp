// Short dates and calendar weeks (Monday 00:00 local to the next Monday), shared by the screens.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "22 Nov", with the year only when it isn't this year ("22 Nov 2025"): fits a header subtitle. */
export function shortDate(t: number, now = Date.now()): string {
  const d = new Date(t);
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? s : `${s} ${d.getFullYear()}`;
}

/** The Monday 00:00 (local time) that starts the calendar week holding `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** The Monday after `start` (a calendar week is 7 days except across a clock change, so step by date). */
export function nextWeek(start: number, by = 1): number {
  const d = new Date(start);
  d.setDate(d.getDate() + 7 * by);
  return d.getTime();
}

/** "17–23 Nov", or "28 Oct – 3 Nov" across a month. */
export function weekLabel(start: number): string {
  const a = new Date(start);
  const b = new Date(nextWeek(start));
  b.setDate(b.getDate() - 1);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
