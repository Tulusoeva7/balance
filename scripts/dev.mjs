import {spawn} from 'node:child_process';
import {existsSync,watch} from 'node:fs';
const python=process.env.BALANCE_PYTHON||process.env.ASDRK_PYTHON||(existsSync('backend/.venv/bin/python')?'backend/.venv/bin/python':'python3');
let stopping=false,restarting=false,timer,backend;
const startBackend=()=>{const child=spawn(python,['backend/app.py'],{stdio:'inherit'});child.on('error',error=>{process.stderr.write(`Backend: ${error.message}\n`);stop(1);});child.on('exit',code=>{if(child===backend&&!restarting&&!stopping)stop(code??1);});return child;};
backend=startBackend();
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js',...process.argv.slice(2)],{stdio:'inherit'});
const watcher=watch('backend',(_,filename)=>{if(stopping||!filename?.endsWith('.py')||filename.startsWith('test_'))return;clearTimeout(timer);timer=setTimeout(()=>{if(restarting||stopping)return;restarting=true;backend.once('exit',()=>{if(!stopping){backend=startBackend();restarting=false;}});backend.kill('SIGTERM');},300);});
function stop(code=0){if(stopping)return;stopping=true;clearTimeout(timer);watcher.close();backend.kill('SIGTERM');frontend.kill('SIGTERM');process.exitCode=code;}
frontend.on('exit',code=>stop(code??0));process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
