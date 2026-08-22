/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // BOSSO portal design tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // Primary: UT Austin burnt orange
        primary: {
          DEFAULT: "hsl(var(--primary))",
          50: "#FFF6EE",
          100: "#FEE8D4",
          200: "#FBCDA7",
          300: "#F5A86F",
          400: "#E87C32",
          500: "#BF5700",
          600: "#A54900",
          700: "#843B05",
          800: "#69310A",
          900: "#562A0B",
          foreground: "hsl(var(--primary-foreground))",
        },
        
        // Secondary: Deep Black (TSAG Black)
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          50: "#3D3D3D",
          100: "#333333",
          200: "#292929",
          300: "#1F1F1F",
          400: "#151515",
          500: "#111111",
          600: "#0D0D0D",
          700: "#090909",
          800: "#050505",
          900: "#000000",
          foreground: "hsl(var(--secondary-foreground))",
        },
        
        // Accent: restrained warm orange
        accent: {
          DEFAULT: "hsl(var(--accent))",
          50: "#FFE8D9",
          100: "#FFD6BF",
          200: "#FFB38A",
          300: "#FF9147",
          400: "#FF7F2E",
          500: "#BF5700",
          600: "#CC5E0F",
          700: "#A34600",
          800: "#7A3300",
          900: "#512000",
          foreground: "hsl(var(--accent-foreground))",
        },
        
        // Legacy surface names. Keeping these token-backed lets older screens
        // participate in both themes, including hover and opacity variants.
        dark: {
          DEFAULT: "hsl(var(--background) / <alpha-value>)",
          50: "hsl(var(--muted) / <alpha-value>)",
          100: "hsl(var(--secondary) / <alpha-value>)",
          200: "hsl(var(--card) / <alpha-value>)",
          300: "hsl(var(--background) / <alpha-value>)",
          400: "hsl(var(--background) / <alpha-value>)",
          500: "hsl(var(--background) / <alpha-value>)",
          600: "hsl(var(--background) / <alpha-value>)",
          700: "hsl(var(--background) / <alpha-value>)",
          800: "hsl(var(--background) / <alpha-value>)",
          900: "#000000",
        },
        
        // Destructive (Error/Warning)
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        
        // Muted elements
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        
        // Card backgrounds
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "slide-in": {
          from: { transform: "translateY(-10px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(245, 125, 31, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(245, 125, 31, 0.8)" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 10px rgba(245, 125, 31, 0.4)",
            transform: "scale(1)"
          },
          "50%": { 
            boxShadow: "0 0 30px rgba(245, 125, 31, 0.8)",
            transform: "scale(1.02)"
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "glow": "glow 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      boxShadow: {
        'neon-orange': '0 0 20px rgba(245, 125, 31, 0.5)',
        'neon-black': '0 0 20px rgba(17, 17, 17, 0.8)',
        'glow-lg': '0 0 40px rgba(245, 125, 31, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23F57D1F' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
