// FCM HTTP v1. The private service-account JSON belongs only in a Worker secret.
const PROJECT='geo-attend-v3-3';
const enc=new TextEncoder();
const b64=(b:Uint8Array)=>btoa(Array.from(b,x=>String.fromCharCode(x)).join('')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
let cached:{source:string;value:string;until:number}|undefined;
export async function accessToken(secret:string,transport:typeof fetch=fetch,now=Date.now()){
 if(cached?.source===secret&&cached.until>now+60000)return cached.value;
 const key=JSON.parse(secret);
 if(key.type!=='service_account'||key.project_id!==PROJECT||!key.client_email?.endsWith('@'+PROJECT+'.iam.gserviceaccount.com')||typeof key.private_key!=='string')throw Error('Invalid notification credentials');
 const pem=key.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const signing=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const iat=Math.floor(now/1000),body=b64(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+b64(enc.encode(JSON.stringify({iss:key.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600})));
 const sig=b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signing,enc.encode(body))));
 const r=await transport('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:body+'.'+sig}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Notification sender authentication failed');const j:any=await r.json();
 if(typeof j.access_token!=='string'||!Number.isFinite(j.expires_in)||j.expires_in<=0)throw Error('Invalid notification access token');
 cached={source:secret,value:j.access_token,until:now+Math.min(j.expires_in,3600)*1000};return cached.value;
}
export function messageFor(row:any){return {message:{token:row.token,data:{eventId:row.id,employeeId:row.employee,name:row.name,kind:row.kind,at:String(row.at),reason:row.reason||'',adminId:row.recipient,sessionId:row.session},android:{priority:'HIGH',ttl:'86400s',restricted_package_name:'com.geoattend.app'}}};}
export async function flushPush(db:any,secret?:string,transport:typeof fetch=fetch,now=Date.now()){
 if(!secret)return;
 const due=await db.prepare("SELECT d.event,d.registration FROM push_deliveries d JOIN push_events e ON e.id=d.event WHERE d.sent IS NULL AND d.attempts<12 AND d.next_at<=? AND d.lease_until<? AND e.created>? ORDER BY d.next_at LIMIT 8").bind(now,now,now-86400000).all();
 if(!due.results.length)return;
 const bearer=await accessToken(secret,transport,now);
 for(const item of due.results){
  const lease=crypto.randomUUID();const claim=await db.prepare('UPDATE push_deliveries SET lease=?,lease_until=?,attempts=attempts+1 WHERE event=? AND registration=? AND sent IS NULL AND lease_until<? AND next_at<=? AND attempts<12').bind(lease,now+60000,item.event,item.registration,now,now).run();if(!claim.meta.changes)continue;
  const row=await db.prepare("SELECT e.*,p.token,d.recipient,d.attempts,d.session FROM push_deliveries d JOIN push_events e ON e.id=d.event JOIN push_registrations p ON p.id=d.registration AND p.session=d.session AND p.account=d.recipient JOIN sessions s ON s.token=p.session AND s.account=p.account JOIN accounts a ON a.id=p.account WHERE d.event=? AND d.registration=? AND d.lease=? AND s.expires>? AND a.role='admin' AND a.active=1").bind(item.event,item.registration,lease,now).first();
  if(!row){await db.prepare('DELETE FROM push_deliveries WHERE event=? AND registration=? AND lease=?').bind(item.event,item.registration,lease).run();continue;}
  try{
   const r=await transport('https://fcm.googleapis.com/v1/projects/'+PROJECT+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(messageFor(row)),signal:AbortSignal.timeout(10000)});
   if(r.ok){await db.prepare('UPDATE push_deliveries SET sent=?,lease_until=0 WHERE event=? AND registration=? AND lease=?').bind(now,item.event,item.registration,lease).run();continue;}
   const error:any=await r.json().catch(()=>({}));const unregistered=error?.error?.details?.some((x:any)=>x.errorCode==='UNREGISTERED');
   if(unregistered){await db.prepare('DELETE FROM push_registrations WHERE id=? AND session=?').bind(item.registration,row.session).run();continue;}
   if(r.status===401)cached=undefined;
   // Retry transient failures. Configuration errors are surfaced by pushStatus/testPush.
  }catch{/* No credential or token is ever logged. */}
  const delay=Math.min(3600000,30000*2**Math.min(row.attempts,7));
  await db.prepare('UPDATE push_deliveries SET next_at=?,lease_until=0 WHERE event=? AND registration=? AND lease=?').bind(now+delay,item.event,item.registration,lease).run();
 }
}
export async function cleanupPush(db:any,now=Date.now()){
 await db.batch([db.prepare('DELETE FROM push_events WHERE created<?').bind(now-86400000),db.prepare('DELETE FROM push_registrations WHERE session NOT IN (SELECT token FROM sessions WHERE expires>?)').bind(now)]);
}
