/* Démo publique de l'agent IA : petit chat qui appelle POST /demo/chat.
 *
 * Réglages dans index.html, sur <div id="demo-agent"> :
 *   data-api      adresse du service démo (sans « / » final)
 *   data-sitekey  clé de SITE Turnstile (publique). Test : 1x00000000000000000000AA
 *
 * Sécurité : le texte de l'agent n'est JAMAIS inséré comme du HTML. Il est
 * découpé en nœuds DOM (textContent) : gras **...**, listes « - », liens https.
 * Une réponse manipulée ne peut donc pas exécuter de script dans la page.
 * Aucune donnée n'est gardée dans le navigateur : recharger = nouvelle conversation.
 */
(function () {
  'use strict';

  var racine = document.getElementById('demo-agent');
  if (!racine) return;

  var API = (racine.dataset.api || '').replace(/\/+$/, '');
  var SITEKEY = racine.dataset.sitekey || '';
  var LONGUEUR_MAX = 500;

  var fil = racine.querySelector('.demo-fil');
  var formulaire = racine.querySelector('.demo-saisie');
  var champ = racine.querySelector('#demo-message');
  var bouton = racine.querySelector('.demo-envoyer');
  var etat = racine.querySelector('.demo-etat');
  var zoneRobot = racine.querySelector('.demo-robot');

  var sessionId = null;      // tiré par le serveur au 1er message
  var jeton = null;          // jeton Turnstile, utile seulement pour ouvrir une conversation
  var widgetRobot = null;
  var enCours = false;

  // Messages affichés pour chaque refus du serveur (texte + symbole, jamais la couleur seule).
  var MESSAGES = {
    verification_robot: 'Vérification anti-robot à refaire. Patientez une seconde, puis renvoyez votre message.',
    limite_session: 'Cette conversation a atteint sa limite de messages. Rechargez la page pour en commencer une autre.',
    limite_ip: 'Trop de messages envoyés depuis votre connexion. Réessayez plus tard.',
    limite_jour: 'La démo a atteint sa limite du jour. Revenez demain !',
    demo_fermee: 'La démo est fermée pour le moment. Merci de votre visite !',
    message_trop_long: 'Message trop long (500 caractères au maximum).',
    message_vide: 'Écrivez un message avant d’envoyer.',
    indisponible: 'La démo est momentanément indisponible. Réessayez dans un instant.',
    reseau: 'Impossible de joindre la démo. Vérifiez votre connexion et réessayez.'
  };

  // ---------------------------------------------------------------- affichage
  function afficherEtat(texte, type) {
    etat.textContent = '';
    if (!texte) return;
    var symbole = { erreur: '✗ ', info: 'ℹ ', attente: '… ' }[type] || '';
    etat.textContent = symbole + texte;
    etat.dataset.type = type || '';
  }

  // Une ligne de texte -> nœuds : **gras** et liens https://, rien d'autre.
  function ajouterEnLigne(parent, ligne) {
    var morceaux = ligne.split(/(\*\*[^*]+\*\*|https:\/\/[^\s<>"')\]]+)/g);
    morceaux.forEach(function (m) {
      if (!m) return;
      if (/^\*\*[^*]+\*\*$/.test(m)) {
        var b = document.createElement('strong');
        b.textContent = m.slice(2, -2);
        parent.appendChild(b);
      } else if (/^https:\/\//.test(m)) {
        var lien = m.replace(/[.,;:!?]+$/, '');
        var a = document.createElement('a');
        a.href = lien;                       // https seulement : pas de javascript:
        a.textContent = lien;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        parent.appendChild(a);
        if (lien.length < m.length) parent.appendChild(document.createTextNode(m.slice(lien.length)));
      } else {
        parent.appendChild(document.createTextNode(m.replace(/\*\*/g, '')));
      }
    });
  }

  // Texte de l'agent -> paragraphes et listes à puces.
  function rendre(texte) {
    var conteneur = document.createElement('div');
    var liste = null;
    texte.split(/\r?\n/).forEach(function (ligne) {
      var puce = ligne.match(/^\s*[-*•]\s+(.*)$/);
      if (puce) {
        if (!liste) { liste = document.createElement('ul'); conteneur.appendChild(liste); }
        var li = document.createElement('li');
        ajouterEnLigne(li, puce[1]);
        liste.appendChild(li);
        return;
      }
      liste = null;
      if (!ligne.trim()) return;
      var p = document.createElement('p');
      ajouterEnLigne(p, ligne.replace(/^#+\s*/, ''));
      conteneur.appendChild(p);
    });
    return conteneur;
  }

  function ajouterBulle(texte, auteur) {
    var bulle = document.createElement('div');
    bulle.className = auteur === 'moi' ? 'bulle moi' : 'bulle';
    var qui = document.createElement('span');
    qui.className = 'sr-only';
    qui.textContent = auteur === 'moi' ? 'Vous : ' : 'Agent : ';
    bulle.appendChild(qui);
    if (auteur === 'moi') bulle.appendChild(document.createTextNode(texte));
    else bulle.appendChild(rendre(texte));
    fil.appendChild(bulle);
    fil.scrollTop = fil.scrollHeight;
    return bulle;
  }

  // Images renvoyées par le serveur (calendrier en base64, photos en https).
  // Créées par le code, jamais en HTML ; toute autre forme d'adresse est ignorée.
  function ajouterImages(bulle, images) {
    if (!Array.isArray(images)) return;
    images.slice(0, 3).forEach(function (image) {
      var src = image && typeof image.src === 'string' ? image.src : '';
      if (src.indexOf('data:image/png;base64,') !== 0 && src.indexOf('https://') !== 0) return;
      var img = document.createElement('img');
      img.src = src;
      img.alt = (image.legende && String(image.legende)) || 'Image envoyée par l’agent';
      img.loading = 'lazy';
      img.addEventListener('load', function () { fil.scrollTop = fil.scrollHeight; });
      bulle.appendChild(img);
    });
  }

  function occupe(oui) {
    enCours = oui;
    bouton.disabled = oui;
    champ.disabled = oui;
    racine.setAttribute('aria-busy', oui ? 'true' : 'false');
    if (oui) afficherEtat('L’agent réfléchit (le 1er message peut prendre une vingtaine de secondes)', 'attente');
  }

  // ---------------------------------------------------------------- anti-robot
  window.demoTurnstilePret = function () {
    if (!window.turnstile || !zoneRobot || widgetRobot !== null) return;
    widgetRobot = window.turnstile.render(zoneRobot, {
      sitekey: SITEKEY,
      language: 'fr',
      callback: function (t) { jeton = t; },
      'expired-callback': function () { jeton = null; },
      'error-callback': function () {
        jeton = null;
        afficherEtat('La vérification anti-robot n’a pas pu se charger. Rechargez la page.', 'erreur');
      }
    });
  };
  if (window.turnstile) window.demoTurnstilePret();

  function nouveauJeton() {
    jeton = null;
    if (window.turnstile && widgetRobot !== null) window.turnstile.reset(widgetRobot);
  }

  // ---------------------------------------------------------------- envoi
  function envoyer(texte, bulleMoi) {
    var corps = { message: texte };
    if (sessionId) corps.session_id = sessionId;
    else corps.turnstile = jeton;

    occupe(true);
    fetch(API + '/demo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { statut: r.status, d: d }; });
    }).then(function (res) {
      occupe(false);
      var d = res.d || {};
      if (res.statut === 200 && typeof d.reponse === 'string') {
        sessionId = d.session_id || sessionId;
        ajouterImages(ajouterBulle(d.reponse, 'agent'), d.images);
        afficherEtat(typeof d.restant === 'number'
          ? 'Messages restants dans cette conversation : ' + d.restant : '', 'info');
        champ.focus();
        return;
      }
      var code = d.erreur || 'indisponible';
      // Message NON traité : on retire la bulle et on rend le texte au champ.
      if (bulleMoi && bulleMoi.parentNode) bulleMoi.parentNode.removeChild(bulleMoi);
      if (!champ.value) champ.value = texte;
      if (code === 'verification_robot') { sessionId = null; nouveauJeton(); }
      afficherEtat(MESSAGES[code] || MESSAGES.indisponible, 'erreur');
      if (code === 'limite_session' || code === 'limite_jour' || code === 'demo_fermee') {
        champ.disabled = true; bouton.disabled = true;
      }
    }).catch(function () {
      occupe(false);
      if (bulleMoi && bulleMoi.parentNode) bulleMoi.parentNode.removeChild(bulleMoi);
      if (!champ.value) champ.value = texte;
      afficherEtat(MESSAGES.reseau, 'erreur');
    });
  }

  // Arrivée par le bouton « Tester mon agent IA » (#demo-agent) : le curseur
  // est placé dans le champ, prêt à écrire.
  function focusSiAncre() {
    if (location.hash === '#demo-agent') champ.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', focusSiAncre);
  focusSiAncre();

  champ.maxLength = LONGUEUR_MAX;
  formulaire.addEventListener('submit', function (e) {
    e.preventDefault();
    if (enCours) return;
    var texte = champ.value.trim();
    if (!texte) { afficherEtat(MESSAGES.message_vide, 'erreur'); return; }
    if (!sessionId && !jeton) {
      afficherEtat('Vérification anti-robot en cours… réessayez dans une seconde.', 'attente');
      return;
    }
    var bulleMoi = ajouterBulle(texte, 'moi');
    champ.value = '';
    envoyer(texte, bulleMoi);
  });
})();