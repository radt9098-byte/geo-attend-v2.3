import assert from 'node:assert/strict';
import {harness,phone,api} from './harness.mjs';
const worker=await harness(),{db}=worker,prepare=db.prepare;const identity=await phone();
const token='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex'),now=Date.now();
await prepare("INSERT INTO organization VALUES(1,'android','Test Office',12,77,65)").run();
await prepare("INSERT INTO accounts(id,name,login,hash,salt,role,active,created) VALUES('employee','Test Employee','test.employee','hash','salt','employee',1,?)",[now]).run();
await prepare("INSERT INTO sessions VALUES(?,'employee','android',?)",[hash,now+86400000]).run();
await prepare("INSERT INTO devices VALUES('employee',?,?,'Phone','approved',?)",[identity.info.id,identity.info.key,now]).run();
await prepare("INSERT INTO session_devices VALUES(?,'employee',?)",[hash,identity.info.id]).run();
const record=(id=crypto.randomUUID(),start=now-3600000,end=now-1800000)=>({id,account:'employee',start,end,distance:5,accuracy:8,office:{name:'Test Office',lat:12,lon:77,radius:65}});
async function request(records,authorization=true){return api(worker,'syncOffline',{records},identity,authorization?token:'')}
try{
 const first=record();assert.equal((await request([first])).status,200);
 assert.deepEqual((await request([first])).body.accepted,[first.id]);
 assert.equal((await prepare('SELECT COUNT(*) AS n FROM attendance').first()).n,1,'retry must not duplicate');
 assert.equal((await request([record()])).status,409,'overlap rejected');
 assert.equal((await request([{...record(undefined,now-1500000,now-1200000),account:'other'}])).status,409);
 assert.equal((await request([{...record(undefined,now-1500000,now-1200000),office:{name:'Other',lat:12,lon:77,radius:65}}])).status,409);
 assert.equal((await request([record(undefined,now+100000,now+200000)])).status,409);
 assert.equal((await request([record(undefined,now-700000000,now-699000000)])).status,409);
 assert.equal((await request([record()],false)).status,401);
 const second=record(undefined,now-1500000,now-1200000);assert.equal((await request([second])).status,200);
 await prepare("UPDATE accounts SET last_seen=? WHERE id='employee'",[now-100000]).run();
 await prepare("INSERT INTO attendance(id,account,start,distance) VALUES('online-before','employee',?,5)",[now-110000]).run();
 assert.equal((await request([record(undefined,now-90000,now-70000)])).status,200);
 assert.equal((await prepare("SELECT end FROM attendance WHERE id='online-before'").first()).end,now-100000,'online session closes before imported offline period');
 await prepare("UPDATE accounts SET active=0 WHERE id='employee'").run();assert.equal((await request([record()])).status,401,'removed account rejected');
 console.log('PASS: valid sync, retry deduplication, overlap, wrong account, changed workplace, future/old timestamps, authentication, and removed account.');
}finally{worker.cleanup()}
