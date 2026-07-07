var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById('spinner');
var loaderContainer = document.getElementById('loader-container');

let cheatsEnabled = window.__cheatsEnabled !== undefined ? window.__cheatsEnabled : true;
let lowMemory = window.__lowMemoryMode || false;
let showTouchControls = window.__showTouchControls !== undefined ? window.__showTouchControls : true;

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
                      window.matchMedia('(pointer: coarse)').matches;
const storedMode = localStorage.getItem('vcsky.mode') || 'auto';

let isTouch = false;
if (storedMode === 'touch') {
    isTouch = true;
} else if (storedMode === 'desktop') {
    isTouch = false;
} else {
    isTouch = isTouchDevice;
}
if (window.__isTouchMode !== undefined) {
    isTouch = window.__isTouchMode;
}
if (storedMode === 'touch' && !isTouch) {
    isTouch = true;
}
window.__isTouchMode = isTouch;
document.body.dataset.isTouch = isTouch ? '1' : '0';

console.log(`[Game] Settings: cheats=${cheatsEnabled}, touch=${isTouch}, showControls=${showTouchControls}, lowMem=${lowMemory}`);

const t = (key) => ({
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
    wrapper.style.display = showTouchControls ? 'block' : 'none';
    void wrapper.offsetHeight;
    wrapper.style.display = showTouchControls ? 'block' : 'none';
    console.log('[Game] Touch controls reflow forced.');
}

function reapplyTouchControls() {
    if (!isTouch) return;
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.pointerEvents = 'none';
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
    const moveElement = document.getElementById('move');
    const canvas = document.getElementById('canvas');
    if (active) {
        if (moveElement) { moveElement.style.pointerEvents = 'auto'; moveElement.style.touchAction = 'none'; }
        if (canvas) canvas.style.touchAction = 'auto';
    } else {
        if (moveElement) { moveElement.style.pointerEvents = 'auto'; moveElement.style.touchAction = 'none'; }
        if (canvas) canvas.style.touchAction = 'none';
    }
}

// ============================================================
// GAME START – uses file-loader.js promise
// ============================================================
function startGame() {
    if (loaderContainer) loaderContainer.style.display = "flex";
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
        canvas.style.pointerEvents = isTouch ? 'none' : 'auto';
    }
    if (isTouch) { reapplyTouchControls(); }

    const cheatBtn = document.querySelector('.touch-control.cheat');
    if (cheatBtn) {
        cheatBtn.style.display = cheatsEnabled ? 'block' : 'none';
        cheatBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.openCheatPopup === 'function') {
                window.openCheatPopup();
            }
        }, { passive: false });
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
            canvasEl.style.pointerEvents = isTouch ? 'none' : 'auto';
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

    window._fileLoaderReady.then(files => {
        const dataBuffer = files.data;
        const wasmBuffer = files.wasm;
        if (spinnerElement) spinnerElement.hidden = true;
        setStatus(t("clickToContinue"));

        // Wait for user click/tap before loading the game
        const clickHandler = () => {
            loadGame(dataBuffer, wasmBuffer);
        };
        if (isTouch) {
            window.addEventListener('pointerup', clickHandler, { once: true });
        } else {
            window.addEventListener('click', clickHandler, { once: true });
        }
    }).catch(err => {
        console.error('[Game] File selection error:', err);
        setStatus('Failed to load files: ' + err.message);
    });
}

// ============================================================
// LOAD GAME (Emscripten Module)
// ============================================================
window.gameReady = false;

