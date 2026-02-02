import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        aprilia: ['Aprilia', 'Dancing Script', 'cursive'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Landing page specific colors
        landing: {
          pink: "hsl(var(--landing-pink))",
          purple: "hsl(var(--landing-purple))",
          "purple-dark": "hsl(var(--landing-purple-dark))",
          yellow: "hsl(var(--landing-yellow))",
          "yellow-light": "hsl(var(--landing-yellow-light))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        float: {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-12px)",
          },
        },
        breathe: {
          "0%, 100%": {
            transform: "rotate(-2deg) scale(1)",
          },
          "50%": {
            transform: "rotate(-2deg) scale(1.02)",
          },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsla(330, 85%, 86%, 0.4), 0 0 40px hsla(280, 50%, 75%, 0.2)",
          },
          "50%": {
            boxShadow: "0 0 40px hsla(330, 85%, 86%, 0.8), 0 0 60px hsla(280, 50%, 75%, 0.4)",
          },
        },
        "gradient-shift": {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },
        wiggle: {
          "0%, 100%": {
            transform: "rotate(-8deg)",
          },
          "50%": {
            transform: "rotate(8deg)",
          },
        },
        sparkle: {
          "0%, 100%": {
            opacity: "0",
            transform: "scale(0) rotate(0deg)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1) rotate(180deg)",
          },
        },
        "arrow-bounce": {
          "0%, 100%": {
            transform: "translateX(0)",
          },
          "50%": {
            transform: "translateX(4px)",
          },
        },
        "bounce-gentle": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-3px)",
          },
        },
        "pulse-scale": {
          "0%, 100%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.05)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 4s ease-in-out infinite",
        breathe: "breathe 5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 3s ease infinite",
        wiggle: "wiggle 1s ease-in-out infinite",
        sparkle: "sparkle 2s ease-in-out infinite",
        "arrow-bounce": "arrow-bounce 1s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        "pulse-scale": "pulse-scale 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
