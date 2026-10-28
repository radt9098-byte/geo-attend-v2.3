import { flushPush, cleanupPush } from './push.js';
import { env } from 'cloudflare:workers';
async function headers() { return new Headers(); }
export function distance(a, b, c, d) { const r = (n) => n * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))); }
export function classify(d, accuracy, radius) { if (d + accuracy <= radius)
    return 'inside'; if (d - accuracy > radius)
    return 'outside'; return 'uncertain'; }
// Office calendar dates are always India Standard Time, independent of phone timezone.
export function officeDay(t) { return new Date(t + 19800000).toISOString().slice(0, 10); }
export function scheduledFor(day, account, rows) {
    const row = rows.find(r => r.day === day);
    if (!row)
        return new Date(day + 'T12:00:00Z').getUTCDay() !== 0;
    return row.mode === 'all' || (row.mode === 'selected' && JSON.parse(row.employees).includes(account));
}
// Join touching recovery fragments before the short-session display/export rule.
// Original evidence is retained to keep retry receipts and reconciliation reliable.
export function readableRecords(input) {
    const sorted = input.map(r => ({ ...r })).sort((a, b) => a.account.localeCompare(b.account) || a.start - b.start), out = [];
    for (const r of sorted) {
        const prev = out[out.length - 1];
        if (prev && prev.account === r.account && prev.end != null && r.start === prev.end && prev.reason !== 'left workplace' && (prev.reason === 'offline device record' || r.reason === 'offline device record')) {
            prev.end = r.end;
            prev.reason = r.reason;
            prev.verified_end = r.verified_end;
        }
        else
            out.push(r);
    }
    return out.filter(r => r.end == null || r.end - r.start >= 60000).sort((a, b) => b.start - a.start);
}
export const dynamic = 'force-dynamic';
const encoder = new TextEncoder();
const hex = (x) => Array.from(new Uint8Array(x)).map(b => b.toString(16).padStart(2, '0')).join('');
async function digest(s) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(s))); }
async function pinHash(pin, salt) { const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']); return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)); }
function equal(a, b) { if (a.length !== b.length)
    return false; let d = 0; for (let i = 0; i < a.length; i++)
    d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function out(data, status = 200, cookie) { const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }; if (cookie)
    h['Set-Cookie'] = cookie; return new Response(JSON.stringify(data), { status, headers: h }); }
const fail = (message, status = 400) => out({ error: message }, status);
const clean = (v, max = 80) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const cookie = (t) => `geo_session=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
const goodPin = (s) => typeof s === 'string' && /^\d{6,12}$/.test(s);
const goodLogin = (s) => /^[a-z0-9][a-z0-9._-]{2,39}$/.test(s);
function place(b) { return { name: clean(b.office, 100), lat: Number(b.lat), lon: Number(b.lon), radius: Number(b.radius) }; }
function validPlace(p, b) { return p.name && b.lat !== '' && b.lon !== '' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 && Number.isInteger(p.radius) && p.radius >= 50 && p.radius <= 80; }
function bytes64(s) { if (!/^[A-Za-z0-9+/=]{1,400}$/.test(s))
    throw new Error('key'); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function deviceIdentity(d) { const publicKey = clean(d?.key, 400), raw = bytes64(publicKey); if (raw.length < 80 || raw.length > 120)
    throw new Error('key'); const key = await crypto.subtle.importKey('spki', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); const id = hex(await crypto.subtle.digest('SHA-256', raw)); if (d?.id !== id)
    throw new Error('device'); return { id, key, publicKey, name: clean(d?.name, 60) || 'Android phone' }; }
async function deviceProof(req, body, publicKey, db) { try {
    const timestamp = req.headers.get('x-geo-time') || '', nonce = req.headers.get('x-geo-nonce') || '', signature = req.headers.get('x-geo-signature') || '';
    if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[-a-f0-9]{36}$/.test(nonce))
        return false;
    const raw = bytes64(publicKey), key = await crypto.subtle.importKey('spki', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const url = new URL(req.url);
    const message = [req.method, url.pathname + url.search, timestamp, nonce, await digest(body)].join('\n');
    const sig = bytes64(signature);
    if (sig.length !== 64 || !await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, encoder.encode(message)))
        return false;
    const result = await db.prepare('INSERT OR IGNORE INTO request_nonces(nonce,expires) VALUES(?,?)').bind(nonce, Date.now() + 600000).run();
    return result.meta.changes === 1;
}
catch {
    return false;
} }
export async function purgeRemoved(db, now = Date.now()) {
    const cutoff = now - 2592000000;
    for (let i = 0; i < 5; i++) {
        const r = await db.prepare("DELETE FROM attendance WHERE id IN (SELECT t.id FROM attendance t JOIN removed_employees r ON r.account=t.account JOIN accounts a ON a.id=r.account WHERE a.active=0 AND a.role='employee' AND r.removed_at<=? LIMIT 1000)").bind(cutoff).run();
        if (!r.meta.changes)
            break;
    }
    const ready = await db.prepare("SELECT r.account FROM removed_employees r JOIN accounts a ON a.id=r.account WHERE a.active=0 AND a.role='employee' AND removed_at<=? AND NOT EXISTS (SELECT 1 FROM attendance WHERE account=r.account) LIMIT 5").bind(cutoff).all();
    for (const r of ready.results) {
        await db.batch([
            db.prepare('DELETE FROM session_devices WHERE account=?').bind(r.account), db.prepare('DELETE FROM sessions WHERE account=?').bind(r.account), db.prepare('DELETE FROM devices WHERE account=?').bind(r.account), db.prepare('DELETE FROM admin_recovery WHERE account=?').bind(r.account), db.prepare('DELETE FROM accounts WHERE id=? AND active=0 AND role=\'employee\'').bind(r.account)
        ]);
    }
    await db.batch([db.prepare('DELETE FROM request_nonces WHERE expires<?').bind(now), db.prepare('DELETE FROM sessions WHERE expires<?').bind(now), db.prepare('DELETE FROM login_attempts WHERE until<?').bind(now)]);
}
export async function handleGeo(req, native = false) {
    const binding = env.DB;
    if (!binding)
        return fail('Attendance database is unavailable.', 503);
    const db = binding;
    const h = await headers(), viewer = native ? 'android' : h.get('oai-authenticated-user-id');
    const ownerEmail = h.get('oai-authenticated-user-email');
    const webOwner = (org) => org?.owner === viewer || (org?.owner === 'android' && !!env.NATIVE_OWNER_EMAIL && ownerEmail === env.NATIVE_OWNER_EMAIL);
    if (!viewer)
        return fail('Sign in with ChatGPT to access this private workplace.', 401);
    if (!native && req.method === 'POST' && req.headers.get('origin') !== new URL(req.url).origin)
        return fail('Invalid request origin.', 403);
    const url = new URL(req.url), action = url.searchParams.get('action') || 'status';
    let b = {}, bodyText = '';
    if (req.method === 'POST') {
        try {
            const text = await req.text();
            bodyText = text;
            if (text.length > 10000)
                return fail('Request is too large.');
            b = JSON.parse(text);
        }
        catch {
            return fail('Invalid request.');
        }
    }
    let org = await db.prepare('SELECT * FROM organization WHERE id=1').first();
    let account = null, sessionDevice = null;
    const token = native ? req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] : req.headers.get('cookie')?.match(/(?:^|;\s*)geo_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (token) {
        account = await db.prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.token=? AND s.viewer=? AND s.expires>? AND a.active=1').bind(await digest(token), viewer, Date.now()).first();
        if (!native && account?.role === 'admin' && !webOwner(org))
            account = null;
        if (native && account) {
            sessionDevice = await db.prepare('SELECT d.* FROM session_devices sd JOIN devices d ON d.account=sd.account AND d.id=sd.device WHERE sd.token=? AND sd.account=?').bind(await digest(token), account.id).first();
            if (!sessionDevice)
                return fail('Version 3.1 requires a fresh login from this phone.', 401);
            if (account.role === 'employee' && sessionDevice.state !== 'approved')
                return fail('This phone is no longer authorised. Ask your admin.', 401);
            if (req.headers.get('x-geo-device') !== sessionDevice.id || !await deviceProof(req, bodyText, sessionDevice.public_key, db))
                return fail('Phone verification failed. Check automatic date/time and log in again.', 401);
        }
    }
    if (action === 'status' && req.method === 'GET')
        return out({ serverVersion: "3.1", releaseVersion: "3.5", pushEnabled: !!env.FCM_SERVICE_ACCOUNT, schedule: account ? (await db.prepare('SELECT * FROM work_calendar ORDER BY day').all()).results : [], setup: !!org, user: account ? { id: account.id, name: account.name, role: account.role, login: account.login, recoveryReady: account.role === 'admin' ? !!await db.prepare('SELECT account FROM admin_recovery WHERE account=?').bind(account.id).first() : undefined } : null, office: org && account ? { name: org.name, lat: org.lat, lon: org.lon, radius: org.radius } : null });
    async function limited(key) { const now = Date.now(), a = await db.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first(); if (a && a.until > now && a.failures >= 5)
        return false; await db.prepare('INSERT INTO login_attempts(key,failures,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN until<? THEN 1 ELSE failures+1 END,until=CASE WHEN until<? THEN ? ELSE until END').bind(key, now + 600000, now, now, now + 600000).run(); return true; }
    if (action === 'recoverAdmin' && req.method === 'POST') {
        const login = clean(b.login, 40).toLowerCase();
        if (!goodLogin(login) || !goodPin(b.pin) || !/^[-a-f0-9]{48,60}$/.test(clean(b.code, 70)))
            return fail('Enter your admin ID, recovery code, and a new 6–12 digit PIN.');
        const limitKey = await digest('recovery:' + login);
        if (!await limited(limitKey))
            return fail('Too many recovery attempts. Try again in 10 minutes.', 429);
        const a = await db.prepare("SELECT a.*,r.hash AS recovery_hash FROM accounts a JOIN admin_recovery r ON r.account=a.id WHERE a.login=? AND a.role='admin' AND a.active=1").bind(login).first();
        const supplied = await digest(clean(b.code, 70).replaceAll('-', ''));
        if (!a || !equal(supplied, a.recovery_hash))
            return fail('Recovery details are incorrect.', 401);
        const salt = crypto.randomUUID(), hash = await pinHash(b.pin, salt), code = hex(crypto.getRandomValues(new Uint8Array(24)).buffer), newCodeHash = await digest(code), now = Date.now();
        const result = await db.batch([
            db.prepare('UPDATE accounts SET hash=?,salt=? WHERE id=? AND EXISTS (SELECT 1 FROM admin_recovery WHERE account=? AND hash=?)').bind(hash, salt, a.id, a.id, supplied), db.prepare('UPDATE admin_recovery SET hash=?,created=? WHERE account=? AND hash=?').bind(newCodeHash, now, a.id, supplied), db.prepare('DELETE FROM sessions WHERE account=? AND EXISTS (SELECT 1 FROM admin_recovery WHERE account=? AND hash=?)').bind(a.id, a.id, newCodeHash), db.prepare('DELETE FROM login_attempts WHERE key IN (?,?)').bind(limitKey, await digest('login:' + login))
        ]);
        if (!result[1].meta.changes)
            return fail('This recovery code has already been used.', 409);
        return out({ ok: true, recoveryCode: code });
    }
    if (action === 'setup' && req.method === 'POST') {
        if (org)
            return fail('Admin setup is already complete.', 409);
        if (!native && env.NATIVE_OWNER_EMAIL && ownerEmail !== env.NATIVE_OWNER_EMAIL)
            return fail('Only the workplace owner can create the first admin.', 403);
        const name = clean(b.name), login = clean(b.login, 40).toLowerCase(), p = place(b);
        if (!name || !goodLogin(login) || !goodPin(b.pin) || !validPlace(p, b))
            return fail('Enter a name, a valid login ID, a 6–12 digit PIN, and a workplace with a 50–80 m radius.');
        const salt = crypto.randomUUID(), hash = await pinHash(b.pin, salt), id = crypto.randomUUID(), recoveryCode = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
        try {
            await db.batch([db.prepare('INSERT INTO organization(id,owner,name,lat,lon,radius) VALUES(1,?,?,?,?,?)').bind(viewer, p.name, p.lat, p.lon, p.radius), db.prepare('INSERT INTO accounts(id,name,login,hash,salt,role,created) VALUES(?,?,?,?,?,?,?)').bind(id, name, login, hash, salt, 'admin', Date.now()), db.prepare('INSERT INTO admin_recovery(account,hash,created) VALUES(?,?,?)').bind(id, await digest(recoveryCode), Date.now())]);
        }
        catch {
            return fail('Admin setup was already completed. Please log in.', 409);
        }
        return out({ ok: true, recoveryCode });
    }
    if (action === 'login' && req.method === 'POST') {
        const login = clean(b.login, 40).toLowerCase();
        if (!goodLogin(login) || !goodPin(b.pin))
            return fail('Enter a valid login ID and a 6–12 digit PIN.');
        const key = await digest('login:' + login), now = Date.now();
        let attempt = await db.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first();
        if (attempt && attempt.until > now && attempt.failures >= 5)
            return fail('Too many attempts. Try again in 10 minutes.', 429);
        await db.prepare('INSERT INTO login_attempts(key,failures,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN until<? THEN 1 ELSE failures+1 END, until=CASE WHEN until<? THEN ? ELSE until END').bind(key, now + 600000, now, now, now + 600000).run();
        const a = await db.prepare('SELECT * FROM accounts WHERE login=? AND active=1').bind(login).first();
        const actual = await pinHash(b.pin, a?.salt || 'invalid-credential');
        if (!a || !equal(actual, a.hash) || (!native && a.role === 'admin' && !webOwner(org)))
            return fail('Incorrect login ID or PIN.', 401);
        let device;
        try {
            device = await deviceIdentity(b.device);
        }
        catch {
            return fail('Install Geo Attend 3.1 and try again. Phone identity is missing.', 400);
        }
        if (req.headers.get('x-geo-device') !== device.id || !await deviceProof(req, bodyText, device.publicKey, db))
            return fail('Phone verification failed. Check automatic date/time.', 401);
        await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
        let registered = await db.prepare('SELECT * FROM devices WHERE account=? AND id=?').bind(a.id, device.id).first();
        if (!registered) {
            const count = await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE account=? AND state='pending'").bind(a.id).first();
            if (a.role === 'employee' && count.n >= 5)
                return fail('Too many phone requests. Ask the admin to review them.', 429);
            await db.prepare('INSERT OR IGNORE INTO devices(account,id,public_key,name,state,created) VALUES(?,?,?,?,?,?)').bind(a.id, device.id, device.publicKey, device.name, 'pending', now).run();
            registered = await db.prepare('SELECT * FROM devices WHERE account=? AND id=?').bind(a.id, device.id).first();
        }
        if (registered.public_key !== device.publicKey)
            return fail('Phone identity conflict.', 409);
        if (a.role === 'employee' && registered.state !== 'approved')
            return fail('Phone approval required. Ask the admin to approve ' + device.name + ' · ' + device.id.slice(0, 8) + '.', 403);
        const t = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
        await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(now), db.prepare('INSERT INTO sessions(token,account,viewer,expires) VALUES(?,?,?,?)').bind(await digest(t), a.id, viewer, now + (native ? 2592000000 : 43200000)), db.prepare('INSERT INTO session_devices(token,account,device) VALUES(?,?,?)').bind(await digest(t), a.id, device.id)]);
        return native ? out({ ok: true, token: t }) : out({ ok: true }, 200, cookie(t));
    }
    if (!account)
        return fail('Please log in to continue.', 401);
    const admin = account.role === 'admin';
    if (action === 'calendar' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        const day = clean(b.day, 10), mode = b.mode, employees = b.employees;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day || day < officeDay(Date.now()))
            return fail('Choose today or a future date. Existing attendance is preserved.');
        if (!['all', 'holiday', 'selected'].includes(mode) || !Array.isArray(employees) || employees.length > 200 || employees.some((id) => typeof id !== 'string'))
            return fail('Invalid schedule.');
        if (mode === 'selected') {
            if (!employees.length)
                return fail('Select at least one employee.');
            for (const id of employees)
                if (!await db.prepare("SELECT id FROM accounts WHERE id=? AND role='employee' AND active=1").bind(id).first())
                    return fail('Employee not found.');
        }
        await db.prepare('INSERT INTO work_calendar(day,mode,employees,updated) VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET mode=excluded.mode,employees=excluded.employees,updated=excluded.updated').bind(day, mode, JSON.stringify(mode === 'selected' ? [...new Set(employees)] : []), Date.now()).run();
        return out({ ok: true });
    }
    async function phoneHealth(state, age = null) {
        const pending = Number.isSafeInteger(b.pending) && b.pending >= 0 && b.pending <= 2000 ? b.pending : 0;
        await db.prepare('INSERT INTO employee_health(account,last_contact,state,fix_age,pending,battery_restricted) VALUES(?,?,?,?,?,?) ON CONFLICT(account) DO UPDATE SET last_contact=excluded.last_contact,state=excluded.state,fix_age=excluded.fix_age,pending=excluded.pending,battery_restricted=excluded.battery_restricted').bind(account.id, Date.now(), state, age, pending, b.batteryRestricted === true ? 1 : 0).run();
    }
    if (action === 'health' && req.method === 'POST') {
        if (!native || admin)
            return fail('Employee phone access required.', 403);
        const allowed = ['finding', 'gps_off', 'permission_denied', 'stale_fix', 'sync_attention', 'mock_rejected', 'paused', 'service_error', 'stopped', 'scheduled_off'];
        if (!allowed.includes(b.state))
            return fail('Invalid tracking health state.');
        if (b.fixAge !== null && b.fixAge !== undefined && (!Number.isSafeInteger(b.fixAge) || b.fixAge < 0 || b.fixAge > 86400000))
            return fail('Invalid location age.');
        if (b.pending !== undefined && (!Number.isSafeInteger(b.pending) || b.pending < 0 || b.pending > 2000))
            return fail('Invalid pending record count.');
        if (b.state === 'scheduled_off') {
            const rows = (await db.prepare('SELECT * FROM work_calendar').all()).results;
            if (scheduledFor(officeDay(Date.now()), account.id, rows))
                return fail('Today is a working day.');
            await db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='schedule stopped' WHERE account=? AND end IS NULL").bind(account.id, account.id).run();
        }
        await phoneHealth(b.state, b.fixAge ?? null);
        return out({ ok: true, contactAt: Date.now() });
    }
    if (action === 'registerPush' && req.method === 'POST') {
        if (!native || !admin || !sessionDevice || !token)
            return fail('Admin phone access required.', 403);
        const pushToken = typeof b.token === 'string' ? b.token : '';
        if (!/^[A-Za-z0-9_:\-]{64,4096}$/.test(pushToken))
            return fail('Invalid notification registration.');
        const id = await digest(pushToken), session = await digest(token), now = Date.now();
        await db.batch([db.prepare('DELETE FROM push_registrations WHERE account=? AND device=? AND id<>?').bind(account.id, sessionDevice.id, id), db.prepare('INSERT INTO push_registrations(id,token,session,account,device,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session=excluded.session,account=excluded.account,device=excluded.device,created=excluded.created').bind(id, pushToken, session, account.id, sessionDevice.id, now)]);
        return out({ ok: true });
    }
    if (action === 'pushStatus' && req.method === 'GET') {
        if (!native || !admin || !token)
            return fail('Admin phone access required.', 403);
        const registration = await db.prepare('SELECT id FROM push_registrations WHERE session=?').bind(await digest(token)).first();
        const pending = await db.prepare('SELECT COUNT(*) AS n FROM push_deliveries WHERE recipient=? AND sent IS NULL').bind(account.id).first();
        return out({ configured: !!env.FCM_SERVICE_ACCOUNT, registered: !!registration, pending: pending.n });
    }
    if (action === 'testPush' && req.method === 'POST') {
        if (!native || !admin || !token)
            return fail('Admin phone access required.', 403);
        if (!env.FCM_SERVICE_ACCOUNT)
            return fail('Finish the notification server setup first.', 503);
        const now = Date.now(), last = await db.prepare("SELECT created FROM push_events WHERE employee=? AND reason='notification test' ORDER BY created DESC LIMIT 1").bind(account.id).first();
        if (last && now - last.created < 60000)
            return fail('Wait one minute before sending another test.', 429);
        const id = crypto.randomUUID() + ':in', session = await digest(token);
        const r = await db.prepare('SELECT id FROM push_registrations WHERE session=?').bind(session).first();
        if (!r)
            return fail('Enable notifications on this phone and reopen the app first.', 409);
        await db.batch([db.prepare("INSERT INTO push_events(id,employee,name,kind,at,reason,created) VALUES(?,?,?,'in',?,'notification test',?)").bind(id, account.id, 'Geo Attend', now, now), db.prepare('INSERT INTO push_deliveries(event,registration,session,recipient,next_at) SELECT ?,id,session,account,? FROM push_registrations WHERE session=?').bind(id, now, session)]);
        return out({ ok: true, message: 'Test queued. Keep notifications allowed on this phone.' });
    }
    async function reconcile() { const now = Date.now(); await db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE accounts.id=attendance.account),start)),reason='tracking interrupted' WHERE end IS NULL AND account IN (SELECT id FROM accounts WHERE last_seen IS NULL OR last_seen<?)").bind(now - 360000).run(); }
    if (action === 'createRecovery' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        if (!goodPin(b.pin) || !await limited(await digest('recovery-generate:' + account.id)))
            return fail('Enter your current PIN or try again in 10 minutes.', 429);
        if (!equal(await pinHash(b.pin, account.salt), account.hash))
            return fail('Incorrect current PIN.', 403);
        const code = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
        await db.batch([db.prepare('INSERT INTO admin_recovery(account,hash,created) VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET hash=excluded.hash,created=excluded.created').bind(account.id, await digest(code), Date.now()), db.prepare('DELETE FROM login_attempts WHERE key=?').bind(await digest('recovery-generate:' + account.id))]);
        return out({ recoveryCode: code });
    }
    if (action === 'resetPin' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        if (!goodPin(b.pin))
            return fail('Use a 6–12 digit PIN.');
        const target = await db.prepare("SELECT * FROM accounts WHERE id=? AND role='employee' AND active=1").bind(clean(b.id)).first();
        if (!target)
            return fail('Employee not found.', 404);
        const salt = crypto.randomUUID();
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='PIN reset' WHERE account=? AND end IS NULL").bind(target.id, target.id), db.prepare('UPDATE accounts SET hash=?,salt=?,last_seen=NULL,outside_since=NULL WHERE id=?').bind(await pinHash(b.pin, salt), salt, target.id), db.prepare('DELETE FROM sessions WHERE account=?').bind(target.id), db.prepare('DELETE FROM login_attempts WHERE key=?').bind(await digest('login:' + target.login))]);
        return out({ ok: true });
    }
    if (action === 'devices' && req.method === 'GET') {
        if (!admin)
            return fail('Admin access required.', 403);
        const target = clean(url.searchParams.get('employee'));
        const devices = await db.prepare('SELECT id,name,state,created FROM devices WHERE account=? ORDER BY created DESC').bind(target).all();
        return out({ devices: devices.results });
    }
    if (action === 'approveDevice' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        const target = clean(b.account), device = clean(b.device);
        const selected = await db.prepare("SELECT d.id FROM devices d JOIN accounts a ON a.id=d.account WHERE d.account=? AND d.id=? AND a.active=1 AND a.role='employee'").bind(target, device).first();
        if (!selected)
            return fail('Phone request not found.', 404);
        await db.batch([
            db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='phone changed' WHERE account=? AND end IS NULL").bind(target, target), db.prepare("UPDATE devices SET state='revoked' WHERE account=?").bind(target), db.prepare("UPDATE devices SET state='approved' WHERE account=? AND id=?").bind(target, device), db.prepare('DELETE FROM sessions WHERE account=?').bind(target), db.prepare('UPDATE accounts SET last_seen=NULL,outside_since=NULL WHERE id=?').bind(target)
        ]);
        return out({ ok: true });
    }
    if (action === 'backup' && req.method === 'GET') {
        if (!admin)
            return fail('Admin access required.', 403);
        const tables = ['organization', 'accounts', 'attendance', 'devices', 'admin_recovery', 'removed_employees', 'work_calendar'];
        const snapshots = await db.batch(tables.map(t => db.prepare('SELECT * FROM ' + t)));
        return out({ schemaVersion: 2, exportedAt: Date.now(), tables: Object.fromEntries(tables.map((t, i) => [t, snapshots[i].results])) });
    }
    if (action === 'pause' && req.method === 'POST') {
        if (admin)
            return fail('Employee access required.', 403);
        await phoneHealth('paused');
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='tracking paused' WHERE account=? AND end IS NULL").bind(account.id, account.id), db.prepare('UPDATE accounts SET last_seen=NULL,outside_since=NULL WHERE id=?').bind(account.id)]);
        return out({ ok: true });
    }
    if (action === 'logout' && req.method === 'POST') {
        if (!admin)
            await phoneHealth('stopped');
        if (!admin)
            await db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='logged out' WHERE account=? AND end IS NULL").bind(account.id, account.id).run();
        if (token)
            await db.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();
        return out({ ok: true }, 200, 'geo_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
    }
    if (action === 'settings' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        const p = place(b);
        if (!validPlace(p, b))
            return fail('Enter valid coordinates and a 50–80 m radius.');
        const now = Date.now();
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE accounts.id=attendance.account),?)),reason='workplace changed' WHERE end IS NULL").bind(now), db.prepare('UPDATE accounts SET last_seen=NULL,outside_since=NULL,last_distance=NULL,accuracy=NULL'), db.prepare('UPDATE organization SET name=?,lat=?,lon=?,radius=? WHERE id=1').bind(p.name, p.lat, p.lon, p.radius)]);
        return out({ ok: true });
    }
    if (action === 'employees' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        const name = clean(b.name), login = clean(b.login, 40).toLowerCase();
        if (!name || !goodLogin(login) || !goodPin(b.pin))
            return fail('Enter a name, login ID (3–40 letters/numbers), and a 6–12 digit PIN.');
        const salt = crypto.randomUUID();
        try {
            await db.prepare('INSERT INTO accounts(id,name,login,hash,salt,role,created) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), name, login, await pinHash(b.pin, salt), salt, 'employee', Date.now()).run();
        }
        catch {
            return fail('That login ID is already used.', 409);
        }
        return out({ ok: true });
    }
    if (action === 'remove' && req.method === 'POST') {
        if (!admin)
            return fail('Admin access required.', 403);
        const target = await db.prepare("SELECT id FROM accounts WHERE id=? AND role='employee' AND active=1").bind(clean(b.id)).first();
        if (!target)
            return fail('Employee not found.', 404);
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),?)),reason='employee removed' WHERE account=? AND end IS NULL").bind(target.id, Date.now(), target.id), db.prepare('UPDATE accounts SET active=0 WHERE id=?').bind(target.id), db.prepare('INSERT INTO removed_employees(account,removed_at) VALUES(?,?) ON CONFLICT(account) DO NOTHING').bind(target.id, Date.now()), db.prepare('DELETE FROM sessions WHERE account=?').bind(target.id)]);
        return out({ ok: true });
    }
    if (action === 'syncOffline' && req.method === 'POST') {
        if (admin)
            return fail('Employee access required.', 403);
        if (!Array.isArray(b.records) || b.records.length < 1 || b.records.length > 5)
            return fail('Send 1–5 offline records.');
        const now = Date.now(), accepted = [];
        await reconcile();
        for (const r of b.records) {
            const id = clean(r.id, 40), start = Number(r.start), end = Number(r.end), d = Number(r.distance), accuracy = Number(r.accuracy), o = r.office;
            if (!/^[a-f0-9-]{36}$/.test(id) || r.account !== account.id || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start || end - start > 43200000 || end > now + 60000 || start < now - 604800000 || !Number.isFinite(d) || d < 0 || !Number.isFinite(accuracy) || accuracy <= 0)
                return fail('Offline record needs review: invalid time or location.', 409);
            const existing = await db.prepare('SELECT * FROM attendance WHERE id=?').bind(id).first();
            if (existing) {
                if (existing.account !== account.id || existing.start !== start || existing.end !== end)
                    return fail('Offline record ID conflict.', 409);
                accepted.push(id);
                continue;
            }
            if (!o || o.name !== org.name || o.lat !== org.lat || o.lon !== org.lon || o.radius !== org.radius || d + accuracy > org.radius)
                return fail('Workplace changed. Offline attendance remains on the phone for review.', 409);
            const receipt = await db.prepare('SELECT account,start,end FROM offline_receipts WHERE id=?').bind(id).first();
            if (receipt) {
                if (receipt.account !== account.id || receipt.start !== start || receipt.end !== end)
                    return fail('Offline record ID conflict.', 409);
                accepted.push(id);
                continue;
            }
            // One transaction closes only an open interval ending before this evidence,
            // subtracts all existing coverage, and stores a retry receipt. No read/write race.
            const coverage = "COALESCE(t.end,(SELECT last_seen FROM accounts WHERE id=t.account),t.start)";
            const bounds = `SELECT MAX(t.start,?) FROM attendance t WHERE t.account=? AND t.start<? AND ${coverage}>? UNION SELECT MIN(${coverage},?) FROM attendance t WHERE t.account=? AND t.start<? AND ${coverage}>?`;
            await db.batch([
                db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='connection interrupted' WHERE account=? AND end IS NULL AND COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)<? AND NOT EXISTS (SELECT 1 FROM offline_receipts WHERE id=?)").bind(account.id, account.id, account.id, end, id),
                db.prepare(`INSERT INTO attendance(id,account,start,end,reason,distance) WITH boundaries(v) AS (SELECT ? UNION SELECT ? UNION ${bounds}), parts AS (SELECT v AS s,LEAD(v) OVER (ORDER BY v) AS e FROM boundaries) SELECT ?||':'||s,?,s,e,'offline device record',? FROM parts WHERE e>s AND EXISTS (SELECT 1 FROM accounts WHERE id=? AND active=1) AND NOT EXISTS (SELECT 1 FROM attendance t WHERE t.account=? AND t.start<e AND ${coverage}>s) AND NOT EXISTS (SELECT 1 FROM offline_receipts WHERE id=?)`).bind(start, end, start, account.id, end, start, end, account.id, end, start, id, account.id, d, account.id, account.id, id),
                db.prepare('INSERT OR IGNORE INTO offline_receipts(id,account,start,end,created) VALUES(?,?,?,?,?)').bind(id, account.id, start, end, now)
            ]);
            const confirmed = await db.prepare('SELECT account,start,end FROM offline_receipts WHERE id=?').bind(id).first();
            if (!confirmed || confirmed.account !== account.id || confirmed.start !== start || confirmed.end !== end)
                return fail('Offline record ID conflict.', 409);
            accepted.push(id);
        }
        return out({ accepted });
    }
    if (action === 'heartbeat' && req.method === 'POST') {
        if (admin)
            return fail('Employee access required.', 403);
        const schedule = (await db.prepare('SELECT * FROM work_calendar ORDER BY day').all()).results;
        if (!scheduledFor(officeDay(Date.now()), account.id, schedule)) {
            await db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='schedule stopped' WHERE account=? AND end IS NULL").bind(account.id, account.id).run();
            await phoneHealth('scheduled_off');
            return out({ state: 'Not scheduled today', scheduled: false, schedule });
        }
        const lat = Number(b.lat), lon = Number(b.lon), accuracy = Number(b.accuracy), age = Number(b.age);
        if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 10000 || !Number.isFinite(age) || age < 0 || age > 120000)
            return fail('A fresh GPS fix is required.');
        await reconcile();
        const now = Date.now() - age, d = distance(org.lat, org.lon, lat, lon), zone = classify(d, accuracy, org.radius);
        await phoneHealth(zone, age);
        let open = await db.prepare('SELECT * FROM attendance WHERE account=? AND end IS NULL').bind(account.id).first();
        if (account.last_seen && now < account.last_seen)
            return out({ state: open ? 'checked in' : 'outside workplace', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: account.last_seen, sessionStart: open?.start ?? 0 });
        if (zone === 'inside') {
            await db.batch([db.prepare('UPDATE accounts SET last_seen=?,last_distance=?,accuracy=?,outside_since=NULL WHERE id=? AND active=1').bind(now, d, accuracy, account.id), db.prepare('INSERT INTO attendance(id,account,start,distance) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM accounts WHERE id=? AND active=1) AND NOT EXISTS (SELECT 1 FROM attendance WHERE account=? AND end IS NULL)').bind(crypto.randomUUID(), account.id, now, d, account.id, account.id)]);
            return out({ state: 'checked in', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: now, sessionStart: (await db.prepare('SELECT start FROM attendance WHERE account=? AND end IS NULL').bind(account.id).first())?.start ?? 0 });
        }
        if (zone === 'outside') {
            if (open && account.outside_since && now - account.outside_since >= 15000) {
                await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,?),reason='left workplace' WHERE account=? AND end IS NULL").bind(account.outside_since, account.id), db.prepare('UPDATE accounts SET last_seen=?,last_distance=?,accuracy=?,outside_since=NULL WHERE id=?').bind(now, d, accuracy, account.id)]);
                return out({ state: 'checked out', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: now });
            }
            await db.prepare('UPDATE accounts SET last_seen=?,last_distance=?,accuracy=?,outside_since=CASE WHEN ?=1 THEN COALESCE(outside_since,?) ELSE NULL END WHERE id=?').bind(now, d, accuracy, open ? 1 : 0, now, account.id).run();
            return out({ state: open ? 'confirming exit' : 'outside workplace', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: now });
        }
        await db.prepare('UPDATE accounts SET last_distance=?,accuracy=?,outside_since=NULL WHERE id=?').bind(d, accuracy, account.id).run();
        return out({ state: 'GPS uncertain', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: account.last_seen, working: !!open });
    }
    if ((action === 'stats' || action === 'export') && req.method === 'GET') {
        if (action === 'export' && !admin)
            return fail('Admin access required.', 403);
        await reconcile();
        const target = url.searchParams.get('employee') || '';
        if (target && !admin && target !== account.id)
            return fail('Access denied.', 403);
        const id = admin ? target : account.id;
        const cutoff = Date.now() - 2592000000;
        const visible = '(a.active=1 OR EXISTS (SELECT 1 FROM removed_employees r WHERE r.account=a.id AND r.removed_at>?))';
        const records = await (id ? db.prepare('SELECT t.*,a.name,a.login,a.active,a.last_seen AS verified_end FROM attendance t JOIN accounts a ON a.id=t.account WHERE t.account=? AND ' + visible + ' ORDER BY t.start DESC').bind(id, cutoff) : db.prepare('SELECT t.*,a.name,a.login,a.active,a.last_seen AS verified_end FROM attendance t JOIN accounts a ON a.id=t.account WHERE ' + visible + ' ORDER BY t.start DESC').bind(cutoff)).all();
        const display = readableRecords(records.results);
        if (action === 'export') {
            const period = url.searchParams.get('period') || officeDay(Date.now()).slice(0, 7);
            if (!/^\d{4}(-(?:0[1-9]|1[0-2]))?(-(?:0[1-9]|[12]\d|3[01]))?$/.test(period))
                return fail('Choose a valid year, month or day.');
            const cell = (v) => '"' + String(v ?? '').replace(/^[\s]*[=+@-]/, "'").replace(/"/g, '""') + '"';
            const date = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(t);
            const time = (t) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(t);
            const month = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }).format(t);
            const rows = [['Month', 'Employee name', 'Login ID', 'Check-in date', 'Check-in time (IST)', 'Check-out date', 'Check-out time (IST)', 'Recorded duration', 'Status', 'Last verified at (IST)']];
            const selected = display.filter(r => officeDay(r.start).startsWith(period)).sort((a, b) => officeDay(a.start).slice(0, 7).localeCompare(officeDay(b.start).slice(0, 7)) || a.name.localeCompare(b.name) || a.start - b.start);
            for (const r of selected) {
                const end = r.end ?? r.verified_end ?? r.start, minutes = Math.floor(Math.max(0, end - r.start) / 60000), departed = r.end != null && r.reason === 'left workplace';
                const status = r.end == null ? 'In progress' : departed ? 'Checked out' : r.reason === 'offline device record' ? 'Recovered attendance' : r.reason === 'schedule stopped' ? 'Schedule ended' : 'Tracking ended; departure unconfirmed';
                rows.push([month(r.start), r.name, r.login, date(r.start), time(r.start), departed ? date(end) : '', departed ? time(end) : '', `${Math.floor(minutes / 60)}h ${minutes % 60}m`, status, date(end) + ' ' + time(end)]);
            }
            return new Response('\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="geo-attend-${period}.csv"`, 'Cache-Control': 'no-store' } });
        }
        const employees = admin ? (await db.prepare("SELECT a.id,a.name,a.login,a.role,a.active,a.last_seen,a.last_distance,a.accuracy,r.removed_at,h.last_contact,h.state AS tracking_health,h.fix_age,h.pending AS pending_records,h.battery_restricted FROM accounts a LEFT JOIN employee_health h ON h.account=a.id LEFT JOIN removed_employees r ON r.account=a.id WHERE a.role='employee' AND (a.active=1 OR r.removed_at>?) ORDER BY a.active DESC,a.name").bind(cutoff).all()).results : [{ id: account.id, name: account.name, login: account.login, active: account.active, last_seen: account.last_seen, last_distance: account.last_distance, accuracy: account.accuracy, ...(await db.prepare("SELECT last_contact,state AS tracking_health,fix_age,pending AS pending_records,battery_restricted FROM employee_health WHERE account=?").bind(account.id).first() || {}) }];
        return out({ records: display, schedule: (await db.prepare('SELECT * FROM work_calendar ORDER BY day').all()).results, employees, now: Date.now(), office: { name: org.name, lat: org.lat, lon: org.lon, radius: org.radius } });
    }
    return fail('Unknown action.', 404);
}
export async function GET(req) { try {
    return await handleGeo(req);
}
catch (e) {
    console.error('Geo Attend request failed', e instanceof Error ? e.message : 'error');
    return fail('Could not complete the request. Please try again.', 500);
} }
export const POST = GET;
export default { async scheduled() { const now = new Date(); if (now.getUTCHours() === 19 && now.getUTCMinutes() === 30)
        await purgeRemoved(env.DB); await cleanupPush(env.DB); await flushPush(env.DB, env.FCM_SERVICE_ACCOUNT); }, async fetch(request, _bindings, ctx) { const url = new URL(request.url); if (url.pathname === '/api/native' && (request.method === 'GET' || request.method === 'POST')) {
        try {
            const response = await handleGeo(request, true);
            if (env.FCM_SERVICE_ACCOUNT) {
                const push = flushPush(env.DB, env.FCM_SERVICE_ACCOUNT).catch(() => console.error('Notification delivery pending'));
                if (ctx)
                    ctx.waitUntil(push);
                else
                    await push;
            }
            return response;
        }
        catch (e) {
            console.error('Attendance request failed');
            return new Response(JSON.stringify({ error: 'Could not complete the request. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        }
    } if (url.pathname === '/' && request.method === 'GET')
        return new Response('Geo Attend office attendance service. Use the Android app to log in.', { headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' } }); return new Response('Not found', { status: 404 }); } };
