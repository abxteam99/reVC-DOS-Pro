// ============================================================
// PATCH: Safe pointer lock to avoid WrongDocumentError
// ============================================================
if (HTMLCanvasElement.prototype.requestPointerLock) {
    const originalLock = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function() {
        try {
            if (document.contains(this) && document.hasFocus()) {
                originalLock.call(this);
            } else {
                console.warn('Pointer lock skipped: canvas not ready or no focus.');
            }
        } catch (e) {
            console.warn('Pointer lock error:', e.message);
        }
    };
}

// ============================================================
// GTA: Vice City – Main Game Logic (Offline/Local)
// ============================================================

// ------------------------------------------------------------------
// 1. GLOBALS & SETTINGS
// ------------------------------------------------------------------

var haveOriginalGame = true;
localStorage.setItem('vcsky.haveOriginalGame', 'true');

var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById('spinner');
var loaderContainer = document.getElementById('loader-container');

var defaultDataContent = "/vcbr/vc-sky-en-v6.data";
var defaultWasmContent = "/vcbr/vc-sky-en-v6.wasm";
var data_content = defaultDataContent;
var wasm_content = defaultWasmContent;

// ============================================================
// READ SETTINGS FROM localStorage / window.__* flags
// ============================================================
let cheatsEnabled = window.__cheatsEnabled !== undefined ? window.__cheatsEnabled : true;
let lowMemory = window.__lowMemoryMode || false;
let showTouchControls = window.__showTouchControls !== undefined ? window.__showTouchControls : true;

// Determine touch mode based on settings and detection
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
                      window.matchMedia('(pointer: coarse)').matches;
const storedMode = localStorage.getItem('vcsky.mode') || 'auto';

let isTouch = false;
if (storedMode === 'touch') {
    isTouch = true;
} else if (storedMode === 'desktop') {
    isTouch = false;
} else { // 'auto' – detect
    isTouch = isTouchDevice;
}
if (window.__isTouchMode !== undefined) {
    isTouch = window.__isTouchMode;
}
// If the user explicitly chose 'touch', force it (even if detection failed)
if (storedMode === 'touch' && !isTouch) {
    isTouch = true;
}
window.__isTouchMode = isTouch;
document.body.dataset.isTouch = isTouch ? '1' : '0';

console.log(`[Game] Settings: cheats=${cheatsEnabled}, touch=${isTouch}, showControls=${showTouchControls}, lowMem=${lowMemory}`);

// ------------------------------------------------------------------
// 2. UTILITY FUNCTIONS
// ------------------------------------------------------------------

const t = (key) => ({
    clickToPlayFull: "Click to play",
    downloading: "Downloading",
    clickToContinue: "Click to continue..."
}[key] || key);

function setStatus(text) {
    if (!text) {
        if (progressElement) progressElement.hidden = true;
        if (spinnerElement) spinnerElement.hidden = true;
        if (loaderContainer) loaderContainer.style.display = 'none';
        return;
    }
    const match = text.match(/(.+)\((\d+\.?\d*)\/(\d+)\)/);
    if (match) {
        const [current, total] = match.slice(2, 4).map(Number);
        const percent = (current / total * 100).toFixed(0);
        if (statusElement) statusElement.textContent = t("downloading") + ` ${percent}%`;
        if (progressElement) {
            progressElement.value = current;
            progressElement.max = total;
            progressElement.hidden = false;
        }
        if (spinnerElement) {
            spinnerElement.hidden = false;
            const fill = spinnerElement.querySelector('.progress-bar-fill');
            if (fill) fill.style.width = percent + '%';
        }
    } else {
        if (statusElement) statusElement.textContent = text;
    }
}

function forceTouchRecalc() {
    if (!isTouch) return;
    const wrapper = document.getElementById('touch-controls-wrapper');
    if (!wrapper) return;
    // Apply showTouchControls: if false, hide it
    wrapper.style.display = showTouchControls ? 'block' : 'none';
    void wrapper.offsetHeight;
    wrapper.style.display = showTouchControls ? 'block' : 'none';
    console.log('[Game] Touch controls reflow forced.');
}

function reapplyTouchControls() {
    if (!isTouch) return;
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
        canvas.style.touchAction = 'none';
    }
    document.body.setAttribute('data-is-touch', '1');
    const wrapper = document.getElementById('touch-controls-wrapper');
    if (wrapper) {
        wrapper.style.display = showTouchControls ? 'block' : 'none';
    }
    forceTouchRecalc();
}

function setMenuModeActive(active) {
    if (!isTouch) return;
    const lookElement = document.getElementById('look');
    const moveElement = document.getElementById('move');
    const canvas = document.getElementById('canvas');
    if (active) {
        if (lookElement) { lookElement.style.pointerEvents = 'none'; lookElement.style.touchAction = 'auto'; }
        if (moveElement) { moveElement.style.pointerEvents = 'none'; moveElement.style.touchAction = 'auto'; }
        if (canvas) canvas.style.touchAction = 'auto';
    } else {
        if (lookElement) { lookElement.style.pointerEvents = 'auto'; lookElement.style.touchAction = 'none'; }
        if (moveElement) { moveElement.style.pointerEvents = 'auto'; moveElement.style.touchAction = 'none'; }
        if (canvas) canvas.style.touchAction = 'none';
    }
}

