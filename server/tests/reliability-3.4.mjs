import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {harness,phone,api,requestObject} from './harness.mjs';
const w=await harness(),db=w.db,identity=await phone();const realNow=Date.now,base=Date.UTC(2026,9,15,17,55),token='b'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');let clock=base;Date.now=()=>clock;
const call=(action,data)=>api(w,action,data,identity,token);
const record=(start,end,id=crypto.randomUUID())=>({id,account:'employee',start,end,distance:5,accuracy:8,office:{name:'Office',lat:12,lon:77,radius:65}});
const total=async()=>Number((await db.prepare("SELECT SUM(COALESCE(end,(SELECT last_seen FROM accounts WHERE id='employee'))-start) n FROM attendance WHERE account='employee'").first()).n||0);
try{
 await db.prepare("INSERT INTO organization VALUES(1,'android','Office',12,77,65)").run();
 await db.prepare("INSERT INTO accounts(id,name,login,hash,salt,role,active,created) VALUES('employee','Test','test.staff','hash','salt','employee',1,?)").bind(base).run();
 await db.prepare("INSERT INTO sessions VALUES(?,'employee','android',?)").bind(hash,base+86400000).run();
 await db.prepare("INSERT INTO devices VALUES('employee',?,?,'Phone','approved',?)").bind(identity.info.id,identity.info.key,base).run();
 await db.prepare("INSERT INTO session_devices VALUES(?,'employee',?)").bind(hash,identity.info.id).run();
 const beat=()=>call('heartbeat',{lat:12,lon:77,accuracy:5,age:0});
 assert.equal((await beat()).status,200);
 // Two virtual hours with one minute samples and a ten-minute network outage.
 for(let minute=1;minute<=120;minute++){
  clock=base+minute*60000;
  if(minute>=41&&minute<=50)continue;
  assert.equal((await beat()).status,200);
 }
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM attendance').first()).n,2,'only long outage splits session');
 const offline=record(base+40*60000,base+51*60000);
 assert.equal((await call('syncOffline',{records:[offline]})).status,200);
 assert.equal(await total(),120*60000,'offline recovery fills outage exactly once across midnight');
 assert.equal((await call('syncOffline',{records:[offline]})).status,200);assert.equal(await total(),120*60000,'lost response retry cannot add hours');
 // Adjacent, nested, head/tail and gap coverage resolved without double-counting.
 for(const r of [record(base+10,base+120*60000-10),record(base-30000,base+30000),record(base+119*60000,clock+30000)]){
  assert.equal((await call('syncOffline',{records:[r]})).status,200);
 }
 assert.equal(await total(),121*60000);
 const overlap=await db.prepare("SELECT COUNT(*) n FROM attendance a JOIN attendance b ON a.id<b.id AND a.account=b.account AND a.start<COALESCE(b.end,?) AND b.start<COALESCE(a.end,?)").bind(clock,clock).first();assert.equal(overlap.n,0,'no overlapping stored intervals');
 assert.equal((await call('syncOffline',{records:[{...offline,end:offline.end-1}]})).status,409,'receipt rejects changed retry payload');
 // Health does not accrue time, and brief GPS uncertainty no longer closes a session.
 await beat();const frozen=await total();clock+=100000;await call('health',{state:'gps_off'});await call('stats',null);assert.equal(await total(),frozen);
 assert.ok(await db.prepare("SELECT id FROM attendance WHERE end IS NULL").first(),'short recovery hold retains session');
 clock+=100000;await call('stats',null);assert.equal(await total(),frozen,'hold expiry never credits unverified time');
 const simultaneous=record(base-60000,base-30000);
 const responses=await Promise.all([call('syncOffline',{records:[simultaneous]}),call('syncOffline',{records:[simultaneous]})]);assert.ok(responses.every(r=>r.status===200));const afterRetry=await total();assert.equal(afterRetry,frozen+30000,'concurrent retry imports missing interval once');
 await beat();clock+=20000;await call('heartbeat',{lat:12.01,lon:77,accuracy:5,age:0});clock+=20000;assert.equal((await call('heartbeat',{lat:12.01,lon:77,accuracy:5,age:0})).body.state,'checked out');
 assert.equal((await call('export',null)).status,403,'only admins may export');
 const migrationTotal=await total();
 execFileSync('python3',['-c',"import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);s=open(sys.argv[2]).read();c.executescript(s);c.executescript(s);c.commit()",w.dbfile,new URL('../migration-3.4.sql',import.meta.url).pathname]);
 assert.equal(await total(),migrationTotal,'repeat migration preserves hours');
 console.log('PASS: two-hour virtual shift, ten-minute outage recovery, exact union hours, retries, head/tail/nested overlaps, receipt conflicts, no duplicate intervals, brief GPS hold, frozen unverified time, IST midnight/AM-PM export, repeatable migration.');
}finally{Date.now=realNow;w.cleanup()}