async function loadGame(data, wasmBuffer) {
    // Disable pointer lock on touch devices permanently
    if (isTouch) {
        HTMLCanvasElement.prototype.requestPointerLock = function() {};
    }

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

    // ============================================================
    //  CONTROL SETUP (inline)
    // ============================================================
    if (isTouch) {
        const canvasEl = document.getElementById('canvas');
        if (canvasEl) {
            canvasEl.style.touchAction = 'none';
            canvasEl.style.pointerEvents = 'none';
        }

        const emulator = new GamepadEmulator();
        window._emulator = emulator;
        emulator.AddEmulatedGamepad(0, true);

        // ------------------------------------------------------------
        //  MOVE JOYSTICK
        // ------------------------------------------------------------
        const moveEl = document.getElementById('move');
        if (moveEl) {
            moveEl.style.position = 'fixed';
            moveEl.style.left = '5%';
            moveEl.style.bottom = '5%';
            moveEl.style.width = '30vmin';
            moveEl.style.height = '30vmin';
            moveEl.style.top = 'auto';
            moveEl.style.right = 'auto';
            moveEl.style.border = '2px solid rgba(13,240,255,0.6)';
            moveEl.style.borderRadius = '50%';
            moveEl.style.background = 'rgba(13,240,255,0.08)';
            moveEl.style.backdropFilter = 'blur(10px)';
            moveEl.style.webkitBackdropFilter = 'blur(10px)';
            moveEl.style.zIndex = '9000';

            const knob = document.createElement('div');
            knob.className = 'move-joystick-knob';
            knob.style.cssText = `
                width: 30%;
                height: 30%;
                background: rgba(13,240,255,0.35);
                border: 2px solid #0df0ff;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                box-shadow: 0 0 15px rgba(13,240,255,0.5);
                z-index: 10;
            `;
            moveEl.appendChild(knob);

            let activeTouchId = null;
            const maxDist = moveEl.offsetWidth * 0.35;

            const getCenter = () => {
                const rect = moveEl.getBoundingClientRect();
                return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            };

            const updateMoveAxes = (clientX, clientY, center) => {
                let dx = clientX - center.cx;
                let dy = clientY - center.cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 8) {
                    emulator.MoveAxis(0, 0, 0);
                    emulator.MoveAxis(0, 1, 0);
                    knob.style.transform = 'translate(-50%, -50%)';
                    return;
                }
                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }
                const normX = dx / maxDist;
                const normY = dy / maxDist;
                const clampedX = Math.min(1, Math.max(-1, normX));
                const clampedY = Math.min(1, Math.max(-1, normY));

                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                emulator.MoveAxis(0, 0, clampedX);
                emulator.MoveAxis(0, 1, clampedY);   // forward
            };

            const resetMove = () => {
                emulator.MoveAxis(0, 0, 0);
                emulator.MoveAxis(0, 1, 0);
                knob.style.transform = 'translate(-50%, -50%)';
            };

            moveEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                updateMoveAxes(touch.clientX, touch.clientY, getCenter());

                const onMove = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            updateMoveAxes(t.clientX, t.clientY, getCenter());
                        }
                    }
                };
                const onEnd = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            resetMove();
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

            moveEl.addEventListener('touchcancel', () => {
                if (activeTouchId !== null) {
                    resetMove();
                    activeTouchId = null;
                }
            }, { passive: true });
        }

        // ------------------------------------------------------------
        //  LOOK AREA (portrait – user settings)
        // ------------------------------------------------------------
        const lookEl = document.getElementById('look');
        if (lookEl) {
            lookEl.style.setProperty('pointer-events', 'auto', 'important');
            lookEl.style.setProperty('touch-action', 'none', 'important');
            lookEl.style.zIndex = '2147483647';
            lookEl.style.position = 'fixed';
            lookEl.style.top = '30%';
            lookEl.style.right = '3%';
            lookEl.style.width = '30%';
            lookEl.style.height = '30%';
            lookEl.style.bottom = 'auto';
            lookEl.style.left = '65%';
            lookEl.style.border = '1px solid rgba(255,255,255,0.3)';
            lookEl.style.borderRadius = '8px';
            lookEl.style.background = 'rgba(255,255,255,0.05)';

            const knob = document.createElement('div');
            knob.className = 'look-joystick-knob';
            knob.style.cssText = `
                width: 30%;
                height: 30%;
                background: rgba(255,255,255,0.25);
                border: 1px solid rgba(255,255,255,0.5);
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 10;
            `;
            lookEl.appendChild(knob);

            let activeTouchId = null;

            const getCenter = (el) => {
                const rect = el.getBoundingClientRect();
                return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            };

            const getMaxDist = (el) => {
                const rect = el.getBoundingClientRect();
                return Math.min(rect.width, rect.height) * 0.35;
            };

            let currentMaxDist = getMaxDist(lookEl);

            const updateLookAxes = (clientX, clientY, center) => {
                let dx = clientX - center.cx;
                let dy = clientY - center.cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 8) {
                    emulator.MoveAxis(0, 2, 0);
                    emulator.MoveAxis(0, 3, 0);
                    knob.style.transform = 'translate(-50%, -50%)';
                    return;
                }
                if (dist > currentMaxDist) {
                    dx = (dx / dist) * currentMaxDist;
                    dy = (dy / dist) * currentMaxDist;
                }
                const normX = dx / currentMaxDist;
                const normY = dy / currentMaxDist;
                const clampedX = Math.min(1, Math.max(-1, normX));
                const clampedY = Math.min(1, Math.max(-1, normY));

                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                emulator.MoveAxis(0, 2, clampedX);
                emulator.MoveAxis(0, 3, clampedY);
            };

            const resetLook = () => {
                emulator.MoveAxis(0, 2, 0);
                emulator.MoveAxis(0, 3, 0);
                knob.style.transform = 'translate(-50%, -50%)';
            };

            lookEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentMaxDist = getMaxDist(lookEl);
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                updateLookAxes(touch.clientX, touch.clientY, getCenter(lookEl));

                const onMove = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            updateLookAxes(t.clientX, t.clientY, getCenter(lookEl));
                        }
                    }
                };
                const onEnd = (ev) => {
                    ev.preventDefault();
                    for (let t of ev.changedTouches) {
                        if (t.identifier === activeTouchId) {
                            resetLook();
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

            lookEl.addEventListener('touchcancel', () => {
                if (activeTouchId !== null) {
                    resetLook();
                    activeTouchId = null;
                }
            }, { passive: true });
        }

        // ---- BUTTONS ----
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
        setupButton('.touch-control.back', 3);

        // ---- HOME BUTTON – redirect to index.html ----
        const homeBtn = document.querySelector('.touch-control.home');
        if (homeBtn) {
            homeBtn.addEventListener('touchstart', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = 'index.html';
            }, { passive: false });
        }

        console.log('✅ Universal touch controls initialized.');

        const menuObserver = new MutationObserver(() => {
            const isMenu = document.body.dataset.stateMenu === '1';
            setMenuModeActive(isMenu);
        });
        menuObserver.observe(document.body, { attributes: true, attributeFilter: ['data-state-menu'] });
        setMenuModeActive(document.body.dataset.stateMenu === '1');
    } else {
        // Desktop mode – pointer lock allowed
        const canvas = document.getElementById('canvas');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            canvas.style.touchAction = 'auto';
        }
        console.log('🖱️ Desktop controls ready.');
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'index.js';
    document.body.appendChild(script);
    setStatus("");
}

