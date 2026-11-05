// Abonnement propriétaire (Stripe) : qui a accès aux fonctions par IA (lecture du décompte de charges, TEOM automatique).
// La table abonnements n'est écrite que par les fonctions serveur (clé service) ; le navigateur la lit seulement.
// Chargé seulement quand il sert (les fonctions qui vérifient juste l'abonnement n'en ont pas besoin)
const stripe = () => { if (!process.env.STRIPE_SECRET_KEY) return null; try { const Stripe = require('stripe'); return new Stripe(process.env.STRIPE_SECRET_KEY); } catch (e) { console.error('module stripe absent', e.message); return null; } };

// Ligne de la table à partir d'un abonnement Stripe
function ligne(sub, clerkId) {
  const fin = sub.current_period_end || sub.items?.data?.[0]?.current_period_end || null;
  return {
    landlord_id: clerkId || sub.metadata?.clerk_id,
    statut: sub.status,                                   // active, trialing, past_due, canceled, unpaid…
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    periode_fin: fin ? new Date(fin * 1000).toISOString() : null,
    annule_fin_periode: !!sub.cancel_at_period_end,
    nb_biens: sub.items?.data?.[0]?.quantity || null,
    plan: sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'an' : 'mois',
    updated_at: new Date().toISOString(),
  };
}
const actif = a => !!a && ['active', 'trialing'].includes(a.statut) && (!a.periode_fin || new Date(a.periode_fin) > new Date());

async function enregistrer(api, row) {
  if (!row.landlord_id) return null;
  return api('abonnements?on_conflict=landlord_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) });
}

// true si le propriétaire a un abonnement en cours. Si la période enregistrée est passée, on redemande à Stripe (renouvellement).
async function estAbonne(api, clerkId) {
  if (!clerkId) return false;
  let a = null;
  try { a = (await api(`abonnements?landlord_id=eq.${encodeURIComponent(clerkId)}&select=*`))?.[0] || null; } catch (e) { return false; }
  if (actif(a)) return true;
  const s = stripe();
  if (a?.stripe_subscription_id && s) {
    try { const row = ligne(await s.subscriptions.retrieve(a.stripe_subscription_id), clerkId); await enregistrer(api, row); return actif(row); } catch (e) { console.error('abonnement', e.message); }
  }
  return false;
}

// Nombre de biens facturés : logements avec au moins un bail signé en cours, gérés en direct (une colocation = un bien). Minimum 1.
async function nbBiens(api, clerkId) {
  let ls = [];
  try { ls = await api(`leases?landlord_id=eq.${encodeURIComponent(clerkId)}&landlord_signed_at=not.is.null&tenant_signed_at=not.is.null&select=id,listing_id,booking_id`) || []; } catch (e) { return 1; }
  try { const m = new Set((await api('gestion_mandats?select=lease_id&statut=neq.resilie') || []).map(x => x.lease_id)); ls = ls.filter(l => !m.has(l.id)); } catch (e) {}
  const bids = [...new Set(ls.map(l => l.booking_id).filter(Boolean))];
  if (bids.length) try { const fin = new Set((await api(`bookings?select=id,tenancy_ended_at&id=in.(${bids.join(',')})`) || []).filter(b => b.tenancy_ended_at).map(b => b.id)); ls = ls.filter(l => !fin.has(l.booking_id)); } catch (e) {}
  return Math.max(1, new Set(ls.map(l => l.listing_id || l.id)).size);
}

module.exports = { stripe, ligne, actif, enregistrer, estAbonne, nbBiens };
