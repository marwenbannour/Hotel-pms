/* Fichier généré par scripts/generate-theme.mjs depuis design/tokens.json : ne pas modifier à la main. */

export const colors = {
  "light": {
    "navy900": "#0d182a",
    "navy700": "#1e2a3b",
    "gold500": "#d4af37",
    "gold300": "#f4c542",
    "gray50": "#f6f7f9",
    "gray200": "#e6e8ec",
    "gray400": "#8d96a3",
    "gray700": "#2c3440",
    "gray950": "#0f1218",
    "success500": "#22c55e",
    "info500": "#0ea5e9",
    "warning500": "#f59e0b",
    "error500": "#ef4444",
    "pending500": "#facc15",
    "bg": "#f6f7f9",
    "surface": "#ffffff",
    "surfaceRaised": "#ffffff",
    "line": "#e6e8ec",
    "lineControl": "#8d96a3",
    "text": "#0d182a",
    "textMuted": "#5b6472",
    "textFaint": "#8d96a3",
    "onDark": "#ffffff",
    "accent": "#d4af37",
    "onAccent": "#0d182a",
    "accentText": "#8a6a12",
    "accentSoft": "#fbf4de",
    "secondary": "#0d182a",
    "onSecondary": "#ffffff",
    "focus": "#d4af37",
    "successText": "#15803d",
    "successSoft": "#f0fdf4",
    "infoText": "#0369a1",
    "infoSoft": "#f0f9ff",
    "warningText": "#b45309",
    "warningSoft": "#fffbeb",
    "errorText": "#b91c1c",
    "errorSoft": "#fef2f2",
    "pendingText": "#a16207",
    "pendingSoft": "#fefce8",
    "neutralText": "#5b6472",
    "neutralSoft": "#f1f2f4"
  },
  "dark": {
    "navy900": "#0d182a",
    "navy700": "#1e2a3b",
    "gold500": "#d4af37",
    "gold300": "#f4c542",
    "gray50": "#f6f7f9",
    "gray200": "#e6e8ec",
    "gray400": "#8d96a3",
    "gray700": "#2c3440",
    "gray950": "#0f1218",
    "success500": "#22c55e",
    "info500": "#0ea5e9",
    "warning500": "#f59e0b",
    "error500": "#ef4444",
    "pending500": "#facc15",
    "bg": "#0d182a",
    "surface": "#1e2a3b",
    "surfaceRaised": "#2c3440",
    "line": "#2c3440",
    "lineControl": "#8d96a3",
    "text": "#f6f7f9",
    "textMuted": "#8d96a3",
    "textFaint": "#8d96a3",
    "onDark": "#ffffff",
    "accent": "#d4af37",
    "onAccent": "#0d182a",
    "accentText": "#f4c542",
    "accentSoft": "rgba(212, 175, 55, 0.16)",
    "secondary": "#2c3440",
    "onSecondary": "#f6f7f9",
    "focus": "#f4c542",
    "successText": "#22c55e",
    "successSoft": "rgba(34, 197, 94, 0.16)",
    "infoText": "#0ea5e9",
    "infoSoft": "rgba(14, 165, 233, 0.16)",
    "warningText": "#f59e0b",
    "warningSoft": "rgba(245, 158, 11, 0.16)",
    "errorText": "#f87171",
    "errorSoft": "rgba(239, 68, 68, 0.16)",
    "pendingText": "#facc15",
    "pendingSoft": "rgba(250, 204, 21, 0.16)",
    "neutralText": "#8d96a3",
    "neutralSoft": "rgba(141, 150, 163, 0.16)"
  }
} as const;

export type ThemeName = keyof typeof colors;
export type Palette = { [K in keyof (typeof colors)['light']]: string };

export const space = {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48
} as const;

export const radius = {
  "sm": 6,
  "md": 8,
  "lg": 12,
  "xl": 20,
  "full": 9999
} as const;

export const size = {
  "touchTarget": 44,
  "touchTargetLg": 48,
  "tabBar": 64,
  "iconSm": 16,
  "iconMd": 20,
  "iconLg": 24,
  "gridMargin": 16,
  "gridGutter": 16
} as const;

export const shadows = {
  "light": {
    "1": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 1
      },
      "shadowRadius": 1,
      "shadowOpacity": 0.05,
      "elevation": 1
    },
    "2": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 4
      },
      "shadowRadius": 6,
      "shadowOpacity": 0.08,
      "elevation": 4
    },
    "3": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 8
      },
      "shadowRadius": 12,
      "shadowOpacity": 0.12,
      "elevation": 8
    }
  },
  "dark": {
    "1": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 1
      },
      "shadowRadius": 1,
      "shadowOpacity": 0.3,
      "elevation": 1
    },
    "2": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 4
      },
      "shadowRadius": 6,
      "shadowOpacity": 0.4,
      "elevation": 4
    },
    "3": {
      "shadowColor": "rgb(0, 0, 0)",
      "shadowOffset": {
        "width": 0,
        "height": 8
      },
      "shadowRadius": 12,
      "shadowOpacity": 0.5,
      "elevation": 8
    }
  }
} as const;

