// cheats.js – embedded cheat engine (no popup, direct API)

(function() {
    const ui = document.getElementById('cheat-engine-ui');
    const statusEl = document.getElementById('ce-status');
    const airbreakStatusEl = document.getElementById('ce-airbreak-status');
    const posDisplayEl = document.getElementById('ce-pos-display');
    let results = [];
    let isSearching = false;

    // ––– Helpers –––
    function updateStatus(text) {
        statusEl.textContent = text;
    }

    function updateAirbreakStatus(text, color) {
        if (airbreakStatusEl) {
            airbreakStatusEl.textContent = text;
            if (color) airbreakStatusEl.style.color = color;
        }
    }

    // Direct game API wrapper (synchronous or async)
    function gameApi(method, ...args) {
        if (!window.__gameApi || typeof window.__gameApi[method] !== 'function') {
            console.warn('Game API not ready:', method);
            return Promise.reject(new Error('Game API not ready'));
        }
        try {
            const res = window.__gameApi[method](...args);
            // If the result is a promise (async functions), handle it
            return res instanceof Promise ? res : Promise.resolve(res);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // ––– Scanner –––
    async function firstSearch() {
        if (isSearching) return;
        const valStr = document.getElementById('ce-value').value;
        const type = document.getElementById('ce-type').value;
        const val = parseFloat(valStr);
        if (isNaN(val)) { updateStatus("Invalid value"); return; }
        isSearching = true;
        updateStatus("Searching...");
        try {
            results = await gameApi('scanMemory', val, type) || [];
            updateStatus(`Found ${results.length} addresses`);
            displayResults();
        } catch (e) {
            updateStatus('Search failed');
        } finally {
            isSearching = false;
        }
    }

    async function nextSearch() {
        if (isSearching || results.length === 0) {
            if (results.length === 0) updateStatus("No results. Do 'New' search first.");
            return;
        }
        const valStr = document.getElementById('ce-value').value;
        const val = parseFloat(valStr);
        if (isNaN(val)) { updateStatus("Invalid value"); return; }
        isSearching = true;
        updateStatus("Filtering...");
        try {
            const allResults = await gameApi('scanMemory', val, 'any') || [];
            const addrSet = new Set(results.map(r => r.addr));
            results = allResults.filter(r => addrSet.has(r.addr));
            updateStatus(`Found ${results.length} addresses`);
            displayResults();
        } catch (e) {
            updateStatus('Filter failed');
        } finally {
            isSearching = false;
        }
    }

    async function snapshotValues() {
        if (results.length === 0) { updateStatus("No results to snapshot"); return; }
        const valStr = document.getElementById('ce-value').value;
        const val = parseFloat(valStr);
        if (isNaN(val)) { updateStatus("Invalid value for snapshot"); return; }
        updateStatus("Snapshotting...");
        const fresh = await gameApi('scanMemory', val, 'any') || [];
        const addrSet = new Set(results.map(r => r.addr));
        results = fresh.filter(r => addrSet.has(r.addr)).map(r => {
            r.lastVal = r.val !== undefined ? r.val : null;
            return r;
        });
        updateStatus(`Snapshot: ${results.length} values captured`);
        displayResults();
    }

    async function filterResults(mode) {
        if (isSearching || results.length === 0) {
            updateStatus("No results to filter.");
            return;
        }
        isSearching = true;
        updateStatus("Filtering...");
        const updated = [];
        for (const res of results) {
            const currentVal = await gameApi('readMemory', res.addr, res.type);
            if (currentVal === null) continue;
            let match = false;
            if (mode === 'inc' && currentVal > res.lastVal) match = true;
            if (mode === 'dec' && currentVal < res.lastVal) match = true;
            if (mode === 'changed' && Math.abs(currentVal - res.lastVal) > 0.0001) match = true;
            if (match) {
                res.lastVal = currentVal;
                updated.push(res);
            }
        }
        results = updated;
        isSearching = false;
        updateStatus(`Found ${results.length} addresses`);
        displayResults();
    }

    async function displayResults() {
        const container = document.getElementById('ce-results');
        container.innerHTML = '';
        const limit = Math.min(results.length, 100);
        for (let i = 0; i < limit; i++) {
            const res = results[i];
            const currentVal = await gameApi('readMemory', res.addr, res.type);
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.marginBottom = '2px';
            div.style.borderBottom = '1px solid #333';
            div.innerHTML = `
                <span style="color: #ff00ff;">0x${res.addr.toString(16)}</span>
                <span style="color: #0ff;">${currentVal !== null ? currentVal : '???'}</span>
                <button class="cheat-btn" data-edit-addr="${res.addr}" data-edit-type="${res.type}">Edit</button>
            `;
            container.appendChild(div);
        }
        container.querySelectorAll('button[data-edit-addr]').forEach(btn => {
            btn.addEventListener('click', async function() {
                const addr = parseInt(this.dataset.editAddr);
                const type = this.dataset.editType;
                const newVal = prompt(`Enter new value for 0x${addr.toString(16)} (${type}):`);
                if (newVal === null) return;
                const num = parseFloat(newVal);
                if (isNaN(num)) { alert('Invalid number'); return; }
                await gameApi('writeMemory', addr, type, num);
                updateStatus(`Value at 0x${addr.toString(16)} updated`);
                displayResults();
            });
        });
    }

    async function viewManualAddr() {
        const addrStr = document.getElementById('ce-manual-addr').value;
        const addr = parseInt(addrStr, 16);
        if (isNaN(addr)) { alert('Invalid address'); return; }
        const container = document.getElementById('ce-manual-results');
        container.style.display = 'block';
        container.innerHTML = '';
        const types = ['i8', 'i16', 'i32', 'f32', 'f64'];
        for (const type of types) {
            const val = await gameApi('readMemory', addr, type);
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.marginBottom = '2px';
            div.innerHTML = `
                <span style="color: #0ff;">${type.toUpperCase()}:</span>
                <span>${val !== null ? val : '???'}</span>
                <button class="cheat-btn" data-edit-addr="${addr}" data-edit-type="${type}">Edit</button>
            `;
            container.appendChild(div);
        }
        container.querySelectorAll('button[data-edit-addr]').forEach(btn => {
            btn.addEventListener('click', async function() {
                const a = parseInt(this.dataset.editAddr);
                const t = this.dataset.editType;
                const newVal = prompt(`New value for 0x${a.toString(16)} (${t}):`);
                if (newVal === null) return;
                const num = parseFloat(newVal);
                if (isNaN(num)) { alert('Invalid number'); return; }
                await gameApi('writeMemory', a, t, num);
                updateStatus('Value updated');
                viewManualAddr();
            });
        });
    }

    // ––– Cheat buttons (type cheat code) –––
    document.querySelectorAll('.cheat-btn[data-cheat]').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.dataset.cheat;
            if (code && typeof window.typeCheat === 'function') {
                window.typeCheat(code);
                updateStatus(`Cheat "${code}" activated`);
            }
        });
    });

    // ––– Scanner buttons –––
    document.getElementById('ce-search').addEventListener('click', firstSearch);
    document.getElementById('ce-next').addEventListener('click', nextSearch);
    document.getElementById('ce-snap').addEventListener('click', snapshotValues);
    document.getElementById('ce-inc').addEventListener('click', () => filterResults('inc'));
    document.getElementById('ce-dec').addEventListener('click', () => filterResults('dec'));
    document.getElementById('ce-changed').addEventListener('click', () => filterResults('changed'));
    document.getElementById('ce-reset').addEventListener('click', () => {
        results = [];
        document.getElementById('ce-results').innerHTML = '';
        updateStatus('Reset');
    });
    document.getElementById('ce-view-addr').addEventListener('click', viewManualAddr);

    // ––– Quick toggles –––
    document.getElementById('ce-toggle-fullscreen').addEventListener('change', e => {
        gameApi('toggleFullscreen', e.target.checked);
    });
    document.getElementById('ce-toggle-airbreak').addEventListener('change', e => {
        gameApi('toggleAirBrake', e.target.checked);
    });
    document.getElementById('ce-toggle-godmode').addEventListener('change', e => {
        gameApi('toggleGodMode', e.target.checked);
    });
    document.getElementById('ce-add-money').addEventListener('click', async () => {
        await gameApi('addMoney');
        updateStatus('+$9999999 added!');
    });
    document.getElementById('ce-fly-speed').addEventListener('change', function() {
        const speed = parseFloat(this.value) || 1.0;
        gameApi('setFlySpeed', speed);
        updateAirbreakStatus(`Fly speed set to ${speed}`);
    });

    // ––– Debug logs –––
    function updateNetworkLogs() {
        const logDiv = document.getElementById('cheat-debug-log');
        if (window.getDebugLogLines) {
            logDiv.textContent = window.getDebugLogLines().join('\n');
        }
    }
    function updateErrorLogs() {
        const logDiv = document.getElementById('cheat-error-log');
        try {
            const lines = window.__gameApi.getErrorLogs();
            logDiv.textContent = lines.join('\n');
        } catch (e) {}
    }

    setInterval(() => {
        const activeTab = document.querySelector('.ce-tab-content.active');
        if (activeTab && activeTab.id === 'tab-debugger') {
            updateNetworkLogs();
            updateErrorLogs();
        }
    }, 1000);

    // ––– Tab switching –––
    document.querySelectorAll('.ce-tabs button').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.ce-tabs button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const tabId = 'tab-' + this.dataset.tab;
            document.querySelectorAll('.ce-tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if (this.dataset.tab === 'debugger') {
                updateNetworkLogs();
                updateErrorLogs();
            }
        });
    });

    // ––– Log controls –––
    document.getElementById('copy-network-logs').addEventListener('click', () => {
        const text = document.getElementById('cheat-debug-log').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    });
    document.getElementById('copy-error-logs').addEventListener('click', () => {
        const text = document.getElementById('cheat-error-log').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    });
    document.getElementById('clear-debug-log-btn').addEventListener('click', () => {
        document.getElementById('cheat-debug-log').textContent = '';
        document.getElementById('cheat-error-log').textContent = '';
        gameApi('clearLogs');
        updateStatus('Logs cleared');
    });

    // ––– Close button –––
    document.getElementById('cheat-close-btn').addEventListener('click', () => {
        ui.style.display = 'none';
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.focus();
    });

    // ––– F3 toggle (global) –––
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F3') {
            e.preventDefault();
            if (ui.style.display === 'block') {
                ui.style.display = 'none';
            } else {
                ui.style.display = 'block';
            }
        }
    });

    // ––– Airbreak status periodic update –––
    setInterval(() => {
        if (!window.gameReady) return;
        const view = new DataView(HEAPU8.buffer);
        const pedPtrAddr = 0x361c50 - 0xA0;
        if (pedPtrAddr < 0 || pedPtrAddr + 4 > view.buffer.byteLength) return;
        const pedAddr = view.getInt32(pedPtrAddr, true);
        if (pedAddr <= 0 || pedAddr + 0x400 > view.buffer.byteLength) return;
        const posAddr = pedAddr + 0x34;
        if (posAddr + 12 > view.buffer.byteLength) return;
        try {
            const x = view.getFloat32(posAddr, true);
            const y = view.getFloat32(posAddr + 4, true);
            const z = view.getFloat32(posAddr + 8, true);
            posDisplayEl.textContent = `X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}`;
        } catch(e) {}
    }, 200);

    updateStatus('Ready. Embedded.');
})();