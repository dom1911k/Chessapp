// In-app updates from GitHub Releases. The app stays fully usable offline;
// this only runs when the phone happens to be online.
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { kvGet, kvSet } from './db';

export const REPO = 'dom1911k/Chessapp';
const LAST_CHECK = 'updateLastCheck';
const SKIPPED = 'updateSkipped';
const DAY = 24 * 60 * 60 * 1000;

interface ApkUpdaterPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(event: 'progress', cb: (p: { loaded: number; total: number }) => void): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export interface UpdateInfo {
  version: string;
  current: string;
  notes: string;
  apkUrl: string;
  size: number;
  pageUrl: string;
}

/** Compares dotted versions: >0 if a is newer than b. Non-numeric parts (e.g. "-dev") count as older. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [main, pre] = v.replace(/^v/, '').split('-');
    return { nums: main.split('.').map((x) => Number(x) || 0), pre: !!pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return d;
  }
  if (x.pre !== y.pre) return x.pre ? -1 : 1;
  return 0;
}

export const updatesSupported = () => Capacitor.getPlatform() === 'android';

export async function currentVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return import.meta.env.VITE_APP_VERSION ?? 'web';
  return (await App.getInfo()).version;
}

/** Asks GitHub for the latest release. Returns null if up to date. Throws if offline. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return null; // no release yet
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const rel = await res.json();
  await kvSet(LAST_CHECK, Date.now());
  const asset = (rel.assets ?? []).find((a: { name: string }) => a.name.toLowerCase().endsWith('.apk'));
  const current = await currentVersion();
  const version = String(rel.tag_name ?? '').replace(/^v/, '');
  if (!asset || !version || compareVersions(version, current) <= 0) return null;
  return {
    version,
    current,
    notes: String(rel.body ?? ''),
    apkUrl: asset.browser_download_url,
    size: asset.size ?? 0,
    pageUrl: rel.html_url,
  };
}

/** Automatic check, at most once a day, skipping a version the user dismissed. */
export async function autoCheck(): Promise<UpdateInfo | null> {
  if (!updatesSupported()) return null;
  const last = await kvGet<number>(LAST_CHECK, 0);
  if (Date.now() - last < DAY) return null;
  try {
    const u = await checkForUpdate();
    if (u && u.version === (await kvGet<string | null>(SKIPPED, null))) return null;
    return u;
  } catch {
    return null; // offline — try again next time
  }
}

export async function skipVersion(v: string) {
  await kvSet(SKIPPED, v);
}

export type InstallResult = 'started' | 'needs-permission';

/** Downloads the APK and opens Android's installer. */
export async function installUpdate(u: UpdateInfo, onProgress: (fraction: number) => void): Promise<InstallResult> {
  const { allowed } = await ApkUpdater.canInstall();
  if (!allowed) {
    await ApkUpdater.openInstallSettings();
    return 'needs-permission';
  }
  const sub = await ApkUpdater.addListener('progress', (p) => onProgress(p.total > 0 ? p.loaded / p.total : 0));
  try {
    await ApkUpdater.downloadAndInstall({ url: u.apkUrl });
  } finally {
    await sub.remove();
  }
  return 'started';
}
