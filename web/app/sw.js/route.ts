/**
 * Service worker de l'application installée. Il ne met rien en cache : les données d'un hôtel
 * changent sans cesse et ne doivent jamais s'afficher périmées. Il n'intervient que sur la
 * navigation entre les pages : sans réseau, une page « pas de connexion » remplace l'écran
 * d'erreur du navigateur. Les appels à l'API et le flux des modifications ne passent pas par lui.
 */
const OFFLINE_PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d182a"><title>Hors ligne</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f7f9;color:#0d182a;
    font:16px/1.6 Inter,'IBM Plex Sans Arabic',system-ui,sans-serif}
  main{max-width:22rem;padding:24px}
  p{margin:0 0 12px}
  .ar{direction:rtl;text-align:right}
  button{margin-top:12px;min-height:44px;padding:0 20px;border:0;border-radius:6px;background:#0d182a;color:#fff;font:inherit;font-weight:500}
</style></head>
<body><main>
  <p><strong>Pas de connexion.</strong> Vérifiez le Wi-Fi ou les données mobiles.</p>
  <p lang="en"><strong>No connection.</strong> Check Wi-Fi or mobile data.</p>
  <p lang="ar" class="ar"><strong>لا يوجد اتصال.</strong> تحقق من شبكة Wi-Fi أو بيانات الجوال.</p>
  <button onclick="location.reload()">Réessayer · Retry · إعادة المحاولة</button>
</main>
<script>addEventListener('online',()=>location.reload())</script>
</body></html>`;

const WORKER = `
const OFFLINE_PAGE = ${JSON.stringify(OFFLINE_PAGE)};
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() => new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
  );
});
`;

export function GET() {
  return new Response(WORKER, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Toujours revérifié : une nouvelle version est prise en compte au chargement suivant.
      'Cache-Control': 'no-cache',
    },
  });
}
