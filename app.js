(function () {
  'use strict';

  var STR = window.TEXTREC_STR;
  var OCR_LANGS = ['tur', 'eng'];

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
  var workerKey = null;
  var busy = false;
  var cropper = null;
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

  function pickFile(file) {
    if (!file || busy) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast(t('toastNotImage'));
      return;
    }
    setImage(file);
    cropDialog.hidden = false;
  }

  function goHome() {
    cropDialog.hidden = true;
    cropScreen.hidden = true;
    loadingDialog.hidden = true;
    warnDialog.hidden = true;
    docTypeDialog.hidden = true;
    nameDialog.hidden = true;
    successDialog.hidden = true;
    if (cropper) { cropper.destroy(); cropper = null; }
    if (lastFileUrl) { URL.revokeObjectURL(lastFileUrl); lastFileUrl = null; }
    lastFile = null;
    resultView.hidden = true;
    homeView.hidden = false;
    backBtn.hidden = true;
    appbarTitle.textContent = t('appbarTitle');
    clearImage();
  }

  function openCropScreen() {
    cropImage.src = imageUrl;
    cropScreen.hidden = false;
    if (cropper) { cropper.destroy(); cropper = null; }
    cropper = new Cropper(cropImage, {
      viewMode: 1,
      autoCropArea: 0.92,
      background: false,
      responsive: true,
      dragMode: 'move',
      guides: false
    });
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
    cropScreen.hidden = true;
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

  function ensureWorker(langs) {
    var key = langs.join('+');
    if (worker && workerKey === key) return Promise.resolve(worker);
    var kill = Promise.resolve();
    if (worker) {
      kill = worker.terminate().catch(function () {});
      worker = null;
      workerKey = null;
    }
    return kill.then(function () {
      return Tesseract.createWorker(langs, 1, {
        workerPath: 'vendor/tesseract/worker.min.js',
        corePath: 'vendor/tesseract/core',
        langPath: 'vendor/tessdata',
        cacheMethod: 'none'
      });
    }).then(function (w) {
      worker = w;
      workerKey = key;
      return w;
    }).catch(function (err) {
      worker = null;
      workerKey = null;
      throw err;
    });
  }

  function ocrParagraphs(data) {
    var blocks = data && data.blocks;
    if (!blocks || !blocks.length) return '';
    var paras = [];
    blocks.forEach(function (block) {
      (block.paragraphs || []).forEach(function (para) {
        var merged = '';
        (para.lines || []).forEach(function (line) {
          var t = (line.text || '').replace(/\s+/g, ' ').trim();
          if (!t) return;
          if (!merged) { merged = t; return; }
          if (/[A-Za-zÇĞİÖŞÜçğıöşü]-$/.test(merged) && /^[a-zçğıöşü]/.test(t)) {
            merged = merged.slice(0, -1) + t;
          } else {
            merged += ' ' + t;
          }
        });
        if (merged) paras.push(merged);
      });
    });
    return paras.join('\n\n');
  }

  function runOcrFlow() {
    if (location.protocol === 'file:') {
      toast(t('toastErrFileProtocol'), 9000);
      goHome();
      return;
    }
    busy = true;
    loadingDialog.hidden = false;
    ensureWorker(OCR_LANGS)
      .then(function (w) {
        return prepareImage(imageFile).then(function (blob) {
          return w.recognize(blob, {}, { text: true, blocks: true });
        });
      })
      .then(function (res) {
        var data = res && res.data ? res.data : {};
        var text = ocrParagraphs(data);
        if (!text && data.text) text = data.text;
        text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        busy = false;
        loadingDialog.hidden = true;
        if (!text) {
          warnDialog.hidden = false;
          return;
        }
        showResult(text);
      })
      .catch(function (err) {
        console.error(err);
        busy = false;
        loadingDialog.hidden = true;
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
    homeView.hidden = true;
    resultView.hidden = false;
    backBtn.hidden = false;
    appbarTitle.textContent = t('resultTitle');
  }

  cropYes.addEventListener('click', function () {
    cropDialog.hidden = true;
    openCropScreen();
  });

  cropNo.addEventListener('click', function () {
    cropDialog.hidden = true;
    runOcrFlow();
  });

  cropCancel.addEventListener('click', function () {
    if (cropper) { cropper.destroy(); cropper = null; }
    cropScreen.hidden = true;
    clearImage();
  });

  cropConfirm.addEventListener('click', finishCrop);

  warnOk.addEventListener('click', goHome);

  warnDialog.addEventListener('click', function (e) {
    if (e.target === warnDialog) goHome();
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
        successDialog.hidden = false;
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
    nameDialog.hidden = false;
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
    docTypeDialog.hidden = false;
  });

  docWord.addEventListener('click', function () {
    docTypeDialog.hidden = true;
    showNameDialog('docx');
  });

  docPdf.addEventListener('click', function () {
    docTypeDialog.hidden = true;
    showNameDialog('pdf');
  });

  docText.addEventListener('click', function () {
    docTypeDialog.hidden = true;
    showNameDialog('txt');
  });

  nameSave.addEventListener('click', function () {
    var v = (nameInput.value || '').trim();
    if (!v) {
      nameError.hidden = false;
      return;
    }
    nameDialog.hidden = true;
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

  succOpen.addEventListener('click', function () {
    if (lastFileUrl) window.open(lastFileUrl, '_blank');
  });

  succShare.addEventListener('click', function () {
    if (!lastFile || !navigator.share || !navigator.canShare) return;
    if (!navigator.canShare({ files: [lastFile] })) return;
    navigator.share({ files: [lastFile], title: lastFile.name }).catch(function () {});
  });

  succClose.addEventListener('click', function () {
    successDialog.hidden = true;
  });

  docTypeDialog.addEventListener('click', function (e) {
    if (e.target === docTypeDialog) docTypeDialog.hidden = true;
  });

  nameDialog.addEventListener('click', function (e) {
    if (e.target === nameDialog) nameDialog.hidden = true;
  });

  successDialog.addEventListener('click', function (e) {
    if (e.target === successDialog) successDialog.hidden = true;
  });

  if (!(navigator.share && navigator.canShare)) {
    succShare.hidden = true;
  }

  window.addEventListener('pagehide', function () {
    if (worker) {
      worker.terminate();
      worker = null;
      workerKey = null;
    }
  });

  applyLang();

  if (location.protocol === 'file:') {
    toast(t('toastErrFileProtocol'), 9000);
  }
})();
