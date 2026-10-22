const globals = {
  colors: {
    primary: '#177E89',
    secondary: '#E5E5E5',
    background: '#ffffff',
    backgroundAlt: '#F5F5F5',
    text: '#04151F',
    textDark: '#04151F',
    textLight: '#ACF39D',
    border: '#dddddd',
    danger: '#cc0000',
    textMuted: '#888888',
    avatarPlaceholder: '#D4D0D0',
    badge: '#F2F1F2',
    sectionCard: '#F5F5F5',
    // --- new design tokens (from the Figma mockups) ---
    surface: '#FFFFFF',        // white cards on the white page
    surfaceBorder: '#EDEDED',  // hairline around cards
    tealSoft: '#DCE8EA',       // icon circles, quote banner, today ring
    textSecondary: '#9A9A9A',  // captions / subtitles
    navInactive: '#6F6F6F',    // outlined footer icons
  },
  // Soft card elevation used across the redesigned screens.
  // (RN-web turns shadow* into box-shadow; `elevation` covers Android.)
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    button: {
      shadowColor: '#177E89',
      shadowOpacity: 0.3,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSize: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 100,
  },
};

export default globals;