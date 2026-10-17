// Paleta con nombres: los valores viven en src/index.css (:root) como canales RGB,
// así se cambia todo el aspecto desde un solo lugar y siguen funcionando las opacidades (bg-marca-600/20).
const ESCALA = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const tono = (nombre) => Object.fromEntries(ESCALA.map((n) => [n, `rgb(var(--${nombre}-${n}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marca: tono("marca"), // acción principal y marca (teal)
        neutro: tono("neutro"), // texto, fondos y bordes
        exito: tono("exito"), // pagado, confirmado, íntegro
        alerta: tono("alerta"), // en curso, matching de empresas
        peligro: tono("peligro"), // sobrecosto, rechazo, errores
        info: tono("info"), // recaudando, reembolsos
        comunidad: tono("comunidad"), // voz de las familias
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        suave: "0 1px 2px rgb(var(--neutro-900) / 0.04), 0 6px 20px -8px rgb(var(--neutro-900) / 0.08)",
        elevada: "0 2px 4px rgb(var(--neutro-900) / 0.05), 0 18px 40px -12px rgb(var(--neutro-900) / 0.18)",
        boton: "0 1px 2px rgb(var(--marca-900) / 0.25), inset 0 1px 0 rgb(255 255 255 / 0.12)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
