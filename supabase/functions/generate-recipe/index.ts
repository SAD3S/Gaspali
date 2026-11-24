/**
 * Edge Function « generate-recipe » : invente une recette anti-gaspi avec l'API Claude.
 *
 * - La clé ANTHROPIC_API_KEY ne vit que dans les secrets Supabase (jamais dans l'app).
 * - Réservé aux membres du foyer ; quota par foyer et par jour (AI_DAILY_LIMIT, 5 par défaut) ;
 *   réponses en cache 3 jours pour une même demande.
 * - Réponse contrainte par un schéma JSON (structured outputs), revalidée ici avec Zod ;
 *   les allergies déclarées sont un filtre strict, revérifié après génération. Recette invalide :
 *   nouvelle tentative (3 au plus) avec la liste des problèmes.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  ALLERGEN_LABELS,
  buildUserPrompt,
  cacheMaterial,
  findAllergenConflicts,
  generatedRecipeSchema,
  mergeConstraints,
  OUTPUT_JSON_SCHEMA,
  RequestSchema,
  SYSTEM_PROMPT,
  toAppRecipe,
} from './recipe.ts';

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-5-5';
/** Claude Opus 5.5 : l'effort par défaut est « medium » ; on le fixe explicitement (réglable). */
const EFFORT = (Deno.env.get('AI_EFFORT') ?? 'medium') as 'low' | 'medium' | 'high';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '5');
const MAX_ATTEMPTS = 3;
/** Au-delà, pas de nouvelle tentative (limite de durée des Edge Functions). */
const TIME_BUDGET_MS = 100_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { error, message, ...extra });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function jsonArray(text: unknown): string[] {
  try {
    const v = JSON.parse(String(text));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

interface Reservation {
  reservation: string | null;
  used: number;
  cached: unknown;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method', 'Méthode non autorisée.');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !url || !anonKey || !serviceKey) return fail(500, 'config', 'Les idées IA ne sont pas encore configurées sur le serveur.');

  // Utilisateur connecté (jeton de la session Supabase envoyé par l'app).
  const authorization = req.headers.get('Authorization');
  if (!authorization) return fail(401, 'unauthorized', 'Connecte-toi pour utiliser les idées IA.');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return fail(401, 'unauthorized', 'Connecte-toi pour utiliser les idées IA.');
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'invalid_request', 'Demande illisible.');
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'invalid_request', 'Demande invalide.', { issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) });
  }
  const r = parsed.data;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: member } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', r.household_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return fail(403, 'not_member', 'Tu ne fais pas partie de ce foyer.');

  // Préférences enregistrées sur le serveur, réunies avec celles envoyées par l'app (le plus prudent).
  const { data: profiles } = await admin
    .from('dietary_profiles')
    .select('diet, allergens, dislikes')
    .eq('household_id', r.household_id)
    .is('deleted_at', null);
  const constraints = mergeConstraints(
    r,
    (profiles ?? []).map((p: { diet: string; allergens: string; dislikes: string }) => ({ diet: p.diet, allergens: jsonArray(p.allergens), dislikes: jsonArray(p.dislikes) })),
  );

  const cacheKey = await sha256(cacheMaterial(r, constraints));
  const { data: reserved, error: reserveError } = await admin
    .rpc('ai_reserve_generation', { p_household: r.household_id, p_user: userId, p_cache_key: cacheKey, p_daily_limit: DAILY_LIMIT })
    .single<Reservation>();
  if (reserveError || !reserved) return fail(500, 'server', 'Le serveur n’a pas pu traiter la demande.');
  const remaining = Math.max(0, DAILY_LIMIT - reserved.used);
  if (reserved.cached) return json(200, { recipe: reserved.cached, cached: true, remaining });
  if (!reserved.reservation) {
    return fail(429, 'quota', `Tu as utilisé les ${DAILY_LIMIT} idées IA du jour pour ton foyer. Reviens demain !`, { limit: DAILY_LIMIT, remaining: 0 });
  }
  const reservationId = reserved.reservation;

  const anthropic = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const schema = generatedRecipeSchema(r);
  const issues: string[] = [];
  const start = Date.now();
  let attempts = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const abandon = async (status: number, error: string, message: string) => {
    await admin.rpc('ai_fail_generation', { p_id: reservationId, p_attempts: attempts });
    console.log(JSON.stringify({ event: 'ai_recipe_failed', error, attempts, inputTokens, outputTokens }));
    return fail(status, error, message, { remaining });
  };

  while (attempts < MAX_ATTEMPTS && Date.now() - start < TIME_BUDGET_MS) {
    attempts++;
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // Refus de sécurité : nouvelle tentative automatique sur le modèle de repli recommandé.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMA } },
        // Partie stable (règles + référentiel d'ingrédients) mise en cache entre les appels.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserPrompt(r, constraints, issues) }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return abandon(503, 'busy', 'Beaucoup de demandes en ce moment : réessaie dans une minute.');
      if (e instanceof Anthropic.APIConnectionError) return abandon(502, 'upstream', 'Le service de recettes ne répond pas. Réessaie dans un instant.');
      if (e instanceof Anthropic.APIError) {
        console.error(JSON.stringify({ event: 'ai_recipe_api_error', status: e.status }));
        return abandon(502, 'upstream', 'Le service de recettes a rencontré une erreur. Réessaie dans un instant.');
      }
      throw e;
    }
    inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === 'refusal') {
      return abandon(422, 'refused', 'Cette demande ne peut pas être traitée. Essaie avec une autre envie.');
    }
    if (response.stop_reason === 'max_tokens') {
      issues.push('la réponse était trop longue : propose une recette plus simple');
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      issues.push('la réponse n’était pas un JSON valide');
      continue;
    }
    const valid = schema.safeParse(candidate);
    if (!valid.success) {
      issues.push(...valid.error.issues.slice(0, 4).map((i) => `champ « ${i.path.join('.')} » : ${i.message}`));
      continue;
    }
    const conflicts = findAllergenConflicts(valid.data, constraints.allergens);
    if (conflicts.length) {
      issues.push(...conflicts.map((c) => `contient ${ALLERGEN_LABELS[c.allergen]} (${c.where}), allergène interdit`));
      continue;
    }

    const recipe = toAppRecipe(valid.data);
    await admin.rpc('ai_complete_generation', {
      p_id: reservationId,
      p_recipe: recipe,
      p_model: response.model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_attempts: attempts,
    });
    console.log(JSON.stringify({ event: 'ai_recipe_done', attempts, inputTokens, outputTokens, model: response.model }));
    return json(200, { recipe, cached: false, remaining });
  }

  return abandon(502, 'generation_failed', 'Pas de recette qui respecte toutes vos contraintes cette fois-ci. Réessaie avec une autre envie.');
});
