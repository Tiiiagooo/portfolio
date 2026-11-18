/* Parcours raconté : chaque étape s'anime quand elle arrive à l'écran (les sections .apparait, elles, apparaissent en fondu).
   Le titre est découpé en mots (chaque mot monte, avec un petit décalage), puis la date et le texte apparaissent en fondu.
   Sans ce script, tout est simplement visible. */
(function () {
  "use strict";
  // Les étapes du parcours, et les sections qui apparaissent en fondu
  var etapes = document.querySelectorAll('.etape, .apparait');
  if (!etapes.length) return;

  // Découpe chaque titre en mots : <span class="w"><span style="--i:n">mot</span></span>
  Array.prototype.forEach.call(document.querySelectorAll('.etape h3'), function (h) {
    var mots = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    h.classList.add('split');
    mots.forEach(function (mot, i) {
      var w = document.createElement('span'), s = document.createElement('span');
      w.className = 'w';
      s.textContent = mot;
      s.style.setProperty('--i', i);
      w.appendChild(s);
      h.appendChild(w);
      if (i < mots.length - 1) h.appendChild(document.createTextNode(' '));
    });
  });

  // Navigateur sans IntersectionObserver : on ne cache rien
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('anime');

  var obs = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('vu'); obs.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -18% 0px', threshold: 0.2 });   // l'étape s'anime un peu avant le milieu de l'écran
  Array.prototype.forEach.call(etapes, function (el) { obs.observe(el); });

  // Ligne de la frise : elle se remplit jusqu'au milieu de l'écran, et chaque point s'allume quand elle l'atteint
  var liste = document.querySelector('.etapes'), ligne = document.querySelector('.remplissage');
  if (!liste || !ligne) return;
  var points = liste.querySelectorAll('.etape'), attente = 0;
  function majLigne() {
    attente = 0;
    var r = liste.getBoundingClientRect(), repere = window.innerHeight * 0.6;
    var p = Math.min(1, Math.max(0, (repere - r.top) / r.height));
    ligne.style.setProperty('--progression', p.toFixed(4));
    var bas = r.top + p * r.height;
    Array.prototype.forEach.call(points, function (el) {
      el.classList.toggle('atteint', el.getBoundingClientRect().top + 14 <= bas);
    });
  }
  function demander() { if (!attente) attente = requestAnimationFrame(majLigne); }
  window.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  majLigne();
})();
