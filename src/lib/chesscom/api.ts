// The only network use in the app: reading a player's public games from chess.com's public API.
// No login and no personal data: the request carries the username in the URL and a generic
// User-Agent, nothing else. On Android the request goes through Capacitor's native HTTP (no CORS).
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { CcGame } from './parse';

export const API = 'https://api.chess.com/pub/player';
const UA = 'ChessCoach-personal-app';

export class ImportError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'notFound' | 'blocked' | 'server',
  ) {
    super(message);
  }
}

/** GET a JSON document from chess.com. */
export async function getJson<T>(url: string): Promise<T> {
  if (!url.startsWith(API + '/')) throw new ImportError('Unexpected address.', 'server');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ImportError("You're offline. Connect to the internet and try again.", 'offline');
  if (Capacitor.isNativePlatform()) {
    let res;
    try {
      res = await CapacitorHttp.get({ url, headers: { 'User-Agent': UA, Accept: 'application/json' }, connectTimeout: 15000, readTimeout: 30000 });
    } catch {
      throw new ImportError("Couldn't reach chess.com. Check your connection and try again.", 'offline');
    }
    if (res.status === 404) throw new ImportError('No chess.com player with that username.', 'notFound');
    if (res.status >= 400) throw new ImportError(`chess.com answered with an error (${res.status}). Try again later.`, 'server');
    return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
  }
  let res: Response;
  try {
    // Browsers pick their own User-Agent; the header is sent where allowed.
    res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new ImportError(
      "The browser blocked the request to chess.com (or you're offline). The import works in the Android app; on the web it depends on your browser.",
      'blocked',
    );
  }
  if (res.status === 404) throw new ImportError('No chess.com player with that username.', 'notFound');
  if (!res.ok) throw new ImportError(`chess.com answered with an error (${res.status}). Try again later.`, 'server');
  return (await res.json()) as T;
}

export const archivesUrl = (username: string) => `${API}/${encodeURIComponent(username.trim().toLowerCase())}/games/archives`;
export const fetchArchives = async (username: string) => (await getJson<{ archives: string[] }>(archivesUrl(username))).archives ?? [];
export const fetchMonth = async (url: string) => (await getJson<{ games: CcGame[] }>(url)).games ?? [];
