export function isAppHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "app.workingpoint.nl" || h.endsWith(".app.workingpoint.nl");
}