// ============================================================
// CHEAT FUNCTIONS & GAME API (with memory safety checks)
// ============================================================
const revc_iniDefault = `…`;
const revc_ini = (() => {
    const cached = localStorage.getItem('vcsky.revc.ini');
    return cached || revc_iniDefault;
})();

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
    if (moneyAddr < 0 || moneyAddr + 4 > bufLen) {
        console.warn('Money address out of range');
        return;
    }
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
        const bufLen = view.buffer.byteLength;
        const pedPtrAddr = 0x361c50 - 0xA0;
        if (pedPtrAddr < 0 || pedPtrAddr + 4 > bufLen) return;
        const pedAddr = view.getInt32(pedPtrAddr, true);
        if (pedAddr <= 0 || pedAddr + 0x350 > bufLen) return;
        view.setFloat32(pedAddr + 0x350, 999.0, true);
        console.log('🛡️ GodMode ON');
    } else {
        console.log('🛡️ GodMode OFF');
    }
};

let airbreakEnabled = false;
let airbreakInterval = null;

const keysPressed = { w: false, s: false, a: false, d: false, space: false, shift: false };

function airbreakLoop() {
    if (!airbreakEnabled) return;
    try {
        const view = new DataView(HEAPU8.buffer);
        const bufLen = view.buffer.byteLength;

        const pedPtrAddr = 0x361c50 - 0xA0;
        if (pedPtrAddr < 0 || pedPtrAddr + 4 > bufLen) return;
        const pedAddr = view.getInt32(pedPtrAddr, true);
        if (pedAddr <= 0 || pedAddr + 0x400 > bufLen) return;

        const posAddr = pedAddr + 0x34;
        const healthAddr = pedAddr + 0x350;
        const speedAddr = pedAddr + 0x74;

        if (posAddr + 12 > bufLen || healthAddr + 4 > bufLen || speedAddr + 12 > bufLen) return;

        let x = view.getFloat32(posAddr, true);
        let y = view.getFloat32(posAddr + 4, true);
        let z = view.getFloat32(posAddr + 8, true);

        let heading = 0;
        if (pedAddr + 0x24 + 4 <= bufLen) {
            try { heading = view.getFloat32(pedAddr + 0x24, true); } catch(e) {}
        }

        const speed = parseFloat(localStorage.getItem('cheat-fly-speed')) || 2.0;

        let moved = false;
        if (heading) {
            const sinH = Math.sin(heading);
            const cosH = Math.cos(heading);
            if (keysPressed.w) { x += sinH * speed; y += cosH * speed; moved = true; }
            if (keysPressed.s) { x -= sinH * speed; y -= cosH * speed; moved = true; }
            if (keysPressed.a) { x -= cosH * speed; y += sinH * speed; moved = true; }
            if (keysPressed.d) { x += cosH * speed; y -= sinH * speed; moved = true; }
        } else {
            if (keysPressed.w) { x += speed; moved = true; }
            if (keysPressed.s) { x -= speed; moved = true; }
            if (keysPressed.a) { y += speed; moved = true; }
            if (keysPressed.d) { y -= speed; moved = true; }
        }
        if (keysPressed.space) { z += speed; moved = true; }
        if (keysPressed.shift) { z -= speed; moved = true; }

        if (moved) {
            view.setFloat32(posAddr, x, true);
            view.setFloat32(posAddr + 4, y, true);
            view.setFloat32(posAddr + 8, z, true);
            view.setFloat32(healthAddr, 999.0, true);
            view.setFloat32(speedAddr, 0, true);
            view.setFloat32(speedAddr + 4, 0, true);
            view.setFloat32(speedAddr + 8, 0, true);
        }
    } catch(e) {}
}