export const type = {
  "display1": {
    "fontFamily": "Poppins_700Bold",
    "fontSize": 34,
    "lineHeight": 42
  },
  "display2": {
    "fontFamily": "Poppins_600SemiBold",
    "fontSize": 28,
    "lineHeight": 36
  },
  "title1": {
    "fontFamily": "Poppins_600SemiBold",
    "fontSize": 22,
    "lineHeight": 30
  },
  "title2": {
    "fontFamily": "Poppins_500Medium",
    "fontSize": 18,
    "lineHeight": 26
  },
  "bodyLg": {
    "fontFamily": "Inter_400Regular",
    "fontSize": 16,
    "lineHeight": 24
  },
  "body": {
    "fontFamily": "Inter_400Regular",
    "fontSize": 14,
    "lineHeight": 20
  },
  "caption": {
    "fontFamily": "Inter_400Regular",
    "fontSize": 12,
    "lineHeight": 16
  },
  "button": {
    "fontFamily": "Inter_600SemiBold",
    "fontSize": 14,
    "lineHeight": 20
  },
  "label": {
    "fontFamily": "Inter_500Medium",
    "fontSize": 12,
    "lineHeight": 16
  },
  "badge": {
    "fontFamily": "Inter_500Medium",
    "fontSize": 12,
    "lineHeight": 16
  },
  "tabLabel": {
    "fontFamily": "Inter_500Medium",
    "fontSize": 11,
    "lineHeight": 14
  },
  "titleAr": {
    "fontFamily": "NotoKufiArabic_600SemiBold",
    "fontSize": 22,
    "lineHeight": 34
  },
  "bodyAr": {
    "fontFamily": "NotoKufiArabic_400Regular",
    "fontSize": 14,
    "lineHeight": 24
  }
} as const;

export const typeArabic = {
  "display1": {
    "fontFamily": "NotoKufiArabic_700Bold",
    "fontSize": 34,
    "lineHeight": 58,
    "letterSpacing": 0
  },
  "display2": {
    "fontFamily": "NotoKufiArabic_600SemiBold",
    "fontSize": 28,
    "lineHeight": 48,
    "letterSpacing": 0
  },
  "title1": {
    "fontFamily": "NotoKufiArabic_600SemiBold",
    "fontSize": 22,
    "lineHeight": 37,
    "letterSpacing": 0
  },
  "title2": {
    "fontFamily": "NotoKufiArabic_500Medium",
    "fontSize": 18,
    "lineHeight": 31,
    "letterSpacing": 0
  },
  "bodyLg": {
    "fontFamily": "NotoKufiArabic_400Regular",
    "fontSize": 16,
    "lineHeight": 27,
    "letterSpacing": 0
  },
  "body": {
    "fontFamily": "NotoKufiArabic_400Regular",
    "fontSize": 14,
    "lineHeight": 24,
    "letterSpacing": 0
  },
  "caption": {
    "fontFamily": "NotoKufiArabic_400Regular",
    "fontSize": 12,
    "lineHeight": 20,
    "letterSpacing": 0
  },
  "button": {
    "fontFamily": "NotoKufiArabic_600SemiBold",
    "fontSize": 14,
    "lineHeight": 24,
    "letterSpacing": 0
  },
  "label": {
    "fontFamily": "NotoKufiArabic_500Medium",
    "fontSize": 12,
    "lineHeight": 20,
    "letterSpacing": 0
  },
  "badge": {
    "fontFamily": "NotoKufiArabic_500Medium",
    "fontSize": 12,
    "lineHeight": 20,
    "letterSpacing": 0
  },
  "tabLabel": {
    "fontFamily": "NotoKufiArabic_500Medium",
    "fontSize": 11,
    "lineHeight": 19,
    "letterSpacing": 0
  },
  "titleAr": {
    "fontFamily": "NotoKufiArabic_600SemiBold",
    "fontSize": 22,
    "lineHeight": 37,
    "letterSpacing": 0
  },
  "bodyAr": {
    "fontFamily": "NotoKufiArabic_400Regular",
    "fontSize": 14,
    "lineHeight": 24,
    "letterSpacing": 0
  }
} as const;

export type TypeStyle = keyof typeof type;

export const duration = {
  "slide": 250,
  "fade": 200,
  "scale": 200,
  "modal": 300
} as const;
