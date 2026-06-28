// ============================================================
//  GTA:VC Cheat Engine – 4‑TAB UI, NO TOUCH INTERFERENCE
//  + Fullscreen Toggle (Quick tab)
//  + Error Logs + Network Logs (Debugger tab)
//  + Copy buttons for logs
// ============================================================
(function() {
    console.log('🔧 Cheat Engine UI loading...');

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isTouch = isMobile && window.matchMedia('(pointer: coarse)').matches;

    const style = document.createElement('style');
    style.textContent = `
        #cheat-engine-ui {
            position: fixed;
            top: 0; right: 0;
            width: ${isTouch ? '100vw' : '360px'};
            height: 100vh;
            background: #0a0a12;
            color: #e0e0e0;
            font-family: system-ui, sans-serif;
            z-index: 100000;
            display: none;
            flex-direction: column;
            overflow-y: auto;
            border-left: 1px solid #333;
            box-shadow: -4px 0 12px rgba(0,0,0,0.5);
            padding: 0;
        }
        #cheat-engine-ui h1 {
            font-size: 16px;
            margin: 0;
            padding: 12px 16px;
            background: #1a1a2e;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #cheat-close-btn {
            background: none;
            border: none;
            color: #f44;
            font-size: 20px;
            cursor: pointer;
            touch-action: manipulation;
        }
        .ce-tabs {
            display: flex;
            border-bottom: 1px solid #333;
            background: #111;
        }
        .ce-tabs button {
            flex: 1;
            background: none;
            border: none;
            color: #888;
            padding: 10px;
            font-size: 13px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            touch-action: manipulation;
        }
        .ce-tabs button.active {
            color: #fff;
            border-bottom-color: #ff00ff;
            background: #1a1a2e;
        }
        .ce-tab-content {
            display: none;
            padding: 10px 16px;
            flex: 1;
            overflow-y: auto;
        }
        .ce-tab-content.active {
            display: block;
        }
        .ce-input-row {
            display: flex;
            gap: 6px;
            margin-bottom: 8px;
        }
        .ce-input-row input, .ce-input-row select {
            background: #1a1a2e;
            border: 1px solid #444;
            color: #fff;
            padding: 8px;
            font-size: 13px;
            border-radius: 4px;
            flex: 1;
        }
        .ce-btn-row {
            display: grid;
            grid-template-columns: repeat(3,1fr);
            gap: 4px;
            margin-bottom: 8px;
        }
        .ce-btn-row button, .cheat-grid button {
            background: #1a1a2e;
            border: 1px solid #444;
            color: #ccc;
            padding: 8px;
            font-size: 12px;
            border-radius: 4px;
            cursor: pointer;
            touch-action: manipulation;
        }
        .cheat-grid button:hover, .ce-btn-row button:hover {
            background: #ff00ff22;
            border-color: #ff00ff;
            color: #fff;
        }
        .results {
            max-height: 150px;
            overflow-y: auto;
            background: #0a0a12;
            border: 1px solid #333;
            margin-top: 8px;
            font-size: 11px;
        }
        .log-container {
            background: #0a0a12;
            border: 1px solid #333;
            padding: 8px;
            max-height: 150px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-all;
            user-select: text;
            margin-top: 4px;
        }
        #cheat-debug-log {
            color: #0f0;
        }
        #cheat-error-log {
            color: #f44;
        }
        .ce-status {
            font-size: 11px;
            color: #888;
            margin-top: 4px;
        }
        .switch-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #222;
        }
        .switch-row label { font-size: 13px; }
        .switch {
            position: relative;
            display: inline-block;
            width: 36px;
            height: 20px;
        }
        .switch input { opacity:0; width:0; height:0; }
        .slider {
            position: absolute;
            cursor: pointer;
            top:0; left:0; right:0; bottom:0;
            background-color: #333;
            transition: .3s;
            border-radius: 20px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #ff00ff;
        }
        input:checked + .slider:before {
            transform: translateX(16px);
        }
        .money-btn {
            background: #ffd70022 !important;
            border: 1px solid #ffd700 !important;
            color: #ffd700 !important;
            font-weight: bold;
            width: 100%;
            margin: 8px 0;
        }
        .money-btn:active {
            background: #ffd70044 !important;
        }
        .cheat-cat {
            font-size: 12px;
            color: #0ff;
            margin: 10px 0 4px 0;
            text-transform: uppercase;
        }
        .cheat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; }
        /* Airbreak touch controls */
        #airbreak-touch-controls {
            display: none;
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 100001;
            touch-action: none;
        }
        #airbreak-touch-controls.active {
            display: block;
        }
        .airbreak-joystick {
            width: 120px;
            height: 120px;
            background: rgba(0, 255, 255, 0.2);
            border: 2px solid #0ff;
            border-radius: 50%;
            position: relative;
            touch-action: none;
        }
        .airbreak-joystick-knob {
            width: 50px;
            height: 50px;
            background: rgba(0, 255, 255, 0.6);
            border: 2px solid #0ff;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        .airbreak-vertical-btns {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 100001;
        }
        .airbreak-v-btn {
            width: 60px;
            height: 60px;
            background: rgba(0, 255, 255, 0.2);
            border: 2px solid #0ff;
            border-radius: 10px;
            color: #0ff;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            touch-action: manipulation;
        }
        .airbreak-v-btn:active {
            background: rgba(0, 255, 255, 0.5);
        }
        #airbreak-toggle-fly {
            position: fixed;
            bottom: 160px;
            right: 20px;
            width: 80px;
            height: 40px;
            background: rgba(255, 255, 0, 0.2);
            border: 2px solid #ff0;
            border-radius: 10px;
            color: #ff0;
            font-size: 12px;
            font-weight: bold;
            z-index: 100001;
            display: none;
            align-items: center;
            justify-content: center;
            touch-action: manipulation;
        }
        #airbreak-toggle-fly.active {
            background: rgba(255, 255, 0, 0.5);
        }
        #airbreak-toggle-fly.visible {
            display: flex;
        }
        .copy-btn {
            background: #1a1a2e;
            border: 1px solid #444;
            color: #ccc;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            margin-left: 8px;
            touch-action: manipulation;
        }
        .copy-btn:hover {
            background: #ff00ff22;
            border-color: #ff00ff;
            color: #fff;
        }
        .log-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 6px;
        }
        .log-header label {
            font-size: 12px;
            color: #888;
        }
    `;
    document.head.appendChild(style);

    // External touch controls (airbreak)
    const airbreakTouchControls = document.createElement('div');
    airbreakTouchControls.id = 'airbreak-touch-controls';
    airbreakTouchControls.innerHTML = '<div class="airbreak-joystick" id="airbreak-joystick"><div class="airbreak-joystick-knob" id="airbreak-joystick-knob"></div></div>';
    document.body.appendChild(airbreakTouchControls);

    const airbreakVerticalBtns = document.createElement('div');
    airbreakVerticalBtns.className = 'airbreak-vertical-btns';
    airbreakVerticalBtns.id = 'airbreak-vertical-btns';
    airbreakVerticalBtns.innerHTML = '<div class="airbreak-v-btn" id="airbreak-up-btn">↑</div><div class="airbreak-v-btn" id="airbreak-down-btn">↓</div>';
    airbreakVerticalBtns.style.display = 'none';
    document.body.appendChild(airbreakVerticalBtns);

    const flyToggleBtn = document.createElement('div');
    flyToggleBtn.id = 'airbreak-toggle-fly';
    flyToggleBtn.innerHTML = 'FLY';
    document.body.appendChild(flyToggleBtn);

    // Main UI
    const ui = document.createElement('div');
    ui.id = 'cheat-engine-ui';
    ui.innerHTML = `
        <h1>
            Cheat Engine
            <button id="cheat-close-btn">✕</button>
        </h1>
        <div class="ce-tabs">
            <button class="active" data-tab="scanner">Scanner</button>
            <button data-tab="cheats">Cheats</button>
            <button data-tab="quick">Quick</button>
            <button data-tab="debugger">Debugger</button>
        </div>
        <div id="tab-scanner" class="ce-tab-content active">
            <div class="ce-input-row">
                <input type="text" id="ce-value" placeholder="Value" />
                <select id="ce-type">
                    <option value="any">Any</option><option value="i32">i32</option><option value="f32">f32</option>
                    <option value="i16">i16</option><option value="i8">i8</option>
                </select>
            </div>
            <div class="ce-btn-row">
                <button id="ce-search">New</button><button id="ce-next">Next</button><button id="ce-reset">Reset</button>
                <button id="ce-snap">Snap</button><button id="ce-inc">Inc</button><button id="ce-dec">Dec</button>
                <button id="ce-changed">Chg</button>
            </div>
            <div class="ce-status" id="ce-status">Ready</div>
            <div class="results" id="ce-results"></div>
            <div class="ce-input-row" style="margin-top:8px;">
                <input type="text" id="ce-manual-addr" placeholder="0xAddress" />
                <button id="ce-view-addr">View</button>
            </div>
            <div id="ce-manual-results" style="display:none;"></div>
        </div>
        <div id="tab-cheats" class="ce-tab-content">
            <div class="cheat-cat">Weapons & Health</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('THUGSTOOLS')">Thug Tools</button>
                <button class="cheat-btn" onclick="typeCheat('PROFESSIONALTOOLS')">Pro Tools</button>
                <button class="cheat-btn" onclick="typeCheat('NUTTERTOOLS')">Nutter Tools</button>
                <button class="cheat-btn" onclick="typeCheat('ASPIRINE')">Health</button>
                <button class="cheat-btn" onclick="typeCheat('PRECIOUSPROTECTION')">Armor</button>
            </div>
            <div class="cheat-cat">Gameplay</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('LEAVEMEALONE')">No Wanted</button>
                <button class="cheat-btn" onclick="typeCheat('YOUWONTTAKEMEALIVE')">Wanted +2</button>
                <button class="cheat-btn" onclick="typeCheat('ONSPEED')">Fast Game</button>
                <button class="cheat-btn" onclick="typeCheat('BOOOOOORING')">Slow Game</button>
                <button class="cheat-btn" onclick="typeCheat('LIFEISPASSINGMEBY')">Fast Time</button>
                <button class="cheat-btn" onclick="typeCheat('BIGBANG')">Explode All</button>
                <button class="cheat-btn" onclick="typeCheat('FIGHTFIGHTFIGHT')">Peds Riot</button>
                <button class="cheat-btn" onclick="typeCheat('NOBODYLIKESME')">Peds Attack</button>
                <button class="cheat-btn" onclick="typeCheat('OURGODGIVENRIGHTTOBEARARMS')">Peds Armed</button>
                <button class="cheat-btn" onclick="typeCheat('CHICKSWITHGUNS')">Armed Girls</button>
                <button class="cheat-btn" onclick="typeCheat('FANNYMAGNET')">Ladies Man</button>
                <button class="cheat-btn" onclick="typeCheat('HOPINGIRL')">Get in Car</button>
                <button class="cheat-btn" onclick="typeCheat('GREENLIGHT')">Green Lights</button>
                <button class="cheat-btn" onclick="typeCheat('MIAMITRAFFIC')">Fast Traffic</button>
                <button class="cheat-btn" onclick="typeCheat('ICANTTAKEITANYMORE')">Suicide</button>
            </div>
            <div class="cheat-cat">Skins</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('STILLLIKEDRESSINGUP')">Random Skin</button>
                <button class="cheat-btn" onclick="typeCheat('IDONTHAVETHEMONEYSONNY')">Sonny</button>
                <button class="cheat-btn" onclick="typeCheat('LOOKLIKELANCE')">Lance</button>
                <button class="cheat-btn" onclick="typeCheat('ILOOKLIKEHILARY')">Hilary</button>
                <button class="cheat-btn" onclick="typeCheat('ROCKANDROLLMAN')">Jezz</button>
                <button class="cheat-btn" onclick="typeCheat('WELOVEOURDICK')">Dick</button>
                <button class="cheat-btn" onclick="typeCheat('MYSONISALAWYER')">Ken</button>
                <button class="cheat-btn" onclick="typeCheat('ONEARMEDBANDIT')">Phil</button>
                <button class="cheat-btn" onclick="typeCheat('FOXYLITTLETHING')">Mercedes</button>
                <button class="cheat-btn" onclick="typeCheat('CHEATSHAVEBEENCRACKED')">Diaz</button>
                <button class="cheat-btn" onclick="typeCheat('IWANTBIGTITS')">Candy</button>
                <button class="cheat-btn" onclick="typeCheat('CERTAINDEATH')">Cigarette</button>
                <button class="cheat-btn" onclick="typeCheat('DEEPFRIEDMARSBARS')">Fat Tommy</button>
                <button class="cheat-btn" onclick="typeCheat('PROGRAMMER')">Thin Tommy</button>
            </div>
            <div class="cheat-cat">Vehicles</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('PANZER')">Tank</button>
                <button class="cheat-btn" onclick="typeCheat('GETTHEREFAST')">Sabre Turbo</button>
                <button class="cheat-btn" onclick="typeCheat('GETTHEREQUICKLY')">Bloodring A</button>
                <button class="cheat-btn" onclick="typeCheat('TRAVELINSTYLE')">Bloodring B</button>
                <button class="cheat-btn" onclick="typeCheat('GETTHEREVERYFASTINDEED')">Hotring A</button>
                <button class="cheat-btn" onclick="typeCheat('GETTHEREAMAZINGLYFAST')">Hotring B</button>
                <button class="cheat-btn" onclick="typeCheat('THELASTRIDE')">Hearse</button>
                <button class="cheat-btn" onclick="typeCheat('ROCKANDROLLCAR')">Limo</button>
                <button class="cheat-btn" onclick="typeCheat('BETTERTHANWALKING')">Caddy</button>
                <button class="cheat-btn" onclick="typeCheat('RUBBISHCAR')">Trashmaster</button>
            </div>
            <div class="cheat-cat">Vehicle Effects</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('COMEFLYWITHME')">Flying Cars</button>
                <button class="cheat-btn" onclick="typeCheat('AIRSHIP')">Flying Boats</button>
                <button class="cheat-btn" onclick="typeCheat('SEAWAYS')">Water Drive</button>
                <button class="cheat-btn" onclick="typeCheat('WHEELSAREALLINEED')">Only Wheels</button>
                <button class="cheat-btn" onclick="typeCheat('GRIPISEVERYTHING')">Perfect Handling</button>
                <button class="cheat-btn" onclick="typeCheat('IWANTITPAINTEDBLACK')">Black Cars</button>
                <button class="cheat-btn" onclick="typeCheat('AHAIRDRESSERSCAR')">Pink Cars</button>
                <button class="cheat-btn" onclick="typeCheat('LOADSOFLITTLETHINGS')">Small Wheels</button>
            </div>
            <div class="cheat-cat">Weather</div>
            <div class="cheat-grid">
                <button class="cheat-btn" onclick="typeCheat('ALOVELYDAY')">Sunny</button>
                <button class="cheat-btn" onclick="typeCheat('APLEASANTDAY')">Cloudy</button>
                <button class="cheat-btn" onclick="typeCheat('ABITDRIEG')">Very Cloudy</button>
                <button class="cheat-btn" onclick="typeCheat('CATSANDDOGS')">Rainy</button>
                <button class="cheat-btn" onclick="typeCheat('CANTSEEATHING')">Foggy</button>
            </div>
        </div>
        <div id="tab-quick" class="ce-tab-content">
            <div class="switch-row">
                <label>Fullscreen</label>
                <label class="switch"><input type="checkbox" id="ce-toggle-fullscreen"><span class="slider"></span></label>
            </div>
            <div class="switch-row">
                <label>AirBreak (RShift)</label>
                <label class="switch"><input type="checkbox" id="ce-toggle-airbreak"><span class="slider"></span></label>
            </div>
            <div class="switch-row">
                <label>GodMode</label>
                <label class="switch"><input type="checkbox" id="ce-toggle-godmode"><span class="slider"></span></label>
            </div>
            <button id="ce-add-money" class="money-btn">+$9999999 MONEY</button>
            <div class="ce-input-row">
                <label style="font-size:13px;">Fly Speed:</label>
                <input type="number" id="ce-fly-speed" value="2.0" step="0.5" min="0.1" max="50" style="width:60px;" />
            </div>
            <div class="ce-status" id="ce-airbreak-status">Ready</div>
            <div style="font-size:10px; color:#666;" id="ce-pos-display"></div>
        </div>
        <div id="tab-debugger" class="ce-tab-content">
            <div class="log-header">
                <label>Network Debug Logs</label>
                <button class="copy-btn" id="copy-network-logs">Copy</button>
            </div>
            <div class="log-container" id="cheat-debug-log"></div>
            <div class="log-header" style="margin-top:10px;">
                <label>Error Logs</label>
                <button class="copy-btn" id="copy-error-logs">Copy</button>
            </div>
            <div class="log-container" id="cheat-error-log"></div>
            <button id="clear-debug-log-btn" style="margin-top:8px; background:#1a1a2e; border:1px solid #444; color:#ccc; padding:4px 8px; border-radius:4px; cursor:pointer; width:100%;">Clear Logs</button>
        </div>
    `;
    document.body.appendChild(ui);

    // ========== COPY BUTTONS ==========
    document.getElementById('copy-network-logs').addEventListener('click', function() {
        const logDiv = document.getElementById('cheat-debug-log');
        const text = logDiv.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {
                // fallback
                copyTextFallback(text);
            });
        } else {
            copyTextFallback(text);
        }
    });

    document.getElementById('copy-error-logs').addEventListener('click', function() {
        const logDiv = document.getElementById('cheat-error-log');
        const text = logDiv.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {
                copyTextFallback(text);
            });
        } else {
            copyTextFallback(text);
        }
    });

    function copyTextFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            console.warn('Copy failed:', e);
        }
        document.body.removeChild(textarea);
    }

    // ========== ERROR LOG CAPTURE ==========
    let errorLogs = [];

    const originalConsoleError = console.error;
    console.error = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('[CheatEngine]')) {
            originalConsoleError.apply(console, args);
            return;
        }
        const timestamp = new Date().toISOString();
        errorLogs.push({ timestamp, message: msg, type: 'console.error' });
        if (errorLogs.length > 200) errorLogs.shift();
        updateErrorLogDisplay();
        originalConsoleError.apply(console, args);
    };

    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        const timestamp = new Date().toISOString();
        const msg = `Error: ${message} at ${source}:${lineno}:${colno}`;
        errorLogs.push({ timestamp, message: msg, type: 'window.onerror' });
        if (errorLogs.length > 200) errorLogs.shift();
        updateErrorLogDisplay();
        if (originalOnError) originalOnError(message, source, lineno, colno, error);
    };

    window.addEventListener('unhandledrejection', function(event) {
        const timestamp = new Date().toISOString();
        const msg = `Unhandled Promise Rejection: ${event.reason}`;
        errorLogs.push({ timestamp, message: msg, type: 'unhandledrejection' });
        if (errorLogs.length > 200) errorLogs.shift();
        updateErrorLogDisplay();
    });

    function updateErrorLogDisplay() {
        const logDiv = document.getElementById('cheat-error-log');
        if (!logDiv) return;
        const lines = errorLogs.map(e => `[${e.timestamp}] ${e.type}: ${e.message}`);
        logDiv.textContent = lines.join('\n');
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // ========== NETWORK LOG DISPLAY ==========
    function updateNetworkLogDisplay() {
        const logDiv = document.getElementById('cheat-debug-log');
        if (!logDiv) return;
        if (typeof window.getDebugLogLines === 'function') {
            const lines = window.getDebugLogLines();
            logDiv.textContent = lines.join('\n');
        }
    }

    // ========== TOGGLE MENU ==========
    let menuOpen = false;
    function toggleMenu() {
        menuOpen = !menuOpen;
        ui.style.display = menuOpen ? 'flex' : 'none';
        window.cheatMenuOpen = menuOpen;
        if (menuOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            document.body.style.cursor = 'default';
            if (Module.canvas) Module.canvas.style.cursor = 'default';
            updateNetworkLogDisplay();
            updateErrorLogDisplay();
            if (window._debugLogInterval) clearInterval(window._debugLogInterval);
            window._debugLogInterval = setInterval(updateNetworkLogDisplay, 1000);
        } else {
            if (Module.canvas) Module.canvas.style.cursor = 'none';
            document.body.style.cursor = 'none';
            if (window._debugLogInterval) {
                clearInterval(window._debugLogInterval);
                window._debugLogInterval = null;
            }
        }
    }
    window.toggleCheatMenu = toggleMenu;

    // Keyboard shortcut
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F3') { e.preventDefault(); e.stopPropagation(); toggleMenu(); }
    }, true);

    // ----- UI event handlers -----
    ui.querySelectorAll('.ce-tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            ui.querySelectorAll('.ce-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            ui.querySelectorAll('.ce-tab-content').forEach(t => t.classList.remove('active'));
            const tab = document.getElementById(tabId);
            if (tab) tab.classList.add('active');
            if (btn.dataset.tab === 'debugger') {
                updateNetworkLogDisplay();
                updateErrorLogDisplay();
            }
        });
    });

    const closeBtn = document.getElementById('cheat-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
        if (isTouch) {
            closeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); }, { passive: false });
        }
    }

    document.getElementById('clear-debug-log-btn').addEventListener('click', function() {
        const logDiv = document.getElementById('cheat-debug-log');
        if (logDiv) logDiv.textContent = '';
        const errDiv = document.getElementById('cheat-error-log');
        if (errDiv) errDiv.textContent = '';
        if (window.requestLog && Array.isArray(window.requestLog)) {
            window.requestLog.length = 0;
        }
        errorLogs = [];
    });

    // Prevent game events when menu open
    window.addEventListener('keydown', (e) => { if (menuOpen && e.target.tagName === 'INPUT') e.stopPropagation(); }, true);
    window.addEventListener('keyup', (e) => { if (menuOpen && e.target.tagName === 'INPUT') e.stopPropagation(); }, true);
    window.addEventListener('keypress', (e) => { if (menuOpen && e.target.tagName === 'INPUT') e.stopPropagation(); }, true);
    window.addEventListener('mousedown', (e) => { if (menuOpen && ui.contains(e.target)) e.stopPropagation(); }, true);
    window.addEventListener('touchstart', (e) => { if (menuOpen && ui.contains(e.target)) e.stopPropagation(); }, true);
    window.addEventListener('touchmove', (e) => { if (menuOpen && ui.contains(e.target)) e.stopPropagation(); }, true);
    window.addEventListener('touchend', (e) => { if (menuOpen && ui.contains(e.target)) e.stopPropagation(); }, true);

    // ========== FULLSCREEN TOGGLE ==========
    const fullscreenCheckbox = document.getElementById('ce-toggle-fullscreen');
    function syncFullscreenCheckbox() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
        fullscreenCheckbox.checked = isFullscreen;
    }
    document.addEventListener('fullscreenchange', syncFullscreenCheckbox);
    document.addEventListener('webkitfullscreenchange', syncFullscreenCheckbox);
    document.addEventListener('mozfullscreenchange', syncFullscreenCheckbox);

    fullscreenCheckbox.addEventListener('change', function(e) {
        if (e.target.checked) {
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(err => console.warn('Fullscreen error:', err));
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.mozRequestFullScreen) {
                el.mozRequestFullScreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => console.warn('Exit fullscreen error:', err));
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    });
    syncFullscreenCheckbox();

    // ========== ORIGINAL CHEAT ENGINE VARIABLES & FUNCTIONS ==========
    let results = [];
    let isSearching = false;
    let lastBuffer = null;
    
    let airbreakEnabled = false;
    let airbreakConfigured = false;
    let airbreakShiftAllowed = false;
    let playerMatrixAddr = 0;
    let flySpeed = 2.0;
    let keysPressed = { w: false, s: false, a: false, d: false, space: false, shift: false };

    let cachedDataView = null;
    function getView() {
        const buf = HEAPU8.buffer;
        if (!cachedDataView || cachedDataView.buffer !== buf) {
            cachedDataView = new DataView(buf);
        }
        return cachedDataView;
    }

    function readValue(view, addr, type) {
        try {
            const bufLen = view.buffer.byteLength;
            if (addr < 0 || addr >= bufLen - 8) return null;
            switch(type) {
                case 'i32': return view.getInt32(addr, true);
                case 'f32': return view.getFloat32(addr, true);
                case 'i16': return view.getInt16(addr, true);
                case 'i8': return view.getInt8(addr);
                case 'f64': return view.getFloat64(addr, true);
            }
        } catch(e) { console.warn('[CheatEngine] Read error at', addr, e); }
        return null;
    }

    function snapshotValues() {
        if (results.length === 0) return;
        const view = getView();
        let updated = 0;
        for (const res of results) {
            const val = readValue(view, res.addr, res.type);
            if (val !== null) { res.lastVal = val; updated++; }
        }
        updateStatus(`Snapshot: ${updated} values captured`);
    }

    function updateStatus(text) { document.getElementById('ce-status').textContent = text; }

    function checkMatch(view, addr, type, val, tolerance = 0.5) {
        try {
            switch(type) {
                case 'i32': { const v = view.getInt32(addr, true); return Math.abs(v - val) <= tolerance; }
                case 'f32': { const v = view.getFloat32(addr, true); if (!isFinite(v)) return false; return Math.abs(v - val) <= tolerance; }
                case 'i16': { const v = view.getInt16(addr, true); return Math.abs(v - val) <= tolerance; }
                case 'i8': { const v = view.getInt8(addr); return Math.abs(v - val) <= tolerance; }
                case 'f64': { const v = view.getFloat64(addr, true); if (!isFinite(v)) return false; return Math.abs(v - val) <= tolerance; }
                case 'any': {
                    const i32 = view.getInt32(addr, true);
                    if (Math.abs(i32 - val) <= tolerance) return 'i32';
                    const f32 = view.getFloat32(addr, true);
                    if (isFinite(f32) && Math.abs(f32 - val) <= tolerance) return 'f32';
                    const i16 = view.getInt16(addr, true);
                    if (Math.abs(i16 - val) <= tolerance) return 'i16';
                    const i8 = view.getInt8(addr);
                    if (Math.abs(i8 - val) <= tolerance) return 'i8';
                    return false;
                }
            }
        } catch(e) {}
        return false;
    }

    function firstSearch() {
        if (isSearching) return;
        const valStr = document.getElementById('ce-value').value;
        const type = document.getElementById('ce-type').value;
        const val = parseFloat(valStr);
        if (isNaN(val)) { updateStatus("Invalid value"); return; }
        isSearching = true;
        updateStatus("Searching...");
        results = [];
        setTimeout(() => {
            const view = getView();
            const bufferLen = view.buffer.byteLength;
            const step = (type === 'i8') ? 1 : 4;
            for (let i = 0; i < bufferLen - 8; i += step) {
                const matchType = checkMatch(view, i, type, val);
                if (matchType) {
                    const resType = type === 'any' ? matchType : type;
                    const currentVal = readValue(view, i, resType);
                    if (currentVal !== null) {
                        results.push({addr: i, type: resType, lastVal: currentVal});
                        if (results.length > 100000) break;
                    }
                }
            }
            updateStatus(`Found ${results.length} addresses`);
            displayResults();
            isSearching = false;
        }, 10);
    }

    function nextSearch() {
        if (isSearching || results.length === 0) {
            if (results.length === 0) updateStatus("No results. Do 'New' search first.");
            return;
        }
        const valStr = document.getElementById('ce-value').value;
        const val = parseFloat(valStr);
        if (isNaN(val)) { updateStatus("Invalid value"); return; }
        isSearching = true;
        const startCount = results.length;
        updateStatus(`Filtering ${startCount} addresses...`);
        const newResults = [];
        const view = getView();
        const bufLen = view.buffer.byteLength;
        for (const res of results) {
            if (res.addr < 0 || res.addr >= bufLen - 8) continue;
            const currentVal = readValue(view, res.addr, res.type);
            if (currentVal === null) continue;
            const matches = Math.abs(currentVal - val) <= 0.5;
            if (matches) { res.lastVal = currentVal; newResults.push(res); }
        }
        results = newResults;
        updateStatus(`Found ${results.length}/${startCount} addresses`);
        displayResults();
        isSearching = false;
    }

    function displayResults() {
        const container = document.getElementById('ce-results');
        container.innerHTML = '';
        const limit = Math.min(results.length, 100);
        const view = getView();
        for (let i = 0; i < limit; i++) {
            const res = results[i];
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.marginBottom = '2px';
            div.style.borderBottom = '1px solid #333';
            let currentVal;
            try {
                switch(res.type) {
                    case 'i32': currentVal = view.getInt32(res.addr, true); break;
                    case 'f32': currentVal = view.getFloat32(res.addr, true).toFixed(2); break;
                    case 'i16': currentVal = view.getInt16(res.addr, true); break;
                    case 'i8': currentVal = view.getInt8(res.addr); break;
                    case 'f64': currentVal = view.getFloat64(res.addr, true).toFixed(2); break;
                }
            } catch(e) { currentVal = "???"; }
            div.innerHTML = `
                <span style="color: #ff00ff;">0x${res.addr.toString(16)}</span>
                <span style="color: #0ff;">${currentVal}</span>
                <button class="cheat-btn" onclick="editAddr(${res.addr}, '${res.type}')">Edit</button>
            `;
            container.appendChild(div);
        }
    }

    window.editAddr = function(addr, type) {
        const newVal = prompt(`Enter new value for 0x${addr.toString(16)} (${type}):`);
        if (newVal === null) return;
        const view = getView();
        try {
            switch(type) {
                case 'i32': view.setInt32(addr, parseInt(newVal), true); break;
                case 'f32': view.setFloat32(addr, parseFloat(newVal), true); break;
                case 'i16': view.setInt16(addr, parseInt(newVal), true); break;
                case 'i8': view.setInt8(addr, parseInt(newVal)); break;
                case 'f64': view.setFloat64(addr, parseFloat(newVal), true); break;
            }
        } catch(e) { alert("Error writing to memory"); }
        displayResults();
        if (document.getElementById('ce-manual-results').style.display === 'block') { viewManualAddr(); }
    };

    function filterResults(mode) {
        if (isSearching || results.length === 0) {
            if (results.length === 0) updateStatus("No results to filter. Do 'New' search first.");
            return;
        }
        isSearching = true;
        updateStatus("Filtering...");
        const newResults = [];
        const view = getView();
        const bufLen = view.buffer.byteLength;
        for (const res of results) {
            if (res.addr < 0 || res.addr >= bufLen - 8) continue;
            const oldVal = res.lastVal;
            const newVal = readValue(view, res.addr, res.type);
            if (newVal === null) continue;
            if (oldVal === undefined || oldVal === null) { res.lastVal = newVal; continue; }
            let match = false;
            if (mode === 'inc' && newVal > oldVal) match = true;
            if (mode === 'dec' && newVal < oldVal) match = true;
            if (mode === 'changed' && Math.abs(newVal - oldVal) > 0.0001) match = true;
            if (match) { res.lastVal = newVal; newResults.push(res); }
        }
        results = newResults;
        updateStatus(`Found ${results.length} addresses (compared to snapshot)`);
        displayResults();
        isSearching = false;
    }

    function viewManualAddr() {
        const addrStr = document.getElementById('ce-manual-addr').value;
        const addr = parseInt(addrStr, 16);
        const view = getView();
        const bufLen = view.buffer.byteLength;
        if (isNaN(addr) || addr < 0 || addr >= bufLen - 8) {
            alert("Invalid address (out of range: 0 - 0x" + (bufLen - 8).toString(16) + ")");
            return;
        }
        const container = document.getElementById('ce-manual-results');
        container.style.display = 'block';
        container.innerHTML = '';
        const types = ['i8', 'i16', 'i32', 'f32', 'f64'];
        types.forEach(type => {
            let val;
            try {
                switch(type) {
                    case 'i8': val = view.getInt8(addr); break;
                    case 'i16': val = view.getInt16(addr, true); break;
                    case 'i32': val = view.getInt32(addr, true); break;
                    case 'f32': val = view.getFloat32(addr, true).toFixed(4); break;
                    case 'f64': val = view.getFloat64(addr, true).toFixed(4); break;
                }
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.marginBottom = '2px';
                div.innerHTML = `
                    <span style="color: #0ff;">${type.toUpperCase()}:</span>
                    <span>${val}</span>
                    <button class="cheat-btn" onclick="editAddr(${addr}, '${type}')">Edit</button>
                `;
                container.appendChild(div);
            } catch(e) {}
        });
    }

    document.getElementById('ce-view-addr').onclick = viewManualAddr;
    document.getElementById('ce-search').onclick = firstSearch;
    document.getElementById('ce-next').onclick = nextSearch;
    document.getElementById('ce-snap').onclick = snapshotValues;
    document.getElementById('ce-inc').onclick = () => filterResults('inc');
    document.getElementById('ce-dec').onclick = () => filterResults('dec');
    document.getElementById('ce-changed').onclick = () => filterResults('changed');
    document.getElementById('ce-reset').onclick = () => {
        results = [];
        document.getElementById('ce-results').innerHTML = '';
        updateStatus("Reset");
    };

    window.typeCheat = async function(code) {
        console.log("Typing cheat:", code);
        updateStatus("Entering cheat...");
        if (typeof JSEvents === 'undefined' || !JSEvents.eventHandlers) return;
        const handlers = JSEvents.eventHandlers.filter(h => 
            h.eventTypeString === 'keydown' || h.eventTypeString === 'keypress' || h.eventTypeString === 'keyup'
        );
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
            const fakeEvent = { _isCheat: true };
            fillBuffer();
            for (const h of handlers) {
                if (h.eventTypeString === 'keydown') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData);
            }
            fillBuffer();
            for (const h of handlers) {
                if (h.eventTypeString === 'keypress') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData);
            }
            fillBuffer();
            for (const h of handlers) {
                if (h.eventTypeString === 'keyup') getWasmTableEntry(h.callbackfunc)(h.eventTypeId, eventDataPtr, h.userData);
            }
            await new Promise(r => setTimeout(r, 5));
        }
        _free(eventDataPtr);
        updateStatus("Cheat entered: " + code);
    };

    // ========== AIRBREAK FUNCTIONALITY ==========
    let positionAddr = 0, headingAddr = 0, healthAddr = 0, moveSpeedAddr = 0;
    let lockedZ = 0, lockedHealth = 100;
    let godModeEnabled = false;
    let moneyAddr = 0;
    
    function getStaticAddresses() {
        const view = getView();
        const bufLen = view.buffer.byteLength;
        const isRu = typeof currentLanguage !== 'undefined' && currentLanguage === 'ru';
        const moneyHandleAddr = isRu ? 0x361c60 : 0x361c50;
        if (moneyHandleAddr >= bufLen - 4) return null;
        moneyAddr = moneyHandleAddr;
        const pedPtrAddr = moneyHandleAddr - 0xA0;
        if (pedPtrAddr < 0 || pedPtrAddr >= bufLen - 4) return null;
        const pedAddr = view.getInt32(pedPtrAddr, true);
        if (pedAddr <= 0 || pedAddr >= bufLen - 0x400) return null;
        const hpAddr = pedAddr + 0x350;
        if (hpAddr < 0 || hpAddr >= bufLen - 4) return null;
        return { pedAddr, healthAddr: hpAddr, moneyAddr: moneyHandleAddr };
    }
    
    function setupAirbreak() {
        const addrs = getStaticAddresses();
        if (!addrs) {
            document.getElementById('ce-airbreak-status').textContent = 'Failed to find addresses';
            document.getElementById('ce-airbreak-status').style.color = '#f00';
            return false;
        }
        healthAddr = addrs.healthAddr;
        const view = getView();
        const bufLen = view.buffer.byteLength;
        const HEALTH_OFFSET = 0x354;
        const MATRIX_OFFSET = 0x04;
        const X_IN_MATRIX = 0x34;
        const HEADING_OFFSET = 0x24;
        const MOVESPEED_OFFSET = 0x74;
        const entityBase = healthAddr - HEALTH_OFFSET;
        positionAddr = entityBase + MATRIX_OFFSET + X_IN_MATRIX;
        headingAddr = healthAddr + HEADING_OFFSET;
        moveSpeedAddr = entityBase + MOVESPEED_OFFSET;
        if (positionAddr < 0 || positionAddr >= bufLen - 12 || headingAddr < 0 || headingAddr >= bufLen - 4) {
            document.getElementById('ce-airbreak-status').textContent = 'Address out of range';
            return false;
        }
        const x = view.getFloat32(positionAddr, true);
        const y = view.getFloat32(positionAddr + 4, true);
        const z = view.getFloat32(positionAddr + 8, true);
        const heading = view.getFloat32(headingAddr, true);
        const health = view.getFloat32(healthAddr, true);
        lockedZ = z;
        lockedHealth = health;
        if (!isFinite(x) || !isFinite(y) || !isFinite(z) || Math.abs(x) > 5000 || Math.abs(y) > 5000 || z < -50 || z > 1000) {
            document.getElementById('ce-airbreak-status').textContent =
                `Suspicious pos: ${x.toFixed(0)},${y.toFixed(0)},${z.toFixed(0)} - try anyway? [RShift]`;
            document.getElementById('ce-airbreak-status').style.color = '#f80';
        } else {
            document.getElementById('ce-airbreak-status').textContent =
                `Ready! [RShift to fly] H:${(heading * 180 / Math.PI).toFixed(0)}°`;
            document.getElementById('ce-airbreak-status').style.color = '#0f0';
        }
        playerMatrixAddr = positionAddr;
        airbreakConfigured = true;
        updatePositionDisplay();
        return true;
    }
    
    function toggleGodMode(e) {
        const checkbox = document.getElementById('ce-toggle-godmode');
        if (e && e.target === checkbox) godModeEnabled = checkbox.checked;
        else { godModeEnabled = !godModeEnabled; checkbox.checked = godModeEnabled; }
        const addrs = getStaticAddresses();
        if (!addrs) {
            document.getElementById('ce-airbreak-status').textContent = 'Failed to find HP address';
            document.getElementById('ce-airbreak-status').style.color = '#f00';
            if (godModeEnabled) { godModeEnabled = false; checkbox.checked = false; }
            return;
        }
        if (!godModeEnabled) {
            const view = getView();
            try { view.setFloat32(addrs.healthAddr, 100.0, true); } catch(e) {}
        }
        document.getElementById('ce-airbreak-status').textContent = godModeEnabled ? 'GodMode ON - Infinite HP' : 'GodMode OFF (HP reset to 100)';
        document.getElementById('ce-airbreak-status').style.color = godModeEnabled ? '#0f0' : '#888';
    }
    
    function godModeTick() {
        if (!godModeEnabled) return;
        const addrs = getStaticAddresses();
        if (!addrs) return;
        const view = getView();
        try { view.setFloat32(addrs.healthAddr, 999.0, true); } catch(e) {}
    }
    
    function addMoney() {
        const addrs = getStaticAddresses();
        if (!addrs) {
            document.getElementById('ce-airbreak-status').textContent = 'Failed to find money address';
            document.getElementById('ce-airbreak-status').style.color = '#f00';
            return;
        }
        const view = getView();
        try {
            const currentMoney = view.getInt32(addrs.moneyAddr, true);
            view.setInt32(addrs.moneyAddr, currentMoney + 9999999, true);
            document.getElementById('ce-airbreak-status').textContent = '+$9999999 added!';
            document.getElementById('ce-airbreak-status').style.color = '#ffd700';
        } catch(e) {
            document.getElementById('ce-airbreak-status').textContent = 'Failed to add money';
            document.getElementById('ce-airbreak-status').style.color = '#f00';
        }
    }
    
    function toggleAirBrake(e) {
        const checkbox = document.getElementById('ce-toggle-airbreak');
        if (e && e.target === checkbox) airbreakShiftAllowed = checkbox.checked;
        else { airbreakShiftAllowed = !airbreakShiftAllowed; checkbox.checked = airbreakShiftAllowed; }
        if (!airbreakShiftAllowed && airbreakEnabled) {
            airbreakEnabled = false;
            document.getElementById('ce-airbreak-status').textContent = 'AirBreak disabled';
            document.getElementById('ce-airbreak-status').style.color = '#888';
        } else if (airbreakShiftAllowed) {
            if (!airbreakConfigured) setupAirbreak();
            document.getElementById('ce-airbreak-status').textContent = 'AirBreak enabled (RShift to fly)';
            document.getElementById('ce-airbreak-status').style.color = '#0f0';
        } else {
            document.getElementById('ce-airbreak-status').textContent = 'AirBreak disabled';
            document.getElementById('ce-airbreak-status').style.color = '#888';
        }
    }
    
    function toggleFlying() {
        if (!airbreakShiftAllowed) return false;
        if (!airbreakConfigured) { if (!setupAirbreak()) return false; }
        airbreakEnabled = !airbreakEnabled;
        if (airbreakEnabled) {
            const view = getView();
            lockedZ = view.getFloat32(positionAddr + 8, true);
            lockedHealth = view.getFloat32(healthAddr, true);
        }
        document.getElementById('ce-airbreak-status').textContent = airbreakEnabled ?
            `FLYING! Z=${lockedZ.toFixed(1)}` : 'AirBreak enabled (RShift to fly)';
        document.getElementById('ce-airbreak-status').style.color = airbreakEnabled ? '#ff0' : '#0f0';
        return true;
    }
    
    function updatePositionDisplay() {
        if (!airbreakConfigured || positionAddr === 0) return;
        const view = getView();
        const bufLen = view.buffer.byteLength;
        if (positionAddr < 0 || positionAddr >= bufLen - 12) return;
        try {
            const x = view.getFloat32(positionAddr, true);
            const y = view.getFloat32(positionAddr + 4, true);
            const z = view.getFloat32(positionAddr + 8, true);
            const heading = view.getFloat32(headingAddr, true);
            const hp = view.getFloat32(healthAddr, true);
            document.getElementById('ce-pos-display').textContent =
                `X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)} H:${(heading * 180 / Math.PI).toFixed(0)}° HP:${hp.toFixed(0)}` +
                (airbreakEnabled ? ' [FLY]' : '');
        } catch(e) {}
    }
    
    function airbreakTick() {
        if (!airbreakEnabled || !airbreakConfigured || positionAddr === 0) return;
        const view = getView();
        const bufLen = view.buffer.byteLength;
        if (positionAddr < 0 || positionAddr >= bufLen - 12) return;
        try {
            let x = view.getFloat32(positionAddr, true);
            let y = view.getFloat32(positionAddr + 4, true);
            let z = view.getFloat32(positionAddr + 8, true);
            const headingRaw = view.getFloat32(headingAddr, true);
            const heading = -headingRaw;
            const speed = parseFloat(document.getElementById('ce-fly-speed').value) || 2.0;
            const sinH = Math.sin(heading);
            const cosH = Math.cos(heading);
            if (keysPressed.w) { x += sinH * speed; y += cosH * speed; }
            if (keysPressed.s) { x -= sinH * speed; y -= cosH * speed; }
            if (keysPressed.a) { x -= cosH * speed; y += sinH * speed; }
            if (keysPressed.d) { x += cosH * speed; y -= sinH * speed; }
            if (keysPressed.space) lockedZ += speed;
            if (keysPressed.shift) lockedZ -= speed;
            z = lockedZ;
            view.setFloat32(positionAddr, x, true);
            view.setFloat32(positionAddr + 4, y, true);
            view.setFloat32(positionAddr + 8, z, true);
            view.setFloat32(healthAddr, lockedHealth, true);
            view.setFloat32(moveSpeedAddr, 0, true);
            view.setFloat32(moveSpeedAddr + 4, 0, true);
            view.setFloat32(moveSpeedAddr + 8, 0, true);
            updatePositionDisplay();
        } catch(e) { console.warn('[AirBreak] Tick error:', e); }
    }
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ShiftRight' || (e.key === 'Shift' && e.location === 2)) {
            if (!airbreakShiftAllowed) return;
            toggleFlying();
            return;
        }
        if (!airbreakEnabled) return;
        const code = e.code;
        if (code === 'KeyW') keysPressed.w = true;
        if (code === 'KeyS') keysPressed.s = true;
        if (code === 'KeyA') keysPressed.a = true;
        if (code === 'KeyD') keysPressed.d = true;
        if (code === 'Space') keysPressed.space = true;
        if (code === 'ShiftLeft') keysPressed.shift = true;
    }, true);
    
    window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (code === 'KeyW') keysPressed.w = false;
        if (code === 'KeyS') keysPressed.s = false;
        if (code === 'KeyA') keysPressed.a = false;
        if (code === 'KeyD') keysPressed.d = false;
        if (code === 'Space') keysPressed.space = false;
        if (code === 'ShiftLeft') keysPressed.shift = false;
    }, true);
    
    setInterval(airbreakTick, 16);
    setInterval(godModeTick, 100);
    setInterval(updatePositionDisplay, 100);
    
    document.getElementById('ce-toggle-airbreak').onchange = toggleAirBrake;
    document.getElementById('ce-toggle-godmode').onchange = toggleGodMode;
    document.getElementById('ce-add-money').onclick = addMoney;
    document.getElementById('ce-fly-speed').onchange = () => {
        flySpeed = parseFloat(document.getElementById('ce-fly-speed').value) || 2.0;
    };

    // ========== TOUCH CONTROLS FOR AIRBREAK ==========
    if (isTouch) {
        const joystick = document.getElementById('airbreak-joystick');
        const joystickKnob = document.getElementById('airbreak-joystick-knob');
        const upBtn = document.getElementById('airbreak-up-btn');
        const downBtn = document.getElementById('airbreak-down-btn');
        const verticalBtns = document.getElementById('airbreak-vertical-btns');
        
        let joystickActive = false;
        let joystickCenterX = 0;
        let joystickCenterY = 0;
        const joystickRadius = 60;
        const deadzone = 15;
        
        function updateTouchControlsVisibility() {
            if (menuOpen) {
                airbreakTouchControls.classList.remove('active');
                verticalBtns.style.display = 'none';
                flyToggleBtn.classList.remove('visible');
                return;
            }
            if (airbreakConfigured && airbreakEnabled && airbreakShiftAllowed) {
                airbreakTouchControls.classList.add('active');
                verticalBtns.style.display = 'flex';
            } else {
                airbreakTouchControls.classList.remove('active');
                verticalBtns.style.display = 'none';
            }
            if (airbreakConfigured && airbreakShiftAllowed) {
                flyToggleBtn.classList.add('visible');
                flyToggleBtn.classList.toggle('active', airbreakEnabled);
                flyToggleBtn.textContent = airbreakEnabled ? 'STOP' : 'FLY';
            } else {
                flyToggleBtn.classList.remove('visible');
            }
        }
        
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
        
        flyToggleBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flyBtnDragging = false;
            const touch = e.touches[0];
            flyBtnStartX = touch.clientX;
            flyBtnStartY = touch.clientY;
            const rect = flyToggleBtn.getBoundingClientRect();
            flyBtnInitialRight = window.innerWidth - rect.right;
            flyBtnInitialBottom = window.innerHeight - rect.bottom;
        }, { passive: false });
        
        flyToggleBtn.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            const deltaX = touch.clientX - flyBtnStartX;
            const deltaY = touch.clientY - flyBtnStartY;
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) flyBtnDragging = true;
            if (flyBtnDragging) {
                let newRight = flyBtnInitialRight - deltaX;
                let newBottom = flyBtnInitialBottom - deltaY;
                const bw = flyToggleBtn.offsetWidth;
                const bh = flyToggleBtn.offsetHeight;
                newRight = Math.max(0, Math.min(window.innerWidth - bw, newRight));
                newBottom = Math.max(0, Math.min(window.innerHeight - bh, newBottom));
                flyToggleBtn.style.right = newRight + 'px';
                flyToggleBtn.style.bottom = newBottom + 'px';
            }
        }, { passive: false });
        
        flyToggleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (flyBtnDragging) {
                const rect = flyToggleBtn.getBoundingClientRect();
                localStorage.setItem('cheat-fly-pos', JSON.stringify({
                    right: window.innerWidth - rect.right,
                    bottom: window.innerHeight - rect.bottom
                }));
            } else {
                if (airbreakConfigured) {
                    airbreakEnabled = !airbreakEnabled;
                    if (airbreakEnabled) {
                        const view = getView();
                        lockedZ = view.getFloat32(positionAddr + 8, true);
                        lockedHealth = view.getFloat32(healthAddr, true);
                    }
                    document.getElementById('ce-airbreak-status').textContent =
                        airbreakEnabled ? `FLYING! Z=${lockedZ.toFixed(1)} HP=${lockedHealth.toFixed(0)}` : `Ready! [Tap FLY]`;
                    document.getElementById('ce-airbreak-status').style.color = airbreakEnabled ? '#ff0' : '#0f0';
                    updateTouchControlsVisibility();
                }
            }
            flyBtnDragging = false;
        }, { passive: false });
        
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            joystickActive = true;
            const rect = joystick.getBoundingClientRect();
            joystickCenterX = rect.left + rect.width / 2;
            joystickCenterY = rect.top + rect.height / 2;
            handleJoystickMove(e.touches[0]);
        }, { passive: false });
        
        joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (joystickActive) handleJoystickMove(e.touches[0]);
        }, { passive: false });
        
        joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            joystickActive = false;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            keysPressed.w = false;
            keysPressed.s = false;
            keysPressed.a = false;
            keysPressed.d = false;
        }, { passive: false });
        
        joystick.addEventListener('touchcancel', (e) => {
            joystickActive = false;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            keysPressed.w = false;
            keysPressed.s = false;
            keysPressed.a = false;
            keysPressed.d = false;
        });
        
        function handleJoystickMove(touch) {
            let deltaX = touch.clientX - joystickCenterX;
            let deltaY = touch.clientY - joystickCenterY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance > joystickRadius) {
                deltaX = (deltaX / distance) * joystickRadius;
                deltaY = (deltaY / distance) * joystickRadius;
            }
            joystickKnob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
            keysPressed.w = deltaY < -deadzone;
            keysPressed.s = deltaY > deadzone;
            keysPressed.a = deltaX < -deadzone;
            keysPressed.d = deltaX > deadzone;
        }
        
        upBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            keysPressed.space = true;
        }, { passive: false });
        
        upBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keysPressed.space = false;
        }, { passive: false });
        
        upBtn.addEventListener('touchcancel', () => { keysPressed.space = false; });
        
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            keysPressed.shift = true;
        }, { passive: false });
        
        downBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keysPressed.shift = false;
        }, { passive: false });
        
        downBtn.addEventListener('touchcancel', () => { keysPressed.shift = false; });
        
        setInterval(updateTouchControlsVisibility, 500);
    }

    console.log('🔧 Cheat Engine UI ready.');
    window.cheatMenuOpen = false;
})();