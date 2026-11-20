/**
 * Save file bytes (P1: never leaves the device by itself — the browser just downloads/opens a file).
 * gzip JSON where the browser can compress (CompressionStream), plain JSON otherwise; reading detects which.
 * Every profile read back goes through `parseProfile` (schema check + migrations), so an old save still loads.
 */
import type { Profile } from '../../domain/profile';
import { parseProfile } from './schema';

const APP = 'numberisland';

export async function profileToBlob(p: Profile, now = new Date()): Promise<Blob> {
  const json = JSON.stringify({ app: APP, exportedAt: now.toISOString(), profiles: [p] });
  if (typeof CompressionStream === 'undefined') return new Blob([json], { type: 'application/json' });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' });
}

/** Reads a save file; throws on anything that is not a numberisland save. */
export async function blobToProfile(blob: Blob): Promise<Profile> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('cannot unzip here');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const data = JSON.parse(text) as { app?: string; profiles?: unknown[] };
  const first = data.app === APP && Array.isArray(data.profiles) ? data.profiles[0] : undefined;
  if (!first || typeof first !== 'object') throw new Error('not a numberisland save');
  const { profile } = parseProfile(first);
  return profile;
}
