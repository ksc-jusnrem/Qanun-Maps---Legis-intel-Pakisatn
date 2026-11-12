import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-skip-pattern=whole|source supplements|supplement PNGs',fileURLToPath(new URL('./reader.test.mjs',import.meta.url))],{stdio:'inherit'});
console.log('READER_MODULE_SHA256 '+crypto.createHash('sha256').update(fs.readFileSync(new URL('./reader.mjs',import.meta.url))).digest('hex'));
process.exitCode=result.status??1;
