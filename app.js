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

  const mediaFilesInput = document.getElementById('mediaFiles');
  const mediaDescriptionInput = document.getElementById('mediaDescription');
  const selectedMediaInfo = document.getElementById('selectedMediaInfo');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editingIdInput = document.getElementById('editingId');
  const saveBtn = document.getElementById('saveBtn');
  const statusMessage = document.getElementById('statusMessage');

  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const statCount = document.getElementById('statCount');
  const statShown = document.getElementById('statShown');
  const statLastSaved = document.getElementById('statLastSaved');

  const STORAGE_KEY = 'trailerLogs';
  const DB_NAME = 'TrailerWeightLoggerDB';
  const DB_VERSION = 1;
  const MEDIA_STORE = 'media';
  let dbPromise = null;
  let activeObjectUrls = [];

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

  async function saveMediaForLog(logId, files, description) {
    if (!files || !files.length) return [];

    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      const saved = [];

      tx.oncomplete = function () { resolve(saved); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };

      files.forEach(function (file) {
        const record = {
          id: uid(),
          logId: logId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          description: description || '',
          createdAt: new Date().toISOString(),
          blob: file
        };
        saved.push(record);
        store.put(record);
      });
    });
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

  async function getAllMediaRecords() {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const request = store.getAll();

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

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl, fallbackType) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) {
      throw new Error('Invalid media backup format.');
    }

    const header = parts[0];
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mimeType = (mimeMatch && mimeMatch[1]) || fallbackType || 'application/octet-stream';
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }

  async function buildExportPackage(entries) {
    const mediaRecords = await getAllMediaRecords();
    const serializedMedia = await Promise.all(mediaRecords.map(async function (item) {
      return {
        id: item.id,
        logId: item.logId,
        name: item.name,
        type: item.type,
        size: item.size,
        description: item.description || '',
        createdAt: item.createdAt,
        dataUrl: await blobToDataUrl(item.blob)
      };
    }));

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: buildExportPayload(entries),
      media: serializedMedia
    };
  }

  async function importMediaRecords(mediaRecords, idMap) {
    if (!Array.isArray(mediaRecords) || !mediaRecords.length) return 0;

    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      let importedCount = 0;

      tx.oncomplete = function () { resolve(importedCount); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };

      mediaRecords.forEach(function (item) {
        if (!item || !item.logId || !item.dataUrl) return;

        const mappedLogId = idMap[item.logId];
        if (!mappedLogId) return;

        const record = {
          id: uid(),
          logId: mappedLogId,
          name: item.name || 'media',
          type: item.type || 'application/octet-stream',
          size: Number(item.size) || 0,
          description: item.description || '',
          createdAt: item.createdAt || new Date().toISOString(),
          blob: dataUrlToBlob(item.dataUrl, item.type)
        };

        importedCount += 1;
        store.put(record);
      });
    });
  }

  function revokeObjectUrls() {
    activeObjectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    activeObjectUrls = [];
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
    if (!Number.isNaN(total) && !Number.isNaN(truckWeight) && !Number.isNaN(emptyTrailerWeight) && total > 0) {
      const payload = total - truckWeight - emptyTrailerWeight;
      netPayloadInput.value = Number.isFinite(payload) ? String(payload) : '';
    } else {
      netPayloadInput.value = '';
    }

    const before = parseFloat(heightBeforeInput.value);
    const after = parseFloat(heightAfterInput.value);
    if (!Number.isNaN(before) && !Number.isNaN(after)) {
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
      input.required = true;
      if (existingWeights && existingWeights[i - 1] != null) {
        input.value = existingWeights[i - 1];
      }
      input.addEventListener('input', recalcComputedFields);

      label.appendChild(input);
      wrapper.appendChild(label);
    }

    axleWeightsContainer.appendChild(wrapper);
  }

  function updateSelectedMediaInfo() {
    const files = Array.from(mediaFilesInput.files || []);
    if (!files.length) {
      selectedMediaInfo.textContent = '';
      return;
    }

    const totalBytes = files.reduce(function (sum, file) { return sum + (file.size || 0); }, 0);
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    selectedMediaInfo.textContent = files.length + ' file(s) selected • ' + totalMb + ' MB total';
  }

  function resetForm() {
    form.reset();
    editingIdInput.value = '';
    axleWeightsContainer.innerHTML = '';
    totalWeightInput.value = '';
    netPayloadInput.value = '';
    vacuumDropInput.value = '';
    selectedMediaInfo.textContent = '';
    cancelEditBtn.hidden = true;
    saveBtn.textContent = 'Save Log';
  }

  function buildEntryFromForm() {
    const axleCount = parseInt(axlesSelect.value, 10) || 0;
    const axleWeights = [];
    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      axleWeights.push(el && el.value !== '' ? parseFloat(el.value) : null);
    }

    recalcComputedFields();

    return {
      id: editingIdInput.value || uid(),
      tubeNumber: tubeNumberInput.value.trim(),
      destination: destinationInput.value.trim(),
      trailerType: trailerTypeInput.value.trim(),
      trailerLength: trailerLengthInput.value === '' ? null : parseFloat(trailerLengthInput.value),
      trailerNumber: trailerNumberInput.value.trim(),
      truckWeight: truckWeightInput.value === '' ? null : parseFloat(truckWeightInput.value),
      emptyTrailerWeight: emptyTrailerWeightInput.value === '' ? null : parseFloat(emptyTrailerWeightInput.value),
      axles: axlesSelect.value || null,
      axleWeights: axleWeights,
      truckAndTrailerWeight: totalWeightInput.value === '' ? null : parseFloat(totalWeightInput.value),
      netPayload: netPayloadInput.value === '' ? null : parseFloat(netPayloadInput.value),
      heightBeforeVacuum: heightBeforeInput.value === '' ? null : parseFloat(heightBeforeInput.value),
      heightAfterVacuum: heightAfterInput.value === '' ? null : parseFloat(heightAfterInput.value),
      vacuumDrop: vacuumDropInput.value === '' ? null : parseFloat(vacuumDropInput.value),
      mfdDate: mfdDateInput.value || null,
      departureDate: departureDateInput.value || null,
      notes: notesInput.value.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function validateEntry(entry) {
    if (!entry.truckWeight || !entry.emptyTrailerWeight || !entry.tubeNumber || !entry.destination || !entry.trailerType || !entry.axles) {
      return 'Please fill all required fields.';
    }
    if (!entry.truckAndTrailerWeight || Number.isNaN(entry.truckAndTrailerWeight)) {
      return 'Truck + trailer weight could not be calculated. Check the axle weights.';
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
      if (sort === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sort === 'tube') {
        return String(a.tubeNumber || '').localeCompare(String(b.tubeNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return entries;
  }

  async function loadEntries() {
    revokeObjectUrls();
    const allEntries = getEntries();
    const entries = getFilteredAndSortedEntries();

    statCount.textContent = String(allEntries.length);
    statShown.textContent = String(entries.length);
    statLastSaved.textContent = allEntries.length ? formatDateTime(allEntries[0].createdAt) : '—';

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
                  '<div class="media-meta">' + formatNumber(Math.round((item.size || 0) / 1024)) + ' KB</div>' +
                '</div>' +
              '</div>'
            );
          }).join('') + '</div>'
        : '';

      return (
        '<li class="entry">' +
          '<div class="entry-top">' +
            '<div>' +
              '<div class="entry-title">Tube ' + escapeHtml(entry.tubeNumber) + ' • ' + escapeHtml(entry.destination) + '</div>' +
              '<div class="entry-meta">Trailer: ' + escapeHtml(entry.trailerType || '-') + ' • Length: ' + escapeHtml(entry.trailerLength ?? '-') + ' ft • Trailer #: ' + escapeHtml(entry.trailerNumber || '-') + '</div>' +
            '</div>' +
            '<div class="entry-date">' + formatDateTime(entry.createdAt) + '</div>' +
          '</div>' +
          '<div class="entry-weights">Truck: ' + formatNumber(entry.truckWeight) + ' lbs • Empty trailer: ' + formatNumber(entry.emptyTrailerWeight) + ' lbs • Truck + trailer: ' + formatNumber(entry.truckAndTrailerWeight) + ' lbs • Net payload: ' + formatNumber(entry.netPayload) + ' lbs</div>' +
          '<div class="entry-meta">Axles: ' + escapeHtml(entry.axles || '-') + ' • Axle weights: ' + escapeHtml(axleSummary) + '</div>' +
          '<div class="entry-meta">Height before: ' + escapeHtml(entry.heightBeforeVacuum ?? '-') + ' ft • After: ' + escapeHtml(entry.heightAfterVacuum ?? '-') + ' ft • Drop: ' + escapeHtml(entry.vacuumDrop ?? '-') + ' ft</div>' +
          '<div class="entry-meta">Mfd: ' + formatDateOnly(entry.mfdDate) + ' • Departure: ' + formatDateOnly(entry.departureDate) + '</div>' +
          (entry.notes ? '<div class="entry-notes"><strong>Notes:</strong> ' + escapeHtml(entry.notes) + '</div>' : '') +
          mediaHtml +
          '<div class="entry-actions">' +
            '<button type="button" class="secondary edit-entry" data-id="' + escapeHtml(entry.id) + '">Edit</button>' +
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
    selectedMediaInfo.textContent = 'Existing attached media will stay unless you delete the log. New files you select now will be added to this log.';
    cancelEditBtn.hidden = false;
    saveBtn.textContent = 'Update Log';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveOrUpdateEntry(entry, files, mediaDescription) {
    const entries = getEntries();
    const existingIndex = entries.findIndex(function (item) { return item.id === entry.id; });
    let createdAt = entry.createdAt;

    if (existingIndex >= 0) {
      createdAt = entries[existingIndex].createdAt;
      entry.createdAt = createdAt;
      entry.updatedAt = new Date().toISOString();
      entries[existingIndex] = entry;
    } else {
      entry.createdAt = new Date().toISOString();
      entry.updatedAt = entry.createdAt;
      entries.unshift(entry);
    }

    if (files.length) {
      await saveMediaForLog(entry.id, files, mediaDescription);
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
    const entries = getEntries();
    const filtered = entries.filter(function (entry) { return entry.id !== entryId; });
    setEntries(filtered);
    await deleteMediaForLog(entryId);
  }

  function buildExportPayload(entries) {
    return entries.map(function (entry) {
      const clone = Object.assign({}, entry);
      delete clone.mediaCount;
      return clone;
    });
  }

  axlesSelect.addEventListener('change', function () {
    renderAxleInputs(parseInt(axlesSelect.value, 10) || 0);
    recalcComputedFields();
  });

  [truckWeightInput, emptyTrailerWeightInput, heightBeforeInput, heightAfterInput].forEach(function (input) {
    input.addEventListener('input', recalcComputedFields);
  });

  mediaFilesInput.addEventListener('change', updateSelectedMediaInfo);
  searchInput.addEventListener('input', function () { loadEntries(); });
  sortSelect.addEventListener('change', function () { loadEntries(); });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const isEditing = Boolean(editingIdInput.value);
    const entry = buildEntryFromForm();
    const error = validateEntry(entry);
    if (error) {
      setStatus(error, 'error');
      return;
    }

    const files = Array.from(mediaFilesInput.files || []);
    const mediaDescription = mediaDescriptionInput.value.trim();

    try {
      await saveOrUpdateEntry(entry, files, mediaDescription);
      resetForm();
      await loadEntries();
      setStatus(isEditing ? 'Log updated.' : 'Log saved.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not save the log. Large videos can exceed your browser storage limit.', 'error');
    }
  });

  cancelEditBtn.addEventListener('click', function () {
    resetForm();
    setStatus('Edit canceled.', 'warning');
  });

  entriesEl.addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const entryId = button.getAttribute('data-id');
    const entries = getEntries();
    const entry = entries.find(function (item) { return item.id === entryId; });
    if (!entry) return;

    if (button.classList.contains('edit-entry')) {
      populateFormForEdit(entry);
      setStatus('Editing log ' + entry.tubeNumber + '.', 'warning');
      return;
    }

    if (button.classList.contains('duplicate-entry')) {
      const copy = Object.assign({}, entry, {
        id: uid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaCount: 0
      });
      delete copy.mediaCount;
      const allEntries = getEntries();
      allEntries.unshift(copy);
      setEntries(allEntries);
      await loadEntries();
      setStatus('Log duplicated. Media is not copied with duplicates.', 'success');
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

  exportBtn.addEventListener('click', async function () {
    const data = getEntries();
    if (!data.length) {
      setStatus('No entries to export.', 'warning');
      return;
    }

    try {
      setStatus('Preparing backup with attached media...', 'warning');
      const exportPackage = await buildExportPackage(data);
      const json = JSON.stringify(exportPackage, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = 'trailer-log-backup-' + ts + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('Backup exported with logs and attached media. Large videos will make the backup file much bigger.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not build the backup file. Try smaller videos or fewer attachments.', 'error');
    }
  });

  importBtn.addEventListener('click', function () {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function () {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (loadEvent) {
      try {
        setStatus('Importing backup file...', 'warning');
        const text = loadEvent.target.result;
        const parsed = JSON.parse(text);
        const imported = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.entries) ? parsed.entries : null);
        const importedMedia = parsed && Array.isArray(parsed.media) ? parsed.media : [];

        if (!imported || !imported.length) {
          setStatus('No valid entries found in the selected file.', 'error');
          return;
        }

        const existing = getEntries();
        const existingIds = new Set(existing.map(function (entry) { return entry.id; }));
        const idMap = {};
        const sanitized = imported.map(function (entry) {
          const clone = Object.assign({}, entry);
          const originalId = clone.id;
          if (!clone.id || existingIds.has(clone.id)) clone.id = uid();
          existingIds.add(clone.id);
          idMap[originalId] = clone.id;
          if (!clone.createdAt) clone.createdAt = new Date().toISOString();
          clone.updatedAt = new Date().toISOString();
          delete clone.mediaCount;
          return clone;
        });

        setEntries(sanitized.concat(existing));
        const importedMediaCount = await importMediaRecords(importedMedia, idMap);
        await loadEntries();

        if (importedMedia.length) {
          setStatus('Imported ' + sanitized.length + ' log(s) and ' + importedMediaCount + ' media file(s).', 'success');
        } else {
          setStatus('Imported ' + sanitized.length + ' log(s). This backup did not contain media attachments.', 'success');
        }
      } catch (err) {
        console.error(err);
        setStatus('Failed to import file. Use a JSON backup exported from this app.', 'error');
      }
    };
    reader.readAsText(file);
  });

  clearBtn.addEventListener('click', async function () {
    if (!getEntries().length) {
      setStatus('Log is already empty.', 'warning');
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

  openDb().catch(function (err) {
    console.error(err);
    setStatus('IndexedDB could not be opened. Media uploads may not work in this browser.', 'error');
  });

  loadEntries();
});
