// debug.js – Offline-first CDN cache (blocks all external requests when offline)
// Toggle with toggleCDNMode() in the cheat panel Debugger tab.

(function() {
    console.log('🐞 Debugger loaded (CDN caching – offline first).');

    window.requestLog = [];
    window.requestLog.push = function() {
        Array.prototype.push.apply(this, arguments);
        while (this.length > 500) this.shift();
    };

    // ============================================================
    //  INDEXEDDB HELPERS
    // ============================================================
    var DB_NAME = 'GTAVC_CDNCache';
    var DB_VERSION = 1;
    var STORE_NAME = 'files';
    var db = null;

    function openDB() {
        return new Promise(function(resolve, reject) {
            if (db) return resolve(db);
            var request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function(e) {
                var database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'url' });
                }
            };
            request.onsuccess = function(e) {
                db = e.target.result;
                resolve(db);
            };
            request.onerror = function(e) {
                reject(e.target.error);
            };
        });
    }

    function getCached(url) {
        return openDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var req = store.get(url);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function saveToCache(url, buffer) {
        return openDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                var entry = { url: url, data: buffer, timestamp: Date.now() };
                var req = store.put(entry);
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    // ============================================================
    //  ONLINE / OFFLINE MODE
    // ============================================================
    var ONLINE_MODE = localStorage.getItem('debug_online') === 'true';
    function setOnlineMode(enabled) {
        ONLINE_MODE = enabled;
        localStorage.setItem('debug_online', enabled);
        console.log('🐞 Debugger: ' + (enabled ? 'ONLINE (fetch & cache)' : 'OFFLINE (block all external requests)'));
    }

    // Expose to console / cheat panel
    window.toggleCDNMode = function() {
        setOnlineMode(!ONLINE_MODE);
        // Update the button text if it exists
        var btn = document.getElementById('ce-toggle-cdn-btn');
        if (btn) {
            btn.textContent = 'CDN: ' + (ONLINE_MODE ? 'ONLINE' : 'OFFLINE');
            btn.style.color = ONLINE_MODE ? '#0f0' : '#ccc';
        }
        alert('CDN mode: ' + (ONLINE_MODE ? 'ONLINE' : 'OFFLINE'));
    };

    // ============================================================
    //  RESPONSE HELPERS
    // ============================================================
    function createResponse(buffer, status, statusText, contentType) {
        return new Response(buffer, {
            status: status || 200,
            statusText: statusText || 'OK',
            headers: { 'Content-Type': contentType || 'application/octet-stream' }
        });
    }

    function empty404Response() {
        return createResponse(new ArrayBuffer(0), 404, 'Not Found');
    }

    // ============================================================
    //  MAIN CDN HANDLER
    // ============================================================
    async function handleCDNRequest(url, method) {
        // --- ONLINE MODE: fetch from CDN, cache it, return it ---
        if (ONLINE_MODE) {
            try {
                var response = await originalFetch(url, { method: method });
                if (response.ok) {
                    var buffer = await response.arrayBuffer();
                    saveToCache(url, buffer).catch(function() {});
                    console.log('[debug.js] Fetched & cached:', url);
                    return createResponse(buffer, response.status, response.statusText, response.headers.get('Content-Type'));
                }
            } catch (e) {
                console.warn('[debug.js] Online fetch failed:', url, e);
            }
        }

        // --- OFFLINE (or fetch failed): try IndexedDB cache ---
        try {
            var cached = await getCached(url);
            if (cached && cached.data) {
                console.log('[debug.js] Serving from cache:', url);
                return createResponse(cached.data, 200, 'OK', 'application/octet-stream');
            }
        } catch (e) {}

        // --- Nothing available: return empty 404 (game will handle gracefully) ---
        console.log('[debug.js] Not cached – returning empty 404:', url);
        return empty404Response();
    }

    // ============================================================
    //  OVERRIDE fetch
    // ============================================================
    var originalFetch = window.fetch;
    window.fetch = function(...args) {
        var url = args[0] instanceof Request ? args[0].url : args[0];
        var method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

        // Intercept CDN requests
        if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
            var logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
            window.requestLog.push(logEntry);
            return handleCDNRequest(url, method).then(function(resp) {
                logEntry.status = resp.status;
                logEntry.duration = 0;
                return resp;
            }).catch(function(err) {
                logEntry.status = 'error';
                logEntry.error = err.message;
                return empty404Response();
            });
        }

        // Normal request – pass through
        var startTime = performance.now();
        var logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
        window.requestLog.push(logEntry);
        return originalFetch.apply(this, args)
            .then(function(response) {
                logEntry.status = response.status;
                logEntry.duration = Math.round(performance.now() - startTime);
                return response;
            })
            .catch(function(error) {
                logEntry.status = 'error';
                logEntry.error = error.message;
                return empty404Response();
            });
    };

    // ============================================================
    //  OVERRIDE XMLHttpRequest
    // ============================================================
    if (window.XMLHttpRequest) {
        var OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            var xhr = new OriginalXHR();
            var originalOpen = xhr.open;
            var originalSend = xhr.send;
            var url, method, logEntry;
            var isCDN = false;

            xhr.open = function(m, u, ...rest) {
                url = u;
                method = m;
                logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
                window.requestLog.push(logEntry);

                if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
                    isCDN = true;
                    // Handle CDN request asynchronously
                    handleCDNRequest(url, method).then(function(resp) {
                        resp.arrayBuffer().then(function(buf) {
                            Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                            Object.defineProperty(xhr, 'status', { value: resp.status, configurable: true });
                            Object.defineProperty(xhr, 'statusText', { value: resp.statusText, configurable: true });
                            Object.defineProperty(xhr, 'response', { value: buf, configurable: true });
                            Object.defineProperty(xhr, 'responseText', { value: '', configurable: true });
                            if (xhr.onload) xhr.onload();
                            if (xhr.onreadystatechange) xhr.onreadystatechange();
                            logEntry.status = resp.status;
                            logEntry.duration = 0;
                        });
                    }).catch(function(err) {
                        Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(xhr, 'status', { value: 404, configurable: true });
                        Object.defineProperty(xhr, 'statusText', { value: 'Not Found', configurable: true });
                        Object.defineProperty(xhr, 'response', { value: new ArrayBuffer(0), configurable: true });
                        Object.defineProperty(xhr, 'responseText', { value: '', configurable: true });
                        if (xhr.onload) xhr.onload();
                        if (xhr.onreadystatechange) xhr.onreadystatechange();
                        logEntry.status = 'error';
                        logEntry.error = err.message;
                    });
                    return originalOpen.apply(this, [m, url, ...rest]);
                } else {
                    return originalOpen.apply(this, [m, url, ...rest]);
                }
            };

            xhr.send = function(body) {
                if (isCDN) {
                    // Already handled in open(), do nothing
                    return;
                }
                var startTime = performance.now();
                xhr.addEventListener('loadend', function() {
                    logEntry.status = this.status;
                    logEntry.duration = Math.round(performance.now() - startTime);
                });
                xhr.addEventListener('error', function() { logEntry.status = 'error'; });
                return originalSend.call(this, body);
            };

            return xhr;
        };
    }

    // ============================================================
    //  DEBUG LOGS
    // ============================================================
    window.getDebugLogLines = function() {
        return window.requestLog.map(function(e) {
            return e.timestamp + '  ' + e.method.padEnd(8) + '  ' + String(e.status).padEnd(6) + '  ' + (e.duration ? e.duration+'ms' : '---') + '  ' + e.url;
        });
    };

    // ============================================================
    //  INIT
    // ============================================================
    setOnlineMode(ONLINE_MODE);
    console.log('🐞 Debugger ready – ' + (ONLINE_MODE ? 'ONLINE (caching)' : 'OFFLINE (all CDN blocked)') + '. Toggle with toggleCDNMode().');
})();