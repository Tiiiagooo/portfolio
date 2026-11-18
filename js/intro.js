/* Intro (environ 2,5 s) : l'ordinateur apparaît, le voyant s'allume, l'écran s'allume comme un vieux cathodique,
   quelques lignes de démarrage défilent, puis on zoome dans l'écran, qui prend la couleur de la page.
   Avec « réduire les animations » (activé aussi par l'économie d'énergie sur Android), version douce :
   pas de zoom ni de flash, seulement des fondus.
   Script classique : le site s'ouvre aussi en double-cliquant sur index.html. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var intro = $('intro'), poste = $('poste'), ecran = $('ecran'), voyant = $('voyant');
  var balayage = $('balayage'), boot = $('boot'), clair = $('clair'), passer = $('passer'), rejouer = $('rejouer');
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lignes affichées au démarrage : [classe, texte]
  var LIGNES = [
    ['', '$ demarrer --profil tiago'],
    ['ok', '[ok] linguistique'],
    ['ok', '[ok] informatique'],
    ['ok', '[ok] nlp · llm · data'],
    ['moi', '> bonjour.']
  ];

  var arrete = false, timers = [], anims = [];
  function attendre(ms) { return new Promise(function (r) { timers.push(setTimeout(r, ms)); }); }
  function jouer(el, images, options) {
    var a = el.animate(images, Object.assign({ fill: 'forwards' }, options));
    anims.push(a);
    return a.finished.catch(function () {});
  }

  // Fin de l'intro : la page apparaît (classe « pret »), l'intro disparaît
  function terminer() {
    if (root.classList.contains('pret')) return;
    arrete = true;
    timers.forEach(clearTimeout);
    root.classList.add('pret');
    try { sessionStorage.setItem('intro-vue', '1'); } catch (e) {}
    var fin = function () { intro.style.display = 'none'; };
    if (intro.animate) intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(fin, fin);
    else fin();
  }

  // Zoom : on amène le centre de l'écran au centre de la fenêtre et on l'agrandit jusqu'à couvrir la fenêtre
  function zoomFinal() {
    var r = ecran.getBoundingClientRect(), p = poste.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var ox = r.left + r.width / 2 - p.left, oy = r.top + r.height / 2 - p.top;
    var dx = vw / 2 - (r.left + r.width / 2), dy = vh / 2 - (r.top + r.height / 2);
    var s = Math.max(vw / r.width, vh / r.height) * 1.06;
    poste.style.transformOrigin = ox + 'px ' + oy + 'px';
    return 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
  }

  async function demarrer() {
    // 1. L'ordinateur apparaît, éteint
    await jouer(poste, reduit ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (arrete) return;
    // 2. Le voyant s'allume
    voyant.classList.add('on');
    await attendre(140);
    if (arrete) return;
    // 3. Allumage de l'écran : un trait horizontal qui s'ouvre en hauteur, puis s'efface
    ecran.classList.add('on');
    if (reduit) await attendre(250);
    else await jouer(balayage, [
      { opacity: 1, transform: 'scale(0, .004)' },
      { opacity: 1, transform: 'scale(1, .004)', offset: .4 },
      { opacity: .85, transform: 'scale(1, 1)', offset: .75 },
      { opacity: 0, transform: 'scale(1, 1)' }
    ], { duration: 420, easing: 'ease-out' });
    if (arrete) return;
    // 4. Les lignes de démarrage
    for (var i = 0; i < LIGNES.length; i++) {
      var span = document.createElement('span');
      if (LIGNES[i][0]) span.className = LIGNES[i][0];
      span.textContent = LIGNES[i][1] + '\n';
      boot.appendChild(span);
      await attendre(i === 0 ? 180 : 110);
      if (arrete) return;
    }
    var curseur = document.createElement('span');
    curseur.className = 'curseur';
    boot.lastChild.textContent = boot.lastChild.textContent.replace('\n', ' ');
    boot.appendChild(curseur);
    await attendre(220);
    if (arrete) return;
    // 5. Mouvement réduit : pas de zoom, l'écran passe simplement à la couleur de la page
    if (reduit) {
      jouer(boot, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      await jouer(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-in' });
      if (!arrete) terminer();
      return;
    }
    // 5. Zoom dans l'écran ; il prend la couleur de la page pendant le trajet
    var transforme = zoomFinal();
    jouer(boot, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-in' });
    jouer(clair, [{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 760, easing: 'ease-in' });
    await jouer(poste, [{ transform: 'none' }, { transform: transforme }], { duration: 760, easing: 'cubic-bezier(.7,0,.2,1)' });
    if (arrete) return;
    terminer();
  }

  var dejaVue = false;
  try { dejaVue = sessionStorage.getItem('intro-vue') === '1'; } catch (e) {}

  if (dejaVue || !intro.animate || !window.Promise) {
    // Pas d'intro : intro déjà vue pendant la visite, ou navigateur trop ancien
    root.classList.add('pret');
    intro.style.display = 'none';
  } else {
    passer.addEventListener('click', function () { anims.forEach(function (a) { a.cancel(); }); terminer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') passer.click(); });
    demarrer();
  }

  rejouer.addEventListener('click', function () {
    try { sessionStorage.removeItem('intro-vue'); } catch (e) {}
    window.scrollTo(0, 0);
    location.reload();
  });
})();
