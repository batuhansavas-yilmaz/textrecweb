(function () {
  'use strict';

  var STR = window.TEXTREC_STR;
  var QS = new URLSearchParams(location.search);
  var DBG = QS.get('debug') === '1';
  var SMALL = QS.get('small') === '1';
  var NO_SW = QS.get('nosw') === '1';

  var dbgEl = null;
  function dbgText(text) {
    if (!DBG) return;
    if (!dbgEl) {
      dbgEl = document.createElement('pre');
      dbgEl.id = 'dbgPanel';
      dbgEl.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;z-index:99999;background:rgba(0,0,0,.85);color:#4f4;font:11px/1.35 monospace;padding:8px;border-radius:8px;white-space:pre-wrap;word-break:break-word;margin:0;pointer-events:none;';
      document.body.appendChild(dbgEl);
    }
    dbgEl.textContent += text + '\n';
    dbgEl.scrollTop = dbgEl.scrollHeight;
  }
  function dbgLog(text) {
    if (!DBG) return;
    var line = new Date().toISOString().slice(11, 19) + ' ' + text;
    dbgText(line);
    try {
      var prev = sessionStorage.getItem('textrec-dbg') || '';
      sessionStorage.setItem('textrec-dbg', (prev + '\n' + line).slice(-6000));
    } catch (e) {}
  }
  if (DBG) {
    try {
      var prevLog = sessionStorage.getItem('textrec-dbg') || '';
      if (prevLog.trim()) dbgText('--- onceki oturum ---\n' + prevLog.trim().split('\n').slice(-40).join('\n'));
    } catch (e) {}
    dbgLog('UA: ' + navigator.userAgent);
    dbgLog('gpu: ' + (!!navigator.gpu) + ' | cores: ' + (navigator.hardwareConcurrency || '?') + ' | sw: ' + ('serviceWorker' in navigator) + ' | small=' + SMALL + ' nosw=' + NO_SW);
    window.addEventListener('error', function (e) { dbgLog('page error: ' + (e.message || e.type)); });
    window.addEventListener('unhandledrejection', function (e) { dbgLog('promise error: ' + ((e.reason && e.reason.message) || e.reason)); });
  }


  var OCR_DET_NAME = SMALL ? 'PP-OCRv6_tiny_det' : 'PP-OCRv6_medium_det';
  var OCR_DET_FILE = SMALL ? 'PP-OCRv6_tiny_det_onnx_infer.tar' : 'PP-OCRv6_medium_det_onnx_infer.tar';
  var OCR_REC_NAME = SMALL ? 'PP-OCRv6_small_rec' : 'PP-OCRv6_medium_rec';
  var OCR_REC_FILE = SMALL ? 'PP-OCRv6_small_rec_onnx_infer.tar' : 'PP-OCRv6_medium_rec_onnx_infer.tar';
  var OCR_ORI_FILE = 'PP-LCNet_x1_0_doc_ori.onnx';
  var OCR_WORKER_URL = 'vendor/paddleocr/textrec-ocr-worker.js?v=5';

  function detectLang() {
    var l = (navigator.language || 'en').toLowerCase();
    if (l.slice(0, 2) === 'tr') return 'tr';
    if (l.slice(0, 2) === 'ru') return 'ru';
    return 'en';
  }

  var lang = detectLang();

  function t(key) {
    var s = STR[lang] && STR[lang][key];
    if (s == null) s = STR.en[key];
    return s == null ? '' : s;
  }

  var $ = function (id) { return document.getElementById(id); };

  var appbarTitle = $('appbarTitle');
  var backBtn = $('backBtn');
  var homeView = $('homeView');
  var resultView = $('resultView');
  var cameraBtn = $('cameraBtn');
  var photosBtn = $('photosBtn');
  var fileInput = $('fileInput');
  var cameraInput = $('cameraInput');
  var toasts = $('toasts');
  var cropDialog = $('cropDialog');
  var cropYes = $('cropYes');
  var cropNo = $('cropNo');
  var cropScreen = $('cropScreen');
  var cropImage = $('cropImage');
  var cropCancel = $('cropCancel');
  var cropConfirm = $('cropConfirm');
  var cropRotate = $('cropRotate');
  var loadingDialog = $('loadingDialog');
  var warnDialog = $('warnDialog');
  var warnOk = $('warnOk');
  var resultText = $('resultText');
  var fabs = $('fabs');
  var fabMain = $('fabMain');
  var fabIconToolbox = $('fabIconToolbox');
  var fabIconClose = $('fabIconClose');
  var fabZoomIn = $('fabZoomIn');
  var fabZoomOut = $('fabZoomOut');
  var fabCopy = $('fabCopy');
  var fabDownload = $('fabDownload');
  var docTypeDialog = $('docTypeDialog');
  var docWord = $('docWord');
  var docPdf = $('docPdf');
  var docText = $('docText');
  var nameDialog = $('nameDialog');
  var nameInput = $('nameInput');
  var nameError = $('nameError');
  var nameSave = $('nameSave');
  var successDialog = $('successDialog');
  var succFileName = $('succFileName');
  var succOpen = $('succOpen');
  var succShare = $('succShare');
  var succClose = $('succClose');

  var imageFile = null;
  var imageUrl = null;
  var worker = null;
  var ocrSeq = 0;
  var busy = false;
  var cropper = null;
  var cropRotateDeg = 0;
  var cropRotateSeq = 0;
  var cropBaseImage = null;
  var cropBakedUrl = null;
  var resultSize = 17;
  var pendingType = null;
  var lastFile = null;
  var lastFileUrl = null;

  function toast(msg, ms) {
    var prev = Array.prototype.find.call(toasts.children, function (el) {
      return el.textContent === msg;
    });
    if (prev) prev.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toasts.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
    }, ms || 2400);
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    appbarTitle.textContent = resultView.hidden ? t('appbarTitle') : t('resultTitle');
  }

  function setImage(file) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageFile = file;
    imageUrl = URL.createObjectURL(file);
  }

  function clearImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    imageFile = null;
  }

  var PAGE_MS = 360;
  var PAGE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

  function motionReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pageSlide(el, from, to, done) {
    if (el._pageT) clearTimeout(el._pageT);
    if (motionReduced()) {
      el.style.transition = '';
      el.style.transform = '';
      if (done) done();
      return;
    }
    el.style.transition = 'none';
    el.style.transform = from;
    void el.offsetWidth;
    el.style.transition = 'transform ' + PAGE_MS + 'ms ' + PAGE_EASE;
    el.style.transform = to;
    el._pageT = setTimeout(function () {
      el._pageT = null;
      el.style.transition = '';
      el.style.transform = '';
      if (done) done();
    }, PAGE_MS + 20);
  }

  var DIALOG_MS = 250;

  function restartSpinner() {
    var wrap = loadingDialog.querySelector('.sk-fading-circle');
    if (!wrap) return;
    wrap.classList.add('reset');
    void wrap.offsetWidth;
    requestAnimationFrame(function () { wrap.classList.remove('reset'); });
  }

  function dialogOpen(el) {
    if (el._dlgT) { clearTimeout(el._dlgT); el._dlgT = null; }
    el.classList.remove('closing');
    el.hidden = false;
    if (el === loadingDialog) restartSpinner();
    if (motionReduced()) { el.classList.add('open'); return; }
    void el.offsetWidth;
    el.classList.add('open');
  }

  function dialogClose(el, done) {
    if (el.hidden) { if (done) done(); return; }
    if (el._dlgT) { clearTimeout(el._dlgT); el._dlgT = null; }
    if (motionReduced()) {
      el.classList.remove('open');
      el.classList.remove('closing');
      el.hidden = true;
      if (done) done();
      return;
    }
    el.classList.add('closing');
    el._dlgT = setTimeout(function () {
      el._dlgT = null;
      el.classList.remove('open');
      el.classList.remove('closing');
      el.hidden = true;
      if (done) done();
    }, DIALOG_MS + 20);
  }

  function dialogHideNow(el) {
    if (el.classList.contains('closing')) return;
    if (el._dlgT) { clearTimeout(el._dlgT); el._dlgT = null; }
    el.classList.remove('open');
    el.classList.remove('closing');
    el.hidden = true;
  }

  document.addEventListener('pointerdown', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button, a.github-btn') : null;
    if (!btn || btn.disabled || motionReduced()) return;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.6;
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 560);
  }, { passive: true });

  function pickFile(file) {
    if (!file || busy) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast(t('toastNotImage'));
      return;
    }
    setImage(file);
    dialogOpen(cropDialog);
  }

  function goHome() {
    var fromResult = !resultView.hidden;
    dialogHideNow(cropDialog);
    dialogHideNow(loadingDialog);
    dialogHideNow(warnDialog);
    dialogHideNow(docTypeDialog);
    dialogHideNow(nameDialog);
    dialogHideNow(successDialog);
    if (cropper) { cropper.destroy(); cropper = null; }
    if (lastFileUrl) { URL.revokeObjectURL(lastFileUrl); lastFileUrl = null; }
    lastFile = null;
    homeView.hidden = false;
    if (fromResult) {
      pageSlide(homeView, 'translateX(-30%)', 'translateX(0)');
      pageSlide(resultView, 'translateX(0)', 'translateX(100%)', function () { resultView.hidden = true; });
    } else {
      resultView.hidden = true;
    }
    cropScreen.hidden = true;
    backBtn.hidden = true;
    appbarTitle.textContent = t('appbarTitle');
    clearImage();
  }

  var CROP_OPTS = {
    viewMode: 1,
    autoCropArea: 0.92,
    background: false,
    responsive: true,
    dragMode: 'move',
    guides: false
  };

  function openCropScreen() {
    cropRotateDeg = 0;
    cropRotateSeq++;
    if (cropBakedUrl) { URL.revokeObjectURL(cropBakedUrl); cropBakedUrl = null; }
    cropBaseImage = new Image();
    cropBaseImage.src = imageUrl;
    cropImage.src = imageUrl;
    cropScreen.hidden = false;
    pageSlide(cropScreen, 'translateY(100%)', 'translateY(0)');
    if (cropper) { cropper.destroy(); cropper = null; }
    cropper = new Cropper(cropImage, CROP_OPTS);
  }

  function finishCrop() {
    if (!cropper) return;
    var canvas = cropper.getCroppedCanvas({
      maxWidth: 2400,
      maxHeight: 2400,
      fillColor: '#fff',
      imageSmoothingQuality: 'high'
    });
    if (!canvas) return;
    cropper.destroy();
    cropper = null;
    pageSlide(cropScreen, 'translateY(0)', 'translateY(100%)', function () {
      cropScreen.hidden = true;
    });
    canvas.toBlob(function (blob) {
      if (blob) setImage(new File([blob], 'crop.jpg', { type: 'image/jpeg' }));
      runOcrFlow();
    }, 'image/jpeg', 0.92);
  }

  function drawScaled(src, w, h, maxDim) {
    var scale = Math.min(1, maxDim / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(src, 0, 0, cw, ch);
    return c;
  }

  function canvasToBlob(c) {
    return new Promise(function (resolve) {
      c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.92);
    });
  }

  function prepareImage(file) {
    var MAX = 2400;
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .then(function (bmp) {
          if (bmp.width <= MAX && bmp.height <= MAX) {
            bmp.close();
            return file;
          }
          return canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, MAX)).then(function (b) {
            bmp.close();
            return b || file;
          });
        })
        .catch(function () { return prepareImageFallback(file, MAX); });
    }
    return prepareImageFallback(file, MAX);
  }

  function prepareImageFallback(file, MAX) {
    return new Promise(function (resolve) {
      var u = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth <= MAX && img.naturalHeight <= MAX) {
          URL.revokeObjectURL(u);
          resolve(file);
          return;
        }
        canvasToBlob(drawScaled(img, img.naturalWidth, img.naturalHeight, MAX)).then(function (b) {
          URL.revokeObjectURL(u);
          resolve(b || file);
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(u);
        resolve(file);
      };
      img.src = u;
    });
  }

  function killWorker() {
    if (worker) {
      try { worker.terminate(); } catch (e) {}
      worker.pending = {};
      worker = null;
    }
  }

  function ensureWorker() {
    if (worker) return Promise.resolve(worker);
    return new Promise(function (resolve, reject) {
      var w;
      try {
        w = new Worker(OCR_WORKER_URL, { type: 'module' });
      } catch (err) {
        reject(err);
        return;
      }
      w.pending = {};
      w.onmessage = function (e) {
        var d = e.data || {};
        if (d.type === 'debug') {
          dbgLog('worker: ' + (d.msg || ''));
          return;
        }
        var p = w.pending[d.id];
        if (!p) return;
        delete w.pending[d.id];
        if (d.type === 'result') p.resolve(d);
        else p.reject(new Error(d.message || 'OCR error'));
      };
      w.onerror = function (ev) {
        var err = new Error((ev && ev.message) || 'OCR worker error');
        var pend = w.pending;
        w.pending = {};
        Object.keys(pend).forEach(function (k) { pend[k].reject(err); });
        if (worker === w) {
          try { w.terminate(); } catch (e2) {}
          worker = null;
        }
      };
      worker = w;
      resolve(w);
    });
  }

  function ocrBlob(blob) {
    return ensureWorker().then(function (w) {
      return new Promise(function (resolve, reject) {
        var id = ++ocrSeq;
        var timer = setTimeout(function () {
          delete w.pending[id];
          killWorker();
          reject(new Error('OCR timeout'));
        }, 300000);
        w.pending[id] = {
          resolve: function (v) { clearTimeout(timer); resolve(v); },
          reject: function (e) { clearTimeout(timer); reject(e); }
        };
        w.postMessage({
          type: 'ocr',
          id: id,
          cfg: {
            detName: OCR_DET_NAME,
            detFile: OCR_DET_FILE,
            recName: OCR_REC_NAME,
            recFile: OCR_REC_FILE,
            oriFile: OCR_ORI_FILE,
            backend: 'wasm'
          },
          blob: blob
        });
      });
    });
  }

  function buildPara(lines) {
    var merged = '';
    lines.forEach(function (txt) {
      if (!merged) { merged = txt; return; }
      if (/[A-Za-zÇĞİÖŞÜçğıöşü]-$/.test(merged) && /^[a-zçğıöşü]/.test(txt)) {
        merged = merged.slice(0, -1) + txt;
      } else {
        merged += ' ' + txt;
      }
    });
    return merged;
  }

  function itemsToText(items) {
    var boxes = [];
    (items || []).forEach(function (it) {
      var txt = (it.text || '').replace(/\s+/g, ' ').trim();
      if (!txt) return;
      var poly = it.poly || [];
      if (!poly.length) return;
      var minX = Infinity;
      var minY = Infinity;
      var maxY = -Infinity;
      poly.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      });
      boxes.push({
        text: txt,
        cy: (minY + maxY) / 2,
        x: minX,
        y: minY,
        h: Math.max(1, maxY - minY)
      });
    });
    boxes.sort(function (a, b) { return a.cy - b.cy; });
    var rows = [];
    boxes.forEach(function (b) {
      var row = null;
      for (var i = rows.length - 1; i >= 0; i--) {
        var r = rows[i];
        var tol = Math.max(r.h, b.h) * 0.6;
        if (Math.abs(b.cy - r.cy) < tol) { row = r; break; }
        if (b.cy - r.cy > tol) break;
      }
      if (!row) {
        row = { cy: b.cy, h: b.h, y: b.y, items: [] };
        rows.push(row);
      }
      row.items.push(b);
      row.cy = row.cy + (b.cy - row.cy) / row.items.length;
      row.h = Math.max(row.h, b.h);
      if (b.y < row.y) row.y = b.y;
    });
    rows.sort(function (a, b) { return a.cy - b.cy; });
    rows.forEach(function (r) {
      r.items.sort(function (a, b) { return a.x - b.x; });
    });
    var paras = [];
    var cur = null;
    rows.forEach(function (r) {
      var lineText = r.items.map(function (b) { return b.text; }).join(' ');
      if (!cur) {
        cur = { texts: [lineText], lastY: r.y, lastH: r.h };
        return;
      }
      var vGap = r.y - (cur.lastY + cur.lastH);
      var near = vGap < Math.max(cur.lastH, r.h) * 0.7;
      if (near) {
        cur.texts.push(lineText);
        cur.lastY = r.y;
        cur.lastH = r.h;
      } else {
        paras.push(buildPara(cur.texts));
        cur = { texts: [lineText], lastY: r.y, lastH: r.h };
      }
    });
    if (cur) paras.push(buildPara(cur.texts));
    return paras.filter(Boolean).join('\n\n');
  }

  function runOcrFlow() {
    if (location.protocol === 'file:') {
      toast(t('toastErrFileProtocol'), 9000);
      goHome();
      return;
    }
    busy = true;
    dialogOpen(loadingDialog);
    ensureWorker()
      .then(function () {
        return prepareImage(imageFile);
      })
      .then(function (blob) {
        return ocrBlob(blob);
      })
      .then(function (out) {
        var text = itemsToText(out.items);
        text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        dbgLog('result items=' + out.items.length + ' ms=' + out.ms + ' ori=' + JSON.stringify(out.ori));
        busy = false;
        dialogClose(loadingDialog);
        if (!text) {
          dialogOpen(warnDialog);
          return;
        }
        showResult(text);
      })
      .catch(function (err) {
        console.error(err);
        dbgLog('ocr error: ' + ((err && err.message) || err));
        busy = false;
        dialogClose(loadingDialog);
        toast(t('toastErrOcr'));
        goHome();
      });
  }

  function showResult(text) {
    resultText.value = text;
    resultSize = 17;
    resultText.style.fontSize = resultSize + 'px';
    nameError.hidden = true;
    setFabsCollapsed(true);
    applySize();
    resultView.hidden = false;
    pageSlide(resultView, 'translateX(100%)', 'translateX(0)');
    pageSlide(homeView, 'translateX(0)', 'translateX(-30%)', function () { homeView.hidden = true; });
    backBtn.hidden = false;
    appbarTitle.textContent = t('resultTitle');
  }

  cropYes.addEventListener('click', function () {
    dialogClose(cropDialog);
    openCropScreen();
  });

  cropNo.addEventListener('click', function () {
    dialogClose(cropDialog);
    runOcrFlow();
  });

  cropCancel.addEventListener('click', function () {
    pageSlide(cropScreen, 'translateY(0)', 'translateY(100%)', function () {
      if (cropper) { cropper.destroy(); cropper = null; }
      cropScreen.hidden = true;
      clearImage();
    });
  });

  cropConfirm.addEventListener('click', finishCrop);

  function bakeRotatedCanvas(src) {
    var iw = src.naturalWidth || src.width;
    var ih = src.naturalHeight || src.height;
    if (!iw || !ih) return null;
    var deg = cropRotateDeg;
    var swap = deg % 180 === 90;
    var s = Math.min(1, 2400 / Math.max(iw, ih));
    var dw = Math.max(1, Math.round(iw * s));
    var dh = Math.max(1, Math.round(ih * s));
    var c = document.createElement('canvas');
    c.width = swap ? dh : dw;
    c.height = swap ? dw : dh;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (deg === 90) {
      ctx.setTransform(0, 1, -1, 0, c.width, 0);
    } else if (deg === 180) {
      ctx.setTransform(-1, 0, 0, -1, c.width, c.height);
    } else if (deg === 270) {
      ctx.setTransform(0, -1, 1, 0, 0, c.height);
    }
    ctx.drawImage(src, 0, 0, dw, dh);
    return c;
  }

  cropRotate.addEventListener('click', function () {
    if (!cropper || !cropBaseImage) return;
    cropRotateDeg = (cropRotateDeg + 90) % 360;
    var seq = ++cropRotateSeq;
    var baked = bakeRotatedCanvas(cropBaseImage);
    if (!baked) return;
    canvasToBlob(baked).then(function (blob) {
      if (!blob || seq !== cropRotateSeq) return;
      if (cropBakedUrl) URL.revokeObjectURL(cropBakedUrl);
      cropBakedUrl = URL.createObjectURL(blob);
      if (cropper) { cropper.destroy(); cropper = null; }
      cropImage.src = cropBakedUrl;
      cropper = new Cropper(cropImage, CROP_OPTS);
    });
  });

  warnOk.addEventListener('click', function () {
    dialogClose(warnDialog);
    goHome();
  });

  warnDialog.addEventListener('click', function (e) {
    if (e.target === warnDialog) {
      dialogClose(warnDialog);
      goHome();
    }
  });

  backBtn.addEventListener('click', goHome);

  cameraBtn.addEventListener('click', function () { cameraInput.click(); });
  photosBtn.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    pickFile(fileInput.files[0]);
    fileInput.value = '';
  });

  cameraInput.addEventListener('change', function () {
    pickFile(cameraInput.files[0]);
    cameraInput.value = '';
  });

  document.addEventListener('dragover', function (e) { e.preventDefault(); });

  document.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      pickFile(e.dataTransfer.files[0]);
    }
  });

  document.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        var f = items[i].getAsFile();
        if (f) {
          pickFile(f);
          e.preventDefault();
        }
        return;
      }
    }
  });

  function setFabsCollapsed(collapsed) {
    fabs.classList.toggle('collapsed', collapsed);
    if (collapsed) {
      fabIconToolbox.removeAttribute('hidden');
      fabIconClose.setAttribute('hidden', '');
    } else {
      fabIconToolbox.setAttribute('hidden', '');
      fabIconClose.removeAttribute('hidden');
    }
  }

  function applySize() {
    resultText.style.fontSize = resultSize + 'px';
    fabZoomIn.disabled = resultSize >= 25;
    fabZoomOut.disabled = resultSize <= 13;
  }

  function buildTxt(value) {
    return Promise.resolve(new Blob([value], { type: 'text/plain;charset=utf-8' }));
  }

  function buildDocx(value) {
    var docx = window.docx;
    var doc = new docx.Document({
      styles: {
        default: {
          document: { run: { font: 'Rubik', size: 22 } }
        }
      },
      sections: [{
        children: value.split('\n').map(function (line) {
          return new docx.Paragraph({ children: [new docx.TextRun(line)] });
        })
      }]
    });
    return docx.Packer.toBlob(doc);
  }

  function buildPdf(value) {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.addFileToVFS('Rubik.ttf', window.PDF_FONT_BASE64);
    pdf.addFont('Rubik.ttf', 'Rubik', 'normal');
    pdf.setFont('Rubik');
    pdf.setFontSize(11);

    var margin = 18;
    var top = 22;
    var bottom = 275;
    var lineHeight = 5.4;
    var maxWidth = 210 - margin * 2;
    var y = top;

    value.split('\n').forEach(function (raw) {
      pdf.splitTextToSize(raw.length ? raw : ' ', maxWidth).forEach(function (line) {
        if (y > bottom) {
          pdf.addPage();
          y = top;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      });
    });

    return Promise.resolve(pdf.output('blob'));
  }

  function startDownload(type, name) {
    var value = resultText.value;
    var build = type === 'docx' ? buildDocx : type === 'pdf' ? buildPdf : buildTxt;
    Promise.resolve()
      .then(function () { return build(value); })
      .then(function (blob) {
        var filename = name + '.' + type;
        if (lastFileUrl) { URL.revokeObjectURL(lastFileUrl); lastFileUrl = null; }
        lastFile = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        lastFileUrl = URL.createObjectURL(lastFile);
        var a = document.createElement('a');
        a.href = lastFileUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        succFileName.textContent = filename;
        dialogOpen(successDialog);
      })
      .catch(function (err) {
        console.error(err);
        toast(t('toastErrOcr'));
      });
  }

  function copyResult() {
    var value = resultText.value;
    if (!value) {
      toast(t('toastNoData'));
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(function () {
        toast(t('toastCopied'));
      }).catch(function () {
        fallbackCopy(value);
      });
    } else {
      fallbackCopy(value);
    }
  }

  function fallbackCopy(value) {
    var ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    window.getSelection().removeAllRanges();
    toast(ok ? t('toastCopied') : t('toastCopyFail'));
  }

  function showNameDialog(type) {
    pendingType = type;
    nameError.hidden = true;
    nameInput.value = '';
    dialogOpen(nameDialog);
    nameInput.focus();
  }

  fabMain.addEventListener('click', function () {
    setFabsCollapsed(!fabs.classList.contains('collapsed'));
  });

  fabZoomIn.addEventListener('click', function () {
    if (resultSize < 25) { resultSize += 1; applySize(); }
  });

  fabZoomOut.addEventListener('click', function () {
    if (resultSize > 13) { resultSize -= 1; applySize(); }
  });

  fabCopy.addEventListener('click', function () {
    copyResult();
    setFabsCollapsed(true);
  });

  fabDownload.addEventListener('click', function () {
    if (!resultText.value) return;
    setFabsCollapsed(true);
    dialogOpen(docTypeDialog);
  });

  docWord.addEventListener('click', function () {
    dialogClose(docTypeDialog);
    showNameDialog('docx');
  });

  docPdf.addEventListener('click', function () {
    dialogClose(docTypeDialog);
    showNameDialog('pdf');
  });

  docText.addEventListener('click', function () {
    dialogClose(docTypeDialog);
    showNameDialog('txt');
  });

  nameSave.addEventListener('click', function () {
    var v = (nameInput.value || '').trim();
    if (!v) {
      nameError.hidden = false;
      return;
    }
    dialogClose(nameDialog);
    startDownload(pendingType, v);
  });

  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameSave.click();
    }
  });

  nameInput.addEventListener('input', function () {
    if (nameInput.value.trim()) nameError.hidden = true;
  });

  function canShareFile(file) {
    try {
      return !!(navigator.share && navigator.canShare && file && navigator.canShare({ files: [file] }));
    } catch (e) {
      return false;
    }
  }

  succOpen.addEventListener('click', function () {
    if (!lastFile || !lastFileUrl) return;
    var ext = (lastFile.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'txt' && ext !== 'pdf') {
      toast(t('toastOpenUnsupported'), 4200);
      return;
    }
    var win = window.open(lastFileUrl, '_blank');
    if (!win) toast(t('toastOpenBlocked'));
  });

  succShare.addEventListener('click', function () {
    if (!lastFile) return;
    if (!canShareFile(lastFile)) {
      toast(t('toastShareUnsupported'), 4200);
      return;
    }
    navigator.share({ files: [lastFile], title: lastFile.name }).catch(function (err) {
      if (err && err.name === 'AbortError' && /cancel/i.test(err.message || '')) return;
      toast(t('toastShareFailed'), 4200);
    });
  });

  succClose.addEventListener('click', function () {
    dialogClose(successDialog);
  });

  docTypeDialog.addEventListener('click', function (e) {
    if (e.target === docTypeDialog) dialogClose(docTypeDialog);
  });

  nameDialog.addEventListener('click', function (e) {
    if (e.target === nameDialog) dialogClose(nameDialog);
  });

  successDialog.addEventListener('click', function (e) {
    if (e.target === successDialog) dialogClose(successDialog);
  });

  if (!(navigator.share && navigator.canShare)) {
    succShare.hidden = true;
  }

  window.addEventListener('pagehide', function () {
    killWorker();
  });

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }

  if (NO_SW && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
    if (window.caches) {
      caches.keys().then(function (ks) {
        ks.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }
  }

  if (!NO_SW && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  function syncThemeColor() {
    var bar = document.getElementById('appbar');
    if (!bar) return;
    var bg = getComputedStyle(bar).backgroundColor;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', bg);
  }

  syncThemeColor();

  if (window.matchMedia) {
    var schemeMq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSchemeChange = function () { syncThemeColor(); };
    if (schemeMq.addEventListener) schemeMq.addEventListener('change', onSchemeChange);
    else if (schemeMq.addListener) schemeMq.addListener(onSchemeChange);
  }

  applyLang();

  if (location.protocol === 'file:') {
    toast(t('toastErrFileProtocol'), 9000);
  }
})();
