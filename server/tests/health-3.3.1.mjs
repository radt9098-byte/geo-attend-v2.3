import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {harness,phone,api,requestObject} from './harness.mjs';
const w=await harness(),{db}=w;const admin=await phone('Admin'),employee=await phone('Employee');
const call=(a,b,p=admin,t='')=>api(w,a,b,p,t);
try{
 await call('setup',{name:'Admin',login:'office.admin',pin:'123456',office:'Office',lat:12,lon:77,radius:65});
 const at=(await call('login',{login:'office.admin',pin:'123456',device:admin.info})).body.token;
 await call('employees',{name:'Employee',login:'office.staff',pin:'654321'},admin,at);
 const e=await db.prepare("SELECT id FROM accounts WHERE login='office.staff'").first();
 await call('login',{login:'office.staff',pin:'654321',device:employee.info},employee);
 await call('approveDevice',{account:e.id,device:employee.info.id},admin,at);
 const et=(await call('login',{login:'office.staff',pin:'654321',device:employee.info},employee)).body.token;
 assert.equal((await call('health',{state:'gps_off'},admin,at)).status,403);
 assert.equal((await call('health',{state:'inside'},employee,et)).status,400,'client cannot claim verified inside through health');
 assert.equal((await call('health',{state:'finding',pending:2001},employee,et)).status,400);
 assert.equal((await call('health',{state:'finding',fixAge:-1},employee,et)).status,400);
 await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0},employee,et);
 const verified=(await db.prepare('SELECT last_seen FROM accounts WHERE id=?').bind(e.id).first()).last_seen;
 await call('health',{state:'gps_off',fixAge:null,pending:3,batteryRestricted:true},employee,et);
 assert.equal((await db.prepare('SELECT last_seen FROM accounts WHERE id=?').bind(e.id).first()).last_seen,verified,'online health must not extend verified work');
 let stats=(await call('stats',null,admin,at)).body,health=stats.employees[0];assert.equal(health.tracking_health,'gps_off');assert.equal(health.pending_records,3);assert.equal(health.battery_restricted,1);assert.ok(health.last_contact>=verified);
 await call('heartbeat',{lat:12,lon:77,accuracy:70,age:0},employee,et);
 health=(await call('stats',null,admin,at)).body.employees[0];assert.equal(health.tracking_health,'uncertain');assert.equal(health.last_seen,verified,'uncertain fixes do not accrue verified time');
 // A conflict during offline syncing must leave current heartbeat usable.
 const r=await call('syncOffline',{records:[{id:crypto.randomUUID(),account:e.id,start:Date.now()-5000,end:Date.now()-1000,distance:1,accuracy:5,office:{name:'Different Office',lat:12,lon:77,radius:65}}]},employee,et);assert.equal(r.status,409);
 assert.equal((await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0},employee,et)).body.state,'checked in');
 await call('health',{state:'sync_attention',pending:1},employee,et);health=(await call('stats',null,admin,at)).body.employees[0];assert.equal(health.tracking_health,'sync_attention');
 execFileSync('python3',['-c',"import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);s=open(sys.argv[2]).read();c.executescript(s);c.executescript(s);c.commit()",w.dbfile,new URL('../migration-3.3.1.sql',import.meta.url).pathname]);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM attendance').first()).n,1);
 const clock=Date.now();await db.prepare('UPDATE attendance SET start=? WHERE account=? AND end IS NULL').bind(clock-240000,e.id).run();await db.prepare('UPDATE accounts SET last_seen=? WHERE id=?').bind(clock-60000,e.id).run();await call('health',{state:'gps_off'},employee,et);
 const csv=await (await w.handleGeo(await requestObject('export',null,admin,at),true)).text();assert.match(csv,/,"3","In progress","in progress"/,'CSV uses verified time, not the latest connectivity report');
 await call('pause',{},employee,et);assert.equal((await db.prepare('SELECT state FROM employee_health WHERE account=?').bind(e.id).first()).state,'paused');
 console.log('PASS: employee-only advisory health, GPS uncertainty, unchanged verified hours, pending-record conflicts, validation and repeatable health migration.');
}finally{w.cleanup()}
