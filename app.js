document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('logForm');
  const entriesEl = document.getElementById('entries');
  const axlesSelect = document.getElementById('axles');
  const axleWeightsContainer = document.getElementById('axleWeightsContainer');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const statusMessage = document.getElementById('statusMessage');
  const installHint = document.getElementById('installHint');

  const editingIdInput = document.getElementById('editingId');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const saveBtn = document.getElementById('saveBtn');

  const truckWeightInput = document.getElementById('truckWeight');
  const emptyTrailerWeightInput = document.getElementById('emptyTrailerWeight');
  const totalWeightInput = document.getElementById('truckAndTrailerWeight');
  const netPayloadInput = document.getElementById('netPayload');
  const vacuumDropInput = document.getElementById('vacuumDrop');
  const heightBeforeVacuumInput = document.getElementById('heightBeforeVacuum');
  const heightAfterVacuumInput = document.getElementById('heightAfterVacuum');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');

  const statCount = document.getElementById('statCount');
  const statShown = document.getElementById('statShown');
  const statLastSaved = document.getElementById('statLastSaved');

  const STORAGE_KEY = 'trailerLogs';
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

  function showStatus(message, type) {
    statusMessage.textContent = message || '';
    statusMessage.className = 'status' + (type ? ' ' + type : '');
  }

  function readEntries() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  function writeEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function formatNumber(value) {
    if (value == null || value === '' || Number.isNaN(Number(value))) return '-';
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function formatDateOnly(value) {
    if (!value) return '-';
    const d = new Date(value + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  }

  function updateSummaryFields() {
    const total = parseFloat(totalWeightInput.value);
    const truck = parseFloat(truckWeightInput.value);
    const emptyTrailer = parseFloat(emptyTrailerWeightInput.value);
    const before = parseFloat(heightBeforeVacuumInput.value);
    const after = parseFloat(heightAfterVacuumInput.value);

    const payload = total - truck - emptyTrailer;
    netPayloadInput.value = !Number.isNaN(payload) ? payload.toFixed(2).replace(/\.00$/, '') : '';

    const drop = before - after;
    vacuumDropInput.value = !Number.isNaN(drop) ? drop.toFixed(2).replace(/\.00$/, '') : '';
  }

  function recalcTotal() {
    const axleCount = parseInt(axlesSelect.value, 10) || 0;
    let axleSum = 0;

    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      if (el && el.value !== '') {
        const value = parseFloat(el.value);
        if (!Number.isNaN(value)) axleSum += value;
      }
    }

    totalWeightInput.value = axleCount > 0 && axleSum > 0 ? axleSum.toFixed(2).replace(/\.00$/, '') : '';
    updateSummaryFields();
  }

  function renderAxleInputs(count, existingValues) {
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
      input.inputMode = 'decimal';
      input.value = existingValues && existingValues[i - 1] != null ? existingValues[i - 1] : '';
      input.addEventListener('input', recalcTotal);

      label.appendChild(input);
      wrapper.appendChild(label);
    }

    axleWeightsContainer.appendChild(wrapper);
  }

  function sortEntries(entries) {
    const sortBy = sortSelect.value;
    const copy = entries.slice();

    if (sortBy === 'oldest') {
      copy.sort(function (a, b) {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    } else if (sortBy === 'tube') {
      copy.sort(function (a, b) {
        return String(a.tubeNumber || '').localeCompare(String(b.tubeNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
      });
    } else {
      copy.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

    return copy;
  }

  function filteredEntries(entries) {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) return sortEntries(entries);

    const filtered = entries.filter(function (entry) {
      const haystack = [
        entry.tubeNumber,
        entry.destination,
        entry.trailerType,
        entry.trailerNumber,
        entry.notes,
        entry.mfdDate,
        entry.departureDate
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });

    return sortEntries(filtered);
  }

  function updateStats(allEntries, shownEntries) {
    statCount.textContent = allEntries.length;
    statShown.textContent = shownEntries.length;
    statLastSaved.textContent = allEntries[0] ? new Date(allEntries.slice().sort(function(a,b){
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    })[0].createdAt).toLocaleDateString() : '—';
  }

  function entryCard(entry) {
    const axleSummary = Array.isArray(entry.axleWeights) && entry.axleWeights.length
      ? entry.axleWeights.map(function (w, i) {
          return 'A' + (i + 1) + ': ' + formatNumber(w) + ' lbs';
        }).join(' · ')
      : '-';

    const heightInfo = (entry.heightBeforeVacuum != null || entry.heightAfterVacuum != null)
      ? 'Height before: ' + formatNumber(entry.heightBeforeVacuum) + ' ft · After: ' + formatNumber(entry.heightAfterVacuum) + ' ft · Drop: ' + formatNumber(entry.vacuumDrop) + ' ft'
      : '';

    const notesBlock = entry.notes
      ? '<div class="entry-notes"><strong>Notes:</strong> ' + escapeHtml(entry.notes) + '</div>'
      : '';

    return (
      '<li class="entry">' +
        '<div class="entry-top">' +
          '<div>' +
            '<div class="entry-title">Tube ' + escapeHtml(entry.tubeNumber || '-') + '</div>' +
            '<div class="entry-meta"><strong>Customer / Destination:</strong> ' + escapeHtml(entry.destination || '-') + '</div>' +
          '</div>' +
          '<div class="entry-date">' + escapeHtml(formatDateTime(entry.createdAt)) + '</div>' +
        '</div>' +
        '<div class="entry-meta">' +
          '<strong>Truck:</strong> ' + formatNumber(entry.truckWeight) + ' lbs · ' +
          '<strong>Empty trailer:</strong> ' + formatNumber(entry.emptyTrailerWeight) + ' lbs · ' +
          '<strong>Total:</strong> ' + formatNumber(entry.truckAndTrailerWeight) + ' lbs · ' +
          '<strong>Payload:</strong> ' + formatNumber(entry.netPayload) + ' lbs' +
        '</div>' +
        '<div class="entry-meta">' +
          '<strong>Type:</strong> ' + escapeHtml(entry.trailerType || '-') + ' · ' +
          '<strong>Length:</strong> ' + formatNumber(entry.trailerLength) + ' ft · ' +
          '<strong>Trailer #:</strong> ' + escapeHtml(entry.trailerNumber || '-') + ' · ' +
          '<strong>Axles:</strong> ' + escapeHtml(entry.axles || '-') +
        '</div>' +
        '<div class="entry-meta">' +
          '<strong>Mfd:</strong> ' + escapeHtml(formatDateOnly(entry.mfdDate)) + ' · ' +
          '<strong>Departure:</strong> ' + escapeHtml(formatDateOnly(entry.departureDate)) +
        '</div>' +
        (heightInfo ? '<div class="entry-meta">' + escapeHtml(heightInfo) + '</div>' : '') +
        '<div class="entry-weights"><strong>Axle weights:</strong> ' + escapeHtml(axleSummary) + '</div>' +
        notesBlock +
        '<div class="entry-actions">' +
          '<button type="button" class="secondary edit-entry" data-id="' + escapeHtml(entry.id) + '">Edit</button>' +
          '<button type="button" class="warning duplicate-entry" data-id="' + escapeHtml(entry.id) + '">Duplicate</button>' +
          '<button type="button" class="danger delete-entry" data-id="' + escapeHtml(entry.id) + '">Delete</button>' +
        '</div>' +
      '</li>'
    );
  }

  function loadEntries() {
    const allEntries = readEntries();
    const shownEntries = filteredEntries(allEntries);

    updateStats(allEntries, shownEntries);

    if (!allEntries.length) {
      entriesEl.innerHTML = '<li class="empty-state">No entries saved yet.</li>';
      return;
    }

    if (!shownEntries.length) {
      entriesEl.innerHTML = '<li class="empty-state">No entries match your search.</li>';
      return;
    }

    entriesEl.innerHTML = shownEntries.map(entryCard).join('');
  }

  function resetForm() {
    form.reset();
    editingIdInput.value = '';
    axleWeightsContainer.innerHTML = '';
    totalWeightInput.value = '';
    netPayloadInput.value = '';
    vacuumDropInput.value = '';
    saveBtn.textContent = 'Save Log';
    cancelEditBtn.hidden = true;
  }

  function populateForm(entry) {
    editingIdInput.value = entry.id;
    document.getElementById('tubeNumber').value = entry.tubeNumber || '';
    document.getElementById('destination').value = entry.destination || '';
    document.getElementById('trailerType').value = entry.trailerType || '';
    document.getElementById('trailerLength').value = entry.trailerLength ?? '';
    document.getElementById('trailerNumber').value = entry.trailerNumber || '';
    document.getElementById('truckWeight').value = entry.truckWeight ?? '';
    document.getElementById('emptyTrailerWeight').value = entry.emptyTrailerWeight ?? '';
    document.getElementById('axles').value = entry.axles || '';
    renderAxleInputs(parseInt(entry.axles, 10) || 0, entry.axleWeights || []);
    document.getElementById('heightBeforeVacuum').value = entry.heightBeforeVacuum ?? '';
    document.getElementById('heightAfterVacuum').value = entry.heightAfterVacuum ?? '';
    document.getElementById('mfdDate').value = entry.mfdDate || '';
    document.getElementById('departureDate').value = entry.departureDate || '';
    document.getElementById('notes').value = entry.notes || '';

    recalcTotal();
    totalWeightInput.value = entry.truckAndTrailerWeight ?? totalWeightInput.value;
    netPayloadInput.value = entry.netPayload ?? netPayloadInput.value;
    vacuumDropInput.value = entry.vacuumDrop ?? vacuumDropInput.value;

    saveBtn.textContent = 'Update Log';
    cancelEditBtn.hidden = false;
    showStatus('Editing log for tube ' + (entry.tubeNumber || ''), 'warning');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function upsertEntry(entry) {
    const entries = readEntries();
    const index = entries.findIndex(function (item) { return item.id === entry.id; });

    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.unshift(entry);
    }

    writeEntries(entries);
    loadEntries();
  }

  function normalizeImportedEntries(imported) {
    return imported
      .filter(function (entry) { return entry && typeof entry === 'object'; })
      .map(function (entry) {
        const normalized = Object.assign({}, entry);
        if (!normalized.id) normalized.id = uid();
        if (!normalized.createdAt) normalized.createdAt = new Date().toISOString();

        if (normalized.truckAndTrailerWeight == null && Array.isArray(normalized.axleWeights)) {
          normalized.truckAndTrailerWeight = normalized.axleWeights.reduce(function(sum, value) {
            const number = Number(value);
            return sum + (Number.isNaN(number) ? 0 : number);
          }, 0);
        }

        if (normalized.netPayload == null) {
          const total = Number(normalized.truckAndTrailerWeight);
          const truck = Number(normalized.truckWeight);
          const trailer = Number(normalized.emptyTrailerWeight);
          const payload = total - truck - trailer;
          normalized.netPayload = Number.isNaN(payload) ? null : payload;
        }

        if (normalized.vacuumDrop == null) {
          const before = Number(normalized.heightBeforeVacuum);
          const after = Number(normalized.heightAfterVacuum);
          const drop = before - after;
          normalized.vacuumDrop = Number.isNaN(drop) ? null : drop;
        }

        return normalized;
      });
  }

  function dedupeEntries(entries) {
    const seen = new Set();
    const output = [];

    entries.forEach(function (entry) {
      const key = [
        entry.id || '',
        entry.tubeNumber || '',
        entry.destination || '',
        entry.createdAt || ''
      ].join('|');

      if (!seen.has(key)) {
        seen.add(key);
        output.push(entry);
      }
    });

    return output;
  }

  axlesSelect.addEventListener('change', function () {
    const count = parseInt(axlesSelect.value, 10);
    renderAxleInputs(Number.isNaN(count) ? 0 : count);
    recalcTotal();
  });

  [truckWeightInput, emptyTrailerWeightInput, heightBeforeVacuumInput, heightAfterVacuumInput].forEach(function (input) {
    input.addEventListener('input', updateSummaryFields);
  });

  searchInput.addEventListener('input', loadEntries);
  sortSelect.addEventListener('change', loadEntries);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const axleCount = parseInt(axlesSelect.value, 10) || 0;
    const axleWeights = [];

    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      const value = el && el.value !== '' ? parseFloat(el.value) : null;
      axleWeights.push(value);
    }

    recalcTotal();

    const total = parseFloat(totalWeightInput.value);
    if (!total || Number.isNaN(total)) {
      alert('Truck + trailer weight could not be calculated. Check the axle weights.');
      return;
    }

    const truckWeight = parseFloat(truckWeightInput.value);
    const emptyTrailerWeight = parseFloat(emptyTrailerWeightInput.value);
    const netPayload = total - truckWeight - emptyTrailerWeight;
    const heightBefore = parseFloat(heightBeforeVacuumInput.value);
    const heightAfter = parseFloat(heightAfterVacuumInput.value);
    const vacuumDrop = heightBefore - heightAfter;

    const entry = {
      id: editingIdInput.value || uid(),
      truckWeight: Number.isNaN(truckWeight) ? null : truckWeight,
      emptyTrailerWeight: Number.isNaN(emptyTrailerWeight) ? null : emptyTrailerWeight,
      truckAndTrailerWeight: total,
      netPayload: Number.isNaN(netPayload) ? null : netPayload,
      heightBeforeVacuum: Number.isNaN(heightBefore) ? null : heightBefore,
      heightAfterVacuum: Number.isNaN(heightAfter) ? null : heightAfter,
      vacuumDrop: Number.isNaN(vacuumDrop) ? null : vacuumDrop,
      trailerType: document.getElementById('trailerType').value.trim(),
      trailerLength: parseFloat(document.getElementById('trailerLength').value) || null,
      trailerNumber: document.getElementById('trailerNumber').value.trim(),
      axles: axlesSelect.value || null,
      axleWeights: axleWeights,
      tubeNumber: document.getElementById('tubeNumber').value.trim(),
      destination: document.getElementById('destination').value.trim(),
      mfdDate: document.getElementById('mfdDate').value || null,
      departureDate: document.getElementById('departureDate').value || null,
      notes: document.getElementById('notes').value.trim(),
      createdAt: editingIdInput.value
        ? (readEntries().find(function (item) { return item.id === editingIdInput.value; }) || {}).createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!entry.truckWeight || !entry.emptyTrailerWeight || !entry.tubeNumber || !entry.destination || !entry.trailerType || !entry.axles) {
      alert('Please fill in all required fields.');
      return;
    }

    upsertEntry(entry);
    showStatus(editingIdInput.value ? 'Log updated successfully.' : 'Log saved successfully.', 'success');
    resetForm();
    loadEntries();
  });

  cancelEditBtn.addEventListener('click', function () {
    resetForm();
    showStatus('Edit cancelled.', 'warning');
  });

  entriesEl.addEventListener('click', function (event) {
    const target = event.target;
    const id = target.getAttribute('data-id');
    if (!id) return;

    const entries = readEntries();
    const entry = entries.find(function (item) { return item.id === id; });
    if (!entry) return;

    if (target.classList.contains('edit-entry')) {
      populateForm(entry);
      return;
    }

    if (target.classList.contains('duplicate-entry')) {
      const copy = Object.assign({}, entry, {
        id: uid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const updated = [copy].concat(entries);
      writeEntries(updated);
      loadEntries();
      showStatus('Entry duplicated.', 'success');
      return;
    }

    if (target.classList.contains('delete-entry')) {
      const ok = confirm('Delete this log entry? This cannot be undone.');
      if (!ok) return;
      const updated = entries.filter(function (item) { return item.id !== id; });
      writeEntries(updated);
      if (editingIdInput.value === id) resetForm();
      loadEntries();
      showStatus('Entry deleted.', 'warning');
    }
  });

  exportBtn.addEventListener('click', function () {
    const data = readEntries();
    if (!data.length) {
      alert('No entries to export.');
      return;
    }

    const json = JSON.stringify({ exportedAt: new Date().toISOString(), entries: data }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = 'trailer-log-' + ts + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Log exported.', 'success');
  });

  importBtn.addEventListener('click', function () {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function () {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);

        let imported;
        if (Array.isArray(parsed)) {
          imported = parsed;
        } else if (parsed && Array.isArray(parsed.entries)) {
          imported = parsed.entries;
        } else {
          alert('That file does not look like a valid Trailer Weight Logger export.');
          return;
        }

        const normalized = normalizeImportedEntries(imported);
        if (!normalized.length) {
          alert('No valid entries found in that file.');
          return;
        }

        const existing = readEntries();
        const merged = dedupeEntries(normalized.concat(existing));
        writeEntries(merged);
        loadEntries();
        showStatus('Imported ' + normalized.length + ' entr' + (normalized.length === 1 ? 'y' : 'ies') + '.', 'success');
      } catch (err) {
        console.error(err);
        alert('Import failed. Make sure the file was exported from this app.');
      }
    };
    reader.readAsText(file);
  });

  clearBtn.addEventListener('click', function () {
    const data = readEntries();
    if (!data.length) {
      alert('Log is already empty.');
      return;
    }

    const ok = confirm('Clear all saved log entries? This cannot be undone.');
    if (!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    resetForm();
    loadEntries();
    showStatus('All entries cleared.', 'warning');
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    installHint.textContent = 'Ready to install';
    installHint.style.cursor = 'pointer';
    installHint.title = 'Install this app';
  });

  installHint.addEventListener('click', async function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installHint.textContent = 'Installed or install prompt used';
  });

  loadEntries();
});
