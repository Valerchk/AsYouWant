/* Applies the stored theme before the first paint.

   A separate file rather than an inline script so the content policy can stay
   nonce-only: an inline script here would need either `'unsafe-inline'`,
   which defeats the policy, or a hash kept manually in step with this text.
   It is deliberately render-blocking — that is the whole point. Without it a
   dark-theme user gets a flash of paper-white on every load, because the
   React tree resolves far too late to prevent it. */
try {
  var t = localStorage.getItem("ayw.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {
  /* Private mode. The default theme is correct often enough. */
}
