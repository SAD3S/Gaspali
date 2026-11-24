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
  navBar: string;
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
    navBar: '#FFFFFF',
    camera: '#1A231F',
  },
  dark: {
    background: '#0F1613',
    surface: '#18221D',
    surface2: '#212D27',
    border: '#2C3A33',
    text: '#E9F0EB',
    textSecondary: '#9AABA1',
    primary: '#4CC38A',
    onPrimary: '#0B1F15',
    primaryText: '#7DDBA8',
    primarySoft: '#1D3A2B',
    urgent: '#FF7A5C',
    navBar: '#141D19',
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
    frais: { bg: '#1D3A2B', fg: '#7DDBA8', dotRadius: DOT / 2 },
    bientot: { bg: '#3A3115', fg: '#F5CF6B', dotRadius: DOT / 2 },
    urgent: { bg: '#43231B', fg: '#FF9A80', dotRadius: 2 },
    perime: { bg: '#3F1A24', fg: '#FF8FA5', dotRadius: 0 },
    a_verifier: { bg: '#2A2640', fg: '#B8AEF0', dotRadius: 2 },
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
