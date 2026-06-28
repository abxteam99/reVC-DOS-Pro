// ============================================================
// Network Debugger – No panel, just logs for cheat UI
// ============================================================
(function() {
    console.log('🐞 Debugger script loaded.');

    const LOCAL_BASE = '/vcsky/fetched/';
    const CDN_BASE = 'https://cdn.dos.zone/vcsky/fetched/';

    function rewriteUrl(url) {
        if (typeof url === 'string' && url.startsWith(CDN_BASE)) {
            const localUrl = url.replace(CDN_BASE, LOCAL_BASE);
            return localUrl;
        }
        return url;
    }

    // Expose requestLog globally so the clear button can access it
    window.requestLog = [];

    function formatLogEntry(entry) {
        // Removed the type label (Loc/Ext) as requested
        return `${entry.timestamp}  ${entry.method.padEnd(8)}  ${String(entry.status).padEnd(6)}  ${entry.duration ? entry.duration+'ms' : '---'}  ${entry.url}`;
    }

    // ---- Intercept fetch ----
    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            let url = args[0] instanceof Request ? args[0].url : args[0];
            const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');
            const rewrittenUrl = rewriteUrl(url);
            if (rewrittenUrl !== url) {
                if (args[0] instanceof Request) {
                    const newRequest = new Request(rewrittenUrl, args[0]);
                    args[0] = newRequest;
                } else {
                    args[0] = rewrittenUrl;
                }
            }
            const finalUrl = rewrittenUrl;
            const startTime = performance.now();
            const logEntry = { url: finalUrl, method, timestamp: new Date().toISOString(), status: 'pending' };
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

    // ---- Intercept XMLHttpRequest ----
    if (window.XMLHttpRequest) {
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            let url, method, logEntry, startTime;

            xhr.open = function(m, u, ...rest) {
                const rewrittenUrl = rewriteUrl(u);
                url = rewrittenUrl;
                method = m;
                logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
                window.requestLog.push(logEntry);
                return originalOpen.apply(this, [m, rewrittenUrl, ...rest]);
            };

            xhr.send = function(body) {
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

    // ---- Intercept Image loads ----
    const OriginalImage = window.Image;
    const ImageSrcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
    window.Image = function(width, height) {
        const img = new OriginalImage(width, height);

        Object.defineProperty(img, 'src', {
            get: function() { return ImageSrcDescriptor.get.call(this); },
            set: function(value) {
                const rewrittenUrl = rewriteUrl(value);
                const logEntry = { url: rewrittenUrl, method: 'Image', timestamp: new Date().toISOString(), status: 'pending' };
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

                ImageSrcDescriptor.set.call(this, rewrittenUrl);
            }
        });

        return img;
    };

    // ---- Expose log lines for cheat UI ----
    window.getDebugLogLines = function() {
        return window.requestLog.map(formatLogEntry);
    };

    console.log('🐞 Debugger ready – logs available to cheat UI.');
})();