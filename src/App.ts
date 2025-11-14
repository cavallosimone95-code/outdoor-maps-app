// Re-export the real app entry to avoid casing/import issues on case-insensitive
// file systems and keep a single canonical module for './App' and './app'.
// This file was a legacy placeholder that conflicted by casing with `app.tsx`.
// Left intentionally empty to avoid import/casing issues on case-insensitive filesystems.

// NOTE: Prefer `src/mainApp.tsx` as the canonical app entry used by the wrapper.

export {};