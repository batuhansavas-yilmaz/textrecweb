(function () {
  'use strict';

  var gate = document.getElementById('orientationGate');
  if (!gate) return;

  var landscape = window.matchMedia('(orientation: landscape)');
  var coarse = window.matchMedia('(pointer: coarse)');
  var noHover = window.matchMedia('(hover: none)');
  var mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var appNodes = [];
  Array.prototype.forEach.call(document.body.children, function (el) {
    if (el === gate) return;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META') return;
    appNodes.push(el);
  });

  var locked = false;
  var lastFocus = null;

  function isMobile() {
    return mobileUA || coarse.matches ||
      (navigator.maxTouchPoints > 0 && noHover.matches);
  }

  function setLocked(next) {
    if (next === locked) return;
    locked = next;

    document.documentElement.classList.toggle('orientation-locked', locked);
    document.body.classList.toggle('orientation-locked', locked);
    appNodes.forEach(function (el) {
      if ('inert' in el) el.inert = locked;
    });

    if (locked) {
      Array.prototype.forEach.call(document.querySelectorAll('dialog[open]'), function (dialog) {
        try { dialog.close(); } catch (err) {}
      });
      window.scrollTo(0, 0);
      if (!lastFocus) lastFocus = document.activeElement;
      gate.removeAttribute('aria-hidden');
      try { gate.focus({ preventScroll: true }); } catch (err) { gate.focus(); }
    } else {
      gate.setAttribute('aria-hidden', 'true');
      if (lastFocus && document.contains(lastFocus)) {
        try { lastFocus.focus({ preventScroll: true }); } catch (err) {}
      }
      lastFocus = null;
    }
  }

  function update() {
    setLocked(isMobile() && landscape.matches);
  }

  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
  window.addEventListener('pageshow', update);

  if (landscape.addEventListener) landscape.addEventListener('change', update);
  else if (landscape.addListener) landscape.addListener(update);

  if (coarse.addEventListener) coarse.addEventListener('change', update);
  else if (coarse.addListener) coarse.addListener(update);

  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', update);
  }

  update();
})();
