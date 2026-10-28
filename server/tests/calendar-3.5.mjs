import assert from 'node:assert/strict';
import {harness,phone,api,requestObject} from './harness.mjs';
const w=await harness(),realNow=Date.now;let clock=Date.UTC(2026,9,28,3,30);Date.now=()=>clock;
const admin=await phone('Admin'),employee=await phone('Employee'),at='a'.repeat(64),et='e'.repeat(64);
async function seed(id,role,identity,token){const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');await w.db.prepare('INSERT INTO accounts(id,name,login,hash,salt,role,active,created) VALUES(?,?,?,?,?,?,1,?)').bind(id,id,id,'hash','salt',role,clock).run();await w.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(hash,id,'android',clock+864000000).run();await w.db.prepare('INSERT INTO devices VALUES(?,?,?,?,?,?)').bind(id,identity.info.id,identity.info.key,id,'approved',clock).run();await w.db.prepare('INSERT INTO session_devices VALUES(?,?,?)').bind(hash,id,identity.info.id).run();}
const call=(action,data,asAdmin=false)=>api(w,action,data,asAdmin?admin:employee,asAdmin?at:et);
try{
 await w.db.prepare("INSERT INTO organization VALUES(1,'android','Office',12,77,50)").run();await seed('admin','admin',admin,at);await seed('employee','employee',employee,et);
 assert.equal(w.scheduledFor('2026-11-01','employee',[]),false,'Sunday default');assert.equal(w.scheduledFor('2026-10-31','employee',[]),true);
 assert.equal(w.officeDay(Date.UTC(2026,9,31,18,30)),'2026-11-01','IST midnight');
 assert.equal((await call('calendar',{day:'2026-10-28',mode:'holiday',employees:[]})).status,403);
 assert.equal((await call('calendar',{day:'2026-10-27',mode:'holiday',employees:[]},true)).status,400,'cannot rewrite past schedule');
 assert.equal((await call('calendar',{day:'2026-10-28',mode:'selected',employees:['missing']},true)).status,400);
 assert.equal((await call('calendar',{day:'2026-10-28',mode:'selected',employees:['employee']},true)).status,200);
 const start=clock;assert.equal((await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0})).body.state,'checked in');
 // Two-hour shift: GPS evidence is 90 seconds apart; routine requests are 120 seconds apart.
 for(let t=120;t<=7200;t+=120){clock=start+t*1000;const age=(t%90)*1000;assert.equal((await call('heartbeat',{lat:12,lon:77,accuracy:5,age})).body.state,'checked in');await call('stats',null,true);}
 assert.equal((await w.db.prepare('SELECT COUNT(*) n FROM attendance').first()).n,1,'normal slower cadence must not fragment attendance');
 const last=(await w.db.prepare("SELECT last_seen FROM accounts WHERE id='employee'").first()).last_seen;
 clock+=120000;await call('health',{state:'gps_off'});assert.equal((await w.db.prepare("SELECT last_seen FROM accounts WHERE id='employee'").first()).last_seen,last,'health does not credit time');
 assert.equal((await call('calendar',{day:'2026-10-28',mode:'holiday',employees:[]},true)).status,200);
 assert.equal((await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0})).body.scheduled,false);
 let record=await w.db.prepare('SELECT * FROM attendance').first();assert.equal(record.end,last);assert.equal(record.reason,'schedule stopped');
 assert.equal((await call('calendar',{day:'2026-11-01',mode:'all',employees:[]},true)).status,200);assert.equal(w.scheduledFor('2026-11-01','employee',(await w.db.prepare('SELECT * FROM work_calendar').all()).results),true);
 assert.equal((await call('export&period=2026',null)).status,403,'employee CSV denied server-side');
 const r=(id,start,end,reason='left workplace')=>({id,account:'employee',name:'Employee',login:'employee',start,end,reason});
 const items=w.readableRecords([r('a',0,30000,'tracking interrupted'),r('b',30000,90000,'offline device record'),r('c',200000,259999),r('d',300000,360000),r('e',400000,null)]);
 assert.deepEqual(items.map(x=>x.id),['e','d','a']);assert.equal(items.find(x=>x.id==='a').end,90000,'join fragments before filtering');
 const shortStart=Date.UTC(2026,9,28,8);await w.db.prepare("INSERT INTO attendance(id,account,start,end,reason,distance) VALUES('short','employee',?,?,'left workplace',5)").bind(shortStart,shortStart+59000).run();
 const response=await w.handleGeo(await requestObject('export&period=2026-10',null,admin,at),true);assert.equal(response.status,200);const bytes=new Uint8Array(await response.arrayBuffer()),csv=new TextDecoder().decode(bytes);assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);assert.match(csv,/Check-in time \(IST\)/);assert.match(csv,/09:00 AM/);assert.match(csv,/2h 0m/);assert.match(csv,/Schedule ended/);assert.doesNotMatch(csv,/UTC|Minutes|0h 0m/);assert.equal(csv.split('\r\n').length,2,'short record absent');
 const empty=await (await w.handleGeo(await requestObject('export&period=2025',null,admin,at),true)).text();assert.equal(empty.split('\r\n').length,1,'year filter applies');
 console.log('PASS 3.5: admin-only export/schedules, Sunday defaults, selected employees, IST dates, 2-hour slow-cadence shift, holiday stop, no health-time inflation, recovery joining, exact 60-second cutoff, month/year CSV.');
}finally{Date.now=realNow;w.cleanup();}
