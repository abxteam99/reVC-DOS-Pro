// ============================================================
//  COMPLETE OFFLINE ENGLISH-ONLY GTA VC (REVC) WEB MOD
//  Full touch/desktop mode
//  Debug button opens Cheat Engine (merged)
//  + Low Memory Mode (Nokia N8 optimization)
//  + WebGL context lost recovery
//  + Suppress alGetProcAddress errors
//  + Fullscreen auto‑start removed (toggle only in Cheat UI)
//  + No persistence – loads from server every time
//  + No pointer lock – removes WrongDocumentError
//  + No fullscreen change listener – touch controls set once and stay
// ============================================================

var haveOriginalGame = true;
localStorage.setItem('vcsky.haveOriginalGame', 'true');

var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById('spinner');
var loaderContainer = document.getElementById('loader-container');
var data_content;
var wasm_content;

let cheatsEnabled = true;
let maxFPS = 0;
let lowMemory = false;

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
let isTouch = isTouchDevice;
document.body.dataset.isTouch = isTouch ? '1' : '0';

function readSettings() {
    const modeSelect = document.getElementById('config-mode');
    const touchCheck = document.getElementById('config-touch-controls');
    const cheatsCheck = document.getElementById('config-cheats');
    const fpsInput = document.getElementById('config-max-fps');
    const lowMemCheck = document.getElementById('config-lowmem');
    if (modeSelect) {
        const mode = modeSelect.value;
        if (mode === 'touch') isTouch = true;
        else if (mode === 'desktop') isTouch = false;
        else isTouch = isTouchDevice;
    }
    if (touchCheck) window.__showTouchControls = touchCheck.checked;
    if (cheatsCheck) cheatsEnabled = cheatsCheck.checked;
    if (fpsInput) maxFPS = parseInt(fpsInput.value) || 0;
    if (lowMemCheck) lowMemory = lowMemCheck.checked;
    document.body.dataset.isTouch = isTouch ? '1' : '0';
    window.__isTouchMode = isTouch;
    window.__lowMemoryMode = lowMemory;
}
readSettings();

const t = (key) => ({
    clickToPlayFull: "Click to play",
    downloading: "Downloading",
    clickToContinue: "Click to continue..."
}[key] || key);

const textDecoder = new TextDecoder();
data_content = "/vcbr/vc-sky-en-v6.data";
wasm_content = "/vcbr/vc-sky-en-v6.wasm";

// ===== Load game data (simple fetch, no cache) =====
async function loadData() {
    try {
        const response = await fetch(data_content);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        console.log('[Game] Data loaded from server.');
        return buffer;
    } catch (e) {
        console.error('[Game] Failed to load data:', e);
        throw e;
    }
}

function forceTouchRecalc() {
    if (!isTouch) return;
    const wrapper = document.getElementById('touch-controls-wrapper');
    if (!wrapper) return;
    wrapper.style.display = 'none';
    void wrapper.offsetHeight;
    wrapper.style.display = 'block';
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
    if (wrapper) wrapper.style.display = 'block';
    forceTouchRecalc();
    const emulator = window._emulator;
    const moveConfig = window._moveConfig;
    const lookConfig = window._lookConfig;
    if (emulator && moveConfig && lookConfig) {
        emulator.ClearDisplayJoystickEventListeners(0);
        emulator.AddDisplayJoystickEventListeners(0, [moveConfig]);
        emulator.AddDisplayJoystickEventListeners(0, [lookConfig]);
        console.log('[Game] Joystick listeners re‑attached.');
    }
}

