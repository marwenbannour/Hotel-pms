/**
 * Lanceur de l'application Android. Au premier démarrage, demande l'adresse du serveur de l'hôtel,
 * vérifie qu'il s'agit bien de l'application (manifeste), l'enregistre puis l'ouvre en plein écran.
 * Ensuite, l'application s'ouvre directement sur ce serveur. L'application web renvoie ici
 * (https://localhost/?change=1) pour changer de serveur.
 */
(function () {
  'use strict';

  var KEY = 'serverUrl';
  var TIMEOUT_MS = 8000;

  var TEXT = {
    fr: {
      checking: 'Connexion au serveur…',
      title: 'Serveur de l’hôtel',
      intro: 'Saisissez l’adresse de l’application de gestion de votre hôtel. Elle vous est fournie par la direction ou le service informatique.',
      label: 'Adresse du serveur',
      hint: 'Exemple : https://pms.mon-hotel.com ou 192.168.1.10:3001',
      connect: 'Se connecter',
      connecting: 'Vérification…',
      invalid: 'Cette adresse n’est pas valide.',
      unreachable: 'Serveur injoignable. Vérifiez l’adresse et la connexion (Wi-Fi ou données mobiles), puis réessayez.',
      notPms: 'Ce serveur répond, mais ce n’est pas l’application de gestion de l’hôtel.',
    },
    en: {
      checking: 'Connecting to the server…',
      title: 'Hotel server',
      intro: 'Enter the address of your hotel’s management application. Your manager or IT department can give it to you.',
      label: 'Server address',
      hint: 'Example: https://pms.my-hotel.com or 192.168.1.10:3001',
      connect: 'Connect',
      connecting: 'Checking…',
      invalid: 'This address is not valid.',
      unreachable: 'Server unreachable. Check the address and your connection (Wi-Fi or mobile data), then try again.',
      notPms: 'This server answers, but it is not the hotel management application.',
    },
    ar: {
      checking: 'جارٍ الاتصال بالخادم…',
      title: 'خادم الفندق',
      intro: 'أدخل عنوان تطبيق إدارة فندقك. تزوّدك به الإدارة أو قسم المعلوماتية.',
      label: 'عنوان الخادم',
      hint: 'مثال: https://pms.my-hotel.com أو 192.168.1.10:3001',
      connect: 'اتصال',
      connecting: 'جارٍ التحقق…',
      invalid: 'هذا العنوان غير صالح.',
      unreachable: 'تعذّر الوصول إلى الخادم. تحقق من العنوان ومن الاتصال (Wi-Fi أو بيانات الجوال) ثم أعد المحاولة.',
      notPms: 'هذا الخادم يستجيب، لكنه ليس تطبيق إدارة الفندق.',
    },
  };

  var nav = (navigator.language || 'fr').toLowerCase();
  var lang = nav.indexOf('ar') === 0 ? 'ar' : nav.indexOf('en') === 0 ? 'en' : 'fr';
  var t = TEXT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (el) {
    el.textContent = t[el.getAttribute('data-t')];
  });

  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), input = $('url'), error = $('error'), submit = $('submit');

  function storage(fn) {
    try { return fn(window.localStorage); } catch (e) { return null; }
  }

  /**
   * « 192.168.1.10:3001 » → http://192.168.1.10:3001 ; « pms.hotel.com » → https://pms.hotel.com.
   * Seule l'origine est gardée : l'application s'ouvre toujours à la racine.
   */
  function normalize(raw) {
    var value = (raw || '').trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) {
      var host = value.split('/')[0];
      var local = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(host) || /\.local(:\d+)?$/i.test(host);
      value = (local ? 'http://' : 'https://') + value;
    }
    try {
      var url = new URL(value);
      return url.hostname ? url.origin : null;
    } catch (e) {
      return null;
    }
  }

  /** Requête native (sans CORS) quand le pont Capacitor est là ; sinon fetch (essai dans un navigateur). */
  function getManifest(origin) {
    var http = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
    var url = origin + '/manifest.webmanifest';
    if (http) {
      return http
        .get({ url: url, connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS, responseType: 'json' })
        .then(function (res) {
          var data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          return { status: res.status, data: data };
        });
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .finally(function () { clearTimeout(timer); });
  }

  /** 'ok', 'unreachable' ou 'notPms'. */
  function check(origin) {
    return getManifest(origin).then(
      function (res) {
        var m = res.data || {};
        return res.status === 200 && m.start_url === '/' && m.display === 'standalone' ? 'ok' : 'notPms';
      },
      function (err) {
        // Réponse reçue mais illisible (page HTML, autre service) : ce n'est pas l'application.
        return err instanceof SyntaxError ? 'notPms' : 'unreachable';
      },
    );
  }

  function open(origin) {
    window.location.replace(origin + '/');
  }

  function showSetup(prefill, message) {
    $('checking').hidden = true;
    $('setup').hidden = false;
    if (prefill) input.value = prefill;
    if (message) {
      error.textContent = message;
      error.hidden = false;
    }
    input.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.hidden = true;
    var origin = normalize(input.value);
    if (!origin) {
      showSetup(null, t.invalid);
      return;
    }
    submit.disabled = true;
    submit.textContent = t.connecting;
    check(origin).then(function (result) {
      submit.disabled = false;
      submit.textContent = t.connect;
      if (result === 'ok') {
        storage(function (s) { s.setItem(KEY, origin); });
        open(origin);
      } else {
        showSetup(null, t[result]);
      }
    });
  });

  var saved = storage(function (s) { return s.getItem(KEY); });
  var change = /[?&]change=1\b/.test(window.location.search);
  if (saved && !change) {
    check(saved).then(function (result) {
      if (result === 'ok') open(saved);
      else showSetup(saved, t[result]);
    });
  } else {
    showSetup(saved, null);
  }
})();
