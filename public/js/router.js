/* Hash-based routes keep the prototype deployable as a static page. */
const APP_ROUTE_VIEWS = new Set(["home", "punch", "timecard", "grid", "kiosk", "journeys", "timeoff"]);
const APP_ROUTE_DEFAULT_PERSONA = { punch: "ava", timecard: "ava", grid: "zofia", kiosk: "lukas" };
let lastAppRouteEventHash = location.hash;

function appRouteFromHash(hash = location.hash) {
  const fragment = (hash || "").replace(/^#/, "").replace(/^\/+/, "");
  const [route, ...params] = fragment.split("?");
  const query = new URLSearchParams(params.join("?"));
  return { route: (route || "").toLowerCase(), persona: query.get("persona") };
}

function appRouteForState(view = S.view) {
  if (view === "timeoff" && S.persona === "oliver" && UI.to.scope === "team") return "#/timeoff-team";
  return `#/${view}?persona=${encodeURIComponent(S.persona)}`;
}

function syncAppRoute(view = S.view, { replace = false } = {}) {
  const next = appRouteForState(view);
  if (location.hash === next) return;
  const method = replace ? "replaceState" : "pushState";
  try {
    history[method](null, "", next);
    lastAppRouteEventHash = next;
  } catch (_) {
    location.hash = next.slice(1);
  }
}

function applyAppRoute(shouldRender = true) {
  const { route, persona } = appRouteFromHash();
  if (route === "timeoff-team") {
    S.persona = "oliver";
    S.lang = "en";
    toResetUI();
    UI.to.scope = "team";
    UI.to.owner = "oliver";
    UI.to.filter = "Submitted";
    S.view = "timeoff";
  } else if (APP_ROUTE_VIEWS.has(route)) {
    const requestedPersona = persona && PERSONAS[persona] ? persona : S.persona;
    const fallbackPersona = APP_ROUTE_DEFAULT_PERSONA[route];
    S.persona = PERSONAS[requestedPersona].views.includes(route) || ["home", "journeys", "timeoff"].includes(route)
      ? requestedPersona
      : fallbackPersona || "ava";
    if (S.view === "kiosk" && route !== "kiosk") kioskReset();
    if (route === "kiosk") kioskReset();
    if (route === "timeoff") {
      toResetUI();
      UI.to.owner = S.persona;
    }
    S.view = route;
  } else {
    syncAppRoute(S.view, { replace: true });
    return false;
  }
  syncAppRoute(S.view, { replace: true });
  if (shouldRender) {
    render();
    window.scrollTo({ top: 0 });
  }
  return true;
}

function initAppRouter() {
  const onRouteChange = () => {
    if (location.hash === lastAppRouteEventHash) return;
    lastAppRouteEventHash = location.hash;
    applyAppRoute();
  };
  window.addEventListener("popstate", onRouteChange);
  window.addEventListener("hashchange", onRouteChange);
  const { route } = appRouteFromHash();
  if (APP_ROUTE_VIEWS.has(route) || route === "timeoff-team") applyAppRoute(false);
  else syncAppRoute(S.view, { replace: true });
}
