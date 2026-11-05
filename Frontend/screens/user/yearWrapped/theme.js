// Frontend/screens/user/yearWrapped/theme.js

import globals from '../../../styles/globals';

// Colores sacados de Frontend/styles/globals.js (misma paleta que el resto de la app).
export const palette = {
  primary: globals.colors.primary,
  ink: globals.colors.textDark,
  mint: globals.colors.textLight,
  tealSoft: globals.colors.tealSoft,
  iconCircle: globals.colors.iconCircle,
  white: globals.colors.surface,
  hairline: globals.colors.surfaceBorder,
};

// Cada diapositiva usa uno de estos "temas" (fondo, texto, acento, manchas decorativas).
export const slideThemes = {
  night: { bg: palette.ink, fg: palette.white, accent: palette.mint, muted: 'rgba(255,255,255,0.68)', blob1: palette.primary, blob2: '#0B2A36' },
  teal:  { bg: palette.primary, fg: palette.white, accent: palette.mint, muted: 'rgba(255,255,255,0.78)', blob1: '#1C97A4', blob2: '#126670' },
  mint:  { bg: palette.mint, fg: palette.ink, accent: palette.primary, muted: 'rgba(4,21,31,0.66)', blob1: '#C6F8BB', blob2: '#8EE27D' },
  light: { bg: palette.tealSoft, fg: palette.ink, accent: palette.primary, muted: 'rgba(4,21,31,0.62)', blob1: '#EAF3F4', blob2: '#C5DADD' },
  paper: { bg: palette.white, fg: palette.ink, accent: palette.primary, muted: 'rgba(4,21,31,0.58)', blob1: palette.iconCircle, blob2: palette.tealSoft },
};

export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  button: { shadowColor: palette.primary, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
};