// ------------------------------------------------------------------
// 3. FILE SELECTION (OFFLINE LOADER)
// ------------------------------------------------------------------

let loadedDataBuffer = null;
let loadedWasmBuffer = null;

function waitForFileSelection() {
    return new Promise((resolve) => {
        const dataInput = document.getElementById('data-file-input');
        const wasmInput = document.getElementById('wasm-file-input');
        const startBtn = document.getElementById('start-game-btn');
        const dataStatus = document.getElementById('data-status');
        const wasmStatus = document.getElementById('wasm-status');
        const progressText = document.getElementById('progress-text');

        let dataLoaded = false;
        let wasmLoaded = false;

        function checkReady() {
            if (dataLoaded && wasmLoaded) {
                startBtn.disabled = false;
                startBtn.textContent = 'START GAME';
                progressText.textContent = '✅ Both files ready! Click START.';
            }
        }

        dataInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            progressText.textContent = '⏳ Reading data file...';
            const reader = new FileReader();
            reader.onload = function(e) {
                loadedDataBuffer = new Uint8Array(e.target.result);
                dataLoaded = true;
                dataStatus.textContent = `✅ Loaded ${(loadedDataBuffer.length / 1024 / 1024).toFixed(2)} MB`;
                dataStatus.className = 'status loaded';
                progressText.textContent = '📦 Data file ready.';
                checkReady();
            };
            reader.onerror = function() {
                dataStatus.textContent = '❌ Error reading file';
                dataStatus.className = 'status error';
                progressText.textContent = '❌ Failed to read data file.';
            };
            reader.readAsArrayBuffer(file);
        });

        wasmInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            progressText.textContent = '⏳ Reading WASM file...';
            const reader = new FileReader();
            reader.onload = function(e) {
                loadedWasmBuffer = e.target.result;
                wasmLoaded = true;
                wasmStatus.textContent = `✅ Loaded ${(loadedWasmBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`;
                wasmStatus.className = 'status loaded';
                progressText.textContent = '📦 WASM file ready.';
                checkReady();
            };
            reader.onerror = function() {
                wasmStatus.textContent = '❌ Error reading file';
                wasmStatus.className = 'status error';
                progressText.textContent = '❌ Failed to read WASM file.';
            };
            reader.readAsArrayBuffer(file);
        });

        startBtn.addEventListener('click', function() {
            if (dataLoaded && wasmLoaded) {
                document.getElementById('file-loader-overlay').style.display = 'none';
                resolve({ data: loadedDataBuffer, wasm: loadedWasmBuffer });
            } else {
                alert('Please select both files first.');
            }
        });
    });
}

// ------------------------------------------------------------------
// 4. GAME START
// ------------------------------------------------------------------

function startGame() {
    if (loaderContainer) loaderContainer.style.display = "flex";
    if (typeof window.updateDebugVisibility === 'function') window.updateDebugVisibility();
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.width = 640;
        canvas.height = 480;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.display = 'block';
        canvas.style.margin = '0';
        canvas.style.objectFit = 'fill';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.touchAction = 'none';
        canvas.style.pointerEvents = 'auto';
    }
    if (isTouch) { reapplyTouchControls(); }

    // ---- Apply cheatsEnabled: hide cheat button if disabled ----
    const cheatBtn = document.querySelector('.touch-control.cheat');
    if (cheatBtn) {
        cheatBtn.style.display = cheatsEnabled ? 'block' : 'none';
    }

    if (typeof AudioContext !== 'undefined') {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch (err) {}
    }

    function onFullscreenChange() {
        const canvasEl = document.getElementById('canvas');
        if (canvasEl) {
            canvasEl.style.touchAction = 'none';
            canvasEl.style.pointerEvents = 'auto';
            if (isTouch) {
                setTimeout(reapplyTouchControls, 50);
            }
            if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
                canvasEl.focus();
            }
        }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);

    window._fullscreenHandlers = { onFullscreenChange };

    waitForFileSelection().then(files => {
        const dataBuffer = files.data;
        const wasmBuffer = files.wasm;
        if (spinnerElement) spinnerElement.hidden = true;
        setStatus(t("clickToContinue"));
        setTimeout(() => {
            loadGame(dataBuffer, wasmBuffer);
        }, 100);
    }).catch(err => {
        console.error('[Game] File selection error:', err);
        setStatus('Failed to load files: ' + err.message);
    });
}

// ------------------------------------------------------------------
// 5. LOAD GAME (Emscripten Module)
// ------------------------------------------------------------------

window.gameReady = false;

