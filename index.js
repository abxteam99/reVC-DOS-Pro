(function() {
    var modules = [
        'modules/runtime.js',               'modules/runtime_invoke_functions.js',
'modules/runtime_wasm_imports.js',   
'modules/packages/en.js',
        'modules/loader.js',
        'modules/fs.js',
        'modules/audio.js',
        'modules/graphics.js',
        'modules/events.js',
        'modules/fetch.js',
        'modules/asm_consts/en.js',
        'modules/main.js'
    ];

    if (typeof importScripts === 'function') {
        importScripts.apply(null, modules);
    } else {
        var loadNext = function(i) {
            if (i < modules.length) {
                var s = document.createElement('script');
                s.src = modules[i];
                s.async = false;
                s.onload = function() { loadNext(i + 1); };
                s.onerror = function() { console.error('Failed to load module: ' + modules[i]); };
                document.body.appendChild(s);
            }
        };
        loadNext(0);
    }
})();