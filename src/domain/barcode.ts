/** Codes-barres alimentaires : EAN-13, EAN-8, UPC-A, UPC-E. */

/** Chiffre de contrôle GS1 (modulo 10, poids 3/1 en partant de la droite). */
function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** Développe un UPC-E (8 chiffres) en UPC-A (12 chiffres). */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0]!;
  const d = code.slice(1, 7);
  const check = code[7]!;
  const last = d[5]!;
  let body: string;
  if (last <= '2') body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  else if (last === '3') body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  else if (last === '4') body = `${d.slice(0, 4)}00000${d[4]}`;
  else body = `${d.slice(0, 5)}0000${last}`;
  return `${ns}${body}${check}`;
}

/**
 * Normalise un code lu par la caméra : chiffres uniquement, UPC-A → EAN-13 (préfixe 0),
 * UPC-E → EAN-13. Renvoie null si le code est invalide (chiffre de contrôle faux = mauvaise lecture).
 */
export function normalizeBarcode(raw: string): string | null {
  let code = raw.replace(/\D/g, '');
  if (code.length === 8 && (code[0] === '0' || code[0] === '1')) {
    // Peut être un EAN-8 ou un UPC-E : on garde l'EAN-8 s'il est valide tel quel.
    if (isValidGtin(code)) return code;
    const upcA = expandUpcE(code);
    if (upcA && isValidGtin(upcA)) return `0${upcA}`;
    return null;
  }
  if (code.length === 12) code = `0${code}`;
  if (code.length !== 8 && code.length !== 13) return null;
  return isValidGtin(code) ? code : null;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}