async function startGame(e) {
    e.stopPropagation();
    readSettings();

    // --- Always use small canvas, stretch to fill (saves VRAM) ---
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
    }

    if (lowMemory) {
        window.__lowMemoryMode = true;
    } else {
        window.__lowMemoryMode = false;
    }

    if (isTouch) {
        reapplyTouchControls();
    }

    if (typeof AudioContext !== 'undefined') {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') await ctx.resume();
        } catch (err) {}
    }

    const startContainer = document.querySelector('.start-container');
    if (startContainer) startContainer.style.display = 'none';
    if (loaderContainer) loaderContainer.style.display = "flex";
    if (typeof window.updateDebugVisibility === 'function') window.updateDebugVisibility();

    let dataBuffer;
    try {
        dataBuffer = await loadData();
    } catch (err) {
        console.error('[Game] Failed to load data:', err);
        setStatus('Failed to load game data. Please refresh.');
        return;
    }

    if (spinnerElement) spinnerElement.hidden = true;
    setStatus(t("clickToContinue"));

    await new Promise(r => setTimeout(r, 100));

    const clickHandler = () => { loadGame(dataBuffer); };
    if (isTouch) {
        window.addEventListener('pointerup', clickHandler, { once: true });
    } else {
        window.addEventListener('click', clickHandler, { once: true });
    }
}

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

function setMenuModeActive(active) {
    if (!isTouch) return;

    const lookElement = document.getElementById('look');
    const moveElement = document.getElementById('move');
    const canvas = document.getElementById('canvas');
    const emulator = window._emulator;
    const lookConfig = window._lookConfig;
    const moveConfig = window._moveConfig;

    if (active) {
        if (lookElement) {
            lookElement.style.pointerEvents = 'none';
            lookElement.style.touchAction = 'auto';
        }
        if (moveElement) {
            moveElement.style.pointerEvents = 'none';
            moveElement.style.touchAction = 'auto';
        }
        if (canvas) canvas.style.touchAction = 'auto';
        if (emulator) emulator.ClearDisplayJoystickEventListeners(0);
    } else {
        if (lookElement) {
            lookElement.style.pointerEvents = 'auto';
            lookElement.style.touchAction = 'none';
        }
        if (moveElement) {
            moveElement.style.pointerEvents = 'auto';
            moveElement.style.touchAction = 'none';
        }
        if (canvas) canvas.style.touchAction = 'none';
        if (emulator) {
            emulator.ClearDisplayJoystickEventListeners(0);
            if (moveConfig) emulator.AddDisplayJoystickEventListeners(0, [moveConfig]);
            if (lookConfig) emulator.AddDisplayJoystickEventListeners(0, [lookConfig]);
        }
    }
}

