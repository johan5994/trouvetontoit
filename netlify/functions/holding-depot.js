const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dcpozxklyxhypwyjbwph.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Commission Trouve Ton Toit côté LOCATAIRE : 10% d'un mois de loyer.
// Capturée uniquement si le propriétaire accepte (capture_method: 'manual').
const TENANT_FEE_RATE = 0.10;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { action, ...params } = JSON.parse(event.body);

    // ── Enregistrer la carte du locataire (SetupIntent, aucun débit) ──────────
    if (action === 'setup_paiement') {
      const { locataire_email, locataire_name, locataire_id } = params;
      if (!locataire_email) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, erreur: 'Email manquant' }) };
      }
      let customerId;
      const existing = await stripe.customers.list({ email: locataire_email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: locataire_email,
          name: locataire_name || 'Locataire',
          metadata: { locataire_id: locataire_id || '' }
        });
        customerId = customer.id;
      }
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { type: 'locataire_carte', locataire_id: locataire_id || '' }
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, client_secret: setupIntent.client_secret, customer_id: customerId })
      };
    }

    // ── Créer la pré-autorisation des frais TTT (10%) côté locataire ──────────
    // Autorisée maintenant, capturée seulement si le propriétaire accepte.
    if (action === 'create_commission_intent') {
      const { listing_id, locataire_id, locataire_email, locataire_name, locataire_stripe_customer_id, monthly_rent } = params;
      if (!monthly_rent) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, erreur: 'Loyer manquant' }) };
      }

      let customerId = locataire_stripe_customer_id;
      if (!customerId) {
        const existing = await stripe.customers.list({ email: locataire_email, limit: 1 });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
        } else {
          const customer = await stripe.customers.create({
            email: locataire_email,
            name: locataire_name || 'Locataire',
            metadata: { locataire_id, listing_id }
          });
          customerId = customer.id;
        }
      }

      const commissionAmount = Math.round(monthly_rent * TENANT_FEE_RATE * 100); // en centimes

      const paymentIntent = await stripe.paymentIntents.create({
        amount: commissionAmount,
        currency: 'eur',
        capture_method: 'manual',
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          type: 'locataire_commission',
          listing_id: listing_id || '',
          locataire_id: locataire_id || '',
          commission_amount: commissionAmount
        },
        description: `Trouve Ton Toit — frais de dossier (10%)`
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          client_secret: paymentIntent.client_secret,
          commission_payment_intent_id: paymentIntent.id,
          commission_amount: commissionAmount / 100,
          customer_id: customerId
        })
      };
    }

    // ── Propriétaire accepte → capturer la commission ─────────────────────────
    if (action === 'landlord_accept') {
      const { booking_id } = params;

      let booking = null;
      try {
        const { data } = await sb.from('bookings').select('*').eq('id', booking_id).single();
        booking = data;
      } catch(e) {}

      if (!booking) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking introuvable' }) };

      let captureResult = 'skipped';
      let commissionAmountEur = 0;

      if (booking.commission_paiement_intent_id) {
        try {
          const intent = await stripe.paymentIntents.retrieve(booking.commission_paiement_intent_id);
          if (intent.status === 'requires_capture') {
            const captured = await stripe.paymentIntents.capture(booking.commission_paiement_intent_id);
            captureResult = 'commission_capturee';
            commissionAmountEur = (captured.amount_received || captured.amount || 0) / 100;
          } else {
            captureResult = `deja_${intent.status}`;
          }
        } catch(e) {
          console.warn('Erreur capture commission (non-bloquant):', e.message);
          captureResult = 'erreur: ' + e.message;
        }
      }

      if (commissionAmountEur > 0 && booking.locataire_id) {
        try {
          await sb.from('payments').insert({
            tenant_id: booking.locataire_id,
            listing_id: booking.listing_id || null,
            tenant_name: booking.locataire_name || null,
            tenant_email: booking.locataire_email || null,
            amount: commissionAmountEur,
            type: 'commission',
            status: 'paid',
            paid_at: new Date().toISOString(),
            due_date: new Date().toISOString().split('T')[0]
          });
        } catch(e) { console.warn('Enregistrement paiement commission (non-bloquant):', e.message); }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, capture: captureResult })
      };
    }

    // ── Propriétaire refuse → annuler / rembourser ────────────────────────────
    if (action === 'landlord_decline') {
      const { booking_id, reason } = params;

      let booking = null;
      try {
        const { data } = await sb.from('bookings').select('*').eq('id', booking_id).single();
        booking = data;
      } catch(e) {}

      if (!booking) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking introuvable' }) };

      if (booking.commission_paiement_intent_id) {
        try {
          const intent = await stripe.paymentIntents.retrieve(booking.commission_paiement_intent_id);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(booking.commission_paiement_intent_id);
          } else if (intent.status === 'succeeded') {
            await stripe.refunds.create({ payment_intent: booking.commission_paiement_intent_id });
          }
        } catch(e) { console.warn('Erreur annulation/remboursement (non-bloquant):', e.message); }
      }

      await sb.from('bookings').update({
        status: 'declined',
        declined_at: new Date().toISOString(),
        decline_reason: reason || 'Aucune raison fournie',
        stripe_refunded: true
      }).eq('id', booking_id);

      await sb.from('listings').update({ status: 'active', reserved_by: null }).eq('id', booking.listing_id);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, status: 'remboursé' })
      };
    }

    // ── Locataire annule avant acceptation ────────────────────────────────────
    if (action === 'tenant_cancel') {
      const { booking_id } = params;

      let booking = null;
      try {
        const { data } = await sb.from('bookings').select('*').eq('id', booking_id).single();
        booking = data;
      } catch(e) {}

      if (!booking) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Booking introuvable' }) };
      if (booking.status !== 'pending') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Candidature déjà traitée' }) };
      }

      if (booking.commission_paiement_intent_id) {
        try {
          const intent = await stripe.paymentIntents.retrieve(booking.commission_paiement_intent_id);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(booking.commission_paiement_intent_id);
          }
        } catch(e) { console.warn('Erreur annulation locataire (non-bloquant):', e.message); }
      }

      await sb.from('bookings').update({
        status: 'cancelled_by_locataire',
        cancelled_at: new Date().toISOString()
      }).eq('id', booking_id);

      await sb.from('listings').update({ status: 'active', reserved_by: null }).eq('id', booking.listing_id);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Candidature annulée' })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action inconnue' }) };

  } catch (e) {
    console.error('holding-depot error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, erreur: e.message }) };
  }
};
