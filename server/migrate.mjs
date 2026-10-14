import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const OLD='https://geo-attend.tangynewt9.chatgpt.site';
const columns={organization:['id','owner','name','lat','lon','radius'],accounts:['id','name','login','hash','salt','role','active','last_seen','last_distance','accuracy','outside_since','created'],attendance:['id','account','start','end','reason','distance']};
const sqlValue=v=>v===null||v===undefined?'NULL':typeof v==='number'&&Number.isFinite(v)?String(v):"'"+String(v).replaceAll("'","''")+"'";
async function ask(message){const r=createInterface({input:process.stdin,output:process.stdout});try{return (await r.question(message)).trim()}finally{r.close()}}
async function hidden(message){if(!process.stdin.isTTY)throw Error('Run this in an interactive CMD window.');process.stdout.write(message);process.stdin.setRawMode(true);process.stdin.resume();return new Promise((resolve,reject)=>{let value='';const cleanup=()=>{process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')};const read=chunk=>{for(const ch of chunk.toString()){if(ch==='\u0003'){cleanup();reject(Error('Cancelled.'));return}if(ch==='\r'||ch==='\n'){cleanup();resolve(value);return}if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);continue}if(/[0-9]/.test(ch)&&value.length<12)value+=ch;}};process.stdin.on('data',read);})}
async function remote(action,body,token=''){const r=await fetch(OLD+'/api/native?action='+action,{method:body?'POST':'GET',headers:{'Accept':'application/json','User-Agent':'Mozilla/5.0',...(body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('The original service did not return an API response. Try again later.');const j=await r.json();if(!r.ok)throw Error(j.error||'Transfer failed.');return j;}
function wrangler(args){const command=['npx','--yes','wrangler@4.150.0',...args];const result=process.platform==='win32'?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command.join(' ')],{stdio:'inherit'}):spawnSync(command[0],command.slice(1),{stdio:'inherit'});if(result.error||result.status!==0)throw Error('Cloudflare command failed. Stop here and share the command error, not any credential or SQL file.');}
let token='';
try{
 console.log('Geo Attend: copy existing accounts and attendance into your office database.');
 console.log('Pause employee tracking during the transfer. Do not create a new admin in the target database.');
 const status=await remote('status');
 if(!status.setup){console.log('No existing admin setup was found. No records to transfer.');process.exit(0)}
 if((await ask('Ready to transfer into the NEW database geo-attend-db? Type YES: ')).toUpperCase()!=='YES')throw Error('Cancelled.');
 const login=await ask('Existing Geo Attend ADMIN login ID: ');const pin=await hidden('Existing admin PIN (hidden): ');
 token=(await remote('login',{login,pin})).token;
 const session=await remote('status',undefined,token);if(session.user?.role!=='admin')throw Error('Use the administrator login, not an employee login.');
 const snapshot=await remote('backup',undefined,token);
 if(snapshot.schemaVersion!==1||!snapshot.tables)throw Error('Unexpected backup format.');
 let sql='-- Private Geo Attend migration. Contains hashed PINs and attendance. Keep this file private.\n';
 for(const [table,fields] of Object.entries(columns)){const rows=snapshot.tables[table];if(!Array.isArray(rows))throw Error('Incomplete backup.');for(const row of rows)sql+='INSERT INTO "'+table+'" ('+fields.map(n=>'"'+n+'"').join(',')+') VALUES ('+fields.map(n=>sqlValue(row[n])).join(',')+');\n';}
 const accounts=snapshot.tables.accounts,history=snapshot.tables.attendance;
 if(!accounts.some(a=>a.role==='admin'&&a.active===1)||snapshot.tables.organization.length!==1)throw Error('No active admin in the backup.');
 writeFileSync('migration-data.sql',sql,{mode:0o600});
 wrangler(['d1','execute','geo-attend-db','--remote','--file','migration-data.sql','--yes','--config','wrangler.jsonc']);
 console.log('Imported '+accounts.length+' accounts and '+history.length+' attendance sessions.');
 console.log('Keep migration-data.sql private. It is NOT something to send in chat.');
}catch(e){console.error(e.message);process.exitCode=1}finally{if(token){try{await remote('logout',{},token)}catch{}}}
