import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const executable=resolve('node_modules/@foundry-rs/forge-'+process.platform+'-'+(process.arch==='x64'?'amd64':process.arch)+'/bin/forge'+(process.platform==='win32'?'.exe':''));
const result=spawnSync(executable,process.argv.slice(2),{stdio:'inherit'});
if(result.error) console.error(result.error.message);
process.exit(result.status??1);
