/* Sélecteur de style : « sombre » (par défaut), « clair » ou « editorial ».
   Le choix est gardé dans le navigateur du visiteur (localStorage) ; le style est posé dans <head> avant l'affichage, pour éviter un flash. */
(function () {
  "use strict";
  var root = document.documentElement;
  var boutons = document.querySelectorAll('[data-theme-choix]');
  function marquer(t) {
    Array.prototype.forEach.call(boutons, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-choix') === t ? 'true' : 'false'); });
  }
  Array.prototype.forEach.call(boutons, function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-theme-choix');
      root.setAttribute('data-theme', t);
      try { localStorage.setItem('theme', t); } catch (e) {}
      marquer(t);
    });
  });
  marquer(root.getAttribute('data-theme') || 'sombre');
})();
