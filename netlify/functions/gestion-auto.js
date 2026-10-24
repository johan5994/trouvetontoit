// Gestion locative des agences — automatisation quotidienne (fonction planifiée Netlify).
// À déclarer dans netlify.toml :
//   [functions."gestion-auto"]
//     schedule = "@daily"
// Variables : SUPABASE_SERVICE_KEY, RESEND_API_KEY (+ RESEND_FROM).
//
// Pour chaque mandat de gestion actif (table gestion_mandats), selon ses réglages :
//  • échéancier des loyers (mois en cours + 2) et passage en retard ;
//  • avis d'échéance par e-mail 7 jours avant (auto_avis) ;
//  • relances J+5 et J+15 (auto_relances) ;
//  • quittance par e-mail après encaissement (auto_quittance) ;
//  • rappels assurance habitation / entretien chaudière avant échéance (auto_conformite) ;
//  • compte rendu de gestion du mois précédent au propriétaire, à partir du 5 (auto_crg) ;
//  • régularisation des charges : demande du décompte au propriétaire (1er mars), relances,
//    application du solde un mois après l'envoi du décompte au locataire ;
//  • résumé quotidien envoyé à l'agence dans sa messagerie.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const FROM = process.env.RESEND_FROM || 'Trouve Ton Toit <onboarding@resend.dev>';
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) });
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

