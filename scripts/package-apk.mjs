import { readFile, copyFile, mkdir } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const suffix = pkg.roxMusic.distributionSuffix;
if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || !/^[a-z0-9-]*$/.test(suffix)) throw new Error('Invalid release metadata');
const name = `RoxMusic${suffix ? '_' + suffix : ''}_${pkg.version}.apk`;
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await copyFile(new URL('../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url), new URL('../artifacts/' + name, import.meta.url));
console.log(`APK: artifacts/${name} (debug-signed test build)`);
