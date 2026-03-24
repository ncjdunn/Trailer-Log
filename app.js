document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('logForm');
  const entriesEl = document.getElementById('entries');
  const axlesSelect = document.getElementById('axles');
  const axleWeightsContainer = document.getElementById('axleWeightsContainer');

  const truckWeightInput = document.getElementById('truckWeight');
  const emptyTrailerWeightInput = document.getElementById('emptyTrailerWeight');
  const totalWeightInput = document.getElementById('truckAndTrailerWeight');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');

  const STORAGE_KEY = 'trailerLogs';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Total is ONLY sum of axle weights
  function recalcTotal() {
    const axlesVal = axlesSelect.value;
    const axleCount = parseInt(axlesVal, 10) || 0;
    let axleSum = 0;

    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      if (el && el.value !== '') {
        const v = parseFloat(el.value);
        if (!isNaN(v)) axleSum += v;
      }
    }

    totalWeightInput.value = axleSum > 0 ? axleSum : '';
  }

  function renderAxleInputs(count) {
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
      input.addEventListener('input', recalcTotal);

      label.appendChild(input);
      wrapper.appendChild(label);
    }

    axleWeightsContainer.appendChild(wrapper);
  }

  axlesSelect.addEventListener('change', function () {
    const n = parseInt(axlesSelect.value, 10);
    renderAxleInputs(isNaN(n) ? 0 : n);
    recalcTotal();
  });

  function loadEntries() {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!data.length) {
      entriesEl.innerHTML = '<li>No entries yet.</li>';
      return;
    }
    entriesEl.innerHTML = data.map(function (e) {
      const created = new Date(e.createdAt).toLocaleString();
      const axleSummary = e.axleWeights && e.axleWeights.length
        ? e.axleWeights.map(function (w, i) {
            return 'A' + (i + 1) + ': ' + (w ?? '-') + ' lbs';
          }).join(', ')
        : '-';

      const heightInfo =
        (e.heightBeforeVacuum != null || e.heightAfterVacuum != null)
          ? 'Height before: ' + (e.heightBeforeVacuum ?? '-') + ' ft, ' +
            'after: ' + (e.heightAfterVacuum ?? '-') + ' ft'
          : '';

      const notesBlock = e.notes
        ? '<div style="font-size:0.8em;color:#555;margin-top:4px"><strong>Notes:</strong> ' +
          e.notes.replace(/</g, '&lt;') +
          '</div>'
        : '';

      return (
        '<li style="margin-bottom:10px;padding:8px;border:1px solid #eef;border-radius:6px">' +
          '<strong>Tube: ' + e.tubeNumber + '</strong> — Customer/Dest: ' + e.destination + ' — ' +
          '<span style="font-size:0.85em">' + created + '</span>' +
          '<div style="font-size:0.9em;color:#555">' +
            'Truck: ' + (e.truckWeight ?? '-') + ' lbs | ' +
            'Empty trailer: ' + (e.emptyTrailerWeight ?? '-') + ' lbs | ' +
            'Truck+Trailer (axle sum): ' + (e.truckAndTrailerWeight ?? '-') + ' lbs' +
          '</div>' +
          '<div style="font-size:0.8em;color:#777">' +
            'Type: ' + (e.trailerType || '-') + ' | ' +
            'Length: ' + (e.trailerLength || '-') + ' ft | ' +
            'Trailer #: ' + (e.trailerNumber || '-') + ' | ' +
            'Axles: ' + (e.axles || '-') +
          '</div>' +
          (heightInfo
            ? '<div style="font-size:0.8em;color:#777">' + heightInfo + '</div>'
            : '') +
          '<div style="font-size:0.8em;color:#777">' +
            'Axle weights: ' + axleSummary +
          '</div>' +
          notesBlock +
        '</li>'
      );
    }).join('');
  }

  function saveEntry(entry) {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    arr.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    loadEntries();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const axlesVal = axlesSelect.value;
    const axleCount = parseInt(axlesVal, 10) || 0;
    const axleWeights = [];

    for (let i = 1; i <= axleCount; i++) {
      const el = document.getElementById('axleWeight_' + i);
      axleWeights.push(el && el.value !== '' ? parseFloat(el.value) : null);
    }

    recalcTotal();
    const total = parseFloat(totalWeightInput.value);
    if (!total || isNaN(total)) {
      alert('Total Truck + Trailer weight (axle sum) could not be calculated. Check axle weights.');
      return;
    }

    const entry = {
      id: uid(),
      truckWeight: parseFloat(truckWeightInput.value) || null,
      emptyTrailerWeight: parseFloat(emptyTrailerWeightInput.value) || null,
      truckAndTrailerWeight: total,
      heightBeforeVacuum: parseFloat(document.getElementById('heightBeforeVacuum').value) || null,
      heightAfterVacuum: parseFloat(document.getElementById('heightAfterVacuum').value) || null,
      trailerType: document.getElementById('trailerType').value.trim(),
      trailerLength: parseFloat(document.getElementById('trailerLength').value) || null,
      trailerNumber: document.getElementById('trailerNumber').value.trim(),
      axles: axlesVal || null,
      axleWeights: axleWeights,
      tubeNumber: document.getElementById('tubeNumber').value.trim(),
      destination: document.getElementById('destination').value.trim(),
      mfdDate: document.getElementById('mfdDate').value || null,
      departureDate: document.getElementById('departureDate').value || null,
      notes: document.getElementById('notes').value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!entry.truckWeight || !entry.emptyTrailerWeight ||
        !entry.tubeNumber || !entry.destination || !entry.trailerType || !entry.axles) {
      alert('Please fill all required fields.');
      return;
    }

    saveEntry(entry);
    form.reset();
    axleWeightsContainer.innerHTML = '';
    totalWeightInput.value = '';
  });

  // Export to .txt (JSON array)
  exportBtn.addEventListener('click', function () {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!data.length) {
      alert('No entries to export.');
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = 'trailer-log-' + ts + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Import .txt (JSON array or {entries:[...]})
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
        let parsed = JSON.parse(text);

        // Accept either an array or { entries: [...] }
        let imported;
        if (Array.isArray(parsed)) {
          imported = parsed;
        } else if (parsed && Array.isArray(parsed.entries)) {
          imported = parsed.entries;
        } else {
          alert('File is not a valid TrailerLog export (JSON array). Export again and re-import.');
          return;
        }

        if (!imported.length) {
          alert('No valid entries found in file.');
          return;
        }

        imported.forEach(function(entry){
          if (!entry.id) entry.id = uid();
          if (!entry.createdAt) entry.createdAt = new Date().toISOString();
        });

        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const merged = imported.concat(existing);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        loadEntries();
        alert('Imported ' + imported.length + ' entries.');
      } catch (err) {
        console.error(err);
        alert('Failed to import file. Make sure it was exported from this app (JSON export).');
      }
    };
    reader.readAsText(file);
  });

  // Clear log (with confirm)
  clearBtn.addEventListener('click', function () {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!data.length) {
      alert('Log is already empty.');
      return;
    }
    const ok = confirm('Are you sure you want to clear all saved log entries? This cannot be undone.');
    if (!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    loadEntries();
  });

  loadEntries();
});
