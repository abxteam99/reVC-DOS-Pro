// debug.js
(function() {
    console.log('🐞 Debugger loaded (offline mode).');

    window.requestLog = [];
    window.requestLog.push = function() {
        Array.prototype.push.apply(this, arguments);
        while (this.length > 500) this.shift();
    };

    function formatLogEntry(entry) {
        return `${entry.timestamp}  ${entry.method.padEnd(8)}  ${String(entry.status).padEnd(6)}  ${entry.duration ? entry.duration+'ms' : '---'}  ${entry.url}`;
    }

    if (window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            let url = args[0] instanceof Request ? args[0].url : args[0];
            const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

            if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
                console.log(`[debug.js] 🚫 Blocked CDN/fetched request: ${url}`);
                return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
            }

            const startTime = performance.now();
            const logEntry = { url, method, timestamp: new Date().toISOString(), status: 'pending' };
            window.requestLog.push(logEntry);

            return originalFetch.apply(this, args)
                .then(response => {
                    logEntry.status = response.status;
                    logEntry.duration = Math.round(performance.now() - startTime);
                    return response;
                })
                .catch(error => {
                    logEntry.status = 'error';
                    logEntry.error = error.message;
                    throw error;
                });
        };
    }

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

                if (url.includes('cdn.dos.zone') || url.includes('/vcsky/fetched/')) {
                    isBlocked = true;
                    return originalOpen.apply(this, [m, url, ...rest]);
                } else {
                    return originalOpen.apply(this, [m, url, ...rest]);
                }
            };

            xhr.send = function(body) {
                if (isBlocked) {
                    console.log(`[debug.js] 🚫 Blocked XHR to CDN/fetched: ${url}`);
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
                    }, 0);
                    return;
                }

                startTime = performance.now();
                xhr.addEventListener('loadend', function() {
                    logEntry.status = this.status;
                    logEntry.duration = Math.round(performance.now() - startTime);
                });
                xhr.addEventListener('error', function() {
                    logEntry.status = 'error';
                });
                return originalSend.call(this, body);
            };

            return xhr;
        };
    }

    window.getDebugLogLines = function() {
        return window.requestLog.map(formatLogEntry);
    };

    console.log('🐞 Debugger ready (offline mode) – all CDN requests blocked.');
})();