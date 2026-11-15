// Tar emot en ny rapport från databastriggern och skickar den som pushnotis.
// Skyddad med en delad hemlighet (PUSH_SECRET). Prenumerationerna följer med i anropet.
import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';

const VAPID_PUBLIC =
  'BGx1Ej6HgdLbwsNzASeDQoXzflzzmlKONw0bj7a2rTXn74oJ4pHcDYhCzSX0AXhSGRmeu80va9u93KQLv3bYwV4';
const SUPABASE_URL = 'https://vqimjctsfgncertfzqtp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_96sOYIhhPFIIBxeGLgJRdg_TqvNUwiy';

function same(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return res.status(500).json({ error: 'not configured' });
  if (!same(req.headers['x-push-secret'], secret)) return res.status(401).json({ error: 'unauthorized' });

  const { id, kind, title, body, subs } = req.body ?? {};
  if (!Array.isArray(subs) || subs.length === 0) return res.status(200).json({ sent: 0 });

  webpush.setVapidDetails('https://coach-os-sigma.vercel.app', VAPID_PUBLIC, priv);
  const payload = JSON.stringify({
    title: String(title ?? 'Coach OS').slice(0, 120),
    body: String(body ?? '').slice(0, 200),
    kind,
    id,
  });

  const results = await Promise.allSettled(
    subs.slice(0, 20).map((s) => webpush.sendNotification(s, payload, { TTL: 6 * 3600 })),
  );
  const gone = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent += 1;
    else if ([404, 410].includes(r.reason?.statusCode)) gone.push(subs[i]?.endpoint);
  });

  if (gone.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/coach_push_prune`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_endpoints: gone }),
    }).catch(() => undefined);
  }
  return res.status(200).json({ sent, failed: results.length - sent, gone: gone.length });
}