async function loadGame(data, wasmBuffer) {
    document.body.classList.add('gameIsStarted');
    var Module = {
        mainCalled: () => {
            try {
                Module.FS.unlink("/vc-assets/local/revc.ini");
                Module.FS.createDataFile("/vc-assets/local/revc.ini", 0, revc_ini, revc_ini.length);
            } catch (e) { console.error('mainCalled error:', e); }
        },
        syncRevcIni: () => {},
        preRun: [],
        postRun: [],
        print: (...args) => console.log(args.join(' ')),
        printErr: (...args) => {
            const msg = args.join(' ');
            if (msg.includes('alGetProcAddress() called without a valid context')) return;
            console.error(msg);
        },
        getPreloadedPackage: () => data.buffer,
        canvas: (function() {
            const canvas = document.getElementById('canvas');
            canvas.addEventListener('webglcontextlost', (e) => {
                if (statusElement) statusElement.textContent = 'WebGL context lost. Please reload the page.';
                e.preventDefault();
                setTimeout(() => { location.reload(); }, 2000);
            });
            canvas.addEventListener('webglcontextrestored', () => {
                if (statusElement) statusElement.textContent = 'WebGL context restored.';
                if (Module && Module.canvas) { Module.canvas.width = Module.canvas.width; }
            });
            return canvas;
        })(),
        setStatus,
        totalDependencies: 0,
        monitorRunDependencies: (num) => {
            Module.totalDependencies = Math.max(Module.totalDependencies, num);
            Module.setStatus(`Preparing... (${Module.totalDependencies - num}/${Module.totalDependencies})`);
        },
        hotelMission: () => {},
    };
    Module.log = Module.print;

    Module.instantiateWasm = async (info, receiveInstance) => {
        console.log('[Game] Using user-provided WASM buffer');
        try {
            const module = await WebAssembly.instantiate(wasmBuffer, info);
            return receiveInstance(module.instance, module);
        } catch (e) {
            const errMsg = e.message || 'WASM instantiate error';
            setStatus(errMsg);
            console.error('[Game] WASM instantiate error:', errMsg);
            throw e;
        }
    };

    Module.arguments = window.location.search.slice(1).split('&').filter(Boolean).map(decodeURIComponent);
    window.onbeforeunload = (e) => { e.preventDefault(); return ''; };
    window.Module = Module;

    Module['postRun'].push(function() {
        window.gameReady = true;
        if (typeof getWasmTableEntry !== 'undefined') {
            const originalGetWasmTableEntry = getWasmTableEntry;
            getWasmTableEntry = function(funcPtr) {
                var entry = originalGetWasmTableEntry(funcPtr);
                if (typeof entry !== 'function') {
                    return function() {};
                }
                return entry;
            };
        }
        if (isTouch) { setTimeout(reapplyTouchControls, 200); }
    });

    const wrapper = document.getElementById('touch-controls-wrapper');
    if (wrapper) {
        if (isTouch && showTouchControls) { wrapper.style.display = 'block'; }
        else { wrapper.style.display = 'none'; }
    }
    if (isTouch) {
        const canvasEl = document.getElementById('canvas');
        if (canvasEl) {
            canvasEl.style.touchAction = 'none';
            canvasEl.style.pointerEvents = 'auto';
        }

        const emulator = new GamepadEmulator();
        window._emulator = emulator;
        emulator.AddEmulatedGamepad(0, true);

        const $ = (sel) => document.querySelector(sel);

        function setupJoystick(element, xAxis, yAxis, invertY = true) {
            if (!element) return;
            let activeTouchId = null;
            const maxDist = 100;

            const getCenter = (el) => {
                const rect = el.getBoundingClientRect();
                return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            };

            const updateAxes = (clientX, clientY, center) => {
                let dx = clientX - center.cx;
                let dy = clientY - center.cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }
                let normX = dx / maxDist;
                let normY = dy / maxDist;
                normX = Math.min(1, Math.max(-1, normX));
                normY = Math.min(1, Math.max(-1, normY));
                emulator.MoveAxis(0, xAxis, normX);
                emulator.MoveAxis(0, yAxis, invertY ? -normY : normY);
            };

            const resetAxes = () => {
                emulator.MoveAxis(0, xAxis, 0);
                emulator.MoveAxis(0, yAxis, 0);
            };

            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (activeTouchId !== null) return;
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                const center = getCenter(element);
                updateAxes(touch.clientX, touch.clientY, center);

                const onMove = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            const centerNow = getCenter(element);
                            updateAxes(t.clientX, t.clientY, centerNow);
                        }
                    }
                };

                const onEnd = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            resetAxes();
                            activeTouchId = null;
                            document.removeEventListener('touchmove', onMove);
                            document.removeEventListener('touchend', onEnd);
                            document.removeEventListener('touchcancel', onEnd);
                        }
                    }
                };

                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onEnd, { passive: false });
                document.addEventListener('touchcancel', onEnd, { passive: false });
            }, { passive: false });

            element.addEventListener('touchcancel', () => {
                if (activeTouchId !== null) {
                    resetAxes();
                    activeTouchId = null;
                }
            }, { passive: true });
        }

        const moveEl = document.getElementById('move');
        const lookEl = document.getElementById('look');
        if (moveEl) setupJoystick(moveEl, 0, 1, true);
        if (lookEl) setupJoystick(lookEl, 2, 3, true);

        function setupButton(selector, buttonIndex) {
            const el = document.querySelector(selector);
            if (!el) return;

            const press = (e) => {
                e.preventDefault();
                emulator.PressButton(0, buttonIndex, 1, true);
            };
            const release = (e) => {
                e.preventDefault();
                emulator.PressButton(0, buttonIndex, 0, false);
            };

            el.addEventListener('touchstart', press, { passive: false });
            el.addEventListener('touchend', release, { passive: false });
            el.addEventListener('touchcancel', release, { passive: true });

            el.addEventListener('mousedown', press);
            el.addEventListener('mouseup', release);
            el.addEventListener('mouseleave', release);
        }

        setupButton('.touch-control.menu', 9);
        setupButton('.touch-control.car.getIn', 3);
        setupButton('.touch-control.run', 0);
        setupButton('.touch-control.fist', 1);
        setupButton('.touch-control.drift', 5);
        setupButton('.touch-control.jump', 2);
        setupButton('.touch-control.mobile', 4);
        setupButton('.touch-control.job', 11);
        setupButton('.touch-control.radio', 12);
        setupButton('.touch-control.weapon', 7);
        setupButton('.touch-control.camera', 8);
        setupButton('.touch-control.horn', 10);
        setupButton('.touch-control.fireRight', 7);
        setupButton('.touch-control.fireLeft', 6);
        setupButton('.touch-control.down', 13);
        setupButton('.touch-control.back', 3);

        console.log('✅ Universal touch controls initialized.');

        const menuObserver = new MutationObserver(() => {
            const isMenu = document.body.dataset.stateMenu === '1';
            setMenuModeActive(isMenu);
        });
        menuObserver.observe(document.body, { attributes: true, attributeFilter: ['data-state-menu'] });
        setMenuModeActive(document.body.dataset.stateMenu === '1');
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'index.js';
    document.body.appendChild(script);
    setStatus("");
}

