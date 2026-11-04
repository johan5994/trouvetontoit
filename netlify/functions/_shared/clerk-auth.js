// Vérifie le jeton de session Clerk envoyé par le navigateur (Authorization: Bearer …) et renvoie l'identifiant de l'utilisateur.
// L'émetteur attendu est déduit de la clé publique Clerk du site (CLERK_PUBLISHABLE_KEY, sinon celle des pages).
const crypto = require('crypto');
const PK = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_Y3JlZGlibGUtbWFybGluLTU1NzcuY2xlcmsuYWNjb3VudHMuZGV2JA';
const ISSUER = 'https://' + Buffer.from(PK.replace(/^pk_(test|live)_/, ''), 'base64').toString('utf8').replace(/\$$/, '');
let JWKS = null;
const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function utilisateur(event) {
  const h = event.headers || {};
  const tok = String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '');
  const parts = tok.split('.'); if (parts.length !== 3) return null;
  try {
    const head = JSON.parse(b64(parts[0]).toString()), pay = JSON.parse(b64(parts[1]).toString());
    if (head.alg !== 'RS256' || pay.iss !== ISSUER) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!pay.sub || (pay.exp && pay.exp < now - 30) || (pay.nbf && pay.nbf > now + 30)) return null;
    if (!JWKS || !JWKS.find(k => k.kid === head.kid)) JWKS = (await (await fetch(ISSUER + '/.well-known/jwks.json')).json()).keys || [];
    const jwk = JWKS.find(k => k.kid === head.kid); if (!jwk) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(parts[2]));
    return ok ? pay.sub : null;
  } catch (e) { console.error('clerk', e.message); return null; }
}
module.exports = { utilisateur, ISSUER };
