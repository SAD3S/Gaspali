/** Texte partagé vers Gaspalli (e-mail de commande drive…) en attente d'analyse par l'écran Ticket. */
let pending: string | null = null;

export function setPendingReceiptText(text: string): void {
  pending = text;
}

export function takePendingReceiptText(): string | null {
  const t = pending;
  pending = null;
  return t;
}