// ------------------------------------------------------------------
// 6. CHEAT FUNCTIONS & GAME API (with cheatsEnabled check)
// ------------------------------------------------------------------

const revc_iniDefault = `…`;
const revc_ini = (() => {
    const cached = localStorage.getItem('vcsky.revc.ini');
    return cached || revc_iniDefault;
})();

// ============================================================
// MODIFIED: typeCheat now respects cheatsEnabled
// ============================================================
window.typeCheat = async function(code) {
    if (!cheatsEnabled) {
        console.warn('Cheats are disabled.');
        return;
    }
    console.log("Typing cheat:", code);

    if (!window.gameReady) {
        console.warn('Cheat ignored – game not ready yet.');
        return;
    }
    if (typeof _malloc !== 'function' || typeof getWasmTableEntry !== 'function' || typeof HEAPU8 === 'undefined') {
        console.warn('Cheat ignored – runtime not fully initialised.');
        return;
    }
    if (typeof JSEvents === 'undefined' || !JSEvents.eventHandlers) return;

    const handlers = JSEvents.eventHandlers.filter(h => {
        if (!h.callbackfunc) return false;
        if (h.eventTypeString !== 'keydown' && h.eventTypeString !== 'keypress' && h.eventTypeString !== 'keyup') return false;
        const entry = getWasmTableEntry(h.callbackfunc);
        return typeof entry === 'function';
    });

    const eventDataPtr = _malloc(160);
    for (let i = 0; i < code.length; i++) {
        const char = code[i].toUpperCase();
        const keyCode = char.charCodeAt(0);
        const fillBuffer = () => {
            for (let j = 0; j < 160; j++) HEAPU8[eventDataPtr + j] = 0;
            HEAPF64[eventDataPtr >> 3] = performance.now();
            const idx = eventDataPtr >> 2;
            HEAP32[idx + 5] = keyCode;
            HEAP32[idx + 6] = keyCode;
            HEAP32[idx + 7] = keyCode;
            stringToUTF8(char, eventDataPtr + 32, 32);
            stringToUTF8('Key' + char, eventDataPtr + 64, 32);
            stringToUTF8(char, eventDataPtr + 96, 32);
        };

        for (const h of handlers) {
            fillBuffer();
            try { if (h.eventTypeString === 'keydown') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData); } catch(e) {}
            fillBuffer();
            try { if (h.eventTypeString === 'keypress') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData); } catch(e) {}
            fillBuffer();
            try { if (h.eventTypeString === 'keyup') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData); } catch(e) {}
        }
        await new Promise(r => setTimeout(r, 5));
    }
    _free(eventDataPtr);
};