async function loadGame(data) {
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
            if (msg.includes('alGetProcAddress() called without a valid context')) {
                return;
            }
            console.error(msg);
        },
        getPreloadedPackage: () => data.buffer,
        canvas: (function() {
            const canvas = document.getElementById('canvas');
            canvas.addEventListener('webglcontextlost', (e) => {
                if (statusElement) statusElement.textContent = 'WebGL context lost. Please reload the page.';
                e.preventDefault();
                setTimeout(() => {
                    location.reload();
                }, 2000);
            });
            canvas.addEventListener('webglcontextrestored', () => {
                if (statusElement) statusElement.textContent = 'WebGL context restored.';
                if (Module && Module.canvas) {
                    Module.canvas.width = Module.canvas.width;
                }
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
        const wasm = await (await fetch(wasm_content)).arrayBuffer();
        const module = await WebAssembly.instantiate(wasm, info);
        return receiveInstance(module.instance, module);
    };

    Module.arguments = window.location.search.slice(1).split('&').filter(Boolean).map(decodeURIComponent);
    window.onbeforeunload = (e) => { e.preventDefault(); return ''; };

    window.Module = Module;

    // ---- NO PERSISTENCE, NO FULLSCREEN LISTENERS ----
    // Touch controls are set up once in startGame and re‑applied after the engine starts.

    // Re‑apply touch controls after the engine initialises
    Module['postRun'].push(function() {
        if (isTouch) {
            setTimeout(reapplyTouchControls, 200);
        }
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'index.js';
    document.body.appendChild(script);

    const wrapper = document.getElementById('touch-controls-wrapper');
    if (wrapper) {
        if (isTouch && window.__showTouchControls !== false) {
            wrapper.style.display = 'block';
        } else {
            wrapper.style.display = 'none';
        }
    }

    if (isTouch) {
        const canvasEl = document.getElementById('canvas');
        if (canvasEl) {
            canvasEl.style.touchAction = 'none';
            canvasEl.style.pointerEvents = 'auto';
        }

        const move = document.getElementById('move');
        const lookElement = document.getElementById('look');
        if (move && lookElement) {
            console.log('[Game] Setting up joystick controls');
            const emulator = new GamepadEmulator();
            window._emulator = emulator;
            const gamepad = emulator.AddEmulatedGamepad(null, true);

            const moveConfig = {
                directions: { up: true, down: true, left: true, right: true },
                dragDistance: 100,
                tapTarget: move,
                lockTargetWhilePressed: true,
                xAxisIndex: 0, yAxisIndex: 1,
                swapAxes: false, invertX: false, invertY: false,
            };
            window._moveConfig = moveConfig;
            emulator.AddDisplayJoystickEventListeners(0, [moveConfig]);

            const lookConfig = {
                directions: { up: true, down: true, left: true, right: true },
                dragDistance: 100,
                tapTarget: lookElement,
                lockTargetWhilePressed: true,
                xAxisIndex: 2, yAxisIndex: 3,
                swapAxes: false, invertX: false, invertY: false,
            };
            window._lookConfig = lookConfig;
            emulator.AddDisplayJoystickEventListeners(0, [lookConfig]);

            setTimeout(() => {
                forceTouchRecalc();
                console.log('[Game] Joystick reflow triggered after setup.');
            }, 200);

            const menuObserver = new MutationObserver(() => {
                const isMenu = document.body.dataset.stateMenu === '1';
                setMenuModeActive(isMenu);
            });
            menuObserver.observe(document.body, { attributes: true, attributeFilter: ['data-state-menu'] });
            setMenuModeActive(document.body.dataset.stateMenu === '1');

            const bindButton = (index, selector) => {
                const el = document.querySelector(selector);
                if (el) emulator.AddDisplayButtonEventListeners(0, [{
                    buttonIndex: index,
                    lockTargetWhilePressed: false,
                    tapTarget: el
                }]);
            };

            bindButton(9,  '.touch-control.menu');
            bindButton(3,  '.touch-control.car.getIn');
            bindButton(0,  '.touch-control.run');
            bindButton(1,  '.touch-control.fist');
            bindButton(5,  '.touch-control.drift');
            bindButton(2,  '.touch-control.jump');
            bindButton(4,  '.touch-control.mobile');
            bindButton(11, '.touch-control.job');
            bindButton(12, '.touch-control.radio');
            bindButton(7,  '.touch-control.weapon');
            bindButton(8,  '.touch-control.camera');
            bindButton(10, '.touch-control.horn');
            bindButton(7,  '.touch-control.fireRight');
            bindButton(6,  '.touch-control.fireLeft');
            bindButton(13, '.touch-control.down');
            bindButton(3,  '.touch-control.back');
        }

        const debugTouchBtn = document.querySelector('.touch-control.cheat');
        if (debugTouchBtn) {
            debugTouchBtn.addEventListener('click', () => {
                console.log('🔧 Cheat button clicked');
                if (typeof window.toggleCheatMenu === 'function') {
                    window.toggleCheatMenu();
                } else {
                    console.warn('🔧 toggleCheatMenu not defined');
                }
            });
            debugTouchBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔧 Cheat button touched');
                if (typeof window.toggleCheatMenu === 'function') {
                    window.toggleCheatMenu();
                } else {
                    console.warn('🔧 toggleCheatMenu not defined');
                }
            }, { passive: false });
        }
    }

    setStatus("");
}

// ===== FPS Limiter =====
function applyFPSLimit(fps) {
    if (fps > 0 && fps <= 240) {
        _emscripten_set_main_loop_timing(0, 1000 / fps);
    } else {
        _emscripten_set_main_loop_timing(1, 1);
    }
}

const clickToPlay = document.querySelector('.click-to-play');
if (clickToPlay) {
    clickToPlay.addEventListener('click', (e) => {
        if (e.target === clickToPlay || e.target === clickToPlay.querySelector('button')) {
            startGame(e);
        }
    });
}

const revc_iniDefault = `…`;
const revc_ini = (() => {
    const cached = localStorage.getItem('vcsky.revc.ini');
    return cached || revc_iniDefault;
})();

window.applyFPSLimit = applyFPSLimit;
window.setMenuModeActive = setMenuModeActive;