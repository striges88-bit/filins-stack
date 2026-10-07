import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
export const releaseRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const manifest = JSON.parse(readFileSync(resolve(releaseRoot, 'release-manifest.json'), 'utf8'));
export function maintainedBinary(name) {
  const component = manifest.binaries[name];
  if (!component) throw new Error(`Unowned maintained binary: ${name}`);
  const path = resolve(releaseRoot, component.path);
  if (!statSync(path).isFile()) throw new Error(`Missing maintained binary: ${name}`);
  return path;
}
export function bindRelease() {
  for (const [key, value] of Object.entries(manifest.environment)) process.env[key] = value;
  for (const [name, item] of Object.entries(manifest.binaries)) process.env[item.env] = maintainedBinary(name);
  process.env.NODE = resolve(releaseRoot, manifest.node.path);
  const profile = process.env.CAVEMAN_NATIVE_PROFILE?.toLowerCase();
  if (profile === 'full-max' || !new Set(['record-only','core','core-lean-build','ledger','ccr-masking','cache-aware','full-safe']).has(profile)) {
    process.env.CAVEMAN_NATIVE_PROFILE = process.env.CAVEMAN_WRAP_MODE === 'record' || process.env.CAVEMAN_WRAP_MODE === 'off' || process.env.CAVEMAN_NATIVE_MODE === 'record' ? 'record-only' : 'full-safe';
  }
  process.env.CAVEMAN_NATIVE_MODE = process.env.CAVEMAN_NATIVE_PROFILE === 'record-only' ? 'record' : 'safe';
  if (process.env.CAVEMAN_WRAP_MODE === 'pixel') process.env.CAVEMAN_WRAP_MODE = 'compress';
}
export function guardDispatch(verb, argv) {
  const deny = new Set(['update','setup','init','enable','disable','login','logout','convert','welcome']);
  const registration = (verb === 'skills' && ['install','add','import'].includes(argv[0])) || (verb === 'mcp' && ['install','uninstall'].includes(argv[0])) || (verb === 'hooks' && !['list','status','--help','-h'].includes(argv[0])) || (verb === 'doctor' && argv.includes('--fix'));
  if (deny.has(verb) || registration || ['wrap','run'].includes(verb)) throw new Error(`Maintained release blocks registration or update command: ${verb}`);
}