// ----- Other cheat functions (addMoney, toggleGodMode, etc.) remain unchanged -----
window._scanMemory = function(value, type) {
    const results = [];
    const view = new DataView(HEAPU8.buffer);
    const bufferLen = view.buffer.byteLength;
    const step = (type === 'i8') ? 1 : 4;
    for (let i = 0; i < bufferLen - 8; i += step) {
        let match = false;
        let foundType = type;
        if (type === 'any') {
            try {
                const i32 = view.getInt32(i, true);
                if (Math.abs(i32 - value) <= 0.5) { match = true; foundType = 'i32'; }
            } catch(e) {}
            if (!match) {
                try {
                    const f32 = view.getFloat32(i, true);
                    if (isFinite(f32) && Math.abs(f32 - value) <= 0.5) { match = true; foundType = 'f32'; }
                } catch(e) {}
            }
            if (!match) {
                try {
                    const i16 = view.getInt16(i, true);
                    if (Math.abs(i16 - value) <= 0.5) { match = true; foundType = 'i16'; }
                } catch(e) {}
            }
            if (!match) {
                try {
                    const i8 = view.getInt8(i);
                    if (Math.abs(i8 - value) <= 0.5) { match = true; foundType = 'i8'; }
                } catch(e) {}
            }
        } else {
            try {
                switch(type) {
                    case 'i32': match = Math.abs(view.getInt32(i, true) - value) <= 0.5; break;
                    case 'f32': match = isFinite(view.getFloat32(i, true)) && Math.abs(view.getFloat32(i, true) - value) <= 0.5; break;
                    case 'i16': match = Math.abs(view.getInt16(i, true) - value) <= 0.5; break;
                    case 'i8': match = Math.abs(view.getInt8(i) - value) <= 0.5; break;
                }
            } catch(e) {}
        }
        if (match) {
            let currentVal;
            try {
                switch(foundType) {
                    case 'i32': currentVal = view.getInt32(i, true); break;
                    case 'f32': currentVal = view.getFloat32(i, true); break;
                    case 'i16': currentVal = view.getInt16(i, true); break;
                    case 'i8': currentVal = view.getInt8(i); break;
                }
            } catch(e) { continue; }
            results.push({ addr: i, type: foundType, lastVal: currentVal });
            if (results.length > 10000) break;
        }
    }
    return results;
};

window.addMoney = function() {
    const view = new DataView(HEAPU8.buffer);
    const bufLen = view.buffer.byteLength;
    const moneyAddr = 0x361c50;
    if (moneyAddr >= bufLen - 4) { console.warn('Money address out of range'); return; }
    try {
        const current = view.getInt32(moneyAddr, true);
        view.setInt32(moneyAddr, current + 9999999, true);
        console.log('💰 +$9999999 added');
    } catch(e) { console.error('Failed to add money:', e); }
};

let godModeEnabled = false;
window.toggleGodMode = function(enable) {
    if (enable !== undefined) godModeEnabled = enable;
    else godModeEnabled = !godModeEnabled;
    if (godModeEnabled) {
        const view = new DataView(HEAPU8.buffer);
        const pedPtrAddr = 0x361c50 - 0xA0;
        if (pedPtrAddr < view.buffer.byteLength - 4) {
            const pedAddr = view.getInt32(pedPtrAddr, true);
            if (pedAddr > 0 && pedAddr < view.buffer.byteLength - 0x350) {
                view.setFloat32(pedAddr + 0x350, 999.0, true);
            }
        }
        console.log('🛡️ GodMode ON');
    } else {
        console.log('🛡️ GodMode OFF');
    }
};

let airbreakEnabled = false;
window.toggleAirBrake = function(enable) {
    if (enable !== undefined) airbreakEnabled = enable;
    else airbreakEnabled = !airbreakEnabled;
    if (typeof window._updateAirBreakUI === 'function') {
        window._updateAirBreakUI(airbreakEnabled);
    }
    console.log('AirBreak:', airbreakEnabled ? 'ON' : 'OFF');
};

window.setFlySpeed = function(speed) {
    console.log('Fly speed set to', speed);
    localStorage.setItem('cheat-fly-speed', String(speed));
};

window.readMemory = function(addr, type) {
    const view = new DataView(HEAPU8.buffer);
    if (addr < 0 || addr >= view.buffer.byteLength - 8) return null;
    try {
        switch(type) {
            case 'i32': return view.getInt32(addr, true);
            case 'f32': return view.getFloat32(addr, true);
            case 'i16': return view.getInt16(addr, true);
            case 'i8': return view.getInt8(addr);
            case 'f64': return view.getFloat64(addr, true);
            default: return null;
        }
    } catch(e) { return null; }
};

window.writeMemory = function(addr, type, value) {
    const view = new DataView(HEAPU8.buffer);
    if (addr < 0 || addr >= view.buffer.byteLength - 8) return;
    try {
        switch(type) {
            case 'i32': view.setInt32(addr, value, true); break;
            case 'f32': view.setFloat32(addr, value, true); break;
            case 'i16': view.setInt16(addr, value, true); break;
            case 'i8': view.setInt8(addr, value); break;
            case 'f64': view.setFloat64(addr, value, true); break;
        }
    } catch(e) { throw new Error('Write failed: ' + e.message); }
};

