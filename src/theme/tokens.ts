/** Design tokens repris de `/design/Gaspalli – Proposition visuelle.html`. */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  primarySoft: string;
  urgent: string;
  /** Actions irréversibles (suppression de compte) : contraste AA avec `onDanger`. */
  danger: string;
  onDanger: string;
  navBar: string;
  /** Graphiques : produits sauvés / jetés (paire vérifiée pour le daltonisme, cf. statistiques). */
  chartSaved: string;
  chartWasted: string;
  /** Vue caméra (identique dans les deux thèmes). */
  camera: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#F3F6F1',
    surface: '#FFFFFF',
    surface2: '#E9EFE7',
    border: '#D8E1D6',
    text: '#14211B',
    textSecondary: '#56665D',
    primary: '#1F7A4D',
    onPrimary: '#FFFFFF',
    primaryText: '#17603C',
    primarySoft: '#DDEFE3',
    urgent: '#E8573A',
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    navBar: '#FFFFFF',
    chartSaved: '#1F7A4D',
    chartWasted: '#E97E50',
    camera: '#1A231F',
  },
  // « Graphite » : gris neutre (pas teinté), cartes nettement plus claires que le fond,
  // texte blanc cassé, vert et orange adoucis. Contrastes vérifiés (≥ 4,5 : 1 pour le texte).
  dark: {
    background: '#121212',
    surface: '#242426',
    surface2: '#303033',
    border: '#3C3C40',
    text: '#EDEDED',
    textSecondary: '#A8A8AD',
    primary: '#5FD39A',
    onPrimary: '#0A1F14',
    primaryText: '#8FE3B8',
    primarySoft: '#1F3328',
    urgent: '#FF8A6B',
    danger: '#FFB4AB',
    onDanger: '#690005',
    navBar: '#1C1C1E',
    chartSaved: '#4CC38A',
    chartWasted: '#E8784A',
    camera: '#1A231F',
  },
};

export type FreshnessState = 'frais' | 'bientot' | 'urgent' | 'perime' | 'a_verifier';

export interface FreshnessStyle {
  bg: string;
  fg: string;
  /** Rayon de la pastille : la forme complète la couleur (accessibilité). */
  dotRadius: number;
}

const DOT = 8;

export const freshnessPalettes: Record<ColorScheme, Record<FreshnessState, FreshnessStyle>> = {
  light: {
    frais: { bg: '#DDEFE3', fg: '#17603C', dotRadius: DOT / 2 },
    bientot: { bg: '#FBEFC9', fg: '#6E5100', dotRadius: DOT / 2 },
    urgent: { bg: '#FCE1D9', fg: '#A3301A', dotRadius: 2 },
    perime: { bg: '#F7D9E0', fg: '#8E1A34', dotRadius: 0 },
    a_verifier: { bg: '#E6E3F4', fg: '#4E4390', dotRadius: 2 },
  },
  dark: {
    frais: { bg: '#1F3328', fg: '#8FE3B8', dotRadius: DOT / 2 },
    bientot: { bg: '#3A3218', fg: '#F2CF6E', dotRadius: DOT / 2 },
    urgent: { bg: '#45261E', fg: '#FFA48C', dotRadius: 2 },
    perime: { bg: '#43202A', fg: '#FF9DB0', dotRadius: 0 },
    a_verifier: { bg: '#2C2943', fg: '#C2B9F2', dotRadius: 2 },
  },
};

export const freshnessLabels: Record<FreshnessState, string> = {
  frais: 'Frais',
  bientot: 'Bientôt',
  urgent: 'Urgent',
  perime: 'Périmé',
  a_verifier: 'À vérifier',
};

export const DOT_SIZE = DOT;

export const radius = {
  card: 22,
  cardLarge: 24,
  tile: 20,
  button: 14,
  chip: 999,
  scanButton: 22,
  sheet: 28,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const fonts = {
  title: 'BricolageGrotesque_800ExtraBold',
  titleBold: 'BricolageGrotesque_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const typography = {
  title1: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40 },
  title2: { fontFamily: fonts.titleBold, fontSize: 22, lineHeight: 28 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 1, textTransform: 'uppercase' as const },
};

export type TypographyVariant = keyof typeof typography;

/** Cible tactile minimale (WCAG / HIG). */
export const MIN_TOUCH = 44;
