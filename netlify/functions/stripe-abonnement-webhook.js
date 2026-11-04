// Webhook Stripe des abonnements propriétaires (facultatif mais conseillé : renouvellements, impayés, résiliations).
// Dans Stripe → Développeurs → Webhooks : URL https://<votre-site>/.netlify/functions/stripe-abonnement-webhook,
// événements customer.subscription.created / updated / deleted ; copiez le secret de signature dans STRIPE_WEBHOOK_SECRET_ABONNEMENT.
// Sans webhook, l'abonnement est quand même vérifié auprès de Stripe au retour du paiement et à chaque fin de période.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const { stripe, ligne, enregistrer } = require('./_shared/abonnement');
const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });

exports.handler = async (event) => {
  const s = stripe(), secret = process.env.STRIPE_WEBHOOK_SECRET_ABONNEMENT;
  if (!s || !secret) return { statusCode: 500, body: 'STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET_ABONNEMENT manquant' };
  let ev;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : (event.body || '');
    ev = s.webhooks.constructEvent(raw, event.headers['stripe-signature'] || event.headers['Stripe-Signature'], secret);
  } catch (e) { return { statusCode: 400, body: 'Signature invalide' }; }
  try {
    if (/^customer\.subscription\./.test(ev.type)) {
      const sub = ev.data.object;
      let clerk = sub.metadata?.clerk_id;
      if (!clerk) clerk = (await api(`abonnements?stripe_customer_id=eq.${sub.customer}&select=landlord_id`))?.[0]?.landlord_id;
      if (clerk) await enregistrer(api, ligne(sub, clerk));
    }
  } catch (e) { console.error('webhook abonnement', e.message); return { statusCode: 500, body: e.message }; }
  return { statusCode: 200, body: 'ok' };
};
