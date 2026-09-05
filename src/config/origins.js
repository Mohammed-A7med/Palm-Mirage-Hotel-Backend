// ─── Development origins ──────────────────────────────────────────────────────
// Only ports actively used during local development.
const DEV_ORIGINS = [
  "http://localhost:3000", // Next.js dashboard
  "http://localhost:5000", // Backend (Render local)
  "http://localhost:5173", // Vite website (dev)
  "http://localhost:4173", // Vite website (preview / npm run preview)
];

// ─── Production origins ───────────────────────────────────────────────────────
// Only deployed frontend URLs. No localhost, no ports.
const PROD_ORIGINS = [
  "https://palm-mirage-hotel.netlify.app",   // Website (Netlify)
  "https://final-project-nti-three.vercel.app", // Website (Vercel)
  "https://palm-mirage-hotel-dashboard-git-sprint-9-1omartarek1s-projects.vercel.app",  // Dashboard (Vercel)
];

// ─── Combined allowlist ───────────────────────────────────────────────────────
// In production, only PROD_ORIGINS are active.
// Additional origins can be injected at runtime via ALLOWED_ORIGINS env var
// (comma-separated) — useful for staging / PR previews without code changes.
export const getAllowedOrigins = () => {
  const isProd = process.env.NODE_ENV?.trim().toLowerCase() === "production";
  const base = isProd ? PROD_ORIGINS : [...DEV_ORIGINS, ...PROD_ORIGINS];

  const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...base, ...extraOrigins])];
};

export const allowOrigin = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();

  if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    return callback(null, origin || true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin}`));
};