window._errorLogs = [];
function captureError(msg, type) {
    const timestamp = new Date().toISOString();
    window._errorLogs.push({ timestamp, message: msg, type });
    if (window._errorLogs.length > 200) window._errorLogs.shift();
}
const originalConsoleError = console.error;
console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('[CheatEngine]')) { originalConsoleError.apply(console, args); return; }
    captureError(msg, 'console.error');
    originalConsoleError.apply(console, args);
};
const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
    const msg = `Error: ${message} at ${source}:${lineno}:${colno}`;
    captureError(msg, 'window.onerror');
    if (originalOnError) originalOnError(message, source, lineno, colno, error);
};
window.addEventListener('unhandledrejection', function(event) {
    const msg = `Unhandled Promise Rejection: ${event.reason}`;
    captureError(msg, 'unhandledrejection');
});

window.clearLogs = function() {
    window._errorLogs = [];
    if (window.requestLog) window.requestLog.length = 0;
};

window.openCheatPopup = function() {
    if (window.cheatWindow && !window.cheatWindow.closed) {
        window.cheatWindow.focus();
        return;
    }
    const width = Math.min(400, window.innerWidth - 40);
    const height = Math.min(600, window.innerHeight - 40);
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
    window.cheatWindow = window.open('cheats.html', 'CheatEngine', features);
    if (window.cheatWindow) window.cheatWindow.focus();
    else window.open('cheats.html', '_blank');
};

window.__gameApi = {
    typeCheat: window.typeCheat,
    addMoney: window.addMoney,
    toggleGodMode: window.toggleGodMode,
    toggleAirBrake: window.toggleAirBrake,
    setFlySpeed: window.setFlySpeed,
    toggleFullscreen: function(enable) {
        if (typeof Browser !== 'undefined' && Browser.requestFullscreen && Browser.exitFullscreen) {
            if (enable === undefined) {
                enable = !Browser.isFullscreen;
            }
            if (enable) {
                Browser.requestFullscreen();
            } else {
                try { Browser.exitFullscreen(); } catch(e) {}
            }
        }
    },
    scanMemory: window._scanMemory,
    readMemory: window.readMemory,
    writeMemory: window.writeMemory,
    getDebugLogs: function() {
        if (typeof window.getDebugLogLines === 'function') return window.getDebugLogLines();
        return [];
    },
    getErrorLogs: function() {
        return window._errorLogs.map(e => `[${e.timestamp}] ${e.type}: ${e.message}`);
    },
    clearLogs: window.clearLogs,
    cheatWindowClosed: function() { console.log('Cheat popup closed.'); }
};

window.setMenuModeActive = setMenuModeActive;
window.reapplyTouchControls = reapplyTouchControls;

// ------------------------------------------------------------------
// 7. AIRBREAK CONTROLS (unchanged)
// ------------------------------------------------------------------

