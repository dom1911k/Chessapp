// Numbers that change in front of you: a digit odometer (each digit a 0–9 strip that rolls, 240ms
// per digit, same markup every time so it's cheap) and a count-up tween for text numbers.
import { eo3, tween, type Token } from './motion';

/** Roll an element's text to `s`: digits roll on strips, other characters (",", ".", "%") just sit. */
export function odoStr(el: HTMLElement | null | undefined, s: string) {
  if (!el || el.dataset.v === s) return;
  const fmt = s.replace(/\d/g, '0');
  if (el.dataset.fmt !== fmt) {
    el.dataset.fmt = fmt;
    el.innerHTML = [...s].map((ch) => (/\d/.test(ch) ? `<span class="dg"><span class="st">${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>` : `<span>${ch}</span>`)).join('');
  }
  el.dataset.v = s;
  [...s].forEach((ch, i) => {
    if (/\d/.test(ch)) ((el.children[i] as HTMLElement).firstChild as HTMLElement).style.transform = `translateY(${-Number(ch)}em)`;
  });
}
/** A whole number on an odometer, with thousands separators. */
export const odo = (el: HTMLElement | null | undefined, val: number) => odoStr(el, Math.round(val).toLocaleString('en-US'));

/** Format a number for display: thousands separators, or a fixed number of decimals. */
export const fmtNum = (v: number, decimals = 0) => (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US'));

/** Count an element's text from one value to another (ease-out cubic). Resolves at the end, or at once when skipped. */
export async function countTo(el: HTMLElement | null | undefined, from: number, to: number, ms: number, decimals = 0, tk?: Token, wrap: (s: string) => string = (s) => s) {
  if (!el) return;
  await tween(ms, (k) => (el.textContent = wrap(fmtNum(from + (to - from) * eo3(k), decimals))), tk);
  el.textContent = wrap(fmtNum(to, decimals));
}