window.toggleAirBrake = function(enable) {
    if (enable !== undefined) airbreakEnabled = enable;
    else airbreakEnabled = !airbreakEnabled;

    if (airbreakEnabled) {
        if (!airbreakInterval) {
            airbreakInterval = setInterval(airbreakLoop, 16);
        }
    } else {
        if (airbreakInterval) {
            clearInterval(airbreakInterval);
            airbreakInterval = null;
        }
        keysPressed.w = keysPressed.s = keysPressed.a = keysPressed.d = false;
        keysPressed.space = keysPressed.shift = false;
    }
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

// ============================================================
// AIRBREAK CONTROLS – touch / desktop strictly separated
// ============================================================
(function() {
    const overlay = document.getElementById('airbreak-overlay');
    const joystick = document.getElementById('airbreak-joystick');
    const knob = document.getElementById('airbreak-joystick-knob');
    const verticalBtns = document.getElementById('airbreak-vertical-btns');
    const upBtn = document.getElementById('airbreak-up-btn');
    const downBtn = document.getElementById('airbreak-down-btn');
    const flyToggleBtn = document.getElementById('airbreak-toggle-fly');

    const setElementInteraction = (el) => {
        if (!el) return;
        if (isTouch) {
            el.style.touchAction = 'none';
            el.style.pointerEvents = 'auto';
        } else {
            el.style.touchAction = 'auto';
            el.style.pointerEvents = 'auto';
        }
    };
    [overlay, joystick, knob, verticalBtns, upBtn, downBtn, flyToggleBtn].forEach(setElementInteraction);

    let joystickActive = false;
    let joystickCenterX = 0, joystickCenterY = 0;
    const joystickRadius = 60;
    const deadzone = 15;
    let activePointerId = null;
    let activeTouchId = null;

    let flyBtnDragging = false;
    let flyBtnStartX = 0, flyBtnStartY = 0;
    let flyBtnInitialRight = 0, flyBtnInitialBottom = 0;
    const savedFlyPos = localStorage.getItem('cheat-fly-pos');
    if (savedFlyPos && flyToggleBtn) {
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
        if (!isTouch && pointerId !== undefined && pointerId !== null) {
            try { joystick.setPointerCapture(pointerId); } catch(e) {}
        }
        handleJoystickMove(clientX, clientY);
    }

    function joystickEnd() {
        joystickActive = false;
        if (!isTouch && activePointerId !== null) {
            try { joystick.releasePointerCapture(activePointerId); } catch(e) {}
        }
        activePointerId = null;
        activeTouchId = null;
        if (knob) knob.style.transform = 'translate(-50%, -50%)';
        keysPressed.w = false;
        keysPressed.s = false;
        keysPressed.a = false;
        keysPressed.d = false;
    }

    if (joystick) {
        if (isTouch) {
            joystick.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const t = e.changedTouches[0];
                if (t) joystickStart(t.clientX, t.clientY, null, t.identifier);
            }, { passive: false });
            joystick.addEventListener('touchmove', (e) => {
                if (!joystickActive) return;
                e.preventDefault();
                const t = e.changedTouches[0];
                if (t && activeTouchId === t.identifier) handleJoystickMove(t.clientX, t.clientY);
            }, { passive: false });
            joystick.addEventListener('touchend', (e) => {
                e.preventDefault();
                joystickEnd();
            }, { passive: false });
            joystick.addEventListener('touchcancel', () => joystickEnd(), { passive: false });
        } else {
            joystick.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                joystickStart(e.clientX, e.clientY, e.pointerId, null);
            });
            joystick.addEventListener('pointermove', (e) => {
                if (joystickActive && activePointerId === e.pointerId) {
                    e.preventDefault();
                    handleJoystickMove(e.clientX, e.clientY);
                }
            });
            joystick.addEventListener('pointerup', (e) => {
                if (activePointerId === e.pointerId) {
                    e.preventDefault();
                    joystickEnd();
                }
            });
            joystick.addEventListener('pointercancel', () => joystickEnd());
        }
    }

    function setupAirButton(btn, key) {
        if (!btn) return;
        if (isTouch) {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (airbreakEnabled) keysPressed[key] = true;
            }, { passive: false });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                keysPressed[key] = false;
            }, { passive: false });
            btn.addEventListener('touchcancel', () => { keysPressed[key] = false; });
        } else {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (airbreakEnabled) keysPressed[key] = true;
            });
            btn.addEventListener('pointerup', (e) => {
                e.preventDefault();
                keysPressed[key] = false;
            });
            btn.addEventListener('pointercancel', () => { keysPressed[key] = false; });
        }
    }
    setupAirButton(upBtn, 'space');
    setupAirButton(downBtn, 'shift');

    if (flyToggleBtn) {
        if (isTouch) {
            flyToggleBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                flyBtnDragging = false;
                const t = e.changedTouches[0];
                flyBtnStartX = t.clientX;
                flyBtnStartY = t.clientY;
                const rect = flyToggleBtn.getBoundingClientRect();
                flyBtnInitialRight = window.innerWidth - rect.right;
                flyBtnInitialBottom = window.innerHeight - rect.bottom;
            }, { passive: false });
            flyToggleBtn.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                const dx = t.clientX - flyBtnStartX;
                const dy = t.clientY - flyBtnStartY;
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
        } else {
            flyToggleBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                flyBtnDragging = false;
                flyBtnStartX = e.clientX;
                flyBtnStartY = e.clientY;
                const rect = flyToggleBtn.getBoundingClientRect();
                flyBtnInitialRight = window.innerWidth - rect.right;
                flyBtnInitialBottom = window.innerHeight - rect.bottom;
            });
            flyToggleBtn.addEventListener('pointermove', (e) => {
                const dx = e.clientX - flyBtnStartX;
                const dy = e.clientY - flyBtnStartY;
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
        }
    }

    updateAirBreakUI(false);
    console.log('✈️ AirBreak controls loaded (' + (isTouch ? 'touch' : 'desktop') + ').');
})();

setTimeout(startGame, 100);
console.log('🎮 Game script loaded. Starting game...');