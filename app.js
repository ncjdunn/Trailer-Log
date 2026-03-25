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
  const vacuumDropInput = document.getElementById('vacuumDrop');

  const trailerTypeInput = document.getElementById('trailerType');
  const trailerLengthInput = document.getElementById('trailerLength');
  const trailerNumberInput = document.getElementById('trailerNumber');
  const tubeNumberInput = document.getElementById('tubeNumber');
  const destinationInput = document.getElementById('destination');
  const mfdDateInput = document.getElementById('mfdDate');
  const departureDateInput = document.getElementById('departureDate');
  const notesInput = document.getElementById('notes');

  const browseMediaBtn = document.getElementById('browseMediaBtn');
  const takePhotoBtn = document.getElementById('takePhotoBtn');
  const recordVideoBtn = document.getElementById('recordVideoBtn');
  const clearPendingMediaBtn = document.getElementById('clearPendingMediaBtn');
  const mediaFilesInput = document.getElementById('mediaFiles');
  const photoCaptureInput = document.getElementById('photoCaptureInput');
  const videoCaptureInput = document.getElementById('videoCaptureInput');
  const mediaDescriptionInput = document.getElementById('mediaDescription');
  const selectedMediaInfo = document.getElementById('selectedMediaInfo');
  const pendingMediaPreview = document.getElementById('pendingMediaPreview');

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
  const DB_VERSION = 2;
  const MEDIA_STORE = 'media';

  let dbPromise = null;
  let activeObjectUrls = [];
  let pendingMedia = [];
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
      const index = store.index('logId');
      const request = index.getAll(logId);

      request.onsuccess = function () {
        const results = request.result || [];
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

  async function saveMediaForLog(logId, items, description) {
    if (!items || !items.length) return [];

    const records = items.map(function (item) {
      return {
        id: uid(),
        logId: logId,
        name: item.file.name,
        type: item.file.type || 'application/octet-stream',
        size: item.file.size || 0,
        description: description || '',
        source: item.source || 'files',
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

    const before = parseFloat(heightBeforeInput.value);
    const after = parseFloat(heightAfterInput.value);
    if (Number.isFinite(before) && Number.isFinite(after)) {
      const drop = before - after;
      vacuumDropInput.value = Number.isFinite(drop) ? String(drop) : '';
    } else {
      vacuumDropInput.value = '';
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
        source: source || 'files'
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

    const totalBytes = pendingMedia.reduce(function (sum, item) { return sum + (item.file.size || 0); }, 0);
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    selectedMediaInfo.textContent = pendingMedia.length + ' pending file(s) • ' + totalMb + ' MB total';

    const html = pendingMedia.map(function (item) {
      const objectUrl = URL.createObjectURL(item.file);
      activeObjectUrls.push(objectUrl);
      const preview = item.file.type.startsWith('video/')
        ? '<video controls preload="metadata" src="' + objectUrl + '"></video>'
        : '<img src="' + objectUrl + '" alt="' + escapeHtml(item.file.name) + '">';
      return (
        '<div class="pending-media-card" style="margin-top:12px">' +
          preview +
          '<div class="pending-media-body">' +
            '<div class="media-name">' + escapeHtml(item.file.name) + '</div>' +
            '<div class="media-meta">' + escapeHtml(item.source) + ' • ' + formatNumber(Math.round((item.file.size || 0) / 1024)) + ' KB</div>' +
            '<div class="pending-media-actions">' +
              '<button type="button" class="ghost small-btn remove-pending-media" data-id="' + escapeHtml(item.localId) + '">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    pendingMediaPreview.innerHTML = html;
  }

  function resetForm() {
    form.reset();
    editingIdInput.value = '';
    axleWeightsContainer.innerHTML = '';
    totalWeightInput.value = '';
    netPayloadInput.value = '';
    vacuumDropInput.value = '';
    clearPendingMedia();
    mediaDescriptionInput.value = '';
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
      vacuumDrop: vacuumDropInput.value === '' ? null : Number(vacuumDropInput.value),
      mfdDate: mfdDateInput.value,
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
      entry.trailerType ||
      entry.trailerLength != null ||
      entry.trailerNumber ||
      entry.truckWeight != null ||
      entry.emptyTrailerWeight != null ||
      entry.axles != null ||
      (entry.axleWeights || []).some(function (weight) { return weight != null; }) ||
      entry.heightBeforeVacuum != null ||
      entry.heightAfterVacuum != null ||
      entry.mfdDate ||
      entry.departureDate ||
      entry.notes ||
      pendingMedia.length
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

    const html = await Promise.all(entries.map(async function (entry) {
      const mediaItems = await getMediaForLog(entry.id);
      const axleSummary = entry.axleWeights && entry.axleWeights.length
        ? entry.axleWeights.map(function (weight, index) {
            return 'A' + (index + 1) + ': ' + (weight != null ? formatNumber(weight) : '-') + ' lbs';
          }).join(', ')
        : '-';

      const mediaHtml = mediaItems.length
        ? '<div class="entry-media-meta"><strong>Media:</strong> ' + mediaItems.length + ' file(s)</div>' +
          '<div class="media-grid">' + mediaItems.map(function (item) {
            const objectUrl = URL.createObjectURL(item.blob);
            activeObjectUrls.push(objectUrl);
            const mediaTag = item.type && item.type.startsWith('video/')
              ? '<video controls preload="metadata" src="' + objectUrl + '"></video>'
              : '<img src="' + objectUrl + '" alt="' + escapeHtml(item.name) + '">';
            return (
              '<div class="media-card">' +
                mediaTag +
                '<div class="media-card-body">' +
                  '<div class="media-name">' + escapeHtml(item.name) + '</div>' +
                  (item.description ? '<div class="media-desc">' + escapeHtml(item.description) + '</div>' : '') +
                  '<div class="media-meta">' + escapeHtml(item.source || 'files') + ' • ' + formatNumber(Math.round((item.size || 0) / 1024)) + ' KB</div>' +
                  '<div class="media-card-actions">' +
                    '<button type="button" class="ghost small-btn delete-media-item" data-log-id="' + escapeHtml(entry.id) + '" data-media-id="' + escapeHtml(item.id) + '">Delete Media</button>' +
                  '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('') + '</div>'
        : '';

      const statusClass = entry.status === 'draft' ? 'draft' : 'final';
      const statusLabel = entry.status === 'draft' ? 'Draft' : 'Final';

      return (
        '<li class="entry">' +
          '<div class="entry-top">' +
            '<div>' +
              '<div class="status-chip ' + statusClass + '">' + statusLabel + '</div>' +
              '<div class="entry-title">Tube ' + escapeHtml(entry.tubeNumber || '—') + ' • ' + escapeHtml(entry.destination || 'No destination yet') + '</div>' +
              '<div class="entry-meta">Trailer: ' + escapeHtml(entry.trailerType || '-') + ' • Length: ' + escapeHtml(entry.trailerLength ?? '-') + ' ft • Trailer #: ' + escapeHtml(entry.trailerNumber || '-') + '</div>' +
            '</div>' +
            '<div class="entry-date">Updated ' + formatDateTime(entry.updatedAt || entry.createdAt) + '</div>' +
          '</div>' +
          '<div class="entry-weights">Truck: ' + formatNumber(entry.truckWeight) + ' lbs • Empty trailer: ' + formatNumber(entry.emptyTrailerWeight) + ' lbs • Truck + trailer: ' + formatNumber(entry.truckAndTrailerWeight) + ' lbs • Net payload: ' + formatNumber(entry.netPayload) + ' lbs</div>' +
          '<div class="entry-meta">Axles: ' + escapeHtml(entry.axles || '-') + ' • Axle weights: ' + escapeHtml(axleSummary) + '</div>' +
          '<div class="entry-meta">Height before: ' + escapeHtml(entry.heightBeforeVacuum ?? '-') + ' ft • After: ' + escapeHtml(entry.heightAfterVacuum ?? '-') + ' ft • Drop: ' + escapeHtml(entry.vacuumDrop ?? '-') + ' ft</div>' +
          '<div class="entry-meta">Mfd: ' + formatDateOnly(entry.mfdDate) + ' • Departure: ' + formatDateOnly(entry.departureDate) + ' • Created: ' + formatDateTime(entry.createdAt) + '</div>' +
          (entry.notes ? '<div class="entry-notes"><strong>Notes:</strong> ' + escapeHtml(entry.notes) + '</div>' : '') +
          mediaHtml +
          '<div class="entry-actions">' +
            '<button type="button" class="secondary edit-entry" data-id="' + escapeHtml(entry.id) + '">Edit</button>' +
            '<button type="button" class="secondary share-entry" data-id="' + escapeHtml(entry.id) + '">Share</button>' +
            '<button type="button" class="secondary print-entry" data-id="' + escapeHtml(entry.id) + '">Print / PDF</button>' +
            '<button type="button" class="warning duplicate-entry" data-id="' + escapeHtml(entry.id) + '">Duplicate</button>' +
            '<button type="button" class="danger delete-entry" data-id="' + escapeHtml(entry.id) + '">Delete</button>' +
          '</div>' +
        '</li>'
      );
    }));

    entriesEl.innerHTML = html.join('');
  }

  function populateFormForEdit(entry) {
    editingIdInput.value = entry.id;
    tubeNumberInput.value = entry.tubeNumber || '';
    destinationInput.value = entry.destination || '';
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
    vacuumDropInput.value = entry.vacuumDrop ?? '';
    mfdDateInput.value = entry.mfdDate || '';
    departureDateInput.value = entry.departureDate || '';
    notesInput.value = entry.notes || '';
    mediaDescriptionInput.value = '';
    clearPendingMedia();
    selectedMediaInfo.textContent = 'Existing attached media will stay unless you delete the log. Any new files you add now will be attached when you save.';
    cancelEditBtn.hidden = false;
    saveBtn.textContent = entry.status === 'draft' ? 'Save Final Log' : 'Update Final Log';
    saveDraftBtn.textContent = 'Update Draft';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveOrUpdateEntry(entry, itemsToAttach, mediaDescription) {
    const entries = getEntries();
    const existingIndex = entries.findIndex(function (item) { return item.id === entry.id; });

    if (existingIndex >= 0) {
      entry.createdAt = entries[existingIndex].createdAt;
      entries[existingIndex] = entry;
    } else {
      entries.unshift(entry);
    }

    if (itemsToAttach.length) {
      await saveMediaForLog(entry.id, itemsToAttach, mediaDescription);
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
    const mediaItems = await getMediaForLog(entry.id);
    const axleSummary = entry.axleWeights && entry.axleWeights.length
      ? entry.axleWeights.map(function (weight, index) {
          return 'Axle ' + (index + 1) + ': ' + (weight != null ? formatNumber(weight) : '-') + ' lbs';
        }).join(' • ')
      : '—';

    const mediaHtml = await buildPrintableMediaHtml(mediaItems);
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
      '<div><strong>Trailer Type</strong><br>' + escapeHtml(entry.trailerType || '—') + '</div>' +
      '<div><strong>Trailer Length</strong><br>' + escapeHtml(entry.trailerLength ?? '—') + ' ft</div>' +
      '<div><strong>Trailer Number</strong><br>' + escapeHtml(entry.trailerNumber || '—') + '</div>' +
      '<div><strong>Axles</strong><br>' + escapeHtml(entry.axles ?? '—') + '</div>' +
      '<div><strong>Created</strong><br>' + escapeHtml(formatDateTime(entry.createdAt)) + '</div>' +
      '<div><strong>Last Updated</strong><br>' + escapeHtml(formatDateTime(entry.updatedAt || entry.createdAt)) + '</div>' +
      '<div><strong>Mfd Date</strong><br>' + escapeHtml(formatDateOnly(entry.mfdDate)) + '</div>' +
      '<div><strong>Departure Date</strong><br>' + escapeHtml(formatDateOnly(entry.departureDate)) + '</div>' +
      '</div></div>' +
      '<h2>Weights</h2><table class="no-break"><tr><th>Truck</th><th>Empty Trailer</th><th>Truck + Trailer</th><th>Net Payload</th></tr><tr><td>' + escapeHtml(formatNumber(entry.truckWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.emptyTrailerWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.truckAndTrailerWeight)) + ' lbs</td><td>' + escapeHtml(formatNumber(entry.netPayload)) + ' lbs</td></tr></table>' +
      '<div class="section no-break"><strong>Axle Weights</strong><br>' + escapeHtml(axleSummary) + '</div>' +
      '<div class="section no-break"><strong>Vacuum Heights</strong><br>Before: ' + escapeHtml(entry.heightBeforeVacuum ?? '—') + ' ft • After: ' + escapeHtml(entry.heightAfterVacuum ?? '—') + ' ft • Drop: ' + escapeHtml(entry.vacuumDrop ?? '—') + ' ft</div>' +
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
    const mediaDescription = mediaDescriptionInput.value.trim();
    const wasEditing = Boolean(editingIdInput.value);

    try {
      await saveOrUpdateEntry(entry, pendingToAttach, mediaDescription);
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

  pendingMediaPreview.addEventListener('click', function (event) {
    const button = event.target.closest('.remove-pending-media');
    if (!button) return;
    const targetId = button.getAttribute('data-id');
    pendingMedia = pendingMedia.filter(function (item) { return item.localId !== targetId; });
    renderPendingMediaPreview();
  });

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
  loadEntries();
});
