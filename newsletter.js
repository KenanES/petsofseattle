/* Newsletter sign-up: 4 emails a year, sent through Buttondown.
   Set BUTTONDOWN_USER to your Buttondown username to turn sign-ups on. */
(function () {
  var BUTTONDOWN_USER = 'petsofseattle';
  var forms = document.querySelectorAll('[data-news-form]');
  forms.forEach(function (form) {
    var msg = form.querySelector('.news-msg'), input = form.querySelector('input[type=email]'), btn = form.querySelector('button');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'That email doesn’t look quite right.'; input.focus(); return; }
      if (!BUTTONDOWN_USER) { msg.textContent = 'Sign-ups open very soon. Check back shortly!'; return; }
      btn.disabled = true; msg.textContent = 'Signing you up…';
      var body = new FormData();
      body.append('email', email);
      body.append('tag', 'site-' + (form.dataset.source || 'home'));
      fetch('https://buttondown.com/api/emails/embed-subscribe/' + encodeURIComponent(BUTTONDOWN_USER), { method: 'POST', body: body, mode: 'no-cors' })
        .then(function () {
          form.classList.add('done');
          msg.innerHTML = '<b>Almost done!</b> Check your inbox and tap the confirm link. See you next quarter.';
          if (window.track) window.track('newsletter-signup');
        })
        .catch(function () { msg.textContent = 'Something went wrong. Please try again in a minute.'; })
        .finally(function () { btn.disabled = false; });
    });
  });
})();
