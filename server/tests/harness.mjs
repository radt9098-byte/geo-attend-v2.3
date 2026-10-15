import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL,fileURLToPath} from 'node:url';
export async function harness(){
 const folder=mkdtempSync(join(tmpdir(),'geo-attend-test-')),dbfile=join(folder,'test.sqlite'),here=fileURLToPath(new URL('.',import.meta.url));
 execFileSync('python3',['-c',"import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(open(sys.argv[2]).read()); c.commit()",dbfile,join(here,'../schema.sql')]);
 const run=q=>JSON.parse(execFileSync('python3',[join(here,'sqlite_bridge.py'),dbfile],{input:JSON.stringify(q),encoding:'utf8'}));
 function prepare(sql,args=[]){return {sql,args,bind(...values){return prepare(sql,values)},async run(){return run({sql,args})},async all(){return run({sql,args})},async first(){return run({sql,args}).results[0]??null}}}
 const db={prepare,async batch(statements){return run(statements.map(s=>({sql:s.sql,args:s.args})))}};globalThis.testEnv={DB:db};
 writeFileSync(join(folder,'worker.mjs'),readFileSync(new URL('../worker.js',import.meta.url),'utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.testEnv;"));
 writeFileSync(join(folder,'push.js'),readFileSync(new URL('../push.js',import.meta.url),'utf8'));writeFileSync(join(folder,'package.json'),'{"type":"module"}');
 const worker=await import(pathToFileURL(join(folder,'worker.mjs')));return {db,dbfile,...worker,cleanup(){rmSync(folder,{recursive:true,force:true})}};
}
export async function phone(name='Test Phone'){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),raw=new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey));const key=Buffer.from(raw).toString('base64'),id=Buffer.from(await crypto.subtle.digest('SHA-256',raw)).toString('hex');return {pair,info:{id,key,name}};
}
export async function requestObject(action,data,identity,token='',options={}){
 const path='/api/native?action='+action,body=data===null?'':JSON.stringify(data),method=data===null?'GET':'POST',time=String(options.time??Date.now()),nonce=options.nonce??crypto.randomUUID();const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))).toString('hex');const message=[method,path,time,nonce,digest].join('\n');const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 if(identity){headers['X-Geo-Device']=identity.info.id;headers['X-Geo-Time']=time;headers['X-Geo-Nonce']=nonce;headers['X-Geo-Signature']=Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.pair.privateKey,new TextEncoder().encode(message))).toString('base64');}
 return new Request('https://example.test'+path,{method,headers,...(data===null?{}:{body})});
}
export async function api(worker,action,data,identity,token='',options={}){const req=await requestObject(action,data,identity,token,options),r=await worker.handleGeo(req,true);return {status:r.status,body:await r.json()};}