const R = n => Math.round((Number(n) || 0) * 100) / 100;
const eur = n => R(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const iso = d => new Date(d).toISOString().slice(0, 10);
const fr = d => new Date(String(d).length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const days = (a, b) => Math.floor((new Date(iso(b) + 'T12:00:00Z') - new Date(iso(a) + 'T12:00:00Z')) / 864e5);
const addM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 15)); return d.toISOString().slice(0, 7); };
const due = (ym, j) => { const [y, m] = ym.split('-').map(Number); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${ym}-${String(Math.min(Math.max(+j || 1, 1), dim)).padStart(2, '0')}`; };
const moisLbl = ym => { const [y, m] = ym.split('-'); return new Date(Date.UTC(+y, +m - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inList = a => `(${a.map(x => `"${x}"`).join(',')})`;

function mailHtml(agence, title, body) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a"><div style="background:#4F46E5;padding:20px 28px;border-radius:12px 12px 0 0"><p style="color:#E0E7FF;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">${esc(agence)} · Gestion locative</p><h1 style="color:#fff;font-size:20px;margin:0">${esc(title)}</h1></div><div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;font-size:15px;line-height:1.55">${body}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px"><p style="font-size:12px;color:#6b7280;margin:0">${esc(agence)} — envoyé via Trouve Ton Toit</p></div></div>`;
}
async function mail(to, subject, agence, title, body) {
  if (!to || !process.env.RESEND_API_KEY) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html: mailHtml(agence, title, body) }) });
  return r.ok;
}
async function msg(to, listing_id, content, sender = 'system') {
  if (!to) return;
  try { await post('messages', { listing_id: listing_id || null, sender_id: sender, receiver_id: to, content, type: sender === 'system' ? 'message' : 'gestion', read: false }); } catch (e) {}
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  const today = iso(new Date()); const cur = today.slice(0, 7); const prev = addM(cur, -1);
  const stats = {};
  const S = (ag, k) => { (stats[ag] = stats[ag] || {})[k] = (stats[ag][k] || 0) + 1; };

  let mandats = [];
  try { mandats = await api('gestion_mandats?select=*&statut=neq.resilie') || []; }
  catch (e) { return { statusCode: 200, body: 'Table gestion_mandats absente : ' + e.message }; }
  if (!mandats.length) return { statusCode: 200, body: 'Aucun mandat' };

  const agIds = [...new Set(mandats.map(m => m.agency_id))];
  const agences = {}; (await api(`agency_profiles?select=clerk_id,agency_name&clerk_id=in.${inList(agIds)}`) || []).forEach(a => agences[a.clerk_id] = a.agency_name);
  const leaseIds = mandats.map(m => m.lease_id).filter(Boolean);
  const leases = {}; if (leaseIds.length) (await api(`leases?select=*&id=in.${inList(leaseIds)}`) || []).forEach(l => leases[l.id] = l);
  const tIds = [...new Set(Object.values(leases).map(l => l.tenant_id).filter(Boolean))];
  const profs = {}; if (tIds.length) (await api(`profiles?select=clerk_id,full_name,email&clerk_id=in.${inList(tIds)}`) || []).forEach(p => profs[p.clerk_id] = p);

  // Rattacher les loyers des baux de la plateforme à leur mandat
  for (const m of mandats) {
    const L = leases[m.lease_id]; if (!L) continue;
    try {
      await patch(`payments?lease_id=eq.${L.id}&mandat_id=is.null`, { mandat_id: m.id });
      if (L.booking_id) await patch(`payments?booking_id=eq.${L.booking_id}&lease_id=is.null&mandat_id=is.null`, { mandat_id: m.id });
    } catch (e) { console.error('attach', m.id, e.message); }
  }
  const mIds = mandats.map(m => m.id);
  const pays = await api(`payments?select=*&mandat_id=in.${inList(mIds)}&type=in.(rent,first_rent,loyer)`) || [];
  const ops = await api(`gestion_operations?select=*&mandat_id=in.${inList(mIds)}`) || [];
  const echs = await api(`gestion_echeances?select=*&mandat_id=in.${inList(mIds)}`) || [];
  let reguls = []; try { reguls = await api(`gestion_regul?select=*&mandat_id=in.${inList(mIds)}`) || []; } catch (e) { reguls = null; }
  // Régularisation étalée sur 12 mois : part ajoutée à chaque échéance du mois ym
  const mDiff = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
  const extra = (mid, ym) => (reguls || []).filter(r => r.mandat_id === mid && r.etalement && r.applique_at).reduce((s, r) => {
    const e = r.etalement; const k = mDiff(e.debut, ym); if (k < 0 || k >= e.mois) return s;
    return s + (k === e.mois - 1 ? R(e.total - e.mensualite * (e.mois - 1)) : e.mensualite); }, 0);

  const tvaM = m => (m.tva_loyer && ['commercial', 'professionnel'].includes(m.type_bail)) ? (+m.tva_taux || 20) : 0;
  const ten = m => {
    const f = m.fin_bail || {};
    if (f.sortie_effective && days(f.sortie_effective, today) > 0) return null;
    const L = leases[m.lease_id];
    if (L) { const p = profs[L.tenant_id] || {}; return { nom: p.full_name || 'Locataire', email: p.email || '', tenant_id: L.tenant_id, hc: +L.rent || 0, ch: +L.charges || 0, debut: L.start_date, jour: +(L.payment_due_day || 1) || 1, lease: L, tva: tvaM(m) }; }
    if (m.loc_nom) return { nom: m.loc_nom, email: m.loc_email || '', tenant_id: m.loc_clerk_id || null, hc: +m.loc_loyer_hc || 0, ch: +m.loc_charges || 0, debut: m.loc_debut, jour: +m.loc_jour || 1, lease: null, tva: tvaM(m) };
    return null;
  };
  const paid = p => p.status === 'paid' ? Number(p.amount_paid ?? p.amount) || 0 : Number(p.amount_paid) || 0;
  const reste = p => p.status === 'paid' ? 0 : Math.max(0, (+p.amount || 0) - (+p.amount_paid || 0));
  const bien = m => m.bien_label || m.bien_adresse || 'votre logement';

  for (const m of mandats) {
    const ag = agences[m.agency_id] || 'Votre agence';
    const t = ten(m);
    const mp = pays.filter(p => p.mandat_id === m.id);
    try {
      // 1) Échéancier
      if (t && (t.hc + t.ch) > 0) {
        const have = new Set(mp.map(p => String(p.due_date || '').slice(0, 7)));
        const debutYm = t.debut ? String(t.debut).slice(0, 7) : cur;
        const cutoff = [t.debut, m.date_signature || String(m.created_at || '').slice(0, 10), m.fin_bail?.reprise ? m.fin_bail.reprise + '-01' : null].filter(Boolean).sort().pop() || '';
        const rows = [];
        for (let k = 0; k < 3; k++) {
          const ym = addM(cur, k);
          if (ym < debutYm || have.has(ym)) continue;
          if (m.fin_bail?.date_fin && ym > String(m.fin_bail.date_fin).slice(0, 7)) continue;
          if (due(ym, t.jour) < cutoff) continue;
          rows.push({ landlord_id: m.agency_id, tenant_id: t.tenant_id, listing_id: m.listing_id || t.lease?.listing_id || null, lease_id: t.lease?.id || null, booking_id: t.lease?.booking_id || null,
            mandat_id: m.id, tenant_name: t.nom, tenant_email: t.email, amount: R((t.hc + t.ch) * (1 + (t.tva || 0) / 100) + extra(m.id, ym)), type: 'rent', status: 'pending', due_date: due(ym, t.jour) });
        }
        if (rows.length) { const ins = await post('payments', rows); mp.push(...(ins || [])); S(m.agency_id, 'echeances'); }
      }
      for (const p of mp) {
        const unpaid = p.status !== 'paid' && p.status !== 'cancelled' && reste(p) > 0.009;
        const d = days(p.due_date, today);
        const email = t?.email || p.tenant_email; const nom = t?.nom || p.tenant_name || '';
        // 2) Retard
        if (unpaid && d > 0 && p.status === 'pending') { await patch(`payments?id=eq.${p.id}`, { status: 'late' }); p.status = 'late'; }
        // 3) Avis d'échéance J-7
        if (m.auto_avis && unpaid && !p.avis_sent_at && d >= -7 && d <= 0) {
          const ok = await mail(email, `Avis d’échéance ${moisLbl(String(p.due_date).slice(0, 7))} — ${bien(m)}`, ag, `Avis d’échéance — ${moisLbl(String(p.due_date).slice(0, 7))}`,
            `<p>Bonjour ${esc(nom)},</p><p>Votre loyer de <strong>${eur(reste(p))}</strong> pour <strong>${esc(bien(m))}</strong> est à régler au plus tard le <strong>${fr(p.due_date)}</strong>.</p><p>Merci de votre règlement.</p>`);
          await msg(t?.tenant_id, p.listing_id, `Avis d’échéance : ${eur(reste(p))} à régler avant le ${fr(p.due_date)}.`, m.agency_id);
          if (ok || t?.tenant_id) { await patch(`payments?id=eq.${p.id}`, { avis_sent_at: new Date().toISOString() }); S(m.agency_id, 'avis'); }
        }
        // 4) Relances
        if (m.auto_relances && unpaid && d >= 5 && !p.relance_at) {
          await mail(email, `Rappel : loyer du ${fr(p.due_date)} — ${bien(m)}`, ag, 'Rappel de loyer',
            `<p>Bonjour ${esc(nom)},</p><p>Sauf erreur de notre part, le loyer de <strong>${eur(reste(p))}</strong> dû le <strong>${fr(p.due_date)}</strong> ne nous est pas parvenu.</p><p>Si le règlement est en cours, merci de ne pas tenir compte de ce message. En cas de difficulté, contactez-nous rapidement : des solutions existent.</p>`);
          await msg(t?.tenant_id, p.listing_id, `Rappel : le loyer de ${eur(reste(p))} dû le ${fr(p.due_date)} n’a pas été reçu.`, m.agency_id);
          await patch(`payments?id=eq.${p.id}`, { relance_at: new Date().toISOString(), status: 'late' }); S(m.agency_id, 'relances');
        } else if (m.auto_relances && unpaid && d >= 15 && p.relance_at && !p.relance2_at) {
          await mail(email, `Deuxième rappel : loyer du ${fr(p.due_date)} — ${bien(m)}`, ag, 'Deuxième rappel de loyer',
            `<p>Bonjour ${esc(nom)},</p><p>Malgré notre premier rappel, le loyer de <strong>${eur(reste(p))}</strong> dû le <strong>${fr(p.due_date)}</strong> reste impayé. Merci de régulariser sous 8 jours ; à défaut, la procédure de recouvrement sera engagée.</p>`);
          await msg(t?.tenant_id, p.listing_id, `Deuxième rappel : loyer de ${eur(reste(p))} du ${fr(p.due_date)} toujours impayé. Merci de régulariser sous 8 jours.`, m.agency_id);
          await patch(`payments?id=eq.${p.id}`, { relance2_at: new Date().toISOString() }); S(m.agency_id, 'relances');
        }
        // 5) Quittance
        if (m.auto_quittance && p.status === 'paid' && !p.quittance_sent_at && p.paid_at && days(p.paid_at, today) <= 60) {
          const ym = String(p.due_date).slice(0, 7);
          const ok = await mail(email, `Quittance de loyer ${moisLbl(ym)} — ${bien(m)}`, ag, `Quittance de loyer — ${moisLbl(ym)}`,
            `<p>Bonjour ${esc(nom)},</p><p>${esc(ag)}, mandataire de ${esc(m.owner_name || 'votre bailleur')}, déclare avoir reçu la somme de <strong>${eur(paid(p))}</strong> le ${fr(p.paid_at)} au titre du loyer et des charges de <strong>${moisLbl(ym)}</strong> pour le logement ${esc(m.bien_adresse || bien(m))}, et en donne quittance, sous réserve de tous droits.</p>`);
          if (ok) { await patch(`payments?id=eq.${p.id}`, { quittance_sent_at: new Date().toISOString() }); S(m.agency_id, 'quittances'); }
        }
      }
      // 6) Conformité : assurance habitation, entretien chaudière
      if (m.auto_conformite && t) {
        for (const e of echs.filter(x => x.mandat_id === m.id && ['assurance_habitation', 'entretien_chaudiere'].includes(x.type) && x.date_expiration)) {
          const r = days(today, e.date_expiration);
          if (r > 15) continue;
          if (e.relance_at && days(e.relance_at, today) < 30) continue;
          const lbl = e.type === 'assurance_habitation' ? 'attestation d’assurance habitation' : 'attestation d’entretien de la chaudière';
          await mail(t.email, `Votre ${lbl} — ${bien(m)}`, ag, 'Justificatif à transmettre',
            `<p>Bonjour ${esc(t.nom)},</p><p>Votre ${lbl} ${r < 0 ? 'a expiré le' : 'expire le'} <strong>${fr(e.date_expiration)}</strong>. Merci de nous transmettre la nouvelle attestation en répondant à cet e-mail.</p>`);
          await msg(t.tenant_id, m.listing_id, `Merci de nous transmettre votre ${lbl} (échéance ${fr(e.date_expiration)}).`, m.agency_id);
          await patch(`gestion_echeances?id=eq.${e.id}`, { relance_at: new Date().toISOString() }); S(m.agency_id, 'conformite');
        }
      }
      // 7) Régularisation des charges
      if (reguls) await regulAuto(m, t, ag, mp);
    } catch (e) { console.error('mandat', m.id, e.message); }
  }

  async function regulDemande(r, m, ag) {
    const lien = `${SITE}/charges.html?t=${r.token}`;
    if (!m.owner_email) {
      if (!r.demande_at) await msg(m.agency_id, null, `Régularisation des charges ${r.annee} — ${bien(m)} : pas d’e-mail pour ${m.owner_name || 'le propriétaire'}. Envoyez-lui ce lien pour déposer le décompte du syndic et l’avis de taxe foncière : ${lien}`);
      await patch(`gestion_regul?id=eq.${r.id}`, { demande_at: new Date().toISOString(), relances: 99 }); return;
    }
    const n = +r.relances || 0;
    const ok = await mail(m.owner_email, `${n ? 'Rappel — ' : ''}Régularisation des charges ${r.annee} — ${bien(m)}`, ag, `Régularisation des charges ${r.annee}`,
      `<p>Bonjour ${esc(m.owner_name || '')},</p><p>Pour faire la régularisation annuelle des charges ${r.annee} de votre locataire (${esc(bien(m))}), nous avons besoin de :</p>
       <ul><li>le <strong>décompte annuel de charges ${r.annee}</strong> envoyé par votre syndic après l’assemblée générale (pas les appels de fonds) ;</li>
       <li>votre <strong>avis de taxe foncière ${r.annee}</strong>, pour la taxe d’ordures ménagères ;</li>
       <li>le cas échéant, les factures d’eau ou d’entretien que vous avez payées.</li></ul>
       <p>Une photo ou un PDF suffit : nous calculons le reste et prévenons le locataire.</p>
       <p style="margin:22px 0"><a href="${lien}" style="background:#4F46E5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Déposer mes documents</a></p>`);
    if (m.owner_clerk_id) await msg(m.owner_clerk_id, m.listing_id, `Régularisation des charges ${r.annee} : déposez le décompte du syndic et l’avis de taxe foncière ici : ${lien}`, m.agency_id);
    await patch(`gestion_regul?id=eq.${r.id}`, { demande_at: new Date().toISOString(), relances: n + 1 });
    if (ok) S(m.agency_id, 'regul_demandes');
  }
  async function regulApplique(r, m, t, mp) {
    const solde = R(r.solde); const from = [String(r.applicable_le), today].sort().pop(); // jamais sur une échéance déjà passée
    const futurs = mp.filter(p => p.status !== 'paid' && p.status !== 'cancelled' && !(+p.amount_paid) && String(p.due_date) >= from).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const setAmt = async (p, a) => { a = R(Math.max(0, a)); await patch(`payments?id=eq.${p.id}`, { amount: a }); p.amount = a; };
    // Nouvelle provision sur charges pour les échéances à venir
    if (t && r.nouvelle_provision != null && R(r.nouvelle_provision) !== R(t.ch)) {
      if (t.lease) await patch(`leases?id=eq.${t.lease.id}`, { charges: R(r.nouvelle_provision) });
      else await patch(`gestion_mandats?id=eq.${m.id}`, { loc_charges: R(r.nouvelle_provision) });
      for (const p of futurs) await setAmt(p, +p.amount + (R(r.nouvelle_provision) - t.ch) * (1 + (t.tva || 0) / 100));
      t.ch = R(r.nouvelle_provision);
    }
    let et = null, reste = 0;
    if (solde > 0 && r.mode === 'etalement') {
      const mens = R(solde / 12); et = { debut: String(futurs[0]?.due_date || from).slice(0, 7), mois: 12, mensualite: mens, total: solde };
      for (const p of futurs) { const k = mDiff(et.debut, String(p.due_date).slice(0, 7)); if (k >= 0 && k < 12) await setAmt(p, +p.amount + (k === 11 ? R(solde - mens * 11) : mens)); }
    } else if (solde > 0) {
      if (futurs[0]) await setAmt(futurs[0], +futurs[0].amount + solde);
      else await post('payments', { landlord_id: m.agency_id, tenant_id: t?.tenant_id || null, listing_id: m.listing_id || null, mandat_id: m.id, tenant_name: t?.nom || null, tenant_email: t?.email || null, amount: solde, type: 'loyer', status: 'pending', due_date: from });
    } else if (solde < 0) {
      reste = -solde;
      for (const p of futurs) { if (reste <= 0) break; const d = Math.min(reste, +p.amount); await setAmt(p, +p.amount - d); reste = R(reste - d); }
    }
    const upd = { statut: 'applique', applique_at: new Date().toISOString(), etalement: et };
    await patch(`gestion_regul?id=eq.${r.id}`, upd); Object.assign(r, upd);
    await post('gestion_operations', { agency_id: m.agency_id, mandat_id: m.id, date: today, type: 'regul_charges', montant: 0,
      libelle: `Régularisation des charges ${r.annee} : ${solde >= 0 ? '+' : ''}${eur(solde)} (réel ${eur(r.reel)} / provisions ${eur(r.provisions)})${et ? ' en 12 mensualités' : ''}` });
    if (t) await msg(t.tenant_id, m.listing_id, `Régularisation des charges ${r.annee} appliquée : ${solde > 0 ? (et ? `${eur(et.mensualite)} ajoutés à chacune de vos 12 prochaines échéances` : `${eur(solde)} ajoutés à votre prochaine échéance`) : solde < 0 ? `${eur(-solde)} déduits de vos prochaines échéances` : 'aucun solde'}.`, m.agency_id);
    if (reste > 0) await msg(m.agency_id, null, `Régularisation ${r.annee} — ${bien(m)} : il reste ${eur(reste)} à rembourser au locataire (plus d’échéance à venir pour les déduire).`);
    S(m.agency_id, 'regul_appliquees');
  }
  async function regulAuto(m, t, ag, mp) {
    if (m.charges_mode === 'forfait') return;
    const N = +today.slice(0, 4), Y = N - 1;
    const mine = reguls.filter(r => r.mandat_id === m.id);
    // Demande au propriétaire à partir du 1er mars pour l'année écoulée (locataire en place avec provisions)
    if (t && t.ch > 0 && today >= `${N}-03-01` && (!t.debut || String(t.debut) <= `${Y}-12-31`) && !mine.some(r => +r.annee === Y)) {
      const ins = await post('gestion_regul', { agency_id: m.agency_id, mandat_id: m.id, annee: Y, statut: 'attente_docs' });
      if (ins?.[0]) { reguls.push(ins[0]); mine.push(ins[0]); }
    }
    for (const r of mine) {
      if (r.statut === 'attente_docs' && !(r.docs || []).length && (+r.relances || 0) < 4 && (!r.demande_at || days(r.demande_at, today) >= 21)) await regulDemande(r, m, ag);
      if (r.statut === 'envoye' && r.applicable_le && String(r.applicable_le) <= today && !r.applique_at) await regulApplique(r, m, t, mp);
    }
  }

  // 7) Comptes rendus de gestion du mois précédent (à partir du 5)
  if (+today.slice(8, 10) >= 5) {
    const owners = {};
    for (const m of mandats) { const k = `${m.agency_id}|${String(m.owner_email || m.owner_name || 'sans-proprietaire').trim().toLowerCase()}`; (owners[k] = owners[k] || []).push(m); }
    const from = prev + '-01', to = cur + '-01';
    for (const [k, ms] of Object.entries(owners)) {
      const [agId, okey] = k.split('|');
      if (!ms.every(m => m.auto_crg) || !ms[0].owner_email) continue;
      try {
        const done = await api(`gestion_crg?select=id,envoye_at&agency_id=eq.${encodeURIComponent(agId)}&owner_key=eq.${encodeURIComponent(okey)}&periode=eq.${prev}`) || [];
        if (done.some(c => c.envoye_at)) continue;
        const calc = (f, tt) => {
          let enc = 0, hon = 0, gli = 0, frais = 0, op = 0, rev = 0;
          for (const m of ms) {
            const t = ten(m) || { hc: +m.loc_loyer_hc || 0, ch: +m.loc_charges || 0 }; const tot = t.hc + t.ch;
            for (const p of pays.filter(x => x.mandat_id === m.id)) { const v = paid(p); if (!v || !p.paid_at) continue; const d = iso(p.paid_at); if ((f && d < f) || d >= tt) continue;
              enc += v; const base = m.base_honoraires === 'hc' && tot ? v * t.hc / tot : v; hon += base * (+m.taux_honoraires || 0) / 100; if (m.gli) gli += v * (+m.gli_taux || 0) / 100; }
            if (+m.frais_fixes > 0) { const st = String(m.date_signature || m.created_at || '').slice(0, 7); for (let ym = (f || '2015-01-01').slice(0, 7); ym < tt.slice(0, 7); ym = addM(ym, 1)) if (!st || ym >= st) frais += +m.frais_fixes; }
            for (const o of ops.filter(x => x.mandat_id === m.id && !String(x.type || '').startsWith('depot_'))) { const d = iso(o.date); if ((f && d < f) || d >= tt) continue; if (o.type === 'reversement') rev += -(+o.montant || 0); else op += +o.montant || 0; }
          }
          return { enc: R(enc), hon: R(hon), gli: R(gli), frais: R(frais), ops: R(op), rev: R(rev), solde: R(enc - hon - gli - frais + op - rev) };
        };
        const c = calc(from, to); const sd = calc('2015-01-01', from).solde; const sf = calc('2015-01-01', to).solde;
        if (!c.enc && !c.ops && !c.rev) continue; // pas de CRG « frais seuls »
        const ag = agences[agId] || 'Votre agence'; const o = ms[0];
        const ok = await mail(o.owner_email, `Compte rendu de gestion — ${moisLbl(prev)}`, ag, `Compte rendu de gestion — ${moisLbl(prev)}`,
          `<p>Bonjour ${esc(o.owner_name || '')},</p><p>Voici votre compte rendu de gestion pour <strong>${moisLbl(prev)}</strong> :</p>
          <table style="border-collapse:collapse;font-size:14px;min-width:320px"><tr><td style="padding:3px 14px 3px 0">Solde reporté</td><td style="text-align:right">${eur(sd)}</td></tr><tr><td style="padding:3px 14px 3px 0">Loyers encaissés</td><td style="text-align:right">${eur(c.enc)}</td></tr><tr><td style="padding:3px 14px 3px 0">Honoraires de gestion et frais</td><td style="text-align:right">− ${eur(c.hon + c.frais)}</td></tr>${c.gli ? `<tr><td style="padding:3px 14px 3px 0">Assurance loyers impayés</td><td style="text-align:right">− ${eur(c.gli)}</td></tr>` : ''}${c.ops ? `<tr><td style="padding:3px 14px 3px 0">Travaux et opérations diverses</td><td style="text-align:right">${eur(c.ops)}</td></tr>` : ''}${c.rev ? `<tr><td style="padding:3px 14px 3px 0">Reversé</td><td style="text-align:right">− ${eur(c.rev)}</td></tr>` : ''}<tr><td style="padding:6px 14px 3px 0"><strong>Solde en votre faveur</strong></td><td style="text-align:right"><strong>${eur(sf)}</strong></td></tr></table>
          <ul style="font-size:13px">${ms.map(m => `<li>${esc(bien(m))} : ${ten(m) ? 'loué — ' + esc(ten(m).nom) : 'vacant'}</li>`).join('')}</ul>`);
        if (ok) { await api('gestion_crg?on_conflict=agency_id,owner_key,periode', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify({ agency_id: agId, owner_key: okey, periode: prev, detail: { ...c, sd, sf }, net: sf, envoye_at: new Date().toISOString() }) }).catch(() => {});
          await msg(o.owner_clerk_id, o.listing_id, `Compte rendu de gestion ${moisLbl(prev)} : ${eur(c.enc)} encaissés, solde en votre faveur ${eur(sf)}.`, agId); S(agId, 'crg'); }
      } catch (e) { console.error('crg', k, e.message); }
    }
  }

  // 8) Résumé à l'agence
  const L = { echeances: 'échéanciers complétés', avis: 'avis d’échéance', relances: 'relances', quittances: 'quittances', conformite: 'rappels assurance/chaudière', regul_demandes: 'demandes de décompte de charges', regul_appliquees: 'régularisations de charges appliquées', crg: 'comptes rendus de gestion' };
  for (const [ag, s] of Object.entries(stats)) {
    const txt = Object.entries(s).map(([k, v]) => `${v} ${L[k] || k}`).join(', ');
    await msg(ag, null, `Gestion locative — envoyé automatiquement aujourd’hui : ${txt}. Le détail et les tâches restantes sont dans « Gestion locative ».`);
  }
  return { statusCode: 200, body: JSON.stringify(stats) };
};
