(function() {
    const dataInput = document.getElementById('data-file-input');
    const wasmInput = document.getElementById('wasm-file-input');
    const dataStatus = document.getElementById('data-status');
    const wasmStatus = document.getElementById('wasm-status');
    const startBtn = document.getElementById('start-game-btn');
    const progressText = document.getElementById('progress-text');
    const removeDataBtn = document.getElementById('remove-data-btn');
    const removeWasmBtn = document.getElementById('remove-wasm-btn');
    const overlay = document.getElementById('file-loader-overlay');
    const dataErrorMsg = document.getElementById('data-error-msg');
    const wasmErrorMsg = document.getElementById('wasm-error-msg');

    let dataBuffer = null;
    let wasmBuffer = null;
    let dataLoaded = false;
    let wasmLoaded = false;

    let resolveReady = null;
    const readyPromise = new Promise(resolve => {
        resolveReady = resolve;
    });
    window._fileLoaderReady = readyPromise;

    function getFileExtension(filename) {
        if (!filename.includes('.')) return '';
        return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
    }

    function updateUI() {
        if (dataLoaded) {
            dataStatus.textContent = `Loaded ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB`;
            dataStatus.className = 'status loaded';
            removeDataBtn.classList.add('visible');
            dataErrorMsg.classList.remove('visible');
        } else {
            dataStatus.textContent = 'Offline';
            dataStatus.className = 'status';
            removeDataBtn.classList.remove('visible');
        }

        if (wasmLoaded) {
            wasmStatus.textContent = `Loaded ${(wasmBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`;
            wasmStatus.className = 'status loaded';
            removeWasmBtn.classList.add('visible');
            wasmErrorMsg.classList.remove('visible');
        } else {
            wasmStatus.textContent = 'Offline';
            wasmStatus.className = 'status';
            removeWasmBtn.classList.remove('visible');
        }

        if (dataLoaded && wasmLoaded) {
            startBtn.disabled = false;
            startBtn.textContent = 'START GAME';
            progressText.textContent = '✅ Both files ready! Click START.';
        } else {
            startBtn.disabled = true;
            startBtn.textContent = 'Initialize';
            progressText.textContent = 'Provide system components to execute.';
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    dataInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) {
            dataBuffer = null;
            dataLoaded = false;
            dataErrorMsg.classList.remove('visible');
            updateUI();
            return;
        }
        const ext = getFileExtension(file.name);
        if (ext !== 'data') {
            dataStatus.textContent = 'Invalid file';
            dataStatus.className = 'status error';
            dataErrorMsg.classList.add('visible');
            dataBuffer = null;
            dataLoaded = false;
            updateUI();
            return;
        }
        dataErrorMsg.classList.remove('visible');
        progressText.textContent = '⏳ Reading data file...';
        try {
            const buffer = await readFile(file);
            dataBuffer = new Uint8Array(buffer);
            dataLoaded = true;
            updateUI();
        } catch (err) {
            dataStatus.textContent = '❌ Error reading file';
            dataStatus.className = 'status error';
            dataBuffer = null;
            dataLoaded = false;
            updateUI();
        }
    });

    wasmInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) {
            wasmBuffer = null;
            wasmLoaded = false;
            wasmErrorMsg.classList.remove('visible');
            updateUI();
            return;
        }
        const ext = getFileExtension(file.name);
        if (ext !== 'wasm') {
            wasmStatus.textContent = 'Invalid file';
            wasmStatus.className = 'status error';
            wasmErrorMsg.classList.add('visible');
            wasmBuffer = null;
            wasmLoaded = false;
            updateUI();
            return;
        }
        wasmErrorMsg.classList.remove('visible');
        progressText.textContent = '⏳ Reading WASM file...';
        try {
            const buffer = await readFile(file);
            wasmBuffer = buffer;
            wasmLoaded = true;
            updateUI();
        } catch (err) {
            wasmStatus.textContent = '❌ Error reading file';
            wasmStatus.className = 'status error';
            wasmBuffer = null;
            wasmLoaded = false;
            updateUI();
        }
    });

    removeDataBtn.addEventListener('click', function() {
        dataInput.value = '';
        dataBuffer = null;
        dataLoaded = false;
        dataErrorMsg.classList.remove('visible');
        updateUI();
    });
    removeWasmBtn.addEventListener('click', function() {
        wasmInput.value = '';
        wasmBuffer = null;
        wasmLoaded = false;
        wasmErrorMsg.classList.remove('visible');
        updateUI();
    });

    startBtn.addEventListener('click', function() {
        if (dataLoaded && wasmLoaded) {
            overlay.style.display = 'none';
            resolveReady({ data: dataBuffer, wasm: wasmBuffer });
        } else {
            alert('Please select both files first.');
        }
    });

    updateUI();
})();