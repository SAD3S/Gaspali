/**
 * Edge Function « delete-account » : suppression définitive du compte de l'utilisateur connecté
 * (exigence Apple et RGPD). Nécessite la clé « service role », qui ne quitte jamais le serveur.
 *
 * 1. `delete_account_data` : quitte chaque foyer (dernier membre → le foyer et ses données sont
 *    supprimés ; sinon l'administration passe au membre le plus ancien et les données partagées
 *    restent au foyer, sans auteur), supprime profil et préférences alimentaires.
 * 2. Suppression de l'utilisateur dans Supabase Auth (e-mail, identités Google / Apple).
 */
// Spécificateur complet : le fichier se colle tel quel dans l'éditeur de fonctions du tableau de bord Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method', message: 'Méthode non autorisée.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'config', message: 'Le serveur n’est pas configuré.' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'unauthorized', message: 'Connecte-toi pour supprimer ton compte.' });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: 'unauthorized', message: 'Connecte-toi pour supprimer ton compte.' });
  const userId = auth.user.id;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: dataError } = await admin.rpc('delete_account_data', { p_user: userId });
  if (dataError) {
    console.error(JSON.stringify({ event: 'delete_account_failed', step: 'data', code: dataError.code }));
    return json(500, { error: 'data', message: 'La suppression a échoué. Réessaie dans un instant.' });
  }
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) {
    console.error(JSON.stringify({ event: 'delete_account_failed', step: 'auth', status: userError.status }));
    return json(500, { error: 'auth', message: 'La suppression a échoué. Réessaie dans un instant.' });
  }
  console.log(JSON.stringify({ event: 'account_deleted' }));
  return json(200, { deleted: true });
});
