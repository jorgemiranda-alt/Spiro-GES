/* Progressive enhancement: the demo also runs in browsers without PWA support. */
const PWA = (() => {
  const base = new URL('../', document.currentScript.src);
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const supported = window.isSecureContext && ['http:', 'https:'].includes(base.protocol);
  let installPrompt = null, installing = false, installedHere = false;
  const copy = {
    en: {install:'Install demo', installing:'Opening installer…', home:'Add to Home Screen', help:'In your browser, open Share, choose Add to Home Screen, then tap Add. If available, keep Open as Web App enabled.', browserHelp:'Open your browser menu and choose Install app or Add to Home Screen, if available.', failed:'Installation could not open. Try installing from your browser menu.'},
    fr: {install:'Installer la démo', installing:'Ouverture de l’installation…', home:'Sur l’écran d’accueil', help:'Dans votre navigateur, ouvrez Partager, choisissez Sur l’écran d’accueil, puis Ajouter. Si disponible, activez Ouvrir comme app web.', browserHelp:'Ouvrez le menu du navigateur et choisissez Installer l’application ou Sur l’écran d’accueil, si disponible.', failed:'Impossible d’ouvrir l’installation. Essayez depuis le menu du navigateur.'},
    de: {install:'Demo installieren', installing:'Installation wird geöffnet…', home:'Zum Home-Bildschirm', help:'Öffnen Sie im Browser Teilen, wählen Sie Zum Home-Bildschirm und dann Hinzufügen. Falls verfügbar, aktivieren Sie Als Web-App öffnen.', browserHelp:'Öffnen Sie das Browsermenü und wählen Sie App installieren oder Zum Home-Bildschirm, falls verfügbar.', failed:'Die Installation konnte nicht geöffnet werden. Versuchen Sie es über das Browsermenü.'},
    nl: {install:'Demo installeren', installing:'Installatie openen…', home:'Zet op beginscherm', help:'Open in uw browser Deel, kies Zet op beginscherm en tik op Voeg toe. Schakel indien beschikbaar Open als webapp in.', browserHelp:'Open het browsermenu en kies App installeren of Zet op beginscherm, indien beschikbaar.', failed:'De installatie kon niet worden geopend. Probeer het via het browsermenu.'},
    pl: {install:'Zainstaluj demo', installing:'Otwieranie instalacji…', home:'Dodaj do ekranu początkowego', help:'W przeglądarce otwórz Udostępnij, wybierz Dodaj do ekranu początkowego i stuknij Dodaj. Jeśli dostępne, włącz Otwórz jako aplikację internetową.', browserHelp:'Otwórz menu przeglądarki i wybierz Zainstaluj aplikację lub Dodaj do ekranu początkowego, jeśli dostępne.', failed:'Nie udało się otworzyć instalacji. Spróbuj z menu przeglądarki.'}
  };
  const text = () => copy[S.lang] || copy.en;
  const installed = () => installedHere || standalone.matches || navigator.standalone === true;

  function controls() {
    if (!supported) return '';
    const c = text();
    let html = '';
    if (!installed() && installPrompt) {
      html += `<button type="button" class="rail-settings" data-pwa-act="install" ${installing ? 'disabled' : ''}>${icon('download',18)}<span>${esc(installing ? c.installing : c.install)}</span></button>`;
    } else if (!installed()) {
      html += `<details class="pwa-install-help"><summary class="rail-settings">${icon('download',18)}<span>${esc(isIOS ? c.home : c.install)}</span></summary><p>${esc(isIOS ? c.help : c.browserHelp)}</p></details>`;
    }
    return html;
  }

  function syncControls() {
    const container = document.querySelector('[data-pwa-controls]');
    if (container) container.innerHTML = controls();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    syncControls();
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
    installPrompt = null;
    syncControls();
  });
  standalone.addEventListener?.('change', syncControls);

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-pwa-act]');
    if (!button || button.disabled) return;
    if (button.dataset.pwaAct === 'install' && installPrompt && !installing) {
      const prompt = installPrompt;
      installing = true;
      syncControls();
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        toast(text().failed, 'error');
      } finally {
        installPrompt = null;
        installing = false;
        syncControls();
      }
    }
  });
  return {controls};
})();