(function() {
    const overlay = document.getElementById('airbreak-overlay');
    const joystick = document.getElementById('airbreak-joystick');
    const knob = document.getElementById('airbreak-joystick-knob');
    const verticalBtns = document.getElementById('airbreak-vertical-btns');
    const upBtn = document.getElementById('airbreak-up-btn');
    const downBtn = document.getElementById('airbreak-down-btn');
    const flyToggleBtn = document.getElementById('airbreak-toggle-fly');

    if (overlay) { overlay.style.touchAction = 'none'; overlay.style.pointerEvents = 'auto'; }
    if (joystick) { joystick.style.touchAction = 'none'; joystick.style.pointerEvents = 'auto'; }
    if (knob) { knob.style.touchAction = 'none'; knob.style.pointerEvents = 'auto'; }
    if (verticalBtns) { verticalBtns.style.touchAction = 'none'; verticalBtns.style.pointerEvents = 'auto'; }
    if (upBtn) { upBtn.style.touchAction = 'none'; upBtn.style.pointerEvents = 'auto'; }
    if (downBtn) { downBtn.style.touchAction = 'none'; downBtn.style.pointerEvents = 'auto'; }
    if (flyToggleBtn) { flyToggleBtn.style.touchAction = 'none'; flyToggleBtn.style.pointerEvents = 'auto'; }

    let airbreakEnabled = false;
    let joystickActive = false;
    let joystickCenterX = 0, joystickCenterY = 0;
    const joystickRadius = 60;
    const deadzone = 15;
    let keysPressed = { w: false, s: false, a: false, d: false, space: false, shift: false };
    let activePointerId = null;
    let activeTouchId = null;

    let flyBtnDragging = false;
    let flyBtnStartX = 0, flyBtnStartY = 0;
    let flyBtnInitialRight = 0, flyBtnInitialBottom = 0;
    const savedFlyPos = localStorage.getItem('cheat-fly-pos');
    if (savedFlyPos) {
        try {
            const pos = JSON.parse(savedFlyPos);
            flyToggleBtn.style.right = pos.right + 'px';
            flyToggleBtn.style.bottom = pos.bottom + 'px';
        } catch(e) {}
    }

    function updateAirBreakUI(enable) {
        airbreakEnabled = enable;
        if (airbreakEnabled) {
            overlay.classList.add('active');
            verticalBtns.classList.add('active');
            flyToggleBtn.classList.add('visible');
            flyToggleBtn.classList.add('active');
            flyToggleBtn.textContent = 'STOP';
        } else {
            overlay.classList.remove('active');
            verticalBtns.classList.remove('active');
            flyToggleBtn.classList.remove('active');
            flyToggleBtn.classList.remove('visible');
            if (knob) knob.style.transform = 'translate(-50%, -50%)';
            keysPressed.w = false;
            keysPressed.s = false;
            keysPressed.a = false;
            keysPressed.d = false;
        }
    }
    window._updateAirBreakUI = updateAirBreakUI;

    window.toggleAirBrake = function(enable) {
        if (enable !== undefined) airbreakEnabled = enable;
        else airbreakEnabled = !airbreakEnabled;
        updateAirBreakUI(airbreakEnabled);
        console.log('AirBreak:', airbreakEnabled ? 'ON' : 'OFF');
    };

    function handleJoystickMove(clientX, clientY) {
        if (!joystickActive) return;
        let deltaX = clientX - joystickCenterX;
        let deltaY = clientY - joystickCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > joystickRadius) {
            deltaX = (deltaX / distance) * joystickRadius;
            deltaY = (deltaY / distance) * joystickRadius;
        }
        if (knob) {
            knob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        }
        keysPressed.w = deltaY < -deadzone;
        keysPressed.s = deltaY > deadzone;
        keysPressed.a = deltaX < -deadzone;
        keysPressed.d = deltaX > deadzone;
    }

    function joystickStart(clientX, clientY, pointerId, touchId) {
        if (!airbreakEnabled) return;
        joystickActive = true;
        activePointerId = pointerId || null;
        activeTouchId = touchId || null;
        const rect = joystick.getBoundingClientRect();
        joystickCenterX = rect.left + rect.width / 2;
        joystickCenterY = rect.top + rect.height / 2;
        if (pointerId !== undefined && pointerId !== null) {
            try { joystick.setPointerCapture(pointerId); } catch(e) {}
        }
        handleJoystickMove(clientX, clientY);
    }

    function joystickEnd() {
        joystickActive = false;
        activePointerId = null;
        activeTouchId = null;
        if (knob) knob.style.transform = 'translate(-50%, -50%)';
        keysPressed.w = false;
        keysPressed.s = false;
        keysPressed.a = false;
        keysPressed.d = false;
    }

    if (joystick) {
        joystick.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); joystickStart(e.clientX, e.clientY, e.pointerId, null); });
        joystick.addEventListener('pointermove', (e) => { if (joystickActive && activePointerId === e.pointerId) { e.preventDefault(); handleJoystickMove(e.clientX, e.clientY); } });
        joystick.addEventListener('pointerup', (e) => { if (activePointerId === e.pointerId) { e.preventDefault(); joystickEnd(); try { joystick.releasePointerCapture(e.pointerId); } catch(e) {} } });
        joystick.addEventListener('pointercancel', () => joystickEnd());

        joystick.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); const t = e.changedTouches[0]; if (t) joystickStart(t.clientX, t.clientY, null, t.identifier); }, { passive: false });
        joystick.addEventListener('touchmove', (e) => { if (!joystickActive) return; e.preventDefault(); const t = e.changedTouches[0]; if (t && activeTouchId === t.identifier) handleJoystickMove(t.clientX, t.clientY); }, { passive: false });
        joystick.addEventListener('touchend', (e) => { e.preventDefault(); joystickEnd(); }, { passive: false });
        joystick.addEventListener('touchcancel', () => joystickEnd(), { passive: false });
    }

    function setupButton(btn, key) {
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (airbreakEnabled) keysPressed[key] = true; });
        btn.addEventListener('pointerup', (e) => { e.preventDefault(); keysPressed[key] = false; });
        btn.addEventListener('pointercancel', () => { keysPressed[key] = false; });
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if (airbreakEnabled) keysPressed[key] = true; }, { passive: false });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keysPressed[key] = false; }, { passive: false });
        btn.addEventListener('touchcancel', () => { keysPressed[key] = false; });
    }
    setupButton(upBtn, 'space');
    setupButton(downBtn, 'shift');

    if (flyToggleBtn) {
        flyToggleBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            flyBtnDragging = false;
            flyBtnStartX = e.clientX; flyBtnStartY = e.clientY;
            const rect = flyToggleBtn.getBoundingClientRect();
            flyBtnInitialRight = window.innerWidth - rect.right;
            flyBtnInitialBottom = window.innerHeight - rect.bottom;
        });
        flyToggleBtn.addEventListener('pointermove', (e) => {
            const dx = e.clientX - flyBtnStartX, dy = e.clientY - flyBtnStartY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) flyBtnDragging = true;
            if (flyBtnDragging && e.buttons === 1) {
                let newRight = flyBtnInitialRight - dx;
                let newBottom = flyBtnInitialBottom - dy;
                const bw = flyToggleBtn.offsetWidth, bh = flyToggleBtn.offsetHeight;
                newRight = Math.max(0, Math.min(window.innerWidth - bw, newRight));
                newBottom = Math.max(0, Math.min(window.innerHeight - bh, newBottom));
                flyToggleBtn.style.right = newRight + 'px';
                flyToggleBtn.style.bottom = newBottom + 'px';
            }
        });
        flyToggleBtn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            if (flyBtnDragging) {
                const rect = flyToggleBtn.getBoundingClientRect();
                localStorage.setItem('cheat-fly-pos', JSON.stringify({
                    right: window.innerWidth - rect.right,
                    bottom: window.innerHeight - rect.bottom
                }));
            } else {
                window.toggleAirBrake();
            }
            flyBtnDragging = false;
        });
        flyToggleBtn.addEventListener('pointercancel', () => { flyBtnDragging = false; });

        flyToggleBtn.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            flyBtnDragging = false;
            const t = e.changedTouches[0];
            flyBtnStartX = t.clientX; flyBtnStartY = t.clientY;
            const rect = flyToggleBtn.getBoundingClientRect();
            flyBtnInitialRight = window.innerWidth - rect.right;
            flyBtnInitialBottom = window.innerHeight - rect.bottom;
        }, { passive: false });
        flyToggleBtn.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const dx = t.clientX - flyBtnStartX, dy = t.clientY - flyBtnStartY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) flyBtnDragging = true;
            if (flyBtnDragging) {
                let newRight = flyBtnInitialRight - dx;
                let newBottom = flyBtnInitialBottom - dy;
                const bw = flyToggleBtn.offsetWidth, bh = flyToggleBtn.offsetHeight;
                newRight = Math.max(0, Math.min(window.innerWidth - bw, newRight));
                newBottom = Math.max(0, Math.min(window.innerHeight - bh, newBottom));
                flyToggleBtn.style.right = newRight + 'px';
                flyToggleBtn.style.bottom = newBottom + 'px';
            }
        }, { passive: false });
        flyToggleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (flyBtnDragging) {
                const rect = flyToggleBtn.getBoundingClientRect();
                localStorage.setItem('cheat-fly-pos', JSON.stringify({
                    right: window.innerWidth - rect.right,
                    bottom: window.innerHeight - rect.bottom
                }));
            } else {
                window.toggleAirBrake();
            }
            flyBtnDragging = false;
        }, { passive: false });
    }

    let airbreakLoop = null;
    function startAirbreakLoop() {
        if (airbreakLoop) return;
        airbreakLoop = setInterval(() => {
            if (!airbreakEnabled) return;
            try {
                if (typeof HEAPU8 === 'undefined' || !HEAPU8.buffer) return;
                const view = new DataView(HEAPU8.buffer);
                const bufLen = view.buffer.byteLength;
                const healthAddr = 0x361c50 - 0xA0 + 0x350;
                const positionAddr = 0x361c50 - 0xA0 + 0x04 + 0x34;
                const headingAddr = 0x361c50 - 0xA0 + 0x350 + 0x24;
                const moveSpeedAddr = 0x361c50 - 0xA0 + 0x74;
                if (positionAddr >= bufLen - 12) return;
                let x = view.getFloat32(positionAddr, true);
                let y = view.getFloat32(positionAddr + 4, true);
                let z = view.getFloat32(positionAddr + 8, true);
                const headingRaw = view.getFloat32(headingAddr, true);
                const heading = -headingRaw;
                const speed = parseFloat(localStorage.getItem('cheat-fly-speed')) || 2.0;
                const sinH = Math.sin(heading), cosH = Math.cos(heading);
                let moved = false;
                if (keysPressed.w) { x += sinH * speed; y += cosH * speed; moved = true; }
                if (keysPressed.s) { x -= sinH * speed; y -= cosH * speed; moved = true; }
                if (keysPressed.a) { x -= cosH * speed; y += sinH * speed; moved = true; }
                if (keysPressed.d) { x += cosH * speed; y -= sinH * speed; moved = true; }
                if (keysPressed.space) { z += speed; moved = true; }
                if (keysPressed.shift) { z -= speed; moved = true; }
                if (moved) {
                    view.setFloat32(positionAddr, x, true);
                    view.setFloat32(positionAddr + 4, y, true);
                    view.setFloat32(positionAddr + 8, z, true);
                    view.setFloat32(healthAddr, 999.0, true);
                    view.setFloat32(moveSpeedAddr, 0, true);
                    view.setFloat32(moveSpeedAddr + 4, 0, true);
                    view.setFloat32(moveSpeedAddr + 8, 0, true);
                }
            } catch(e) {}
        }, 16);
    }
    function waitForModule() {
        if (typeof Module !== 'undefined' && Module && Module.canvas) {
            startAirbreakLoop();
        } else {
            setTimeout(waitForModule, 500);
        }
    }
    waitForModule();
    window.stopAirbreakLoop = () => { if (airbreakLoop) { clearInterval(airbreakLoop); airbreakLoop = null; } };
    updateAirBreakUI(false);
    console.log('✈️ AirBreak controls loaded (touch + pointer).');
})();

// ------------------------------------------------------------------
// 8. START THE GAME
// ------------------------------------------------------------------

setTimeout(startGame, 100);
console.log('🎮 Game script loaded. Starting game...');