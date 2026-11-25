// Déclarations minimales du runtime Deno, pour vérifier les types des Edge Functions avec tsc
// (npx tsc -p supabase/functions) sans installer Deno.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  const env: { get(key: string): string | undefined };
}

// Fonctions écrites pour être collées dans le tableau de bord (sans deno.json) : même types que le paquet npm.
declare module 'npm:@supabase/supabase-js@2.119.2' {
  export * from '@supabase/supabase-js';
}
