import { env } from 'cloudflare:workers';
async function headers() { return new Headers(); }
export function distance(a, b, c, d) { const r = (n) => n * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h))); }
export function classify(d, accuracy, radius) { if (d + accuracy <= radius)
    return 'inside'; if (d - accuracy > radius)
    return 'outside'; return 'uncertain'; }
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
    let b = {};
    if (req.method === 'POST') {
        try {
            const text = await req.text();
            if (text.length > 10000)
                return fail('Request is too large.');
            b = JSON.parse(text);
        }
        catch {
            return fail('Invalid request.');
        }
    }
    let org = await db.prepare('SELECT * FROM organization WHERE id=1').first();
    let account = null;
    const token = native ? req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] : req.headers.get('cookie')?.match(/(?:^|;\s*)geo_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (token) {
        account = await db.prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.token=? AND s.viewer=? AND s.expires>? AND a.active=1').bind(await digest(token), viewer, Date.now()).first();
        if (!native && account?.role === 'admin' && !webOwner(org))
            account = null;
    }
    if (action === 'status' && req.method === 'GET')
        return out({ setup: !!org, user: account ? { id: account.id, name: account.name, role: account.role, login: account.login } : null, office: org && account ? { name: org.name, lat: org.lat, lon: org.lon, radius: org.radius } : null });
    if (action === 'setup' && req.method === 'POST') {
        if (org)
            return fail('Admin setup is already complete.', 409);
        if (!native && env.NATIVE_OWNER_EMAIL && ownerEmail !== env.NATIVE_OWNER_EMAIL)
            return fail('Only the workplace owner can create the first admin.', 403);
        const name = clean(b.name), login = clean(b.login, 40).toLowerCase(), p = place(b);
        if (!name || !goodLogin(login) || !goodPin(b.pin) || !validPlace(p, b))
            return fail('Enter a name, a valid login ID, a 6–12 digit PIN, and a workplace with a 50–80 m radius.');
        const salt = crypto.randomUUID(), hash = await pinHash(b.pin, salt), id = crypto.randomUUID();
        try {
            await db.batch([db.prepare('INSERT INTO organization(id,owner,name,lat,lon,radius) VALUES(1,?,?,?,?,?)').bind(viewer, p.name, p.lat, p.lon, p.radius), db.prepare('INSERT INTO accounts(id,name,login,hash,salt,role,created) VALUES(?,?,?,?,?,?,?)').bind(id, name, login, hash, salt, 'admin', Date.now())]);
        }
        catch {
            return fail('Admin setup was already completed. Please log in.', 409);
        }
        return out({ ok: true });
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
        await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
        const t = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
        await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(now), db.prepare('INSERT INTO sessions(token,account,viewer,expires) VALUES(?,?,?,?)').bind(await digest(t), a.id, viewer, now + (native ? 2592000000 : 43200000))]);
        return native ? out({ ok: true, token: t }) : out({ ok: true }, 200, cookie(t));
    }
    if (!account)
        return fail('Please log in to continue.', 401);
    const admin = account.role === 'admin';
    async function reconcile() { const now = Date.now(); await db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE accounts.id=attendance.account),start)),reason='tracking interrupted' WHERE end IS NULL AND account IN (SELECT id FROM accounts WHERE last_seen IS NULL OR last_seen<?)").bind(now - 90000).run(); }
    if (action === 'backup' && req.method === 'GET') {
        if (!admin)
            return fail('Admin access required.', 403);
        const tables = ['organization', 'accounts', 'attendance'];
        const snapshots = await db.batch(tables.map(t => db.prepare('SELECT * FROM ' + t)));
        return out({ schemaVersion: 1, exportedAt: Date.now(), tables: Object.fromEntries(tables.map((t, i) => [t, snapshots[i].results])) });
    }
    if (action === 'pause' && req.method === 'POST') {
        if (admin)
            return fail('Employee access required.', 403);
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),start)),reason='tracking paused' WHERE account=? AND end IS NULL").bind(account.id, account.id), db.prepare('UPDATE accounts SET last_seen=NULL,outside_since=NULL WHERE id=?').bind(account.id)]);
        return out({ ok: true });
    }
    if (action === 'logout' && req.method === 'POST') {
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
        await db.batch([db.prepare("UPDATE attendance SET end=MAX(start,COALESCE((SELECT last_seen FROM accounts WHERE id=?),?)),reason='employee removed' WHERE account=? AND end IS NULL").bind(target.id, Date.now(), target.id), db.prepare('UPDATE accounts SET active=0 WHERE id=?').bind(target.id), db.prepare('DELETE FROM sessions WHERE account=?').bind(target.id)]);
        return out({ ok: true });
    }
    if (action === 'heartbeat' && req.method === 'POST') {
        if (admin)
            return fail('Employee access required.', 403);
        const lat = Number(b.lat), lon = Number(b.lon), accuracy = Number(b.accuracy), age = Number(b.age);
        if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 10000 || !Number.isFinite(age) || age < 0 || age > 30000)
            return fail('A fresh GPS fix is required.');
        await reconcile();
        const now = Date.now(), d = distance(org.lat, org.lon, lat, lon), zone = classify(d, accuracy, org.radius);
        let open = await db.prepare('SELECT * FROM attendance WHERE account=? AND end IS NULL').bind(account.id).first();
        if (zone === 'inside') {
            await db.batch([db.prepare('UPDATE accounts SET last_seen=?,last_distance=?,accuracy=?,outside_since=NULL WHERE id=? AND active=1').bind(now, d, accuracy, account.id), db.prepare('INSERT INTO attendance(id,account,start,distance) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM accounts WHERE id=? AND active=1) AND NOT EXISTS (SELECT 1 FROM attendance WHERE account=? AND end IS NULL)').bind(crypto.randomUUID(), account.id, now, d, account.id, account.id)]);
            return out({ state: 'checked in', distance: Math.round(d), accuracy: Math.round(accuracy), verifiedAt: now });
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
        await reconcile();
        const target = url.searchParams.get('employee') || '';
        if (target && !admin && target !== account.id)
            return fail('Access denied.', 403);
        const id = admin ? target : account.id;
        const records = await (id ? db.prepare('SELECT t.*,a.name,a.login,a.active FROM attendance t JOIN accounts a ON a.id=t.account WHERE t.account=? ORDER BY t.start DESC').bind(id) : db.prepare('SELECT t.*,a.name,a.login,a.active FROM attendance t JOIN accounts a ON a.id=t.account ORDER BY t.start DESC')).all();
        if (action === 'export') {
            const cell = (v) => '"' + String(v ?? '').replace(/^[\s]*[=+@-]/, "'").replace(/"/g, '""') + '"';
            const rows = [['Employee', 'Login ID', 'Check in (UTC)', 'Check out (UTC)', 'Minutes', 'End reason'], ...records.results.map((r) => [r.name, r.login, new Date(r.start).toISOString(), r.end ? new Date(r.end).toISOString() : '', Math.floor(((r.end || Date.now()) - r.start) / 60000), r.reason || 'in progress'])];
            return new Response(rows.map(r => r.map(cell).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="geo-attend.csv"', 'Cache-Control': 'no-store' } });
        }
        const employees = admin ? (await db.prepare("SELECT id,name,login,role,active,last_seen,last_distance,accuracy FROM accounts WHERE role='employee' ORDER BY active DESC,name").all()).results : [{ id: account.id, name: account.name, login: account.login, active: account.active, last_seen: account.last_seen, last_distance: account.last_distance, accuracy: account.accuracy }];
        return out({ records: records.results, employees, now: Date.now(), office: { name: org.name, lat: org.lat, lon: org.lon, radius: org.radius } });
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
export default { async fetch(request) { const url = new URL(request.url); if (url.pathname === '/api/native' && (request.method === 'GET' || request.method === 'POST')) {
        try {
            return await handleGeo(request, true);
        }
        catch (e) {
            console.error('Attendance request failed');
            return new Response(JSON.stringify({ error: 'Could not complete the request. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        }
    } if (url.pathname === '/' && request.method === 'GET')
        return new Response('Geo Attend office attendance service. Use the Android app to log in.', { headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' } }); return new Response('Not found', { status: 404 }); } };
