/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FBF6EA",
        ink: "#20261F",
        chili: "#B3402A",
        "chili-dark": "#8C2F1E",
        turmeric: "#D9A441",
        herb: "#3F6B4A",
        clay: "#8C7B63",
        "clay-light": "#E7DFCF",
        // Exact greens sampled from the client's reference video, used only
        // on the customer-facing menu/details pages so the rest of the
        // dashboard's muted "herb" green is untouched.
        // A lighter, more muted "professional" green for the customer view
        // (previously a very saturated emerald, sampled from a reference
        // video -- toned down here per the client's request).
        sprout: "#43A06D",
        "sprout-dark": "#2E7D53",
        // Customer view palette (warm cream + banana-leaf green)
        cream: "#F9F4EA",
        leaf: "#14641E",
        "leaf-dark": "#0E4A16",
        "leaf-light": "#E4F0DC",
        cocoa: "#2B140A",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        script: ["Fraunces", "Georgia", "Cambria", "serif"],
        quick: ["Quicksand", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        "stage-in": {
          "0%": { opacity: "0", transform: "translateX(70px) scale(0.86) rotate(4deg)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1) rotate(0)" },
        },
        "stage-out": {
          "0%": { opacity: "1", transform: "translateX(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateX(-70px) scale(0.9) rotate(-4deg)" },
        },
        "text-in": {
          "0%": { opacity: "0", filter: "blur(6px)", transform: "translateY(6px)" },
          "100%": { opacity: "1", filter: "blur(0)", transform: "translateY(0)" },
        },
        "float-dish": {
          "0%,100%": { transform: "translateY(0) rotate(-1deg)" },
          "50%": { transform: "translateY(-7px) rotate(1deg)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(-14px) scale(0.6)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.15)" },
        },
        "leaf-pop": {
          "0%": { opacity: "0", transform: "scale(0.2) translateY(-18px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "bump": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.22)" },
          "100%": { transform: "scale(1)" },
        },
        "card-rise": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "nav-drop": {
          "0%": { opacity: "0", transform: "translateY(-22px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "stage-in": "stage-in 0.7s cubic-bezier(0.22, 0.9, 0.3, 1) both",
        "stage-out": "stage-out 0.55s cubic-bezier(0.5, 0, 0.8, 0.4) both",
        "text-in": "text-in 0.6s ease-out both",
        "float-dish": "float-dish 5s ease-in-out infinite",
        "toast-in": "toast-in 0.4s cubic-bezier(0.22, 1.2, 0.36, 1) both",
        "toast-out": "toast-out 0.35s ease-in both",
        "leaf-pop": "leaf-pop 0.55s cubic-bezier(0.3, 1.6, 0.5, 1) both",
        "bump": "bump 0.45s cubic-bezier(0.3, 1.6, 0.5, 1)",
        "card-rise": "card-rise 0.6s cubic-bezier(0.22, 0.9, 0.3, 1) both",
        "nav-drop": "nav-drop 0.7s cubic-bezier(0.22, 0.9, 0.3, 1) both",
        "rise-in": "rise-in 0.6s ease-out both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.32s ease-out both",
        "pop-in": "pop-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
