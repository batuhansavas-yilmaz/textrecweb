(function () {
  'use strict';

  var STR = window.TEXTREC_STR;
  var QS = new URLSearchParams(location.search);
  var DBG = QS.get('debug') === '1';
  var MODEL_MODE_STORAGE = 'textrec-model-mode';
  var SMALL_OVERRIDE = null;
  try {
    var savedMode = localStorage.getItem(MODEL_MODE_STORAGE);
    if (savedMode === 'small') SMALL_OVERRIDE = true;
    else if (savedMode === 'medium') SMALL_OVERRIDE = false;
  } catch (e) {}
  var SMALL;
  if (QS.get('small') === '1') SMALL = true;
  else if (QS.get('small') === '0' || QS.get('accurate') === '1') SMALL = false;
  else if (SMALL_OVERRIDE !== null) SMALL = SMALL_OVERRIDE;
  else SMALL = true;
  var MAX_DIM = SMALL ? 1600 : 2400;
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
    dbgLog('gpu: ' + (!!navigator.gpu) + ' | cores: ' + (navigator.hardwareConcurrency || '?') + ' | sw: ' + ('serviceWorker' in navigator) + ' | small=' + SMALL + ' maxDim=' + MAX_DIM + ' nosw=' + NO_SW);
    window.addEventListener('error', function (e) { dbgLog('page error: ' + (e.message || e.type)); });
    window.addEventListener('unhandledrejection', function (e) { dbgLog('promise error: ' + ((e.reason && e.reason.message) || e.reason)); });
  }


  var OCR_DET_NAME = SMALL ? 'PP-OCRv6_tiny_det' : 'PP-OCRv6_medium_det';
  var OCR_DET_FILE = SMALL ? 'PP-OCRv6_tiny_det_onnx_infer.tar' : 'PP-OCRv6_medium_det_onnx_infer.tar';
  var OCR_REC_NAME = SMALL ? 'PP-OCRv6_small_rec' : 'PP-OCRv6_medium_rec';
  var OCR_REC_FILE = SMALL ? 'PP-OCRv6_small_rec_onnx_infer.tar' : 'PP-OCRv6_medium_rec_onnx_infer.tar';
  var OCR_ORI_FILE = 'PP-LCNet_x1_0_doc_ori.onnx';
  var OCR_WORKER_URL = 'vendor/paddleocr/textrec-ocr-worker.js?v=6';
  var OCR_BACKEND = 'auto';

  function ocrCfg() {
    return {
      detName: OCR_DET_NAME,
      detFile: OCR_DET_FILE,
      recName: OCR_REC_NAME,
      recFile: OCR_REC_FILE,
      oriFile: OCR_ORI_FILE,
      backend: OCR_BACKEND
    };
  }

  function detectLang() {
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
  var lastResultBtn = $('lastResultBtn');
  var lastResultHomeBtn = $('lastResultHomeBtn');
  var homeView = $('homeView');
  var resultView = $('resultView');
  var cameraBtn = $('cameraBtn');
  var photosBtn = $('photosBtn');
  var accuracyBtns = [ $('accuracyBtn'), $('accuracyBtnDesktop') ].filter(function (b) { return !!b; });
  var accuracyDialog = $('accuracyDialog');
  var accuracyEnable = $('accuracyEnable');
  var accuracyCancel = $('accuracyCancel');
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
  var cropMirrorBtn = $('cropMirror');
  var loadingDialog = $('loadingDialog');
  var loadingStatus = $('loadingStatus');
  var warnDialog = $('warnDialog');
  var warnText = $('warnText');
  var warnOk = $('warnOk');
  var resultText = $('resultText');
  var resultImage = $('resultImage');
  var resultPreview = document.querySelector('.result-preview');
  var resultSheet = document.querySelector('.result-sheet');
  var resultCorners = document.querySelectorAll('.result-corner');
  var resultRotateBtn = $('resultRotateBtn');
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
  var docText = $('docText');
  var pdfOptionsDialog = $('pdfOptionsDialog');
  var pdfPageCountEl = $('pdfPageCount');
  var pdfRangeInputs = $('pdfRangeInputs');
  var pdfListInputs = $('pdfListInputs');
  var pdfRangeStart = $('pdfRangeStart');
  var pdfRangeEnd = $('pdfRangeEnd');
  var pdfPageList = $('pdfPageList');
  var pdfPageError = $('pdfPageError');
  var pdfStart = $('pdfStart');
  var pdfCancel = $('pdfCancel');
  var nameDialog = $('nameDialog');
  var nameInput = $('nameInput');
  var nameError = $('nameError');
  var nameSave = $('nameSave');
  var successDialog = $('successDialog');
  var succMessage = $('succMessage');
  var succFileName = $('succFileName');
  var succOpen = $('succOpen');
  var succShare = $('succShare');
  var succClose = $('succClose');

  var imageFile = null;
  var imageUrl = null;
  var worker = null;
  var warmupPromise = null;
  var ocrSeq = 0;
  var busy = false;
  var cropper = null;
  var cropRotateDeg = 0;
  var cropMirror = false;
  var cropRotateSeq = 0;
  var cropBaseImage = null;
  var cropBakedUrl = null;
  var resultSize = 17;
  var pendingType = null;
  var lastFile = null;
  var lastFileUrl = null;
  var lastScanFile = null;
  var lastResultText = '';
  var pdfFile = null;
  var pdfDoc = null;
  var pdfPageTotal = 0;
  var prebuiltExports = { txt: null, docx: null };
  var prebuiltValue = '';
  var prebuildPromise = null;
  var previewBaseImgW = 0;
  var previewBaseImgH = 0;
  var previewFrameX = 0;
  var previewFrameY = 0;
  var previewScale = 1;
  var previewMaxScale = 1;
  var previewDrag = null;
  var PREVIEW_START = 0.82;
  var PREVIEW_MIN = 0.55;

  var OCR_LANG_STORAGE = 'textrec-ocr-lang';
  var OCR_LANGS = {
    ru: { label: 'Русский / Кириллица', name: 'cyrillic_PP-OCRv5_mobile_rec', file: 'cyrillic_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    ja: { label: '日本語', name: 'japan_PP-OCRv3_mobile_rec', file: 'japan_PP-OCRv3_mobile_rec_onnx_infer.tar' },
    ch: { label: '中文', name: 'PP-OCRv5_mobile_rec', file: 'PP-OCRv5_mobile_rec_onnx_infer.tar' },
    ko: { label: '한국어', name: 'korean_PP-OCRv5_mobile_rec', file: 'korean_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    ar: { label: 'العربية', name: 'arabic_PP-OCRv5_mobile_rec', file: 'arabic_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    el: { label: 'Ελληνικά', name: 'el_PP-OCRv5_mobile_rec', file: 'el_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    th: { label: 'ไทย', name: 'th_PP-OCRv5_mobile_rec', file: 'th_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    hi: { label: 'हिन्दी / Devanagari', name: 'devanagari_PP-OCRv5_mobile_rec', file: 'devanagari_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    ta: { label: 'தமிழ்', name: 'ta_PP-OCRv5_mobile_rec', file: 'ta_PP-OCRv5_mobile_rec_onnx_infer.tar' },
    te: { label: 'తెలుగు', name: 'te_PP-OCRv5_mobile_rec', file: 'te_PP-OCRv5_mobile_rec_onnx_infer.tar' }
  };
  var ocrLang = 'latin';

  function setOcrLang(id, remember) {
    if (id !== 'latin' && !OCR_LANGS[id]) id = 'latin';
    var spec = OCR_LANGS[id];
    if (spec) {
      OCR_REC_NAME = spec.name;
      OCR_REC_FILE = spec.file;
      OCR_DET_NAME = 'PP-OCRv6_tiny_det';
      OCR_DET_FILE = 'PP-OCRv6_tiny_det_onnx_infer.tar';
    } else {
      OCR_REC_NAME = SMALL ? 'PP-OCRv6_small_rec' : 'PP-OCRv6_medium_rec';
      OCR_REC_FILE = SMALL ? 'PP-OCRv6_small_rec_onnx_infer.tar' : 'PP-OCRv6_medium_rec_onnx_infer.tar';
      OCR_DET_NAME = SMALL ? 'PP-OCRv6_tiny_det' : 'PP-OCRv6_medium_det';
      OCR_DET_FILE = SMALL ? 'PP-OCRv6_tiny_det_onnx_infer.tar' : 'PP-OCRv6_medium_det_onnx_infer.tar';
    }
    ocrLang = id;
    if (remember) {
      try { localStorage.setItem(OCR_LANG_STORAGE, id); } catch (e) {}
    }
    if (worker) killWorker();
    warmupPromise = null;
  }

  function detectOcrLang() {
    try {
      var saved = localStorage.getItem(OCR_LANG_STORAGE);
      if (saved === 'latin' || OCR_LANGS[saved]) return saved;
    } catch (e) {}
    var ui = (navigator.language || '').toLowerCase().split('-')[0];
    if (OCR_LANGS[ui]) return ui;
    if (ui === 'zh') return 'ch';
    if (ui === 'uk' || ui === 'be' || ui === 'bg' || ui === 'sr' || ui === 'mk' || ui === 'kk' || ui === 'ky' || ui === 'tg' || ui === 'mn') return 'ru';
    if (ui === 'fa' || ui === 'ur' || ui === 'ps' || ui === 'ug') return 'ar';
    if (ui === 'ne' || ui === 'mr' || ui === 'sa') return 'hi';
    return 'latin';
  }

  function initOcrLang() {
    var forced = QS.get('lang');
    if (forced && forced !== 'latin' && !OCR_LANGS[forced]) forced = null;
    setOcrLang(forced || detectOcrLang(), false);
  }

  function updateAccuracyUI() {
    var forced = QS.has('small') || QS.has('accurate');
    var visible = !forced && ocrLang === 'latin';
    accuracyBtns.forEach(function (btn) {
      btn.hidden = !visible;
      btn.classList.toggle('active', !SMALL);
      btn.setAttribute('aria-pressed', SMALL ? 'false' : 'true');
    });
  }

  function mediumModelsCached() {
    if (!window.caches) return Promise.resolve(false);
    var base = new URL('vendor/paddleocr/models/', location.href).href;
    var urls = [
      base + 'PP-OCRv6_medium_det_onnx_infer.tar',
      base + 'PP-OCRv6_medium_rec_onnx_infer.tar'
    ];
    return Promise.all(urls.map(function (u) {
      return caches.match(u).then(function (hit) { return !!hit; }).catch(function () { return false; });
    })).then(function (hits) {
      return hits.length === urls.length && hits.every(Boolean);
    }).catch(function () { return false; });
  }

  function setAccurate(enabled) {
    SMALL_OVERRIDE = !enabled;
    SMALL = !enabled;
    MAX_DIM = SMALL ? 1600 : 2400;
    try { localStorage.setItem(MODEL_MODE_STORAGE, SMALL ? 'small' : 'medium'); } catch (e) {}
    setOcrLang(ocrLang, false);
    updateAccuracyUI();
    toast(t(enabled ? 'toastAccurateOn' : 'toastAccurateOff'));
  }

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

  function clearPdf() {
    if (pdfDoc) {
      try { pdfDoc.destroy(); } catch (e) {}
      pdfDoc = null;
    }
    pdfFile = null;
    pdfPageTotal = 0;
  }

  var PAGE_MS = 360;
  var PAGE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

  function motionReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isDesktop() {
    return window.matchMedia && window.matchMedia('(min-width: 700px)').matches;
  }

  function previewFit() {
    if (!resultPreview || !resultSheet || !resultImage) return null;
    var pw = resultPreview.clientWidth;
    var ph = resultPreview.clientHeight;
    var iw = resultImage.naturalWidth || resultImage.width;
    var ih = resultImage.naturalHeight || resultImage.height;
    if (!pw || !ph || !iw || !ih) return null;
    var cs = getComputedStyle(resultSheet);
    var frameX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    var frameY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    var maxW = Math.max(40, pw - frameX);
    var maxH = Math.max(40, ph - frameY);
    var fit = Math.min(maxW / iw, maxH / ih);
    return { frameX: frameX, frameY: frameY, w: iw * fit, h: ih * fit };
  }

  function applyPreviewSize() {
    if (!resultSheet || !resultImage || !previewBaseImgW || !previewBaseImgH) return;
    previewScale = Math.max(PREVIEW_MIN, Math.min(previewMaxScale, previewScale));
    var iw = previewBaseImgW * previewScale;
    var ih = previewBaseImgH * previewScale;
    resultSheet.style.width = (iw + previewFrameX) + 'px';
    resultSheet.style.height = (ih + previewFrameY) + 'px';
    resultImage.style.width = iw + 'px';
    resultImage.style.height = ih + 'px';
    resultImage.style.maxWidth = 'none';
    resultImage.style.maxHeight = 'none';
  }

  function fitPreview(reset) {
    if (resultView.hidden || !isDesktop()) return;
    var fit = previewFit();
    if (!fit) return;
    previewFrameX = fit.frameX;
    previewFrameY = fit.frameY;
    previewBaseImgW = fit.w * PREVIEW_START;
    previewBaseImgH = fit.h * PREVIEW_START;
    previewMaxScale = 1 / PREVIEW_START;
    if (reset) previewScale = 1;
    applyPreviewSize();
  }

  function onPreviewPointerDown(e) {
    if (!isDesktop() || !resultSheet || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    var rect = resultSheet.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    previewDrag = {
      id: e.pointerId,
      startScale: previewScale,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      cx: cx,
      cy: cy
    };
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    resultSheet.classList.add('resizing');
  }

  function onPreviewPointerMove(e) {
    if (!previewDrag || e.pointerId !== previewDrag.id) return;
    var dist = Math.hypot(e.clientX - previewDrag.cx, e.clientY - previewDrag.cy);
    previewScale = previewDrag.startScale * (dist / previewDrag.startDist);
    applyPreviewSize();
  }

  function onPreviewPointerUp(e) {
    if (!previewDrag || (e && e.pointerId !== previewDrag.id)) return;
    previewDrag = null;
    if (resultSheet) resultSheet.classList.remove('resizing');
  }

  function rotateResultImage() {
    if (!imageFile || !imageUrl || !resultImage || !resultRotateBtn) return;
    resultRotateBtn.disabled = true;
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      canvas.toBlob(function (blob) {
        resultRotateBtn.disabled = false;
        if (!blob) return;
        var rotated = new File([blob], 'scan-rotated.jpg', { type: 'image/jpeg' });
        setImage(rotated);
        lastScanFile = rotated;
        resultImage.src = imageUrl;
      }, 'image/jpeg', 0.94);
    };
    img.onerror = function () { resultRotateBtn.disabled = false; };
    img.src = imageUrl;
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

  function setLoadingStatus(text) {
    if (!loadingStatus) return;
    loadingStatus.textContent = text || '';
    loadingStatus.hidden = !text;
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

  function isPdfFile(file) {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  }

  function pickFile(file) {
    if (!file || busy) return;
    if (isPdfFile(file)) {
      clearPdf();
      clearImage();
      warmupOcr();
      openPdf(file);
      return;
    }
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast(t('toastNotImage'));
      return;
    }
    clearPdf();
    setImage(file);
    warmupOcr();
    dialogOpen(cropDialog);
  }

  function updateLastResultButton() {
    var hasLast = !!(lastScanFile && lastResultText);
    var onResult = !resultView.hidden;
    if (lastResultBtn) lastResultBtn.hidden = !hasLast || onResult || isDesktop();
    if (lastResultHomeBtn) lastResultHomeBtn.hidden = !hasLast || onResult || !isDesktop();
  }

  function restoreLastResult() {
    if (!lastScanFile || !lastResultText) return;
    if (!resultView.hidden) {
      resultText.focus();
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageFile = lastScanFile;
    imageUrl = URL.createObjectURL(lastScanFile);
    showResult(lastResultText);
  }

  function goHome() {
    var fromResult = !resultView.hidden;
    dialogHideNow(cropDialog);
    dialogHideNow(loadingDialog);
    dialogHideNow(warnDialog);
    dialogHideNow(docTypeDialog);
    dialogHideNow(pdfOptionsDialog);
    dialogHideNow(nameDialog);
    dialogHideNow(successDialog);
    dialogHideNow(accuracyDialog);
    if (cropper) { cropper.destroy(); cropper = null; }
    if (lastFileUrl) { URL.revokeObjectURL(lastFileUrl); lastFileUrl = null; }
    lastFile = null;
    resetPrebuilt();
    clearPdf();
    homeView.hidden = false;
    if (fromResult && isDesktop()) {
      resultView.classList.remove('split-reveal');
      resultView.hidden = true;
      if (resultImage) resultImage.removeAttribute('src');
    } else if (fromResult) {
      pageSlide(homeView, 'translateX(-30%)', 'translateX(0)');
      pageSlide(resultView, 'translateX(0)', 'translateX(100%)', function () {
        resultView.hidden = true;
        updateLastResultButton();
      });
    } else {
      resultView.hidden = true;
    }
    cropScreen.hidden = true;
    backBtn.hidden = true;
    appbarTitle.textContent = t('appbarTitle');
    clearImage();
    updateLastResultButton();
  }

  var CROP_OPTS = {
    viewMode: 1,
    autoCropArea: 0.92,
    background: false,
    responsive: true,
    dragMode: 'move',
    guides: false
  };

  var CROP_LIBS = {
    css: 'vendor/cropperjs/cropper.min.css',
    js: 'vendor/cropperjs/cropper.min.js'
  };
  var cropLoad = null;

  function loadStyleOnce(href) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('link[data-crop-src="' + href + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') { resolve(); return; }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Style load failed: ' + href)); });
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-crop-src', href);
      link.addEventListener('load', function () {
        link.setAttribute('data-loaded', '1');
        resolve();
      });
      link.addEventListener('error', function () {
        reject(new Error('Style load failed: ' + href));
      });
      document.head.appendChild(link);
    });
  }

  function ensureCropper() {
    if (!cropLoad) {
      cropLoad = Promise.all([
        loadStyleOnce(CROP_LIBS.css),
        loadScriptOnce(CROP_LIBS.js)
      ]).catch(function (err) {
        cropLoad = null;
        throw err;
      });
    }
    return cropLoad;
  }

  function openCropScreen() {
    cropRotateDeg = 0;
    cropMirror = false;
    if (cropMirrorBtn) cropMirrorBtn.classList.remove('active');
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
      maxWidth: MAX_DIM,
      maxHeight: MAX_DIM,
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
    var MAX = MAX_DIM;
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

  var PDFJS_URL = 'vendor/pdfjs/pdf.min.js';
  var PDFJS_WORKER_URL = 'vendor/pdfjs/pdf.worker.min.js';
  var pdfJsLoad = null;

  function ensurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return Promise.resolve(window.pdfjsLib);
    }
    if (!pdfJsLoad) {
      pdfJsLoad = loadScriptOnce(PDFJS_URL).then(function () {
        if (!window.pdfjsLib) throw new Error('PDF.js failed to load');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return window.pdfjsLib;
      }).catch(function (err) {
        pdfJsLoad = null;
        throw err;
      });
    }
    return pdfJsLoad;
  }

  function readFileBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read file')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function openPdf(file) {
    if (location.protocol === 'file:') {
      toast(t('toastErrFileProtocol'), 9000);
      goHome();
      return;
    }
    busy = true;
    pdfFile = file;
    setLoadingStatus(t('statusPdfReading'));
    dialogOpen(loadingDialog);
    Promise.all([ensurePdfJs(), readFileBuffer(file)])
      .then(function (res) {
        return res[0].getDocument({ data: new Uint8Array(res[1]) }).promise;
      })
      .then(function (doc) {
        if (!pdfFile) {
          try { doc.destroy(); } catch (e) {}
          return;
        }
        pdfDoc = doc;
        pdfPageTotal = doc.numPages;
        busy = false;
        dialogClose(loadingDialog);
        openPdfOptions();
      })
      .catch(function (err) {
        console.error(err);
        busy = false;
        dialogClose(loadingDialog);
        clearPdf();
        toast(t(err && err.name === 'PasswordException' ? 'toastPdfPassword' : 'toastErrPdf'), 5200);
        goHome();
      });
  }

  function openPdfOptions() {
    if (!pdfOptionsDialog) return;
    if (pdfPageCountEl) pdfPageCountEl.textContent = String(pdfPageTotal);
    if (pdfRangeStart) pdfRangeStart.value = '1';
    if (pdfRangeEnd) pdfRangeEnd.value = String(pdfPageTotal);
    if (pdfPageList) pdfPageList.value = '';
    if (pdfRangeInputs) pdfRangeInputs.hidden = true;
    if (pdfListInputs) pdfListInputs.hidden = true;
    if (pdfPageError) pdfPageError.hidden = true;
    var all = document.querySelector('input[name="pdfMode"][value="all"]');
    if (all) all.checked = true;
    dialogOpen(pdfOptionsDialog);
  }

  function parsePdfTokens(raw, total) {
    var tokens = String(raw || '').split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) return null;
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var m = tokens[i].match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return null;
      var a = parseInt(m[1], 10);
      var b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || b < a || b > total) return null;
      for (var n = a; n <= b; n++) out.push(n);
    }
    out = out.filter(function (v, idx, arr) { return arr.indexOf(v) === idx; });
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : null;
  }

  function selectedPdfPages() {
    var checked = document.querySelector('input[name="pdfMode"]:checked');
    var mode = checked ? checked.value : 'all';
    if (mode === 'all') {
      var allPages = [];
      for (var i = 1; i <= pdfPageTotal; i++) allPages.push(i);
      return allPages;
    }
    if (mode === 'range') {
      var start = parseInt(pdfRangeStart.value, 10);
      var end = parseInt(pdfRangeEnd.value, 10);
      if (!isFinite(start) || !isFinite(end) || start < 1 || end < start || end > pdfPageTotal) return null;
      var pages = [];
      for (var p = start; p <= end; p++) pages.push(p);
      return pages;
    }
    return parsePdfTokens(pdfPageList.value, pdfPageTotal);
  }

  function renderPdfPage(pdf, pageNum) {
    return pdf.getPage(pageNum).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(3, MAX_DIM / Math.max(base.width, base.height));
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
        return canvasToBlob(canvas);
      });
    });
  }

  function runPdfOcr(pages) {
    if (location.protocol === 'file:') {
      toast(t('toastErrFileProtocol'), 9000);
      goHome();
      return;
    }
    if (!pdfDoc || !pages || !pages.length) return;
    busy = true;
    setLoadingStatus(t('statusPdfReading'));
    dialogOpen(loadingDialog);
    var results = [];
    var firstBlob = null;
    var chain = Promise.resolve();
    pages.forEach(function (pageNum, index) {
      chain = chain.then(function () {
        setLoadingStatus(t('statusPdfPage').replace('{n}', String(index + 1)).replace('{total}', String(pages.length)));
        return renderPdfPage(pdfDoc, pageNum).then(function (blob) {
          if (!firstBlob) firstBlob = blob;
          return ocrWithFallback(blob);
        }).then(function (out) {
          var pageText = itemsToText(out.items);
          pageText = pageText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          if (pageText) results.push({ page: pageNum, text: pageText });
        });
      });
    });
    chain.then(function () {
      busy = false;
      dialogClose(loadingDialog);
      if (!results.length) {
        if (warnText) warnText.textContent = t('pdfNoText');
        dialogOpen(warnDialog);
        return;
      }
      var text;
      if (results.length === 1 && pages.length === 1) {
        text = results[0].text;
      } else {
        text = results.map(function (r) {
          return '--- Page ' + r.page + ' ---\n' + r.text;
        }).join('\n\n');
      }
      clearPdf();
      if (firstBlob) {
        setImage(new File([firstBlob], 'pdf-page-' + pages[0] + '.jpg', { type: 'image/jpeg' }));
      }
      showResult(text);
    }).catch(function (err) {
      console.error(err);
      busy = false;
      dialogClose(loadingDialog);
      clearPdf();
      toast(t('toastErrOcr'), 5200);
      goHome();
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
    var ready = warmupPromise || Promise.resolve();
    return ready.then(function () {
      return ensureWorker();
    }).then(function (w) {
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
          cfg: ocrCfg(),
          blob: blob
        });
      });
    });
  }

  function ocrWithFallback(blob) {
    return ocrBlob(blob).catch(function (err) {
      if (OCR_BACKEND !== 'auto') throw err;
      dbgLog('auto backend failed, retrying wasm: ' + ((err && err.message) || err));
      OCR_BACKEND = 'wasm';
      warmupPromise = null;
      killWorker();
      return ocrBlob(blob);
    });
  }

  function canWarmupOcr() {
    var conn = navigator.connection;
    if (!conn) return true;
    if (conn.saveData) return false;
    var et = conn.effectiveType;
    return et !== 'slow-2g' && et !== '2g' && et !== '3g';
  }

  function warmupOcr() {
    if (warmupPromise || location.protocol === 'file:' || !canWarmupOcr()) return;
    warmupPromise = ensureWorker().then(function (w) {
      return new Promise(function (resolve) {
        var finished = false;
        function done() {
          if (finished) return;
          finished = true;
          try { w.removeEventListener('message', onMsg); } catch (e) {}
          resolve();
        }
        function onMsg(e) {
          var d = e.data || {};
          if (d.type === 'warmup-done' || d.type === 'warmup-error') done();
        }
        w.addEventListener('message', onMsg);
        w.postMessage({ type: 'warmup', id: 0, cfg: ocrCfg() });
        setTimeout(done, 30000);
      });
    }).catch(function () {
      warmupPromise = null;
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
    setLoadingStatus(t('statusOcr'));
    dialogOpen(loadingDialog);
    ensureWorker()
      .then(function () {
        return prepareImage(imageFile);
      })
      .then(function (blob) {
        return ocrWithFallback(blob);
      })
      .then(function (out) {
        var text = itemsToText(out.items);
        text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        dbgLog('result items=' + out.items.length + ' ms=' + out.ms + ' ori=' + JSON.stringify(out.ori));
        busy = false;
        dialogClose(loadingDialog);
        if (!text) {
          if (warnText) warnText.textContent = t('warnText');
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
    resetPrebuilt();
    lastScanFile = imageFile;
    lastResultText = text;
    resultText.value = text;
    resultSize = 17;
    resultText.style.setProperty('font-size', resultSize + 'px', 'important');
    nameError.hidden = true;
    setFabsCollapsed(true);
    applySize();
    if (resultImage) resultImage.src = imageUrl || '';
    resultView.classList.remove('split-reveal');
    resultView.hidden = false;
    if (isDesktop()) {
      homeView.hidden = true;
      void resultView.offsetWidth;
      resultView.classList.add('split-reveal');
    } else {
      pageSlide(resultView, 'translateX(100%)', 'translateX(0)');
      pageSlide(homeView, 'translateX(0)', 'translateX(-30%)', function () { homeView.hidden = true; });
    }
    backBtn.hidden = false;
    appbarTitle.textContent = t('resultTitle');
    updateLastResultButton();
    if (resultSheet) {
      resultSheet.style.width = '';
      resultSheet.style.height = '';
    }
    requestAnimationFrame(function () { fitPreview(true); });
  }

  cropYes.addEventListener('click', function () {
    dialogClose(cropDialog);
    ensureCropper().then(openCropScreen).catch(function (err) {
      console.error(err);
      toast(t('toastErrCrop'), 4200);
      runOcrFlow();
    });
  });

  cropNo.addEventListener('click', function () {
    dialogClose(cropDialog);
    runOcrFlow();
  });

  document.querySelectorAll('input[name="pdfMode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var mode = radio.value;
      if (pdfRangeInputs) pdfRangeInputs.hidden = mode !== 'range';
      if (pdfListInputs) pdfListInputs.hidden = mode !== 'list';
      if (pdfPageError) pdfPageError.hidden = true;
      if (mode === 'range' && pdfRangeStart) pdfRangeStart.focus();
      if (mode === 'list' && pdfPageList) pdfPageList.focus();
    });
  });

  function closePdfOptions() {
    dialogClose(pdfOptionsDialog);
    clearPdf();
    clearImage();
    goHome();
  }

  if (pdfCancel) pdfCancel.addEventListener('click', closePdfOptions);

  if (pdfOptionsDialog) {
    pdfOptionsDialog.addEventListener('click', function (e) {
      if (e.target === pdfOptionsDialog) closePdfOptions();
    });
  }

  if (pdfStart) {
    pdfStart.addEventListener('click', function () {
      var pages = selectedPdfPages();
      if (!pages) {
        if (pdfPageError) pdfPageError.hidden = false;
        return;
      }
      if (pdfPageError) pdfPageError.hidden = true;
      dialogClose(pdfOptionsDialog, function () {
        runPdfOcr(pages);
      });
    });
  }

  [pdfRangeStart, pdfRangeEnd, pdfPageList].forEach(function (input) {
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (pdfStart) pdfStart.click();
      }
    });
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
    var s = Math.min(1, MAX_DIM / Math.max(iw, ih));
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
    if (cropMirror) {
      var mirrored = document.createElement('canvas');
      mirrored.width = c.width;
      mirrored.height = c.height;
      var mctx = mirrored.getContext('2d');
      mctx.translate(c.width, 0);
      mctx.scale(-1, 1);
      mctx.drawImage(c, 0, 0);
      return mirrored;
    }
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

  if (cropMirrorBtn) {
    cropMirrorBtn.addEventListener('click', function () {
      if (!cropper || !cropBaseImage) return;
      cropMirror = !cropMirror;
      cropMirrorBtn.classList.toggle('active', cropMirror);
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
  }

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

  function onAccuracyClick() {
    if (!SMALL) {
      setAccurate(false);
      return;
    }
    mediumModelsCached().then(function (cached) {
      if (cached) {
        setAccurate(true);
        return;
      }
      dialogOpen(accuracyDialog);
    });
  }

  accuracyBtns.forEach(function (btn) {
    btn.addEventListener('click', onAccuracyClick);
  });

  accuracyEnable.addEventListener('click', function () {
    dialogClose(accuracyDialog);
    setAccurate(true);
  });

  accuracyCancel.addEventListener('click', function () {
    dialogClose(accuracyDialog);
  });

  accuracyDialog.addEventListener('click', function (e) {
    if (e.target === accuracyDialog) dialogClose(accuracyDialog);
  });

  backBtn.addEventListener('click', goHome);
  if (lastResultBtn) lastResultBtn.addEventListener('click', restoreLastResult);
  if (lastResultHomeBtn) lastResultHomeBtn.addEventListener('click', restoreLastResult);
  if (resultImage) {
    resultImage.addEventListener('load', function () { fitPreview(true); });
    resultImage.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }
  if (resultRotateBtn) resultRotateBtn.addEventListener('click', rotateResultImage);
  if (resultCorners.length) {
    resultCorners.forEach(function (corner) {
      corner.addEventListener('pointerdown', onPreviewPointerDown);
    });
    document.addEventListener('pointermove', onPreviewPointerMove);
    document.addEventListener('pointerup', onPreviewPointerUp);
    document.addEventListener('pointercancel', onPreviewPointerUp);
  }
  resultText.addEventListener('input', function () {
    if (!resultView.hidden) lastResultText = resultText.value;
  });

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
    resultText.style.setProperty('font-size', resultSize + 'px', 'important');
    fabZoomIn.disabled = resultSize >= 25;
    fabZoomOut.disabled = resultSize <= 13;
  }

  var EXPORT_SCRIPTS = {
    docx: ['vendor/docx.umd.js']
  };
  var exportLoads = {};

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-export-src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') { resolve(); return; }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Script load failed: ' + src)); });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-export-src', src);
      s.addEventListener('load', function () {
        s.setAttribute('data-loaded', '1');
        resolve();
      });
      s.addEventListener('error', function () {
        reject(new Error('Script load failed: ' + src));
      });
      document.head.appendChild(s);
    });
  }

  function ensureExportLibs(type) {
    var list = EXPORT_SCRIPTS[type];
    if (!list) return Promise.resolve();
    if (!exportLoads[type]) {
      exportLoads[type] = Promise.all(list.map(loadScriptOnce)).catch(function (err) {
        exportLoads[type] = null;
        throw err;
      });
    }
    return exportLoads[type];
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

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function resetPrebuilt() {
    prebuiltExports = { txt: null, docx: null };
    prebuiltValue = '';
    prebuildPromise = null;
  }

  function prebuildExports(value) {
    if (!value) return;
    if (prebuiltValue === value && (prebuiltExports.txt || prebuildPromise)) return;
    prebuiltValue = value;
    prebuiltExports = { txt: null, docx: null };
    prebuildPromise = Promise.resolve()
      .then(function () { return buildTxt(value); })
      .then(function (blob) {
        if (prebuiltValue === value) prebuiltExports.txt = blob;
        return ensureExportLibs('docx');
      })
      .then(function () { return buildDocx(value); })
      .then(function (blob) {
        if (prebuiltValue === value) prebuiltExports.docx = blob;
      })
      .catch(function (err) {
        console.error(err);
      })
      .then(function () { prebuildPromise = null; });
  }

  function showSuccessDialog(mode) {
    var shareAvailable = lastFile ? canShareFile(lastFile) : false;
    if (succMessage) {
      if (mode === 'ios') succMessage.textContent = t(shareAvailable ? 'succIosReady' : 'succIosNoShare');
      else succMessage.textContent = t('succDownload');
    }
    if (succOpen) succOpen.hidden = !lastFile || !/\.txt$/i.test(lastFile.name);
    if (succShare) succShare.hidden = !shareAvailable;
    if (succFileName) succFileName.textContent = lastFile ? lastFile.name : '';
    dialogOpen(successDialog);
  }

  function finishExport(file, filename) {
    if (lastFileUrl) { URL.revokeObjectURL(lastFileUrl); lastFileUrl = null; }
    lastFile = file;
    lastFileUrl = URL.createObjectURL(lastFile);

    if (isIos()) {
      if (canShareFile(lastFile)) {
        navigator.share({ files: [lastFile], title: lastFile.name }).then(function () {
          toast(t('toastShareSuccess'), 3600);
        }).catch(function (err) {
          if (err && err.name === 'AbortError') {
            toast(t('toastShareCancelled'), 3600);
            return;
          }
          console.error(err);
          showSuccessDialog('ios');
          toast(t('toastShareFailed'), 4200);
        });
        return;
      }
      showSuccessDialog('ios');
      toast(t('toastShareUnsupported'), 4200);
      return;
    }

    var a = document.createElement('a');
    a.href = lastFileUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showSuccessDialog('download');
  }

  function startDownload(type, name, prebuilt) {
    var filename = name + '.' + type;
    if (prebuilt) {
      finishExport(new File([prebuilt], filename, {
        type: prebuilt.type || 'application/octet-stream'
      }), filename);
      return;
    }
    var value = resultText.value;
    var build = type === 'docx' ? buildDocx : buildTxt;
    Promise.resolve()
      .then(function () { return ensureExportLibs(type); })
      .then(function () { return build(value); })
      .then(function (blob) {
        finishExport(new File([blob], filename, {
          type: blob.type || 'application/octet-stream'
        }), filename);
      })
      .catch(function (err) {
        console.error(err);
        toast(t('toastErrExport'), 4200);
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

  function autoFileName() {
    var now = new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return two(now.getDate()) + '.' + two(now.getMonth() + 1) + '.' +
      now.getFullYear() + ' ' + two(now.getHours()) + '.' +
      two(now.getMinutes()) + '-Textrec';
  }

  function saveWithAutoName(type) {
    pendingType = type;
    var value = resultText.value;
    var prebuilt = (prebuiltValue === value && prebuiltExports[type]) || null;
    startDownload(type, autoFileName(), prebuilt);
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
    prebuildExports(resultText.value);
    setFabsCollapsed(true);
    dialogOpen(docTypeDialog);
  });

  function prefetchExportOnIntent(el, type) {
    var load = function () { ensureExportLibs(type).catch(function () {}); };
    el.addEventListener('pointerenter', load, { passive: true });
    el.addEventListener('pointerdown', load, { passive: true });
  }

  prefetchExportOnIntent(docWord, 'docx');

  docWord.addEventListener('click', function () {
    dialogClose(docTypeDialog);
    saveWithAutoName('docx');
  });

  docText.addEventListener('click', function () {
    dialogClose(docTypeDialog);
    saveWithAutoName('txt');
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
    if (ext !== 'txt') {
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
    navigator.share({ files: [lastFile], title: lastFile.name }).then(function () {
      toast(t('toastShareSuccess'), 3600);
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        toast(t('toastShareCancelled'), 3600);
        return;
      }
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

  initMobileShell();

  function initMobileShell() {
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
    var editableSelector = 'input, textarea, select, [contenteditable="true"], .selectable';
    var pinchSelector = '.cropper-container';
    var isEditable = function (target) {
      return target instanceof Element && target.closest(editableSelector);
    };
    var isPinchAllowed = function (target) {
      return target instanceof Element && target.closest(pinchSelector);
    };

    var stopGesture = function (event) {
      if (!isPinchAllowed(event.target)) event.preventDefault();
    };
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
      document.addEventListener(type, stopGesture, { passive: false });
    });

    document.addEventListener('touchmove', function (event) {
      if (event.touches.length > 1 && !isPinchAllowed(event.target)) event.preventDefault();
    }, { passive: false });

    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
      if (event.touches.length > 0 || isPinchAllowed(event.target)) return;
      var interactive = event.target instanceof Element &&
        event.target.closest('button, a, label, input, textarea, select, [role="button"], [contenteditable="true"], .selectable');
      if (interactive) return;
      var now = Date.now();
      if (now - lastTouchEnd < 320) event.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });

    document.addEventListener('contextmenu', function (event) {
      if (isEditable(event.target)) return;
      event.preventDefault();
    });

    document.addEventListener('selectstart', function (event) {
      if (isEditable(event.target)) return;
      event.preventDefault();
    });

    document.addEventListener('dragstart', function (event) {
      if (isEditable(event.target)) return;
      event.preventDefault();
    });
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
    var swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (swRefreshing) return;
      swRefreshing = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (registration) {
      if (registration && registration.update) registration.update().catch(function () {});
    }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
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
  initOcrLang();
  updateAccuracyUI();
  updateLastResultButton();

  if (window.matchMedia) {
    var resultMq = window.matchMedia('(min-width: 700px)');
    if (resultMq.addEventListener) resultMq.addEventListener('change', updateLastResultButton);
    else if (resultMq.addListener) resultMq.addListener(updateLastResultButton);
  }

  window.addEventListener('resize', function () {
    if (!resultView.hidden) fitPreview(false);
    updateAccuracyUI();
  });

  if (location.protocol === 'file:') {
    toast(t('toastErrFileProtocol'), 9000);
  }
})();
