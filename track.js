/* Visitor counts with GoatCounter: no cookies, no cross-site tracking.
   To turn it on, set GC_SITE to your GoatCounter site code (the "xyz" in xyz.goatcounter.com). */
(function () {
  var GC_SITE = '';
  // track('name-check') etc. records an event; it does nothing until GoatCounter is on and loaded.
  window.track = function (name) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'event/' + name, title: name, event: true }); } catch (e) {}
  };
  if (!GC_SITE || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;   // never count local testing
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + GC_SITE + '.goatcounter.com/count');
  document.head.appendChild(s);
})();
