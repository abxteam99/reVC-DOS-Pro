// ============================================================
// Network Debugger – Offline Mode (No CDN, No Internet)
// ============================================================
(function() {
    console.log('🐞 Debugger loaded (offline mode).');

    // We no longer need rewriteUrl – we block everything.
    // No local fallback, no CDN.

    window.requestLog = [];
    window.requestLog.push = function() {
        Array.prototype.push.apply(this, arguments);
        while (this.length > 500) this.shift();
    };

    function formatLogEntry(entry) {
        return `${entry.timestamp}  ${entry.method.padEnd(8)}  ${String(entry.status).padEnd(6)}  ${entry.duration ? entry.duration+'ms' : '---'}  ${entry.url}`;
    }

    // ----------------------------------------------------------
    // FETCH INTERCEPTION – Block all CDN / local fallback requests
    // ----------------------------------------------------------
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            let url = args[0] instanceof Request ? args[0].url : args[0];
            const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

            // Block any request to CDN or /vcsky/fetched/
            if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
                console.log(`[debug.js] 🚫 Blocked CDN/fetched request: ${url}`);
                // Return 204 No Content – game will treat as "loaded"
                return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
            }

            // For all other requests, log and forward
            const startTime = performance.now();
            const logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
            window.requestLog.push(logEntry);

            return originalFetch.apply(this, args)
                .then(response => {
                    logEntry.status = response.status;
                    logEntry.duration = Math.round(performance.now() - startTime);
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                    return response;
                })
                .catch(error => {
                    logEntry.status = 'error';
                    logEntry.error = error.message;
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                    throw error;
                });
        };
    }

    // ----------------------------------------------------------
    // XHR INTERCEPTION – Block all CDN / local fallback requests
    // ----------------------------------------------------------
    if (window.XMLHttpRequest) {
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            let url, method, logEntry, startTime;
            let isBlocked = false;

            xhr.open = function(m, u, ...rest) {
                url = u;
                method = m;
                logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
                window.requestLog.push(logEntry);

                // Block CDN / fetched path
                if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
                    isBlocked = true;
                    // Still call open but we'll override send
                    return originalOpen.apply(this, [m, url, ...rest]);
                } else {
                    return originalOpen.apply(this, [m, url, ...rest]);
                }
            };

            xhr.send = function(body) {
                if (isBlocked) {
                    console.log(`[debug.js] 🚫 Blocked XHR to CDN/fetched: ${url}`);
                    // Return a successful empty response
                    // We need to simulate the response events
                    setTimeout(() => {
                        Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(xhr, 'status', { value: 204, configurable: true });
                        Object.defineProperty(xhr, 'statusText', { value: 'No Content', configurable: true });
                        Object.defineProperty(xhr, 'response', { value: null, configurable: true });
                        Object.defineProperty(xhr, 'responseText', { value: '', configurable: true });
                        if (xhr.onload) xhr.onload();
                        if (xhr.onreadystatechange) xhr.onreadystatechange();
                        logEntry.status = 204;
                        logEntry.duration = 0;
                        if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                    }, 0);
                    return;
                }

                // Normal XHR
                startTime = performance.now();
                xhr.addEventListener('loadend', function() {
                    logEntry.status = this.status;
                    logEntry.duration = Math.round(performance.now() - startTime);
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                });
                xhr.addEventListener('error', function() {
                    logEntry.status = 'error';
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                });
                return originalSend.call(this, body);
            };

            return xhr;
        };
    }

    // ----------------------------------------------------------
    // IMAGE INTERCEPTION – Block CDN / fetched images
    // ----------------------------------------------------------
    const OriginalImage = window.Image;
    const ImageSrcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
    window.Image = function(width, height) {
        const img = new OriginalImage(width, height);

        Object.defineProperty(img, 'src', {
            get: function() { return ImageSrcDescriptor.get.call(this); },
            set: function(value) {
                if (value.includes('cdn.dos.zone') || value.includes('/vcsky/fetched/')) {
                    console.log(`[debug.js] 🚫 Blocked Image to CDN/fetched: ${value}`);
                    // Use a tiny transparent PNG as dummy
                    const dummySrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
                    ImageSrcDescriptor.set.call(this, dummySrc);
                    return;
                }
                // Normal image loading
                const logEntry = { url: value, method: 'Image', timestamp: new Date().toISOString(), status: 'pending' };
                window.requestLog.push(logEntry);
                const startTime = performance.now();

                img.addEventListener('load', function onLoad() {
                    logEntry.status = 200;
                    logEntry.duration = Math.round(performance.now() - startTime);
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                }, { once: true });
                img.addEventListener('error', function onError() {
                    logEntry.status = 'error';
                    if (typeof window.updateDebugLog === 'function') window.updateDebugLog();
                }, { once: true });

                ImageSrcDescriptor.set.call(this, value);
            }
        });

        return img;
    };

    window.getDebugLogLines = function() {
        return window.requestLog.map(formatLogEntry);
    };

    console.log('🐞 Debugger ready (offline mode) – all CDN requests blocked.');
})();