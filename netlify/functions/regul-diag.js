// Diagnostic de la lecture automatique des documents : indique seulement si les variables existent (jamais leur valeur)
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify({ supabase_service_key: !!process.env.SUPABASE_SERVICE_KEY, anthropic_api_key: !!process.env.ANTHROPIC_API_KEY }),
});
