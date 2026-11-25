/* Mesure d'audience du portfolio : compteurs globaux et anonymes.
 *
 * Ce script envoie seulement un NOM d'événement pris dans une liste fermée
 * (ex. « pdf:data-scientist ») au compteur (Worker Cloudflare). Il n'envoie
 * ni l'URL, ni le référent, ni aucun identifiant. Il ne lit ni n'écrit rien
 * dans le navigateur (pas de cookie, ni localStorage, ni sessionStorage).
 *
 * Réglage dans index.html : <script src="js/mesure.js" data-url="https://…workers.dev" defer>
 *
 * Inactif :
 *   - hors de https://tiiiagooo.github.io (ouverture en file://, tests locaux) ;
 *   - si le navigateur envoie un signal de refus (Do Not Track ou Global Privacy Control).
 *
 * Les autres scripts peuvent compter un événement avec window.mesure('nom'),
 * toujours appelé sous la forme « if (window.mesure) window.mesure('…') ».
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var URL_COMPTEUR = (script && script.dataset.url ? script.dataset.url : '').replace(/\/+$/, '') + '/e';
  var SITE = 'tiiiagooo.github.io';

  var refus = navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
    navigator.globalPrivacyControl === true;
  var actif = location.protocol === 'https:' && location.hostname === SITE &&
    URL_COMPTEUR.indexOf('https://') === 0 && !refus;

  var deja = {};   // événements « une fois par chargement », en mémoire seulement

  function envoyer(nom) {
    if (!actif || typeof nom !== 'string' || !/^[a-z]+:[a-z0-9-]{1,40}$/.test(nom)) return;
    try {
      // text/plain : pas de requête préalable CORS. sendBeacon ne bloque pas la page.
      var corps = new Blob([nom], { type: 'text/plain' });
      if (navigator.sendBeacon && navigator.sendBeacon(URL_COMPTEUR, corps)) return;
      fetch(URL_COMPTEUR, { method: 'POST', body: nom, mode: 'no-cors', keepalive: true, credentials: 'omit' })
        .catch(function () {});
    } catch (e) { /* la mesure ne doit jamais casser le site */ }
  }

  function uneFois(nom) {
    if (deja[nom]) return;
    deja[nom] = true;
    envoyer(nom);
  }

  window.mesure = envoyer;
  if (!actif) return;

  // ------------------------------------------------------------ provenance
  // Seul le domaine du référent sert à choisir une catégorie ; il n'est pas envoyé.
  function categorie() {
    var hote = '';
    try { hote = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { hote = ''; }
    if (!hote) return 'direct';
    if (hote === SITE) return null;   // navigation interne : déjà comptée
    if (/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/.test(hote)) return 'linkedin';
    if (/(^|\.)github\.com$/.test(hote)) return 'github';
    if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|qwant\.com|ecosia\.org|yahoo\.com|yandex\.[a-z]+|startpage\.com|brave\.com)$/.test(hote)) return 'recherche';
    return 'autre';
  }
  var source = categorie();
  if (source) envoyer('visite:' + source);

  // ------------------------------------------------------------ arrivée sur une ancre (liens des CV)
  var ARRIVEES = { '#data': 'data', '#marche': 'data', '#agent': 'agent', '#demo-agent': 'agent' };
  if (location.hash) envoyer('arrivee:' + (ARRIVEES[location.hash] || 'autre'));

  // ------------------------------------------------------------ sections vues (une fois par chargement)
  var SECTIONS = {
    parcours: 'parcours', projets: 'projets', agent: 'agent', marche: 'data',
    kriolu: 'kriolu', memoire: 'memoire', paroles: 'paroles', autres: 'autres', contact: 'contact'
  };
  if ('IntersectionObserver' in window) {
    var surveiller = function (options, ids) {
      var obs = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (!e.isIntersecting) return;
          uneFois('vue:' + SECTIONS[e.target.id]);
          obs.unobserve(e.target);
        });
      }, options);
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) obs.observe(el);
      });
    };
    // Vue = la section traverse la bande centrale de l'écran (marche quelle que soit sa hauteur)…
    surveiller({ rootMargin: '-35% 0px -35% 0px', threshold: 0 },
      Object.keys(SECTIONS).filter(function (id) { return id !== 'contact'; }));
    // … sauf le pied de page, qui peut ne jamais atteindre le milieu : moitié visible.
    surveiller({ threshold: 0.5 }, ['contact']);
  }

  // ------------------------------------------------------------ clics (écoute globale : aucun autre script modifié)
  var PROJETS = {
    'github.com/tiiiagooo/agent-ia-publique': 'agent',
    'github.com/tiiiagooo/memoire': 'memoire',
    'github.com/tiiiagooo/music_lyrics_generation': 'paroles',
    'github.com/latenightsbeats1208-pixel/jobscout': 'jobscout'
  };
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.classList.contains('marche-pdf')) {
      // Le nom du fichier téléchargé est « marche-data-ia-<filtre>.pdf » (js/marche.js).
      var m = (a.getAttribute('download') || '').match(/^marche-data-ia-([a-z0-9-]{1,40})\.pdf$/);
      if (m) envoyer('pdf:' + m[1]);
      return;
    }
    if (/CV_[^/]*\.pdf$/i.test(href)) { envoyer('cv:telechargement'); return; }
    if (href.indexOf('mailto:') === 0) { envoyer('clic:email'); return; }
    if (/linkedin\.com\/in\//i.test(href)) { envoyer('clic:linkedin'); return; }
    var propre = href.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (PROJETS[propre]) { envoyer('projet:' + PROJETS[propre]); return; }
    if (propre === 'github.com/tiiiagooo') envoyer('clic:github');
  }, true);

  // ------------------------------------------------------------ démo : premier clic dans le champ
  document.addEventListener('focusin', function (ev) {
    if (ev.target && ev.target.id === 'demo-message') uneFois('demo:ouverture');
  });

  // ------------------------------------------------------------ erreurs JavaScript (une fois par chargement)
  window.addEventListener('error', function () { uneFois('erreur:js'); });
})();
