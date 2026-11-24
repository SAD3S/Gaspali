// Déclarations minimales du runtime Deno, pour vérifier les types des Edge Functions avec tsc
// (npx tsc -p supabase/functions) sans installer Deno.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  const env: { get(key: string): string | undefined };
}
