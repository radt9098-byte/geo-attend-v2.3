import {readFileSync} from 'node:fs';
import {createPrivateKey,sign} from 'node:crypto';
try{
 const c=JSON.parse(readFileSync(new URL('./notification-credentials.json',import.meta.url),'utf8'));
 if(c.type!=='service_account'||c.project_id!=='geo-attend-v3-3'||!c.client_email?.endsWith('@geo-attend-v3-3.iam.gserviceaccount.com'))throw Error('The notification credential belongs to a different Firebase project.');
 const key=createPrivateKey(c.private_key);const now=Math.floor(Date.now()/1000);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:c.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const jwt=body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Firebase could not verify the sender. Check internet and automatic date/time; do not share the credential.');
 const j=await r.json();if(typeof j.access_token!=='string')throw Error('Firebase verification returned an unexpected response.');
 // validate_only checks FCM API enablement and sender permission without sending any notification.
 const check=await fetch('https://fcm.googleapis.com/v1/projects/geo-attend-v3-3/messages:send',{method:'POST',headers:{Authorization:'Bearer '+j.access_token,'Content-Type':'application/json'},body:JSON.stringify({validate_only:true,message:{topic:'geo-attend-setup-validation',data:{test:'configuration-only'}}}),signal:AbortSignal.timeout(30000)});
 if(!check.ok)throw Error('Firebase Messaging validation failed (HTTP '+check.status+'). Check that Firebase Cloud Messaging API is enabled for geo-attend-v3-3. No notification was sent.');
 console.log('Firebase sender verified. No test message was sent.');
}catch(e){console.error(e.message.includes('Firebase')||e.message.includes('notification')?e.message:'Could not verify the private notification credential.');process.exitCode=1;}
