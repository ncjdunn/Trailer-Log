document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('logForm');
  const entriesEl = document.getElementById('entries');
  const axlesSelect = document.getElementById('axles');
  const axleWeightsContainer = document.getElementById('axleWeightsContainer');

  const truckWeightInput = document.getElementById('truckWeight');
  const emptyTrailerWeightInput = document.getElementById('emptyTrailerWeight');
  const totalWeightInput = document.getElementById('truckAndTrailerWeight');
  const netPayloadInput = document.getElementById('netPayload');
  const heightBeforeInput = document.getElementById('heightBeforeVacuum');
  const heightAfterInput = document.getElementById('heightAfterVacuum');

  const trailerTypeInput = document.getElementById('trailerType');
  const trailerLengthInput = document.getElementById('trailerLength');
  const trailerNumberInput = document.getElementById('trailerNumber');
  const tubeNumberInput = document.getElementById('tubeNumber');
  const destinationInput = document.getElementById('destination');
  const departureDateInput = document.getElementById('departureDate');
  const notesInput = document.getElementById('notes');
  const linerLengthInput = document.getElementById('linerLength');
  const linerWidthInput = document.getElementById('linerWidth');
  const linerGaugeInput = document.getElementById('linerGauge');

  const browseMediaBtn = document.getElementById('browseMediaBtn');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const recordVideoBtn = document.getElementById('recordVideoBtn');
  const clearPendingMediaBtn = document.getElementById('clearPendingMediaBtn');
  const mediaFilesInput = document.getElementById('mediaFiles');
  const photoCaptureInput = document.getElementById('photoCaptureInput');
  const videoCaptureInput = document.getElementById('videoCaptureInput');
  const selectedMediaInfo = document.getElementById('selectedMediaInfo');
  const pendingMediaPreview = document.getElementById('pendingMediaPreview');
  const attachedMediaSection = document.getElementById('attachedMediaSection');
  const topOpenConstructionSheetBtn = document.getElementById('topOpenConstructionSheetBtn');
  const topDownloadConstructionSheetBtn = document.getElementById('topDownloadConstructionSheetBtn');
  const takeConstructionSheetBtn = document.getElementById('takeConstructionSheetBtn');
  const uploadConstructionSnapshotBtn = document.getElementById('uploadConstructionSnapshotBtn');
  const uploadConstructionSheetBtn = document.getElementById('uploadConstructionSheetBtn');
  const removeConstructionSheetBtn = document.getElementById('removeConstructionSheetBtn');
  const removeConstructionSheetFileBtn = document.getElementById('removeConstructionSheetFileBtn');
  const constructionSheetCaptureInput = document.getElementById('constructionSheetCaptureInput');
  const constructionSnapshotUploadInput = document.getElementById('constructionSnapshotUploadInput');
  const constructionSheetUploadInput = document.getElementById('constructionSheetUploadInput');
  const constructionSheetStatus = document.getElementById('constructionSheetStatus');
  const takeCutSheetBtn = document.getElementById('takeCutSheetBtn');
  const viewCutSheetBtn = document.getElementById('viewCutSheetBtn');
  const removeCutSheetBtn = document.getElementById('removeCutSheetBtn');
  const cutSheetCaptureInput = document.getElementById('cutSheetCaptureInput');
  const cutSheetStatus = document.getElementById('cutSheetStatus');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editingIdInput = document.getElementById('editingId');
  const saveBtn = document.getElementById('saveBtn');
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const statusMessage = document.getElementById('statusMessage');
  const installAppBtn = document.getElementById('installAppBtn');
  const installMessage = document.getElementById('installMessage');

  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const statCount = document.getElementById('statCount');
  const statShown = document.getElementById('statShown');
  const statLastSaved = document.getElementById('statLastSaved');

  const STORAGE_KEY = 'trailerLogs';
  const DB_NAME = 'TrailerWeightLoggerDB';
  const DB_VERSION = 3;
  const MEDIA_STORE = 'media';

  let dbPromise = null;
  let activeObjectUrls = [];
  let pendingMedia = [];
  let pendingConstructionSheet = null;
  let pendingConstructionSheetFile = null;
  let pendingCutSheet = null;
  let deferredInstallPrompt = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '-';
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  function formatDateOnly(value) {
    if (!value) return '-';
    const d = new Date(value + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? escapeHtml(value) : d.toLocaleDateString();
  }

  function getSpecialMediaItem(items, role) {
    return (items || []).find(function (item) { return item.role === role; }) || null;
  }

  function getRegularMediaItems(items) {
    return (items || []).filter(function (item) { return item.role !== 'construction-sheet' && item.role !== 'construction-sheet-file' && item.role !== 'cut-sheet'; });
  }

  function getConstructionSheetItem(items) {
    return getSpecialMediaItem(items, 'construction-sheet');
  }

  function getConstructionSheetFileItem(items) {
    return getSpecialMediaItem(items, 'construction-sheet-file');
  }

  function getCutSheetItem(items) {
    return getSpecialMediaItem(items, 'cut-sheet');
  }

  function formatLinerValue(value, unit) {
    if (value == null || value === '') return '—';
    return escapeHtml(value) + (unit ? ' ' + unit : '');
  }

  function setStatus(message, type) {
    statusMessage.textContent = message || '';
    statusMessage.className = 'status' + (type ? ' ' + type : '');
  }

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function updateInstallUi() {
    if (!installAppBtn) return;

    if (isStandaloneMode()) {
      installAppBtn.textContent = 'Installed';
      installAppBtn.disabled = true;
      if (installMessage) installMessage.textContent = 'This app is already installed on this device.';
      return;
    }

    installAppBtn.textContent = 'Install to Device';
    installAppBtn.disabled = false;

    if (deferredInstallPrompt) {
      if (installMessage) installMessage.textContent = 'Ready to install on this device.';
    } else {
      if (installMessage) installMessage.textContent = 'Open the hosted site directly in Chrome or Edge. If this button does not prompt, use the browser menu to install.';
    }
  }

  function isSpreadsheetType(type, name) {
    const safeType = String(type || '').toLowerCase();
    const safeName = String(name || '').toLowerCase();
    return safeType.indexOf('macroenabled') !== -1 || safeType.indexOf('spreadsheetml') !== -1 || safeName.endsWith('.xlsm');
  }

  function isPreviewableMedia(type, name) {
    const safeType = String(type || '').toLowerCase();
    return safeType.startsWith('image/') || safeType.startsWith('video/');
  }

  function downloadBlobFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function openSpreadsheetBlobInViewer(blob, description, options) {
    const dataUrl = await blobToDataUrl(blob);
    const tempKey = 'temp-sheet-' + uid();
    const viewerOptions = options || {};
    try {
      sessionStorage.setItem(tempKey, JSON.stringify({
        dataUrl: dataUrl,
        type: blob && blob.type ? blob.type : 'application/vnd.ms-excel.sheet.macroenabled.12',
        description: description || '',
        title: viewerOptions.title || 'Spreadsheet Viewer',
        fileName: viewerOptions.fileName || ''
      }));
    } catch (err) {
      console.error(err);
      setStatus('Could not open this spreadsheet preview.', 'error');
      return;
    }
    const params = new URLSearchParams({ tempKey: tempKey, returnUrl: window.location.href });
    if (viewerOptions.title) params.set('title', viewerOptions.title);
    window.location.assign('./spreadsheet-viewer.html?' + params.toString());
  }

  function openSavedSpreadsheetViewer(mediaId, options) {
    if (!mediaId) return;
    const viewerOptions = options || {};
    const params = new URLSearchParams({ mediaId: mediaId, returnUrl: window.location.href });
    if (viewerOptions.title) params.set('title', viewerOptions.title);
    window.location.assign('./spreadsheet-viewer.html?' + params.toString());
  }

  async function openConstructionSheetSnapshotItem(item) {
    if (!item || !item.file) return;
    await openBlobInViewer(item.file, item.file.type, item.description || 'Construction sheet', { landscape: true, title: 'Construction Sheet' });
  }

  async function downloadConstructionSheetFileItem(item) {
    if (!item || !item.file) return;
    downloadBlobFile(item.file, item.file.name || 'construction-sheet.xlsm');
  }

  async function downloadSavedConstructionSheetFile(item) {
    if (!item || !item.blob) return;
    downloadBlobFile(item.blob, item.name || 'construction-sheet.xlsm');
  }

  async function openConstructionSheetItem(item) {
    if (!item || !item.file) return;
    await openConstructionSheetSnapshotItem(item);
  }

  async function openSavedConstructionSheetItem(item) {
    if (!item) return;
    openSavedMediaViewer(item.id, { landscape: true, title: 'Construction Sheet' });
  }

  function describeConstructionSheetSnapshotItem(item) {
    if (!item) return 'No construction sheet snapshot attached.';
    const isPending = Boolean(item.file);
    return isPending ? 'New construction sheet snapshot ready to save with this log.' : 'Construction sheet snapshot attached to this log.';
  }

  function describeConstructionSheetFileItem(item) {
    if (!item) return 'No construction sheet XLSM attached.';
    const isPending = Boolean(item.file);
    return isPending ? 'New construction sheet XLSM ready to save with this log.' : 'Construction sheet XLSM attached to this log.';
  }

  async function openBlobInViewer(blob, type, description, options) {
    const dataUrl = await blobToDataUrl(blob);
    const tempKey = 'temp-media-' + uid();
    const viewerOptions = options || {};
    try {
      sessionStorage.setItem(tempKey, JSON.stringify({
        dataUrl: dataUrl,
        type: type || 'application/octet-stream',
        description: description || '',
        landscape: Boolean(viewerOptions.landscape),
        title: viewerOptions.title || ''
      }));
    } catch (err) {
      console.error(err);
      setStatus('Could not open this media preview.', 'error');
      return;
    }
    const params = new URLSearchParams({ tempKey: tempKey, returnUrl: window.location.href });
    if (viewerOptions.landscape) params.set('landscape', '1');
    if (viewerOptions.title) params.set('title', viewerOptions.title);
    window.location.assign('./media-viewer.html?' + params.toString());
  }

  function openSavedMediaViewer(mediaId, options) {
    if (!mediaId) return;
    const viewerOptions = options || {};
    const params = new URLSearchParams({ mediaId: mediaId, returnUrl: window.location.href });
    if (viewerOptions.landscape) params.set('landscape', '1');
    if (viewerOptions.title) params.set('title', viewerOptions.title);
    window.location.assign('./media-viewer.html?' + params.toString());
  }

  async function openPendingMediaViewer(targetId) {
    const item = pendingMedia.find(function (media) { return media.localId === targetId; });
    if (!item) return;
    await openBlobInViewer(item.file, item.file.type, item.description || '');
  }

  async function openPendingConstructionSheetViewer() {
    if (!pendingConstructionSheet) return;
    await openConstructionSheetItem(pendingConstructionSheet);
  }

  async function openPendingCutSheetViewer() {
    if (!pendingCutSheet) return;
    await openBlobInViewer(pendingCutSheet.file, pendingCutSheet.file.type, pendingCutSheet.description || 'Cut sheet', { landscape: true, title: 'Cut Sheet' });
  }

  function getEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  function setEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        let store;
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          store = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        } else {
          store = request.transaction.objectStore(MEDIA_STORE);
        }
        if (store && !store.indexNames.contains('logId')) {
          store.createIndex('logId', 'logId', { unique: false });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });

    return dbPromise;
  }

  async function getMediaForLog(logId) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      let request;

      try {
        if (store.indexNames.contains('logId')) {
          request = store.index('logId').getAll(logId);
        } else {
          request = store.getAll();
        }
      } catch (err) {
        request = store.getAll();
      }

      request.onsuccess = function () {
        let results = request.result || [];
        if (!Array.isArray(results)) results = [];
        results = results.filter(function (item) { return item && item.logId === logId; });
        results.sort(function (a, b) {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });
        resolve(results);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  async function getAllMedia() {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.getAll();
      request.onsuccess = function () {
        resolve(request.result || []);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  async function saveMediaRecords(records) {
    if (!records || !records.length) return;
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      records.forEach(function (record) {
        store.put(record);
      });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  async function saveMediaForLog(logId, items) {
    if (!items || !items.length) return [];

    const records = items.map(function (item) {
      return {
        id: uid(),
        logId: logId,
        name: item.file.name,
        type: item.file.type || 'application/octet-stream',
        size: item.file.size || 0,
        description: item.description || '',
        source: item.source || 'files',
        role: item.role || 'general',
        createdAt: new Date().toISOString(),
        blob: item.file
      };
    });

    await saveMediaRecords(records);
    return records;
  }

  async function deleteMediaForLog(logId) {
    const db = await openDb();
    const items = await getMediaForLog(logId);
    if (!items.length) return;

    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      items.forEach(function (item) {
        store.delete(item.id);
      });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  async function deleteMediaRecordById(mediaId) {
    if (!mediaId) return;
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.delete(mediaId);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function deleteSpecialMediaForLog(logId, role) {
    if (!logId || !role) return;
    const items = await getMediaForLog(logId);
    const specialItems = items.filter(function (item) { return item.role === role; });
    if (!specialItems.length) return;
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      specialItems.forEach(function (item) { store.delete(item.id); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  async function deleteConstructionSheetForLog(logId) {
    return deleteSpecialMediaForLog(logId, 'construction-sheet');
  }

  async function deleteConstructionSheetFileForLog(logId) {
    return deleteSpecialMediaForLog(logId, 'construction-sheet-file');
  }

  async function deleteCutSheetForLog(logId) {
    return deleteSpecialMediaForLog(logId, 'cut-sheet');
  }

  async function getSpecialMediaForLog(logId, role) {
    return getSpecialMediaItem(await getMediaForLog(logId), role);
  }

  async function getConstructionSheetForLog(logId) {
    return getSpecialMediaForLog(logId, 'construction-sheet');
  }

  async function getConstructionSheetFileForLog(logId) {
    return getSpecialMediaForLog(logId, 'construction-sheet-file');
  }

  async function getCutSheetForLog(logId) {
    return getSpecialMediaForLog(logId, 'cut-sheet');
  }

  async function getMediaRecordById(mediaId) {
    if (!mediaId) return null;
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.get(mediaId);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function updateMediaDescription(mediaId, description) {
    const existing = await getMediaRecordById(mediaId);
    if (!existing) throw new Error('Media not found.');
    existing.description = description || '';
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.put(existing);
      request.onsuccess = function () { resolve(existing); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function clearAllMedia() {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.clear();
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function revokeObjectUrls() {
    activeObjectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    activeObjectUrls = [];
  }

  function clearPendingMediaInputs() {
    mediaFilesInput.value = '';
    photoCaptureInput.value = '';
    videoCaptureInput.value = '';
  }

  function clearPendingConstructionSheetInput() {
    constructionSheetCaptureInput.value = '';
    if (constructionSnapshotUploadInput) constructionSnapshotUploadInput.value = '';
  }

  function clearPendingConstructionSheetFileInput() {
    if (constructionSheetUploadInput) constructionSheetUploadInput.value = '';
  }

  function clearPendingCutSheetInput() {
    cutSheetCaptureInput.value = '';
  }

  async function refreshConstructionSheetUi() {
    let existingSnapshot = null;
    let existingFile = null;
    if (editingIdInput.value) {
      try {
        if (!pendingConstructionSheet) existingSnapshot = await getConstructionSheetForLog(editingIdInput.value);
        if (!pendingConstructionSheetFile) existingFile = await getConstructionSheetFileForLog(editingIdInput.value);
      } catch (err) {
        console.error(err);
      }
    }

    const statusParts = [];
    const activeSnapshot = pendingConstructionSheet || existingSnapshot;
    const activeFile = pendingConstructionSheetFile || existingFile;

    if (activeSnapshot) {
      statusParts.push(describeConstructionSheetSnapshotItem(activeSnapshot));
      topOpenConstructionSheetBtn.hidden = false;
      removeConstructionSheetBtn.hidden = false;
    } else {
      topOpenConstructionSheetBtn.hidden = true;
      removeConstructionSheetBtn.hidden = true;
    }

    if (activeFile) {
      statusParts.push(describeConstructionSheetFileItem(activeFile));
      if (topDownloadConstructionSheetBtn) topDownloadConstructionSheetBtn.hidden = false;
      if (removeConstructionSheetFileBtn) removeConstructionSheetFileBtn.hidden = false;
    } else {
      if (topDownloadConstructionSheetBtn) topDownloadConstructionSheetBtn.hidden = true;
      if (removeConstructionSheetFileBtn) removeConstructionSheetFileBtn.hidden = true;
    }

    constructionSheetStatus.innerHTML = statusParts.length ? statusParts.map(function (part) { return escapeHtml(part); }).join('<br>') : 'No construction sheet snapshot or XLSM attached.';
  }

  async function refreshCutSheetUi() {
    let existingSheet = null;
    if (!pendingCutSheet && editingIdInput.value) {
      try {
        existingSheet = await getCutSheetForLog(editingIdInput.value);
      } catch (err) {
        console.error(err);
      }
    }

    if (pendingCutSheet) {
      cutSheetStatus.textContent = 'New cut sheet photo ready to save with this log.';
      viewCutSheetBtn.hidden = false;
      removeCutSheetBtn.hidden = false;
      return;
    }

    if (existingSheet) {
      cutSheetStatus.textContent = 'Cut sheet photo attached to this log.';
      viewCutSheetBtn.hidden = false;
      removeCutSheetBtn.hidden = false;
      return;
    }

    cutSheetStatus.textContent = 'No cut sheet attached.';
    viewCutSheetBtn.hidden = true;
    removeCutSheetBtn.hidden = true;
  }

  function clearPendingConstructionSheet() {
    pendingConstructionSheet = null;
    clearPendingConstructionSheetInput();
    refreshConstructionSheetUi();
  }

  function clearPendingConstructionSheetFile() {
    pendingConstructionSheetFile = null;
    clearPendingConstructionSheetFileInput();
    refreshConstructionSheetUi();
  }

  function clearPendingCutSheet() {
    pendingCutSheet = null;
    clearPendingCutSheetInput();
    refreshCutSheetUi();
  }

  function clearPendingMedia() {
    pendingMedia = [];
    clearPendingMediaInputs();
    renderPendingMediaPreview();
  }

  function recalcComputedFields() {
    const axleCount = parseInt(axlesSelect.value, 10) || 0;
    let total = 0;

    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      if (el && el.value !== '') {
        const v = parseFloat(el.value);
        if (!Number.isNaN(v)) total += v;
      }
    }

    totalWeightInput.value = total > 0 ? String(total) : '';

    const truckWeight = parseFloat(truckWeightInput.value);
    const emptyTrailerWeight = parseFloat(emptyTrailerWeightInput.value);
    if (total > 0 && Number.isFinite(truckWeight) && Number.isFinite(emptyTrailerWeight)) {
      const payload = total - truckWeight - emptyTrailerWeight;
      netPayloadInput.value = Number.isFinite(payload) ? String(payload) : '';
    } else {
      netPayloadInput.value = '';
    }
  }

  function renderAxleInputs(count, existingWeights) {
    axleWeightsContainer.innerHTML = '';
    if (!count) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'axle-grid';

    for (let i = 1; i <= count; i++) {
      const label = document.createElement('label');
      label.textContent = 'Axle ' + i + ' weight (lbs)';

      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.id = 'axleWeight_' + i;
      input.inputMode = 'decimal';
      if (existingWeights && existingWeights[i - 1] != null) {
        input.value = existingWeights[i - 1];
      }
      input.addEventListener('input', recalcComputedFields);

      label.appendChild(input);
      wrapper.appendChild(label);
    }

    axleWeightsContainer.appendChild(wrapper);
  }

  function addPendingFiles(fileList, source) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach(function (file) {
      pendingMedia.push({
        localId: uid(),
        file: file,
        source: source || 'files',
        description: '',
        role: 'general'
      });
    });

    clearPendingMediaInputs();
    renderPendingMediaPreview();
  }

  function renderPendingMediaPreview() {
    if (!pendingMedia.length) {
      selectedMediaInfo.textContent = 'No new media selected yet.';
      pendingMediaPreview.innerHTML = '';
      return;
    }

    selectedMediaInfo.textContent = pendingMedia.length + (pendingMedia.length === 1 ? ' pending item selected.' : ' pending items selected.');

    const html = pendingMedia.map(function (item) {
      const objectUrl = URL.createObjectURL(item.file);
      activeObjectUrls.push(objectUrl);
      const preview = item.file.type.startsWith('video/')
        ? '<video preload="metadata" muted playsinline src="' + objectUrl + '"></video>'
        : '<img src="' + objectUrl + '" alt="' + escapeHtml(item.file.name) + '">';
      return (
        '<div class="pending-media-card" style="margin-top:12px">' +
          '<button type="button" class="media-open-btn pending-open-media" data-id="' + escapeHtml(item.localId) + '" aria-label="Open media full screen">' + preview + '</button>' +
          '<div class="pending-media-body">' +
            '<label class="pending-note-input"><input type="text" class="pending-media-note" data-id="' + escapeHtml(item.localId) + '" maxlength="140" placeholder="Add media note..." value="' + escapeHtml(item.description || '') + '"></label>' +
            ((item.description || '').trim() ? '<div class="media-desc">' + escapeHtml(item.description.trim()) + '</div>' : '') +
            '<div class="pending-media-actions">' +
              '<button type="button" class="ghost small-btn remove-pending-media" data-id="' + escapeHtml(item.localId) + '">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    pendingMediaPreview.innerHTML = html;
  }

  async function renderAttachedMediaPreview() {
    if (!attachedMediaSection) return;

    const logId = editingIdInput.value;
    if (!logId) {
      attachedMediaSection.hidden = true;
      attachedMediaSection.innerHTML = '';
      return;
    }

    let mediaItems = [];
    try {
      mediaItems = getRegularMediaItems(await getMediaForLog(logId));
    } catch (err) {
      console.error(err);
      attachedMediaSection.hidden = true;
      attachedMediaSection.innerHTML = '';
      return;
    }

    if (!mediaItems.length) {
      attachedMediaSection.hidden = true;
      attachedMediaSection.innerHTML = '';
      return;
    }

    attachedMediaSection.hidden = false;
    attachedMediaSection.innerHTML = mediaItems.map(function (item) {
      const objectUrl = URL.createObjectURL(item.blob);
      activeObjectUrls.push(objectUrl);
      const preview = item.type && item.type.startsWith('video/')
        ? '<video preload="metadata" muted playsinline src="' + objectUrl + '"></video>'
        : '<img src="' + objectUrl + '" alt="Attached media">';
      const noteHtml = (item.description || '').trim()
        ? '<div class="media-desc">' + escapeHtml(item.description.trim()) + '</div>'
        : '';
      return (
        '<div class="media-card">' +
          '<button type="button" class="media-open-btn saved-open-media" data-media-id="' + escapeHtml(item.id) + '" aria-label="Open attached media full screen">' + preview + '</button>' +
          '<div class="media-card-body">' +
            noteHtml +
            '<div class="media-card-actions">' +
              '<button type="button" class="secondary small-btn edit-media-note" data-media-id="' + escapeHtml(item.id) + '" data-log-id="' + escapeHtml(logId) + '">Edit Note</button>' +
              '<button type="button" class="danger small-btn delete-media-item" data-media-id="' + escapeHtml(item.id) + '" data-log-id="' + escapeHtml(logId) + '">Delete Media</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function resetForm() {
    form.reset();
    editingIdInput.value = '';
    axleWeightsContainer.innerHTML = '';
    totalWeightInput.value = '';
    netPayloadInput.value = '';
    clearPendingMedia();
    clearPendingConstructionSheet();
    clearPendingConstructionSheetFile();
    clearPendingCutSheet();
    if (attachedMediaSection) {
      attachedMediaSection.hidden = true;
      attachedMediaSection.innerHTML = '';
    }
    cancelEditBtn.hidden = true;
    saveBtn.textContent = 'Save Final Log';
    saveDraftBtn.textContent = 'Save Draft';
  }

  function buildEntryFromForm(status) {
    const axleCount = parseInt(axlesSelect.value, 10) || 0;
    const axleWeights = [];
    for (let i = 1; i <= axleCount; i++) {
      const input = document.getElementById('axleWeight_' + i);
      const value = input ? input.value.trim() : '';
      axleWeights.push(value === '' ? null : Number(value));
    }

    const nowIso = new Date().toISOString();
    return {
      id: editingIdInput.value || uid(),
      status: status,
      tubeNumber: tubeNumberInput.value.trim(),
      destination: destinationInput.value.trim(),
      linerLength: linerLengthInput.value === '' ? null : Number(linerLengthInput.value),
      linerWidth: linerWidthInput.value === '' ? null : Number(linerWidthInput.value),
      linerGauge: linerGaugeInput.value === '' ? null : Number(linerGaugeInput.value),
      trailerType: trailerTypeInput.value.trim(),
      trailerLength: trailerLengthInput.value === '' ? null : Number(trailerLengthInput.value),
      trailerNumber: trailerNumberInput.value.trim(),
      truckWeight: truckWeightInput.value === '' ? null : Number(truckWeightInput.value),
      emptyTrailerWeight: emptyTrailerWeightInput.value === '' ? null : Number(emptyTrailerWeightInput.value),
      axles: axlesSelect.value === '' ? null : Number(axlesSelect.value),
      axleWeights: axleWeights,
      truckAndTrailerWeight: totalWeightInput.value === '' ? null : Number(totalWeightInput.value),
      netPayload: netPayloadInput.value === '' ? null : Number(netPayloadInput.value),
      heightBeforeVacuum: heightBeforeInput.value === '' ? null : Number(heightBeforeInput.value),
      heightAfterVacuum: heightAfterInput.value === '' ? null : Number(heightAfterInput.value),
      departureDate: departureDateInput.value,
      notes: notesInput.value.trim(),
      updatedAt: nowIso,
      createdAt: nowIso
    };
  }

  function hasDraftContent(entry) {
    return Boolean(
      entry.tubeNumber ||
      entry.destination ||
      entry.linerLength != null ||
      entry.linerWidth != null ||
      entry.linerGauge != null ||
      entry.trailerType ||
      entry.trailerLength != null ||
      entry.trailerNumber ||
      entry.truckWeight != null ||
      entry.emptyTrailerWeight != null ||
      entry.axles != null ||
      (entry.axleWeights || []).some(function (weight) { return weight != null; }) ||
      entry.heightBeforeVacuum != null ||
      entry.heightAfterVacuum != null ||
      entry.departureDate ||
      entry.notes ||
      pendingMedia.length ||
      pendingConstructionSheet ||
      pendingConstructionSheetFile ||
      pendingCutSheet
    );
  }

  function validateEntry(entry, mode) {
    if (mode === 'draft') {
      return hasDraftContent(entry) ? '' : 'Add at least one field or some media before saving a draft.';
    }

    if (!entry.tubeNumber) return 'Tube number is required for a final log.';
    if (!entry.destination) return 'Customer and destination are required for a final log.';
    if (!entry.trailerType) return 'Trailer type is required for a final log.';
    if (entry.truckWeight == null) return 'Truck weight is required for a final log.';
    if (entry.emptyTrailerWeight == null) return 'Empty trailer weight is required for a final log.';
    if (entry.axles == null) return 'Number of axles is required for a final log.';
    if ((entry.axleWeights || []).length !== entry.axles) return 'Enter each axle weight before saving a final log.';
    if (entry.axleWeights.some(function (weight) { return weight == null || !Number.isFinite(weight); })) {
      return 'Every axle needs a weight before saving a final log.';
    }
    return '';
  }

  function getMostRecentEntry() {
    const entries = getEntries().slice();
    if (!entries.length) return null;
    entries.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
    return entries[0] || null;
  }

  function autoOpenMostRecentEntry() {
    const latestEntry = getMostRecentEntry();
    if (!latestEntry) return false;
    populateFormForEdit(latestEntry);
    setStatus('Opened most recent ' + (latestEntry.status === 'draft' ? 'draft' : 'log') + ' for editing.', 'success');
    return true;
  }

  function getFilteredAndSortedEntries() {
    const search = searchInput.value.trim().toLowerCase();
    const sort = sortSelect.value;
    let entries = getEntries().slice();

    if (search) {
      entries = entries.filter(function (entry) {
        return [
          entry.status,
          entry.tubeNumber,
          entry.destination,
          entry.linerLength,
          entry.linerWidth,
          entry.linerGauge,
          entry.trailerType,
          entry.trailerNumber,
          entry.notes
        ].some(function (value) {
          return String(value || '').toLowerCase().includes(search);
        });
      });
    }

    entries.sort(function (a, b) {
      if (sort === 'created') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sort === 'tube') {
        return String(a.tubeNumber || '').localeCompare(String(b.tubeNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sort === 'status') {
        return String(a.status || '').localeCompare(String(b.status || '')) || (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      }
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    return entries;
  }

  async function loadEntries() {
    revokeObjectUrls();
    const allEntries = getEntries().slice().sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
    const entries = getFilteredAndSortedEntries();

    statCount.textContent = String(allEntries.length);
    statShown.textContent = String(entries.length);
    statLastSaved.textContent = allEntries.length ? formatDateTime(allEntries[0].updatedAt || allEntries[0].createdAt) : '—';

    if (!entries.length) {
      entriesEl.innerHTML = '<li class="empty-state">No entries yet.</li>';
      return;
    }

    const html = entries.map(function (entry) {
      return (
        '<li class="entry entry-openable" data-entry-id="' + escapeHtml(entry.id) + '">' +
          '<div class="entry-top entry-top-compact">' +
            '<div class="entry-summary">' +
              '<div class="entry-title">Tube ' + escapeHtml(entry.tubeNumber || '—') + '</div>' +
              '<div class="entry-meta entry-summary-line"><strong>Customer / Destination:</strong> ' + escapeHtml(entry.destination || '—') + '</div>' +
            '</div>' +
            '<div class="entry-open-hint">Tap to open</div>' +
          '</div>' +
          '<div class="entry-actions">' +
            '<button type="button" class="secondary share-entry" data-id="' + escapeHtml(entry.id) + '">Share</button>' +
            '<button type="button" class="secondary print-entry" data-id="' + escapeHtml(entry.id) + '">Print / PDF</button>' +
            '<button type="button" class="warning duplicate-entry" data-id="' + escapeHtml(entry.id) + '">Duplicate</button>' +
            '<button type="button" class="danger delete-entry" data-id="' + escapeHtml(entry.id) + '">Delete</button>' +
          '</div>' +
        '</li>'
      );
    });

    entriesEl.innerHTML = html.join('');
  }

  function populateFormForEdit(entry) {
    editingIdInput.value = entry.id;
    tubeNumberInput.value = entry.tubeNumber || '';
    destinationInput.value = entry.destination || '';
    linerLengthInput.value = entry.linerLength ?? '';
    linerWidthInput.value = entry.linerWidth ?? '';
    linerGaugeInput.value = entry.linerGauge ?? '';
    trailerTypeInput.value = entry.trailerType || '';
    trailerLengthInput.value = entry.trailerLength ?? '';
    trailerNumberInput.value = entry.trailerNumber || '';
    truckWeightInput.value = entry.truckWeight ?? '';
    emptyTrailerWeightInput.value = entry.emptyTrailerWeight ?? '';
    axlesSelect.value = entry.axles || '';
    renderAxleInputs(parseInt(entry.axles, 10) || 0, entry.axleWeights || []);
    totalWeightInput.value = entry.truckAndTrailerWeight ?? '';
    netPayloadInput.value = entry.netPayload ?? '';
    heightBeforeInput.value = entry.heightBeforeVacuum ?? '';
    heightAfterInput.value = entry.heightAfterVacuum ?? '';
    departureDateInput.value = entry.departureDate || '';
    notesInput.value = entry.notes || '';
    clearPendingMedia();
    clearPendingConstructionSheet();
    clearPendingConstructionSheetFile();
    clearPendingCutSheet();
    selectedMediaInfo.textContent = 'Existing attached media will stay unless you delete it. Any new files you add now will be attached when you save, and saved media notes can be edited below.';
    refreshConstructionSheetUi();
    refreshCutSheetUi();
    renderAttachedMediaPreview().catch(function (err) {
      console.error(err);
    });
    cancelEditBtn.hidden = false;
    saveBtn.textContent = entry.status === 'draft' ? 'Save Final Log' : 'Update Final Log';
    saveDraftBtn.textContent = 'Update Draft';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveOrUpdateEntry(entry, itemsToAttach) {
    const entries = getEntries();
    const existingIndex = entries.findIndex(function (item) { return item.id === entry.id; });

    if (existingIndex >= 0) {
      entry.createdAt = entries[existingIndex].createdAt;
      entries[existingIndex] = entry;
    } else {
      entries.unshift(entry);
    }

    if (itemsToAttach.some(function (item) { return item.role === 'construction-sheet'; })) {
      await deleteConstructionSheetForLog(entry.id);
    }

    if (itemsToAttach.some(function (item) { return item.role === 'construction-sheet-file'; })) {
      await deleteConstructionSheetFileForLog(entry.id);
    }

    if (itemsToAttach.some(function (item) { return item.role === 'cut-sheet'; })) {
      await deleteCutSheetForLog(entry.id);
    }

    if (itemsToAttach.length) {
      await saveMediaForLog(entry.id, itemsToAttach);
    }

    const mediaCount = (await getMediaForLog(entry.id)).length;
    entry.mediaCount = mediaCount;

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries[0] = entry;
    }

    setEntries(entries);
  }

  async function deleteEntry(entryId) {
    const entries = getEntries().filter(function (entry) { return entry.id !== entryId; });
    setEntries(entries);
    await deleteMediaForLog(entryId);
  }

  async function syncMediaCountForEntry(entryId) {
    const entries = getEntries();
    const index = entries.findIndex(function (entry) { return entry.id === entryId; });
    if (index < 0) return;
    entries[index].mediaCount = (await getMediaForLog(entryId)).length;
    setEntries(entries);
  }

  function buildExportPayload(entries) {
    return entries.map(function (entry) {
      const clone = Object.assign({}, entry);
      delete clone.mediaCount;
      return clone;
    });
  }

  function sanitizeFileNamePart(value, fallback) {
    const cleaned = String(value || '')
      .trim()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return cleaned || fallback;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function buildLogSharePayload(entry) {
    const media = await getMediaForLog(entry.id);
    const mediaPayload = await Promise.all(media.map(async function (item) {
      return {
        id: item.id,
        logId: item.logId,
        name: item.name,
        type: item.type,
        size: item.size,
        description: item.description,
        source: item.source || 'files',
        role: item.role || 'general',
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
        createdAt: item.createdAt,
        dataUrl: await blobToDataUrl(item.blob)
      };
    }));

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: buildExportPayload([entry]),
      media: mediaPayload
    };
  }

  function buildLogShareFilename(entry) {
    const tubePart = sanitizeFileNamePart(entry.tubeNumber, 'log');
    const destinationPart = sanitizeFileNamePart(entry.destination, 'destination');
    const date = new Date(entry.updatedAt || entry.createdAt || Date.now()).toISOString().slice(0, 10);
    return 'trailer-log-' + tubePart + '-' + destinationPart + '-' + date + '.json';
  }

  async function shareEntry(entry) {
    const payload = await buildLogSharePayload(entry);
    const json = JSON.stringify(payload, null, 2);
    const filename = buildLogShareFilename(entry);
    const blob = new Blob([json], { type: 'application/json' });

    const shareTitle = 'Trailer log ' + (entry.tubeNumber || 'export');
    const shareText = 'Trailer Weight Logger export for tube ' + (entry.tubeNumber || '—') + (entry.destination ? ' • ' + entry.destination : '') + '. Import the attached JSON file into the app to restore this log.';

    if (typeof File === 'function' && typeof navigator.share === 'function' && window.isSecureContext) {
      const file = new File([blob], filename, { type: 'application/json' });
      const shareData = {
        title: shareTitle,
        text: shareText,
        files: [file]
      };

      let canShareFiles = true;
      if (typeof navigator.canShare === 'function') {
        try {
          canShareFiles = navigator.canShare({ files: [file] });
        } catch (err) {
          canShareFiles = false;
        }
      }

      if (canShareFiles) {
        try {
          await navigator.share(shareData);
          setStatus('Log shared.', 'success');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') {
            setStatus('Share canceled.', 'warning');
            return;
          }
          console.warn('Native file share failed, trying text share fallback.', err);
        }
      }

      try {
        await navigator.share({
          title: shareTitle,
          text: shareText
        });
        downloadBlob(blob, filename);
        setStatus('Log details shared. The full JSON file was also downloaded to this device.', 'warning');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          setStatus('Share canceled.', 'warning');
          return;
        }
      }
    }

    downloadBlob(blob, filename);
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareTitle + '\n' + shareText);
        setStatus('This browser view could not open the native share sheet, so the log file was downloaded and a summary was copied to your clipboard.', 'warning');
        return;
      } catch (err) {}
    }

    setStatus('This browser view could not open the native share sheet, so the log file was downloaded instead.', 'warning');
  }

  async function buildPrintableMediaHtml(mediaItems) {
    if (!mediaItems.length) return '<p class="muted">No attached media.</p>';

    const blocks = await Promise.all(mediaItems.map(async function (item) {
      if (item.type && item.type.startsWith('image/') && item.blob) {
        const dataUrl = await blobToDataUrl(item.blob);
        return (
          '<div class="print-media-card">' +
            '<img src="' + dataUrl + '" alt="' + escapeHtml(item.name || 'Attached image') + '">' +
            '<div class="print-media-caption"><strong>' + escapeHtml(item.name || 'Image') + '</strong>' +
            (item.description ? '<div>' + escapeHtml(item.description) + '</div>' : '') +
            '<div class="muted">' + escapeHtml(item.source || 'media') + ' • ' + formatNumber(Math.round((item.size || 0) / 1024)) + ' KB</div></div>' +
          '</div>'
        );
      }
      return (
        '<div class="print-media-card print-media-file">' +
          '<div class="print-media-caption"><strong>' + escapeHtml(item.name || 'Video') + '</strong>' +
          (item.description ? '<div>' + escapeHtml(item.description) + '</div>' : '') +
          '<div class="muted">Video attachment • ' + formatNumber(Math.round((item.size || 0) / 1024)) + ' KB</div>' +
          '<div class="muted">Videos are listed in the PDF export but are not embedded in the print view.</div></div>' +
        '</div>'
      );
    }));

    return '<div class="print-media-grid">' + blocks.join('') + '</div>';
  }

  async function printEntry(entry) {
    const allMediaItems = await getMediaForLog(entry.id);
    const constructionSheet = getConstructionSheetItem(allMediaItems);
    const cutSheet = getCutSheetItem(allMediaItems);
    const mediaItems = getRegularMediaItems(allMediaItems);
    const axleSummary = entry.axleWeights && entry.axleWeights.length
      ? entry.axleWeights.map(function (weight, index) {
          return 'Axle ' + (index + 1) + ': ' + (weight != null ? formatNumber(weight) : '-') + ' lbs';
        }).join(' • ')
      : '—';

    const mediaHtml = await buildPrintableMediaHtml(mediaItems);
    const constructionSheetHtml = constructionSheet ? '<div class="section no-break"><strong>Construction Sheet</strong><br>Attached file stored with this log.</div>' : '';
    const cutSheetHtml = cutSheet ? '<div class="section no-break"><strong>Cut Sheet</strong><br>Attached photo stored with this log.</div>' : '';
    const statusLabel = entry.status === 'draft' ? 'Draft' : 'Final';
    const printableHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailer Log ' + escapeHtml(entry.tubeNumber || '') + '</title>' +
      '<style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;line-height:1.45;background:#fff}h1,h2,h3{margin:0 0 10px}h1{font-size:24px}h2{font-size:16px;margin-top:20px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #cfd6df;padding:8px;vertical-align:top;text-align:left}.muted{color:#5d6a78}.chip{display:inline-block;background:#eef3f8;border:1px solid #d6dee8;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;margin-bottom:10px}.notes,.section{margin-top:16px;padding:12px;border:1px solid #d8dee8;border-radius:12px;background:#fafcff}.print-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}.print-media-card{border:1px solid #d8dee8;border-radius:12px;overflow:hidden;background:#fff}.print-media-card img{display:block;width:100%;height:auto;max-height:320px;object-fit:contain;background:#f3f6f9}.print-media-caption{padding:10px;font-size:13px}.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.print-actions{margin:0 0 16px}.print-actions button{padding:10px 14px;border:1px solid #ccd6e3;background:#f4f7fb;border-radius:10px;font-weight:700;cursor:pointer}@media print{body{margin:12px}.print-actions{display:none}.no-break{break-inside:avoid;page-break-inside:avoid}}' +
      '</style></head><body>' +
      '<div class="print-actions"><button onclick="window.print()">Print / Save PDF</button></div>' +
      '<div class="chip">' + escapeHtml(statusLabel) + ' log</div>' +
      '<h1>Trailer Weight Logger Report</h1>' +
      '<div class="muted">Generated ' + escapeHtml(new Date().toLocaleString()) + '</div>' +
      '<div class="section no-break"><div class="summary-grid">' +
      '<div><strong>Tube Number</strong><br>' + escapeHtml(entry.tubeNumber || '—') + '</div>' +
      '<div><strong>Customer / Destination</strong><br>' + escapeHtml(entry.destination || '—') + '</div>' +
      '<div><strong>Liner Length</strong><br>' + escapeHtml(entry.linerLength ?? '—') + ' ft</div>' +
      '<div><strong>Liner Width</strong><br>' + escapeHtml(entry.linerWidth ?? '—') + ' in</div>' +
      '<div><strong>Liner Gauge</strong><br>' + escapeHtml(entry.linerGauge ?? '—') + ' mm</div>' +
      '<div><strong>Trailer Type</strong><br>' + escapeHtml(entry.trailerType || '—') + '</div>' +
      '<div><strong>Trailer Length</strong><br>' + escapeHtml(entry.trailerLength ?? '—') + ' ft</div>' +
      '<div><strong>Trailer Number</strong><br>' + escapeHtml(entry.trailerNumber || '—') + '</div>' +
      '<div><strong>Axles</strong><br>' + escapeHtml(entry.axles ?? '—') + '</div>' +
      '<div><strong>Created</strong><br>' + escapeHtml(formatDateTime(entry.createdAt)) + '</div>' +
      '<div><strong>Last Updated</strong><br>' + escapeHtml(formatDateTime(entry.updatedAt || entry.createdAt)) + '</div>' +
      '<div><strong>Departure Date</strong><br>' + escapeHtml(formatDateOnly(entry.departureDate)) + '</div>' +
      '</div></div>' +
      '<h2>Weights</h2><table class="no-break"><tr><th>Truck</th><th>Empty Trailer</th><th>Truck + Trailer</th><th>Net Payload</th></tr><tr><td>' + escapeHtml(formatNumber(entry.truckWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.emptyTrailerWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.truckAndTrailerWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.netPayload)) + ' lbs</td></tr></table>' +
      '<div class="section no-break"><strong>Axle Weights</strong><br>' + escapeHtml(axleSummary) + '</div>' +
      '<div class="section no-break"><strong>Vacuum Heights</strong><br>Before: ' + escapeHtml(entry.heightBeforeVacuum ?? '—') + ' ft • After: ' + escapeHtml(entry.heightAfterVacuum ?? '—') + ' ft</div>' +
      constructionSheetHtml +
      cutSheetHtml +
      (entry.notes ? '<div class="notes no-break"><strong>Notes</strong><br>' + escapeHtml(entry.notes).replace(/\n/g, '<br>') + '</div>' : '') +
      '<h2>Attached Media</h2>' + mediaHtml +
      '</body></html>';

    const htmlBlob = new Blob([printableHtml], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const printWindow = window.open(htmlUrl, '_blank');
    if (!printWindow) {
      URL.revokeObjectURL(htmlUrl);
      setStatus('Pop-up blocked. Allow pop-ups for this site to print or save PDF.', 'error');
      return;
    }

    setStatus('Print view opened. Use your browser print menu to print or save as PDF.', 'success');
    setTimeout(function () {
      URL.revokeObjectURL(htmlUrl);
    }, 60000);
  }

  function blobToDataUrl(blob) {

    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const meta = parts[0] || '';
    const match = meta.match(/data:(.*?);base64/);
    const mime = match ? match[1] : 'application/octet-stream';
    const binary = atob(parts[1] || '');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function exportBackup() {
    const data = getEntries();
    const media = await getAllMedia();

    if (!data.length && !media.length) {
      setStatus('No logs or media to export.', 'warning');
      return;
    }

    const mediaPayload = await Promise.all(media.map(async function (item) {
      return {
        id: item.id,
        logId: item.logId,
        name: item.name,
        type: item.type,
        size: item.size,
        description: item.description,
        source: item.source || 'files',
        role: item.role || 'general',
        rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
        createdAt: item.createdAt,
        dataUrl: await blobToDataUrl(item.blob)
      };
    }));

    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: buildExportPayload(data),
      media: mediaPayload
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(blob, 'trailer-log-backup-' + ts + '.json');
    setStatus('Backup exported with logs and attached media.', 'success');
  }

  async function importBackup(text) {
    const parsed = JSON.parse(text);
    const importedEntries = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.entries) ? parsed.entries : null);

    if (!importedEntries || !importedEntries.length) {
      throw new Error('No valid entries found.');
    }

    const existing = getEntries();
    const existingIds = new Set(existing.map(function (entry) { return entry.id; }));
    const idMap = new Map();

    const sanitizedEntries = importedEntries.map(function (entry) {
      const clone = Object.assign({}, entry);
      const originalId = clone.id || uid();
      if (!clone.id || existingIds.has(clone.id)) {
        clone.id = uid();
      }
      idMap.set(originalId, clone.id);
      clone.status = clone.status === 'draft' ? 'draft' : 'final';
      clone.createdAt = clone.createdAt || new Date().toISOString();
      clone.updatedAt = clone.updatedAt || clone.createdAt;
      delete clone.mediaCount;
      existingIds.add(clone.id);
      return clone;
    });

    setEntries(sanitizedEntries.concat(existing));

    const importedMedia = parsed && Array.isArray(parsed.media) ? parsed.media : [];
    if (importedMedia.length) {
      const records = importedMedia
        .filter(function (item) { return item && item.dataUrl; })
        .map(function (item) {
          return {
            id: uid(),
            logId: idMap.get(item.logId) || item.logId,
            name: item.name || 'media-file',
            type: item.type || 'application/octet-stream',
            size: item.size || 0,
            description: item.description || '',
            source: item.source || 'imported backup',
            role: item.role || 'general',
            createdAt: item.createdAt || new Date().toISOString(),
            blob: dataUrlToBlob(item.dataUrl)
          };
        });

      if (records.length) {
        await saveMediaRecords(records);
      }
    }

    await loadEntries();
    setStatus('Imported ' + sanitizedEntries.length + ' log(s).' + (importedMedia.length ? ' Attached media was restored too.' : ''), 'success');
  }

  async function saveCurrentEntry(mode) {
    const entry = buildEntryFromForm(mode);
    const error = validateEntry(entry, mode);
    if (error) {
      setStatus(error, 'error');
      return;
    }

    const pendingToAttach = pendingMedia.slice();
    if (pendingConstructionSheet) pendingToAttach.push(pendingConstructionSheet);
    if (pendingConstructionSheetFile) pendingToAttach.push(pendingConstructionSheetFile);
    if (pendingCutSheet) pendingToAttach.push(pendingCutSheet);
    const wasEditing = Boolean(editingIdInput.value);

    try {
      await saveOrUpdateEntry(entry, pendingToAttach);
      resetForm();
      await loadEntries();
      setStatus((mode === 'draft' ? 'Draft' : 'Log') + (wasEditing ? ' updated.' : ' saved.'), 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not save the entry. Large videos can exceed your browser storage limit.', 'error');
    }
  }

  axlesSelect.addEventListener('change', function () {
    renderAxleInputs(parseInt(axlesSelect.value, 10) || 0);
    recalcComputedFields();
  });

  [truckWeightInput, emptyTrailerWeightInput, heightBeforeInput, heightAfterInput].forEach(function (input) {
    input.addEventListener('input', recalcComputedFields);
  });

  browseMediaBtn.addEventListener('click', function () {
    mediaFilesInput.click();
  });

  takePhotoBtn.addEventListener('click', function () {
    photoCaptureInput.click();
  });

  recordVideoBtn.addEventListener('click', function () {
    videoCaptureInput.click();
  });

  takeConstructionSheetBtn.addEventListener('click', function () {
    constructionSheetCaptureInput.click();
  });

  if (uploadConstructionSnapshotBtn) {
    uploadConstructionSnapshotBtn.addEventListener('click', function () {
      constructionSnapshotUploadInput.click();
    });
  }

  if (uploadConstructionSheetBtn) {
    uploadConstructionSheetBtn.addEventListener('click', function () {
      constructionSheetUploadInput.click();
    });
  }

  topOpenConstructionSheetBtn.addEventListener('click', async function () {
    if (pendingConstructionSheet) {
      await openPendingConstructionSheetViewer();
      return;
    }
    if (!editingIdInput.value) return;
    const existingSheet = await getConstructionSheetForLog(editingIdInput.value);
    if (!existingSheet) {
      setStatus('No construction sheet snapshot is attached to this log yet.', 'warning');
      await refreshConstructionSheetUi();
      return;
    }
    await openSavedConstructionSheetItem(existingSheet);
  });

  if (topDownloadConstructionSheetBtn) {
    topDownloadConstructionSheetBtn.addEventListener('click', async function () {
      if (pendingConstructionSheetFile) {
        await downloadConstructionSheetFileItem(pendingConstructionSheetFile);
        return;
      }
      if (!editingIdInput.value) return;
      const existingFile = await getConstructionSheetFileForLog(editingIdInput.value);
      if (!existingFile) {
        setStatus('No construction sheet XLSM is attached to this log yet.', 'warning');
        await refreshConstructionSheetUi();
        return;
      }
      await downloadSavedConstructionSheetFile(existingFile);
    });
  }

  takeCutSheetBtn.addEventListener('click', function () {
    cutSheetCaptureInput.click();
  });

  viewCutSheetBtn.addEventListener('click', async function () {
    if (pendingCutSheet) {
      await openPendingCutSheetViewer();
      return;
    }
    if (!editingIdInput.value) return;
    const existingSheet = await getCutSheetForLog(editingIdInput.value);
    if (!existingSheet) {
      setStatus('No cut sheet is attached to this log yet.', 'warning');
      await refreshCutSheetUi();
      return;
    }
    openSavedMediaViewer(existingSheet.id, { landscape: true, title: 'Cut Sheet' });
  });

  removeConstructionSheetBtn.addEventListener('click', async function () {
    if (pendingConstructionSheet) {
      const ok = confirm('Remove the new construction sheet snapshot before saving?');
      if (!ok) return;
      clearPendingConstructionSheet();
      setStatus('Pending construction sheet snapshot removed.', 'warning');
      return;
    }

    if (!editingIdInput.value) return;
    const existingSheet = await getConstructionSheetForLog(editingIdInput.value);
    if (!existingSheet) {
      await refreshConstructionSheetUi();
      return;
    }

    const ok = confirm('Delete the saved construction sheet snapshot from this log?');
    if (!ok) return;
    try {
      await deleteConstructionSheetForLog(editingIdInput.value);
      await syncMediaCountForEntry(editingIdInput.value);
      await refreshConstructionSheetUi();
      await loadEntries();
      setStatus('Construction sheet snapshot removed from this log.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not remove the construction sheet snapshot.', 'error');
    }
  });

  if (removeConstructionSheetFileBtn) {
    removeConstructionSheetFileBtn.addEventListener('click', async function () {
      if (pendingConstructionSheetFile) {
        const ok = confirm('Remove the new construction sheet XLSM before saving?');
        if (!ok) return;
        clearPendingConstructionSheetFile();
        setStatus('Pending construction sheet XLSM removed.', 'warning');
        return;
      }

      if (!editingIdInput.value) return;
      const existingFile = await getConstructionSheetFileForLog(editingIdInput.value);
      if (!existingFile) {
        await refreshConstructionSheetUi();
        return;
      }

      const ok = confirm('Delete the saved construction sheet XLSM from this log?');
      if (!ok) return;
      try {
        await deleteConstructionSheetFileForLog(editingIdInput.value);
        await syncMediaCountForEntry(editingIdInput.value);
        await refreshConstructionSheetUi();
        await loadEntries();
        setStatus('Construction sheet XLSM removed from this log.', 'success');
      } catch (err) {
        console.error(err);
        setStatus('Could not remove the construction sheet XLSM.', 'error');
      }
    });
  }

  removeCutSheetBtn.addEventListener('click', async function () {
    if (pendingCutSheet) {
      const ok = confirm('Remove the new cut sheet photo before saving?');
      if (!ok) return;
      clearPendingCutSheet();
      setStatus('Pending cut sheet removed.', 'warning');
      return;
    }

    if (!editingIdInput.value) return;
    const existingSheet = await getCutSheetForLog(editingIdInput.value);
    if (!existingSheet) {
      await refreshCutSheetUi();
      return;
    }

    const ok = confirm('Delete the saved cut sheet photo from this log?');
    if (!ok) return;
    try {
      await deleteCutSheetForLog(editingIdInput.value);
      await syncMediaCountForEntry(editingIdInput.value);
      await refreshCutSheetUi();
      await loadEntries();
      setStatus('Cut sheet removed from this log.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not remove the cut sheet.', 'error');
    }
  });

  clearPendingMediaBtn.addEventListener('click', function () {
    clearPendingMedia();
    setStatus('Pending media cleared.', 'warning');
  });

  mediaFilesInput.addEventListener('change', function () {
    addPendingFiles(mediaFilesInput.files, 'file picker');
  });

  photoCaptureInput.addEventListener('change', function () {
    addPendingFiles(photoCaptureInput.files, 'camera photo');
  });

  videoCaptureInput.addEventListener('change', function () {
    addPendingFiles(videoCaptureInput.files, 'camera video');
  });

  constructionSheetCaptureInput.addEventListener('change', function () {
    const file = constructionSheetCaptureInput.files && constructionSheetCaptureInput.files[0];
    if (!file) return;
    pendingConstructionSheet = {
      localId: uid(),
      file: file,
      source: 'construction sheet camera',
      description: 'Construction sheet snapshot',
      role: 'construction-sheet'
    };
    refreshConstructionSheetUi();
    setStatus('Construction sheet snapshot added. Save the log to attach it.', 'success');
  });

  if (constructionSnapshotUploadInput) {
    constructionSnapshotUploadInput.addEventListener('change', function () {
      const file = constructionSnapshotUploadInput.files && constructionSnapshotUploadInput.files[0];
      if (!file) return;
      pendingConstructionSheet = {
        localId: uid(),
        file: file,
        source: 'construction sheet snapshot upload',
        description: 'Construction sheet snapshot',
        role: 'construction-sheet'
      };
      refreshConstructionSheetUi();
      setStatus('Construction sheet snapshot uploaded. Save the log to attach it.', 'success');
    });
  }

  if (constructionSheetUploadInput) {
    constructionSheetUploadInput.addEventListener('change', function () {
      const file = constructionSheetUploadInput.files && constructionSheetUploadInput.files[0];
      if (!file) return;
      const isXlsm = isSpreadsheetType(file.type, file.name);
      if (!isXlsm) {
        setStatus('Please choose an .xlsm construction sheet file.', 'warning');
        constructionSheetUploadInput.value = '';
        return;
      }
      pendingConstructionSheetFile = {
        localId: uid(),
        file: file,
        source: 'construction sheet upload',
        description: 'Construction sheet XLSM',
        role: 'construction-sheet-file'
      };
      refreshConstructionSheetUi();
      setStatus('Construction sheet XLSM added. Save the log to attach it.', 'success');
    });
  }

  cutSheetCaptureInput.addEventListener('change', function () {
    const file = cutSheetCaptureInput.files && cutSheetCaptureInput.files[0];
    if (!file) return;
    pendingCutSheet = {
      localId: uid(),
      file: file,
      source: 'cut sheet camera',
      description: 'Cut sheet',
      role: 'cut-sheet'
    };
    refreshCutSheetUi();
    setStatus('Cut sheet photo added. Save the log to attach it.', 'success');
  });

  pendingMediaPreview.addEventListener('input', function (event) {
    const noteInput = event.target.closest('.pending-media-note');
    if (!noteInput) return;
    const targetId = noteInput.getAttribute('data-id');
    const item = pendingMedia.find(function (media) { return media.localId === targetId; });
    if (!item) return;
    item.description = noteInput.value;
  });

  pendingMediaPreview.addEventListener('click', function (event) {
    const removeButton = event.target.closest('.remove-pending-media');
    if (removeButton) {
      const targetId = removeButton.getAttribute('data-id');
      pendingMedia = pendingMedia.filter(function (item) { return item.localId !== targetId; });
      renderPendingMediaPreview();
      return;
    }

    const openButton = event.target.closest('.pending-open-media');
    if (openButton) {
      const targetId = openButton.getAttribute('data-id');
      openPendingMediaViewer(targetId);
    }
  });


  if (attachedMediaSection) {
    attachedMediaSection.addEventListener('click', async function (event) {
      const mediaOpenButton = event.target.closest('.saved-open-media');
      if (mediaOpenButton) {
        const mediaId = mediaOpenButton.getAttribute('data-media-id');
        if (mediaId) openSavedMediaViewer(mediaId);
        return;
      }

      const mediaEditButton = event.target.closest('.edit-media-note');
      if (mediaEditButton) {
        const mediaId = mediaEditButton.getAttribute('data-media-id');
        const logId = mediaEditButton.getAttribute('data-log-id');
        if (!mediaId || !logId) return;
        try {
          const mediaItem = await getMediaRecordById(mediaId);
          if (!mediaItem) {
            setStatus('That media item could not be found.', 'error');
            return;
          }
          const updatedDescription = window.prompt('Edit media note/description:', mediaItem.description || '');
          if (updatedDescription === null) {
            setStatus('Media note edit canceled.', 'warning');
            return;
          }
          await updateMediaDescription(mediaId, updatedDescription.trim());
          await syncMediaCountForEntry(logId);
          await renderAttachedMediaPreview();
          await loadEntries();
          setStatus('Media note updated.', 'success');
        } catch (err) {
          console.error(err);
          setStatus('Could not update that media note.', 'error');
        }
        return;
      }

      const mediaDeleteButton = event.target.closest('.delete-media-item');
      if (mediaDeleteButton) {
        const mediaId = mediaDeleteButton.getAttribute('data-media-id');
        const logId = mediaDeleteButton.getAttribute('data-log-id');
        if (!mediaId || !logId) return;
        const ok = confirm('Delete this attached media item from the log?');
        if (!ok) {
          setStatus('Media delete canceled.', 'warning');
          return;
        }
        try {
          await deleteMediaRecordById(mediaId);
          await syncMediaCountForEntry(logId);
          await renderAttachedMediaPreview();
          await loadEntries();
          setStatus('Media deleted from this log.', 'success');
        } catch (err) {
          console.error(err);
          setStatus('Could not delete that media item.', 'error');
        }
      }
    });
  }

  searchInput.addEventListener('input', function () { loadEntries(); });
  sortSelect.addEventListener('change', function () { loadEntries(); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    saveCurrentEntry('final');
  });

  saveDraftBtn.addEventListener('click', function () {
    saveCurrentEntry('draft');
  });

  cancelEditBtn.addEventListener('click', function () {
    resetForm();
    setStatus('Edit canceled.', 'warning');
  });

  entriesEl.addEventListener('click', async function (event) {
    const mediaOpenButton = event.target.closest('.saved-open-media');
    if (mediaOpenButton) {
      const mediaId = mediaOpenButton.getAttribute('data-media-id');
      if (mediaId) openSavedMediaViewer(mediaId);
      return;
    }

    const mediaEditButton = event.target.closest('.edit-media-note');
    if (mediaEditButton) {
      const mediaId = mediaEditButton.getAttribute('data-media-id');
      const logId = mediaEditButton.getAttribute('data-log-id');
      if (!mediaId || !logId) return;
      try {
        const mediaItem = await getMediaRecordById(mediaId);
        if (!mediaItem) {
          setStatus('That media item could not be found.', 'error');
          return;
        }
        const updatedDescription = window.prompt('Edit media note/description:', mediaItem.description || '');
        if (updatedDescription === null) {
          setStatus('Media note edit canceled.', 'warning');
          return;
        }
        await updateMediaDescription(mediaId, updatedDescription.trim());
        await syncMediaCountForEntry(logId);
        await loadEntries();
        setStatus('Media note updated.', 'success');
      } catch (err) {
        console.error(err);
        setStatus('Could not update that media note.', 'error');
      }
      return;
    }

    const openConstructionButton = event.target.closest('.open-construction-sheet');
    if (openConstructionButton) {
      const mediaId = openConstructionButton.getAttribute('data-media-id');
      if (mediaId) openSavedMediaViewer(mediaId, { landscape: true, title: 'Construction Sheet' });
      return;
    }

    const openCutSheetButton = event.target.closest('.open-cut-sheet');
    if (openCutSheetButton) {
      const mediaId = openCutSheetButton.getAttribute('data-media-id');
      if (mediaId) openSavedMediaViewer(mediaId, { landscape: true, title: 'Cut Sheet' });
      return;
    }

    const mediaDeleteButton = event.target.closest('.delete-media-item');
    if (mediaDeleteButton) {
      const mediaId = mediaDeleteButton.getAttribute('data-media-id');
      const logId = mediaDeleteButton.getAttribute('data-log-id');
      if (!mediaId || !logId) return;
      const ok = confirm('Delete this attached media item from the log?');
      if (!ok) {
        setStatus('Media delete canceled.', 'warning');
        return;
      }
      try {
        await deleteMediaRecordById(mediaId);
        await syncMediaCountForEntry(logId);
        await loadEntries();
        setStatus('Media deleted from this log.', 'success');
      } catch (err) {
        console.error(err);
        setStatus('Could not delete that media item.', 'error');
      }
      return;
    }


    const openEntryCard = event.target.closest('.entry-openable[data-entry-id]');
    if (openEntryCard && !event.target.closest('button')) {
      const entryId = openEntryCard.getAttribute('data-entry-id');
      const entries = getEntries();
      const entry = entries.find(function (item) { return item.id === entryId; });
      if (!entry) return;
      populateFormForEdit(entry);
      setStatus('Opened ' + (entry.status === 'draft' ? 'draft' : 'log') + ' for editing.', 'warning');
      return;
    }

    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const entryId = button.getAttribute('data-id');
    const entries = getEntries();
    const entry = entries.find(function (item) { return item.id === entryId; });
    if (!entry) return;

    if (button.classList.contains('edit-entry')) {
      populateFormForEdit(entry);
      setStatus('Editing ' + (entry.status === 'draft' ? 'draft' : 'log') + '.', 'warning');
      return;
    }

    if (button.classList.contains('share-entry')) {
      try {
        await shareEntry(entry);
      } catch (err) {
        console.error(err);
        setStatus('Could not share this log.', 'error');
      }
      return;
    }

    if (button.classList.contains('print-entry')) {
      try {
        await printEntry(entry);
        setStatus('Print view opened. Choose Print or Save as PDF.', 'success');
      } catch (err) {
        console.error(err);
        setStatus('Could not open the print view for this log.', 'error');
      }
      return;
    }

    if (button.classList.contains('duplicate-entry')) {
      const copy = Object.assign({}, entry, {
        id: uid(),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaCount: 0
      });
      delete copy.mediaCount;
      const allEntries = getEntries();
      allEntries.unshift(copy);
      setEntries(allEntries);
      await loadEntries();
      setStatus('Log duplicated as a draft. Media is not copied with duplicates.', 'success');
      return;
    }

    if (button.classList.contains('delete-entry')) {
      const ok = confirm('Delete this log and all local attached media for it?');
      if (!ok) return;
      try {
        await deleteEntry(entryId);
        if (editingIdInput.value === entryId) {
          resetForm();
        }
        await loadEntries();
        setStatus('Log deleted.', 'success');
      } catch (err) {
        console.error(err);
        setStatus('Could not delete the log.', 'error');
      }
    }
  });

  exportBtn.addEventListener('click', function () {
    exportBackup().catch(function (err) {
      console.error(err);
      setStatus('Could not export the backup.', 'error');
    });
  });

  importBtn.addEventListener('click', function () {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function () {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (loadEvent) {
      importBackup(loadEvent.target.result).catch(function (err) {
        console.error(err);
        setStatus('Failed to import backup. Use a JSON backup from this app.', 'error');
      });
    };
    reader.readAsText(file);
  });

  clearBtn.addEventListener('click', async function () {
    const hasEntries = getEntries().length;
    const hasMedia = (await getAllMedia()).length;
    if (!hasEntries && !hasMedia) {
      setStatus('The log is already empty.', 'warning');
      return;
    }

    const ok = confirm('Are you sure you want to clear all saved log entries and all local media? This cannot be undone.');
    if (!ok) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      await clearAllMedia();
      resetForm();
      await loadEntries();
      setStatus('All logs and local media cleared.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not clear all local data.', 'error');
    }
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUi();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    updateInstallUi();
    setStatus('App installed.', 'success');
  });

  if (installAppBtn) {
    installAppBtn.addEventListener('click', async function () {
      if (isStandaloneMode()) {
        setStatus('This app is already installed on this device.', 'success');
        return;
      }

      if (!deferredInstallPrompt) {
        const message = 'Install prompt is not available in this browser view yet. Open the hosted site directly in Chrome or Edge and use the browser install menu if needed.';
        setStatus(message, 'warning');
        if (installMessage) installMessage.textContent = message;
        window.alert(message);
        return;
      }

      try {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        updateInstallUi();
        if (result && result.outcome === 'accepted') {
          setStatus('Install accepted.', 'success');
        } else {
          setStatus('Install dismissed.', 'warning');
        }
      } catch (err) {
        console.error(err);
        setStatus('Could not show the install prompt in this browser view.', 'error');
      }
    });
  }

  openDb().catch(function (err) {
    console.error(err);
    setStatus('IndexedDB could not be opened. Media uploads may not work in this browser.', 'error');
  });

  updateInstallUi();
  renderPendingMediaPreview();
  loadEntries().then(function () {
    autoOpenMostRecentEntry();
  }).catch(function (err) {
    console.error(err);
  });
});
