// Abonnement propriétaire — Stripe Checkout (paiement) et portail client (gérer, résilier).
// Variables Netlify : STRIPE_SECRET_KEY, STRIPE_PRICE_PRO (identifiant du prix récurrent créé dans Stripe, « price_… »),
// SUPABASE_SERVICE_KEY. Facultatif : STRIPE_WEBHOOK_SECRET_ABONNEMENT (voir stripe-abonnement-webhook.js).
// Actions (POST JSON { action }) :
//   prix      → montant et périodicité affichés sur la page (sans connexion)
//   checkout  → lien de paiement Stripe (utilisateur connecté)
//   verifier  → au retour du paiement, enregistre l'abonnement (session_id Stripe)
//   statut    → revérifie l'abonnement auprès de Stripe (fin de période)
//   portail   → lien vers le portail Stripe pour changer de carte ou résilier (utilisateur connecté)
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';
const { stripe, ligne, enregistrer, estAbonne } = require('./_shared/abonnement');
const { utilisateur } = require('./_shared/clerk-auth');

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const rep = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return rep(405, { erreur: 'POST attendu' });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  const s = stripe();
  if (!s) return rep(200, { disponible: false, erreur: 'Paiement non configuré : ajoutez STRIPE_SECRET_KEY dans les variables Netlify.' });
  const PRIX = process.env.STRIPE_PRICE_PRO;
  try {
    if (b.action === 'prix') {
      if (!PRIX) return rep(200, { disponible: false, erreur: 'Abonnement non configuré : ajoutez STRIPE_PRICE_PRO dans les variables Netlify.' });
      const p = await s.prices.retrieve(PRIX);
      return rep(200, { disponible: true, montant: (p.unit_amount || 0) / 100, devise: p.currency, intervalle: p.recurring?.interval || null, nb: p.recurring?.interval_count || 1 });
    }
    if (b.action === 'verifier') {
      if (!/^cs_/.test(String(b.session_id || ''))) return rep(400, { erreur: 'session_id invalide' });
      const ses = await s.checkout.sessions.retrieve(b.session_id, { expand: ['subscription'] });
      if (!ses.subscription || !ses.client_reference_id) return rep(200, { ok: false });
      const sub = typeof ses.subscription === 'string' ? await s.subscriptions.retrieve(ses.subscription) : ses.subscription;
      const row = ligne(sub, ses.client_reference_id); await enregistrer(api, row);
      return rep(200, { ok: true, statut: row.statut, periode_fin: row.periode_fin });
    }
    // Actions réservées à l'utilisateur connecté
    const uid = await utilisateur(event);
    if (!uid) return rep(401, { erreur: 'Session expirée : reconnectez-vous.' });
    const a = (await api(`abonnements?landlord_id=eq.${encodeURIComponent(uid)}&select=*`))?.[0] || null;
    if (b.action === 'statut') {
      await estAbonne(api, uid);
      return rep(200, { abonnement: (await api(`abonnements?landlord_id=eq.${encodeURIComponent(uid)}&select=*`))?.[0] || null });
    }
    if (b.action === 'checkout') {
      if (!PRIX) return rep(200, { erreur: 'Abonnement non configuré : ajoutez STRIPE_PRICE_PRO dans les variables Netlify.' });
      if (a && ['active', 'trialing', 'past_due'].includes(a.statut)) return rep(200, { erreur: 'Vous avez déjà un abonnement en cours.' });
      let customer = a?.stripe_customer_id || null;
      if (!customer) {
        const prof = (await api(`profiles?clerk_id=eq.${encodeURIComponent(uid)}&select=email,full_name`))?.[0] || {};
        const c = await s.customers.create({ email: prof.email || b.email || undefined, name: prof.full_name || undefined, metadata: { clerk_id: uid } });
        customer = c.id;
        await enregistrer(api, { landlord_id: uid, stripe_customer_id: customer, statut: a?.statut || 'aucun', updated_at: new Date().toISOString() });
      }
      const ses = await s.checkout.sessions.create({
        mode: 'subscription', customer, client_reference_id: uid, locale: 'fr', allow_promotion_codes: true,
        line_items: [{ price: PRIX, quantity: 1 }],
        subscription_data: { metadata: { clerk_id: uid } },
        success_url: `${SITE}/landlord-dashboard.html?abonnement=ok&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE}/landlord-dashboard.html?abonnement=annule`,
      });
      return rep(200, { url: ses.url });
    }
    if (b.action === 'portail') {
      if (!a?.stripe_customer_id) return rep(200, { erreur: 'Aucun abonnement trouvé.' });
      const p = await s.billingPortal.sessions.create({ customer: a.stripe_customer_id, return_url: `${SITE}/landlord-dashboard.html?abonnement=retour` });
      return rep(200, { url: p.url });
    }
    return rep(400, { erreur: 'action inconnue' });
  } catch (e) {
    console.error('abonnement', e.message);
    return rep(200, { erreur: /No such price/i.test(e.message) ? 'STRIPE_PRICE_PRO ne correspond à aucun prix dans votre compte Stripe.' : /portal|configuration/i.test(e.message) ? 'Activez le portail client dans Stripe (Paramètres → Facturation → Portail client).' : 'Stripe : ' + e.message });
  }
};
