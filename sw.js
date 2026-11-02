// Ancien service worker désactivé : il interceptait les requêtes (dont les appels aux fonctions Netlify)
// et les cassait. Cette version se désinstalle elle-même, vide les caches et recharge les pages ouvertes.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (err) {}
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach((c) => { try { c.navigate(c.url); } catch (err) {} });
  })());
});
// Aucun gestionnaire « fetch » : le navigateur fait les requêtes normalement.
