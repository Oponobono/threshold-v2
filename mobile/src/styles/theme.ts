export const theme = {
  colors: {
    primary: '#000000',
    primaryTransparent: {
      light: 'rgba(0, 0, 0, 0.05)',
      medium: 'rgba(0, 0, 0, 0.15)',
      heavy: 'rgba(0, 0, 0, 0.35)',
    },
    background: '#FAFAFA',
    card: '#F4F6F8',
    white: '#FFFFFF',
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
      placeholder: '#999999',
      link: '#000000',
      error: '#FF3B30',
      white: '#FFFFFF',
      inverse: '#FFFFFF', // For text on dark backgrounds
    },
    border: '#E0E0E0',
    inputBackground: '#FDFDFD',
    success: '#34C759', // Used for "Safe" status, good grades
    successTransparent: 'rgba(52, 199, 89, 0.15)',
    warning: '#FF9500', // Used for "At Risk" status
    warningTransparent: 'rgba(255, 149, 0, 0.15)',
    danger: '#FF2D55',  // Used for "Impossible" status, destructive actions
    dangerTransparent: 'rgba(255, 45, 85, 0.08)',
    info: '#007AFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
  },
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    sizes: {
      xs: 10,  // Labels, meta text
      sm: 12,  // Subtitles, hints
      md: 14,  // Body text, list items
      lg: 16,  // Input text, buttons, section titles
      xl: 20,  // Headers
      xxl: 28, // Large headers, Hero text
      xxxl: 36, // Huge numbers (GPA, grades)
      display: 44, // Very large metrics
    },
  },
};
