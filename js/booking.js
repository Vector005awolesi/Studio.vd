/* Studio.VD — booking flow (request-based, persisted locally) */
(function () {
  'use strict';

  var app = document.getElementById('booking-app');
  if (!app) return;

  var form = document.getElementById('booking-form');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.b-step'));
  var stepInds = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var btnBack = document.getElementById('b-back');
  var btnNext = document.getElementById('b-next');
  var btnSubmit = document.getElementById('b-submit');
  var success = document.getElementById('b-success');
  var dateInput = document.getElementById('b-date');
  var current = 1;
  var TOTAL = 4;
  var STORE_KEY = 'vd-booking-requests';

  /* ---------- Init ---------- */
  // Min date = today
  var today = new Date();
  var iso = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  dateInput.min = iso;

  // Preselect service from a services-row / nav click (session handoff)
  try {
    var prefill = sessionStorage.getItem('vd-prefill-service');
    if (prefill) {
      var radio = form.querySelector('input[name="service"][value="' + prefill.replace(/"/g, '\\"') + '"]');
      if (radio) {
        radio.checked = true;
        sessionStorage.removeItem('vd-prefill-service');
      }
    }
  } catch (e) { /* ignore */ }

  function val(name) {
    var el = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }

  function showError(name, show, msg) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    if (!el) return;
    if (show && msg) el.textContent = msg;
    el.hidden = !show;
    var field = el.closest('.field');
    if (field) field.classList.toggle('has-error', show);
  }

  /* ---------- Validation per step ---------- */
  function validate(step) {
    var ok = true;
    var focusTarget = null;

    if (step === 1) {
      var service = form.querySelector('input[name="service"]:checked');
      if (!service) { ok = false; focusTarget = form.querySelector('input[name="service"]'); }
      showError('service', !ok);
    }

    if (step === 2) {
      var d = dateInput.value;
      var good = !!d && d >= iso;
      showError('date', !good, good ? '' : (d ? 'That date has passed — please choose today or later.' : ''));
      if (!good) { ok = false; focusTarget = focusTarget || dateInput; }
      var t = form.querySelector('input[name="time"]:checked');
      showError('time', !t);
      if (!t) { ok = false; focusTarget = focusTarget || form.querySelector('input[name="time"]'); }
    }

    if (step === 3) {
      var name = val('name');
      var nameOk = name.length >= 2;
      showError('name', !nameOk);
      if (!nameOk) { ok = false; focusTarget = focusTarget || document.getElementById('b-name'); }

      var phone = val('phone').replace(/[\s\-()+.]/g, '');
      var phoneOk = /^\+?\d{7,15}$/.test(phone);
      showError('phone', !phoneOk);
      if (!phoneOk) { ok = false; focusTarget = focusTarget || document.getElementById('b-phone'); }

      var email = val('email');
      var emailOk = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      showError('email', !emailOk);
      if (!emailOk) { ok = false; focusTarget = focusTarget || document.getElementById('b-email'); }
    }

    if (focusTarget) focusTarget.focus();
    return ok;
  }

  /* ---------- Step rendering ---------- */
  function goTo(n) {
    current = Math.min(Math.max(n, 1), TOTAL);
    steps.forEach(function (s) {
      s.hidden = Number(s.getAttribute('data-step')) !== current;
    });
    stepInds.forEach(function (ind) {
      var n2 = Number(ind.getAttribute('data-step-ind'));
      ind.classList.toggle('is-current', n2 === current);
      ind.classList.toggle('is-done', n2 < current);
    });
    btnBack.hidden = current === 1;
    btnNext.hidden = current === TOTAL;
    btnSubmit.hidden = current !== TOTAL;
    if (current === TOTAL) buildSummary();
  }

  function prettyDate(v) {
    if (!v) return '';
    var p = v.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fmtTime(t) {
    if (!t) return '';
    var h = parseInt(t.split(':')[0], 10);
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + t.split(':')[1] + ' ' + suffix;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildSummary() {
    var dl = document.getElementById('review-summary');
    var rows = [
      ['Service', val('service')],
      ['Date', prettyDate(val('date'))],
      ['Time', fmtTime(val('time'))],
      ['Name', val('name')],
      ['Phone', val('phone')]
    ];
    var email = val('email');
    if (email) rows.push(['Email', email]);
    var notes = val('notes');
    if (notes) rows.push(['Details', notes]);
    dl.innerHTML = rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');
  }

  function makeRef() {
    return 'VD-' + Date.now().toString(36).toUpperCase().slice(-5);
  }

  /* ---------- Persistence ---------- */
  function persist(record) {
    try {
      var all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      all.push(record);
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* storage unavailable — request still works via WhatsApp */ }
  }

  function whatsappLink(ref) {
    var text =
      'Hello Studio.VD! I would like to book a shoot.\n\n' +
      'Reference: ' + ref + '\n' +
      'Service: ' + val('service') + '\n' +
      'Date: ' + prettyDate(val('date')) + '\n' +
      'Time: ' + fmtTime(val('time')) + '\n' +
      'Name: ' + val('name') + '\n' +
      'Phone: ' + val('phone');
    var email = val('email');
    if (email) text += '\nEmail: ' + email;
    var notes = val('notes');
    if (notes) text += '\nDetails: ' + notes;
    return 'https://wa.me/2347079765065?text=' + encodeURIComponent(text);
  }

  /* ---------- Events ---------- */
  btnNext.addEventListener('click', function () {
    if (validate(current)) goTo(current + 1);
  });

  btnBack.addEventListener('click', function () { goTo(current - 1); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(3)) { goTo(3); return; }

    var ref = makeRef();
    var record = {
      ref: ref,
      created: new Date().toISOString(),
      status: 'request', // request-based — the studio confirms, nothing auto-booked
      service: val('service'),
      date: val('date'),
      time: val('time'),
      name: val('name'),
      phone: val('phone'),
      email: val('email'),
      notes: val('notes')
    };
    persist(record);

    document.getElementById('b-ref').textContent = ref;
    document.getElementById('b-confirm-phone').textContent = record.phone;
    document.getElementById('b-whatsapp').href = whatsappLink(ref);
    form.hidden = true;
    document.querySelector('.steps').style.visibility = 'hidden';
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('b-again').addEventListener('click', function () {
    form.reset();
    form.querySelectorAll('.field-error').forEach(function (el) { el.hidden = true; });
    form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
    success.hidden = true;
    document.querySelector('.steps').style.visibility = '';
    form.hidden = false;
    goTo(1);
  });

  // Live-clear errors as the user fixes them
  form.addEventListener('input', function (e) {
    var name = e.target.name;
    if (name) showError(name, false);
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') showError('service', false);
    if (e.target.name === 'time') showError('time', false);
  });

  goTo(1);
})();
