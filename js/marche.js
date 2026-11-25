// Section « Le marché data et IA en France, en chiffres » : filtres par type de poste,
// graphiques Plotly, conclusion, chiffres à retenir et rapport PDF du filtre choisi.
// Les données (window.MARCHE_DONNEES) viennent de data/marche/marche.js, chargé par une
// balise <script> : la page fonctionne aussi ouverte directement, sans serveur.
// Ce dossier est généré et publié par JobScout après chaque scan.
// Plotly (environ 1 Mo) n'est téléchargé que lorsque la section approche de l'écran.
(function () {
  var bloc = document.querySelector('.marche-graphes');
  var D = window.MARCHE_DONNEES;
  if (!bloc || !D || !D.filtres || !D.filtres.length) return; // pas encore de données : bloc masqué
  var PLOTLY = 'https://cdn.plot.ly/plotly-basic-2.35.2.min.js';
  var DOSSIER = 'data/marche/';
  var zones = {}; // figure -> élément où Plotly dessine

  function chargerPlotly() {
    if (window.Plotly) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = PLOTLY;
      s.async = true;
      s.onload = ok;
      s.onerror = ko;
      document.head.appendChild(s);
    });
  }

  function dateFr(iso, options) {
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', options);
  }

  // Copie adaptée à la largeur de la colonne (les figures d'origine ne sont jamais modifiées)
  function adapter(fig, largeur) {
    var f = JSON.parse(JSON.stringify(fig));
    f.layout.autosize = true;
    delete f.layout.width;
    if (largeur < 600) { // colonne étroite ou téléphone : texte plus petit, étiquettes à plat
      f.layout.font = Object.assign({}, f.layout.font, { size: 11 });
      if (f.data[0].type !== 'pie') f.layout.xaxis = Object.assign({}, f.layout.xaxis, { tickangle: 0, automargin: true });
      f.layout.margin = { l: 4, r: 8, t: 64, b: 30 };
      if (f.layout.height && f.layout.height < 480) f.layout.height = 480; // colonnes de même hauteur
      if (f.layout.legend) f.layout.legend = Object.assign({}, f.layout.legend, { y: -0.22, font: { size: 10 } });
      f.data.forEach(function (t) { if (t.orientation !== 'h') t.textfont = { size: 9 }; });
    }
    return f;
  }

  function requeteSql(el) {
    var details = document.createElement('details');
    details.className = 'marche-sql';
    var resume = document.createElement('summary');
    resume.textContent = 'Voir la requête SQL';
    var pre = document.createElement('pre');
    details.appendChild(resume);
    details.appendChild(pre);
    el.appendChild(details);
    return pre;
  }

  function texteSql(nom, filtre) {
    if (!D.requetes) return '';
    // Le troisième graphique change selon les données : évolution, répartition ou outils propres au poste
    if (nom === 'troisieme') return D.requetes[filtre.troisieme] || '';
    return D.requetes[nom] || '';
  }

  function afficherFiltre(filtre) {
    var c = filtre.chiffres;
    Array.prototype.forEach.call(bloc.querySelectorAll('.marche-filtres button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filtre') === filtre.id ? 'true' : 'false');
    });
    bloc.querySelector('.marche-chiffres').textContent =
      filtre.label + ' : ' + c.offres.toLocaleString('fr-FR') + ' offres, publiées entre ' +
      dateFr(c.premiere, { month: 'long', year: 'numeric' }) + ' et ' +
      dateFr(c.derniere, { month: 'long', year: 'numeric' }) + ' sur ' + c.sources +
      ' sites. Chiffres mis à jour le ' + dateFr(D.genere_le) + '.';

    var pdf = bloc.querySelector('.marche-pdf');
    pdf.href = DOSSIER + filtre.pdf;
    pdf.setAttribute('download', 'marche-data-ia-' + filtre.id + '.pdf');
    pdf.textContent = 'Télécharger le rapport complet « ' + filtre.court + ' » (PDF)';

    // Conclusion écrite à la main : textContent, jamais interprétée comme du HTML
    var conclusion = bloc.querySelector('.marche-conclusion');
    conclusion.textContent = '';
    if (filtre.conclusion) {
      filtre.conclusion.split(/\n\s*\n/).forEach(function (para) {
        var p = document.createElement('p');
        p.textContent = para.replace(/\s*\n\s*/g, ' ');
        conclusion.appendChild(p);
      });
    } else {
      var vide = document.createElement('p');
      vide.className = 'marche-vide';
      vide.textContent = 'Conclusion à venir.';
      conclusion.appendChild(vide);
    }
    var faits = bloc.querySelector('.marche-faits');
    faits.textContent = '';
    filtre.faits.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      faits.appendChild(li);
    });

    Object.keys(zones).forEach(function (nom) {
      var z = zones[nom];
      var fig = filtre.figures[nom];
      z.figure.hidden = !fig;
      if (!fig) return;
      var f = adapter(fig, z.figure.clientWidth);
      window.Plotly.react(z.zone, f.data, f.layout, { displayModeBar: false, responsive: true });
      z.sql.textContent = texteSql(nom, filtre).trim();
    });
  }

  function construire() {
    var seuil = bloc.querySelector('.marche-seuil');
    if (seuil && D.seuil_publication) seuil.textContent = D.seuil_publication;

    var barre = bloc.querySelector('.marche-filtres');
    D.filtres.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-filtre', f.id);
      b.setAttribute('aria-pressed', 'false');
      b.textContent = f.court + ' (' + f.chiffres.offres.toLocaleString('fr-FR') + ')';
      b.addEventListener('click', function () { afficherFiltre(f); });
      barre.appendChild(b);
    });

    bloc.hidden = false; // avant de dessiner : Plotly a besoin de la largeur réelle
    Array.prototype.forEach.call(bloc.querySelectorAll('[data-figure]'), function (el) {
      // Plotly mesure la largeur avec le padding : on dessine dans un enfant sans padding
      var zone = document.createElement('div');
      el.appendChild(zone);
      zones[el.getAttribute('data-figure')] = { figure: el, zone: zone, sql: requeteSql(el) };
    });
    afficherFiltre(D.filtres[0]);
  }

  function demarrer() {
    chargerPlotly().then(construire).catch(function () { bloc.hidden = true; }); // Plotly injoignable
  }

  if (!('IntersectionObserver' in window)) { demarrer(); return; }
  var obs = new IntersectionObserver(function (entrees) {
    if (entrees.some(function (e) { return e.isIntersecting; })) { obs.disconnect(); demarrer(); }
  }, { rootMargin: '600px 0px' });
  obs.observe(bloc.closest('section') || bloc);
})();
