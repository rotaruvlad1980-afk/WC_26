// ─── localStorage helpers ─────────────────────────────────────────────────────
export const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
};

export const load = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch(e) { return def; }
};

export const clear = (k) => {
  try { localStorage.removeItem(k); } catch(e) {}
};
