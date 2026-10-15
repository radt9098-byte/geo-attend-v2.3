import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {harness,phone,api} from './harness.mjs';
import {flushPush,messageFor,accessToken} from '../push.js';
const w=await harness();const {db}=w;const admin=await phone('Admin'),second=await phone('Admin second'),employee=await phone('Employee');
const call=(a,b,p=admin,t='')=>api(w,a,b,p,t);
try{
 await call('setup',{name:'Office Admin',login:'office.admin',pin:'123456',office:'Office',lat:12,lon:77,radius:65});
 const t=(await call('login',{login:'office.admin',pin:'123456',device:admin.info})).body.token;
 const t2=(await call('login',{login:'office.admin',pin:'123456',device:second.info},second)).body.token;
 assert.equal((await call('registerPush',{token:'bad'},admin,t)).status,400);
 assert.equal((await call('registerPush',{token:'a'.repeat(140)},admin,t)).status,200);
 assert.equal((await call('registerPush',{token:'b'.repeat(140)},second,t2)).status,200);
 await call('employees',{name:'Test Employee',login:'staff.one',pin:'654321'},admin,t);
 const e=await db.prepare("SELECT id FROM accounts WHERE login='staff.one'").first();
 await call('login',{login:'staff.one',pin:'654321',device:employee.info},employee);
 await call('approveDevice',{account:e.id,device:employee.info.id},admin,t);
 const et=(await call('login',{login:'staff.one',pin:'654321',device:employee.info},employee)).body.token;
 assert.equal((await call('registerPush',{token:'c'.repeat(140)},employee,et)).status,403);
 assert.equal((await call('pushStatus',null,employee,et)).status,403);
 assert.equal((await call('registerPush',{token:'c'.repeat(140)},employee,t)).status,401,'copied admin session rejected');
 for(let i=0;i<3;i++)assert.equal((await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0},employee,et)).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_events').first()).n,1,'repeated heartbeats create one event');
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_deliveries').first()).n,2,'one delivery per admin phone');
 // Reapplying migration creates no historical events and keeps accounts intact.
 execFileSync('python3',['-c',"import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.executescript(open(sys.argv[2]).read());c.commit()",w.dbfile,new URL('../migration-3.3.sql',import.meta.url).pathname]);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_events').first()).n,1);
 await call('logout',{},second,t2);
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pk=Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey)).toString('base64');
 const secret=JSON.stringify({type:'service_account',project_id:'geo-attend-v3-3',client_email:'test@geo-attend-v3-3.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+pk+'\n-----END PRIVATE KEY-----'});
 let oauth=0;const messages=[];
 const transport=async(url,opts)=>{if(url==='https://oauth2.googleapis.com/token'){
  oauth++;const jwt=opts.body.get('assertion').split('.');const claims=JSON.parse(Buffer.from(jwt[1],'base64url'));
  assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');assert.equal(claims.exp-claims.iat,3600);
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key.publicKey,Buffer.from(jwt[2],'base64url'),new TextEncoder().encode(jwt[0]+'.'+jwt[1])));
  return Response.json({access_token:'test-access',expires_in:3600});}
  assert.equal(url,'https://fcm.googleapis.com/v1/projects/geo-attend-v3-3/messages:send');assert.equal(opts.headers.Authorization,'Bearer test-access');messages.push(JSON.parse(opts.body));return Response.json({name:'test/message'});};
 await flushPush(db,secret,transport,Date.now()+5000);assert.equal(messages.length,1,'signed-out phone must not receive an alert');
 assert.equal(messages[0].message.data.name,'Test Employee');assert.equal(messages[0].message.data.kind,'in');assert.equal(messages[0].message.data.sessionId,Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))).toString('hex'));assert.equal(messages[0].message.android.restricted_package_name,'com.geoattend.app');assert.ok(!messages[0].message.notification,'data-only delivery uses the silent channel and account checks');
 await flushPush(db,secret,transport,Date.now()+6000);assert.equal(messages.length,1,'sent event is not re-sent');assert.equal(oauth,1);
 await call('pause',{},employee,et);assert.equal((await db.prepare("SELECT COUNT(*) n FROM push_events WHERE kind='out'").first()).n,1);
 await call('pause',{},employee,et);assert.equal((await db.prepare("SELECT COUNT(*) n FROM push_events WHERE kind='out'").first()).n,1,'closing again does not duplicate checkout');
 await flushPush(db,secret,transport,Date.now()+7000);assert.equal(messages.length,2);assert.equal(messages[1].message.data.reason,'tracking paused');
 // Historical offline records do not produce a fresh check-in/out burst.
 await db.prepare("INSERT INTO attendance(id,account,start,end,reason,distance) VALUES(?,?,?,?,?,5)").bind(crypto.randomUUID(),e.id,Date.now()-600000,Date.now()-500000,'offline device record').run();
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_events').first()).n,2);
 // FCM failures retain the queue for retry; a retry uses the same event ID.
 await call('heartbeat',{lat:12,lon:77,accuracy:5,age:0},employee,et);
 let failed=0;await flushPush(db,secret,async(url,opts)=>{failed++;return Response.json({error:{status:'UNAVAILABLE'}},{status:503});},Date.now()+8000);assert.equal(failed,1);
 const pending=await db.prepare('SELECT * FROM push_deliveries WHERE sent IS NULL').first();assert.ok(pending.next_at>Date.now()+8000);
 await flushPush(db,secret,transport,pending.next_at+1);assert.equal(messages.length,3);
 // Token rotation replaces the prior token for the same device without replaying old events.
 await call('registerPush',{token:'d'.repeat(140)},admin,t);assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_registrations').first()).n,1);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_deliveries').first()).n,0);
 assert.equal((await call('pushStatus',null,admin,t)).body.registered,true);
 await call('recoverAdmin',{login:'office.admin',code:(await call('createRecovery',{pin:'123456'},admin,t)).body.recoveryCode,pin:'123456'});
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_registrations').first()).n,0,'recovery revokes push recipients');
 await assert.rejects(accessToken(JSON.stringify({type:'service_account',project_id:'wrong'}),transport));
 console.log('PASS: admin-only push, signed phone registration, event deduplication, logout/recovery revocation, repeatable migration, offline history suppression, JWT signing, FCM retry, and token rotation.');
}finally{w.cleanup()}
