var Module = typeof Module != "undefined" ? Module : {};
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";
if (!Module["expectedDataFileDownloads"]) Module["expectedDataFileDownloads"] = 0;
Module["expectedDataFileDownloads"]++;
var arguments_ = [];
var thisProgram = "./this.program";

var _scriptName = globalThis.document?.currentScript?.src;
if (typeof __filename != "undefined") {
    _scriptName = __filename
} else if (ENVIRONMENT_IS_WORKER) {
    _scriptName = self.location.href
}
var scriptDirectory = "";

function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    }
    return scriptDirectory + path
}
var readAsync, readBinary;
if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    scriptDirectory = __dirname + "/";
    readBinary = filename => {
        filename = isFileURI(filename) ? new URL(filename) : filename;
        var ret = fs.readFileSync(filename);
        return ret
    };
    readAsync = async (filename, binary = true) => {
        filename = isFileURI(filename) ? new URL(filename) : filename;
        var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
        return ret
    };
    if (process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, "/")
    }
    arguments_ = process.argv.slice(2);
    if (typeof module != "undefined") {
        module["exports"] = Module
    }
    quit_ = (status, toThrow) => {
        process.exitCode = status;
        throw toThrow
    }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
        scriptDirectory = new URL(".", _scriptName).href
    } catch {} {
        if (ENVIRONMENT_IS_WORKER) {
            readBinary = url => {
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response)
            }
        }
        readAsync = async url => {
            if (isFileURI(url)) {
                return new Promise((resolve, reject) => {
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = () => {
                        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                            resolve(xhr.response);
                            return
                        }
                        reject(xhr.status)
                    };
                    xhr.onerror = reject;
                    xhr.send(null)
                })
            }
            var response = await fetch(url, {
                credentials: "same-origin"
            });
            if (response.ok) {
                return response.arrayBuffer()
            }
            throw new Error(response.status + " : " + response.url)
        }
    }
} else {}
var out = console.log.bind(console);
var err = console.error.bind(console);
var wasmBinary;
var ABORT = false;
var EXITSTATUS;
var isFileURI = filename => filename.startsWith("file://");
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var HEAP64, HEAPU64;
var runtimeInitialized = false;

function updateMemoryViews() {
    var b = wasmMemory.buffer;
    HEAP8 = new Int8Array(b);
    HEAP16 = new Int16Array(b);
    HEAPU8 = new Uint8Array(b);
    HEAPU16 = new Uint16Array(b);
    HEAP32 = new Int32Array(b);
    HEAPU32 = new Uint32Array(b);
    HEAPF32 = new Float32Array(b);
    HEAPF64 = new Float64Array(b);
    HEAP64 = new BigInt64Array(b);
    HEAPU64 = new BigUint64Array(b)
}

function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(onPreRuns)
}

function initRuntime() {
    FS.createPreloadedFile = FS_createPreloadedFile;
    FS.preloadFile = FS_preloadFile;
    if (window.initGLFrame) window.initGLFrame();
    Fetch.init();
    runtimeInitialized = true;
    TTY.init();
    wasmExports["xk"]();
    FS.ignorePermissions = false
}

function preMain() {}

function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(onPostRuns)
}
abort = function(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    throw e
};
var wasmBinaryFile;

function findWasmBinary() {
    return locateFile("index.wasm")
}

function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary)
    }
    if (readBinary) {
        return readBinary(file)
    }
    throw "both async and sync fetching of the wasm failed"
}
async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
        try {
            var response = await readAsync(binaryFile);
            return new Uint8Array(response)
        } catch {}
    }
    return getBinarySync(binaryFile)
}
async function instantiateArrayBuffer(binaryFile, imports) {
    try {
        var binary = await getWasmBinary(binaryFile);
        var instance = await WebAssembly.instantiate(binary, imports);
        return instance
    } catch (reason) {
        err(`failed to asynchronously prepare wasm: ${reason}`);
        abort(reason)
    }
}
async function instantiateAsync(binary, binaryFile, imports) {
    if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
        try {
            var response = fetch(binaryFile, {
                credentials: "same-origin"
            });
            var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
            return instantiationResult
        } catch (reason) {
            err(`wasm streaming compile failed: ${reason}`);
            err("falling back to ArrayBuffer instantiation")
        }
    }
    return instantiateArrayBuffer(binaryFile, imports)
}

function getWasmImports() {
    initDependencies();
    var imports = {
        a: wasmImports   // defined in runtime_wasm_imports.js
    };
    return imports
}
async function createWasm() {
    function receiveInstance(instance, module) {
        wasmExports = instance.exports;
        assignWasmExports(wasmExports);
        updateMemoryViews();
        removeRunDependency("wasm-instantiate");
        return wasmExports
    }
    addRunDependency("wasm-instantiate");

    function receiveInstantiationResult(result) {
        return receiveInstance(result["instance"])
    }
    var info = getWasmImports();
    if (Module["instantiateWasm"]) {
        return new Promise((resolve, reject) => {
            Module["instantiateWasm"](info, (inst, mod) => {
                resolve(receiveInstance(inst, mod))
            })
        })
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
    var exports = receiveInstantiationResult(result);
    return exports
}
class ExitStatus {
    name = "ExitStatus";
    constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status
    }
}
var callRuntimeCallbacks = callbacks => {
    while (callbacks.length > 0) {
        callbacks.shift()(Module)
    }
};
var onPostRuns = [];
var addOnPostRun = cb => onPostRuns.push(cb);
var onPreRuns = [];
var addOnPreRun = cb => onPreRuns.push(cb);
var runDependencies = 0;
var dependenciesFulfilled = null;
var removeRunDependency = id => {
    runDependencies--;
    Module["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
};
var addRunDependency = id => {
    runDependencies++;
    Module["monitorRunDependencies"]?.(runDependencies)
};
var noExitRuntime = true;

function setValue(ptr, value, type = "i8") {
    if (type.endsWith("*")) type = "*";
    switch (type) {
        case "i1":
            HEAP8[ptr] = value;
            break;
        case "i8":
            HEAP8[ptr] = value;
            break;
        case "i16":
            HEAP16[ptr >> 1] = value;
            break;
        case "i32":
            HEAP32[ptr >> 2] = value;
            break;
        case "i64":
            HEAP64[ptr >> 3] = BigInt(value);
            break;
        case "float":
            HEAPF32[ptr >> 2] = value;
            break;
        case "double":
            HEAPF64[ptr >> 3] = value;
            break;
        case "*":
            HEAPU32[ptr >> 2] = value;
            break;
        default:
            abort(`invalid type for setValue: ${type}`)
    }
}
var stackRestore = val => __emscripten_stack_restore(val);
var stackSave = () => _emscripten_stack_get_current();
var exceptionCaught = [];
var uncaughtExceptionCount = 0;
var ___cxa_begin_catch = ptr => {
    var info = new ExceptionInfo(ptr);
    if (!info.get_caught()) {
        info.set_caught(true);
        uncaughtExceptionCount--
    }
    info.set_rethrown(false);
    exceptionCaught.push(info);
    ___cxa_increment_exception_refcount(ptr);
    return ___cxa_get_exception_ptr(ptr)
};
var exceptionLast = 0;
var ___cxa_end_catch = () => {
    _setThrew(0, 0);
    var info = exceptionCaught.pop();
    ___cxa_decrement_exception_refcount(info.excPtr);
    exceptionLast = 0
};
class ExceptionInfo {
    constructor(excPtr) {
        this.excPtr = excPtr;
        this.ptr = excPtr - 24
    }
    set_type(type) {
        HEAPU32[this.ptr + 4 >> 2] = type
    }
    get_type() {
        return HEAPU32[this.ptr + 4 >> 2]
    }
    set_destructor(destructor) {
        HEAPU32[this.ptr + 8 >> 2] = destructor
    }
    get_destructor() {
        return HEAPU32[this.ptr + 8 >> 2]
    }
    set_caught(caught) {
        caught = caught ? 1 : 0;
        HEAP8[this.ptr + 12] = caught
    }
    get_caught() {
        return HEAP8[this.ptr + 12] != 0
    }
    set_rethrown(rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[this.ptr + 13] = rethrown
    }
    get_rethrown() {
        return HEAP8[this.ptr + 13] != 0
    }
    init(type, destructor) {
        this.set_adjusted_ptr(0);
        this.set_type(type);
        this.set_destructor(destructor)
    }
    set_adjusted_ptr(adjustedPtr) {
        HEAPU32[this.ptr + 16 >> 2] = adjustedPtr
    }
    get_adjusted_ptr() {
        return HEAPU32[this.ptr + 16 >> 2]
    }
}
var setTempRet0 = val => __emscripten_tempret_set(val);
var findMatchingCatch = args => {
    var thrown = exceptionLast;
    if (!thrown) {
        setTempRet0(0);
        return 0
    }
    var info = new ExceptionInfo(thrown);
    info.set_adjusted_ptr(thrown);
    var thrownType = info.get_type();
    if (!thrownType) {
        setTempRet0(0);
        return thrown
    }
    for (var caughtType of args) {
        if (caughtType === 0 || caughtType === thrownType) {
            break
        }
        var adjusted_ptr_addr = info.ptr + 16;
        if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
            setTempRet0(caughtType);
            return thrown
        }
    }
    setTempRet0(thrownType);
    return thrown
};
var ___cxa_find_matching_catch_2 = () => findMatchingCatch([]);
var ___cxa_find_matching_catch_3 = arg0 => findMatchingCatch([arg0]);
var ___cxa_rethrow = () => {
    var info = exceptionCaught.pop();
    if (!info) {
        abort("no exception to throw")
    }
    var ptr = info.excPtr;
    if (!info.get_rethrown()) {
        exceptionCaught.push(info);
        info.set_rethrown(true);
        info.set_caught(false);
        uncaughtExceptionCount++
    }
    exceptionLast = ptr;
    throw exceptionLast
};
var ___cxa_throw = (ptr, type, destructor) => {
    var info = new ExceptionInfo(ptr);
    info.init(type, destructor);
    exceptionLast = ptr;
    uncaughtExceptionCount++;
    throw exceptionLast
};
var ___cxa_uncaught_exceptions = () => uncaughtExceptionCount;
var ___resumeException = ptr => {
    if (!exceptionLast) {
        exceptionLast = ptr
    }
    throw exceptionLast
};
var __abort_js = () => abort("");
var INT53_MAX = 9007199254740992;
var INT53_MIN = -9007199254740992;
var bigintToI53Checked = num => num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

function __gmtime_js(time, tmPtr) {
    time = bigintToI53Checked(time);
    var date = new Date(time * 1e3);
    HEAP32[tmPtr >> 2] = date.getUTCSeconds();
    HEAP32[tmPtr + 4 >> 2] = date.getUTCMinutes();
    HEAP32[tmPtr + 8 >> 2] = date.getUTCHours();
    HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
    HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
    HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
    HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
    var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
    var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;
    HEAP32[tmPtr + 28 >> 2] = yday
}
var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
var MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
var MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
var ydayFromDate = date => {
    var leap = isLeapYear(date.getFullYear());
    var monthDaysCumulative = leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE;
    var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
    return yday
};

function __localtime_js(time, tmPtr) {
    time = bigintToI53Checked(time);
    var date = new Date(time * 1e3);
    HEAP32[tmPtr >> 2] = date.getSeconds();
    HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
    HEAP32[tmPtr + 8 >> 2] = date.getHours();
    HEAP32[tmPtr + 12 >> 2] = date.getDate();
    HEAP32[tmPtr + 16 >> 2] = date.getMonth();
    HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
    HEAP32[tmPtr + 24 >> 2] = date.getDay();
    var yday = ydayFromDate(date) | 0;
    HEAP32[tmPtr + 28 >> 2] = yday;
    HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
    var start = new Date(date.getFullYear(), 0, 1);
    var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    var winterOffset = start.getTimezoneOffset();
    var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
    HEAP32[tmPtr + 32 >> 2] = dst
}
var __mktime_js = function(tmPtr) {
    var ret = (() => {
        var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0);
        var dst = HEAP32[tmPtr + 32 >> 2];
        var guessedOffset = date.getTimezoneOffset();
        var start = new Date(date.getFullYear(), 0, 1);
        var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dstOffset = Math.min(winterOffset, summerOffset);
        if (dst < 0) {
            HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset)
        } else if (dst > 0 != (dstOffset == guessedOffset)) {
            var nonDstOffset = Math.max(winterOffset, summerOffset);
            var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
            date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4)
        }
        HEAP32[tmPtr + 24 >> 2] = date.getDay();
        var yday = ydayFromDate(date) | 0;
        HEAP32[tmPtr + 28 >> 2] = yday;
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
        HEAP32[tmPtr + 8 >> 2] = date.getHours();
        HEAP32[tmPtr + 12 >> 2] = date.getDate();
        HEAP32[tmPtr + 16 >> 2] = date.getMonth();
        HEAP32[tmPtr + 20 >> 2] = date.getYear();
        var timeMs = date.getTime();
        if (isNaN(timeMs)) {
            return -1
        }
        return timeMs / 1e3
    })();
    return BigInt(ret)
};
var __tzset_js = (timezone, daylight, std_name, dst_name) => {
    var currentYear = (new Date).getFullYear();
    var winter = new Date(currentYear, 0, 1);
    var summer = new Date(currentYear, 6, 1);
    var winterOffset = winter.getTimezoneOffset();
    var summerOffset = summer.getTimezoneOffset();
    var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
    HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
    HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
    var extractZone = timezoneOffset => {
        var sign = timezoneOffset >= 0 ? "-" : "+";
        var absOffset = Math.abs(timezoneOffset);
        var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
        var minutes = String(absOffset % 60).padStart(2, "0");
        return `UTC${sign}${hours}${minutes}`
    };
    var winterName = extractZone(winterOffset);
    var summerName = extractZone(summerOffset);
    if (summerOffset < winterOffset) {
        stringToUTF8(winterName, std_name, 17);
        stringToUTF8(summerName, dst_name, 17)
    } else {
        stringToUTF8(winterName, dst_name, 17);
        stringToUTF8(summerName, std_name, 17)
    }
};
var _emscripten_set_main_loop_timing = (mode, value) => {
    MainLoop.timingMode = mode;
    MainLoop.timingValue = value;
    if (!MainLoop.func) {
        return 1
    }
    if (!MainLoop.running) {
        MainLoop.running = true
    }
    if (mode == 0) {
        MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
            var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
            setTimeout(MainLoop.runner, timeUntilNextTick)
        };
        MainLoop.method = "timeout"
    } else if (mode == 1) {
        MainLoop.scheduler = function MainLoop_scheduler_rAF() {
            MainLoop.requestAnimationFrame(MainLoop.runner)
        };
        MainLoop.method = "rAF"
    } else if (mode == 2) {
        if (!MainLoop.setImmediate) {
            if (globalThis.setImmediate) {
                MainLoop.setImmediate = setImmediate
            } else {
                var setImmediates = [];
                var emscriptenMainLoopMessageId = "setimmediate";
                var MainLoop_setImmediate_messageHandler = event => {
                    if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                        event.stopPropagation();
                        setImmediates.shift()()
                    }
                };
                addEventListener("message", MainLoop_setImmediate_messageHandler, true);
                MainLoop.setImmediate = func => {
                    setImmediates.push(func);
                    if (ENVIRONMENT_IS_WORKER) {
                        Module["setImmediates"] ??= [];
                        Module["setImmediates"].push(func);
                        postMessage({
                            target: emscriptenMainLoopMessageId
                        })
                    } else postMessage(emscriptenMainLoopMessageId, "*")
                }
            }
        }
        MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
            MainLoop.setImmediate(MainLoop.runner)
        };
        MainLoop.method = "immediate"
    }
    return 0
};
var _emscripten_get_now = () => performance.now();
var runtimeKeepaliveCounter = 0;
var keepRuntimeAlive = () => true;  // Force runtime to always stay alive
var _proc_exit = code => {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
        Module["onExit"]?.(code);
        ABORT = false;
        quit_(code, new ExitStatus(code));
    } else {
        // Suppress exit, only log
        console.warn("[Runtime] _proc_exit ignored because keepRuntimeAlive is true");
    }
};
var exitJS = (status, implicit) => {
    EXITSTATUS = status;
    _proc_exit(status)
};
var _exit = exitJS;
var handleException = e => {
    if (e instanceof ExitStatus || e == "unwind") {
        return EXITSTATUS
    }
    if (!keepRuntimeAlive()) {
        quit_(1, e);
    } else {
        console.warn("[Runtime] Exception caught but keepRuntimeAlive is true; ignoring:", e);
    }
};
var maybeExit = () => {
    if (!keepRuntimeAlive()) {
        try {
            _exit(EXITSTATUS)
        } catch (e) {
            handleException(e)
        }
    }
};

// ── setMainLoop with FPS override ──
var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
    if (Module['desiredFPS'] != null) {
        if (Module['desiredFPS'] > 0) {
            fps = Module['desiredFPS'];
        } else if (Module['desiredFPS'] === 0) {
            fps = 0;
        }
    }

    MainLoop.func = iterFunc;
    MainLoop.arg = arg;
    var thisMainLoopId = MainLoop.currentlyRunningMainloop;

    function checkIsRunning() {
        if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
            maybeExit();
            return false
        }
        return true
    }
    MainLoop.running = false;
    MainLoop.runner = function MainLoop_runner() {
        if (ABORT) return;
        if (MainLoop.queue.length > 0) {
            var start = Date.now();
            var blocker = MainLoop.queue.shift();
            blocker.func(blocker.arg);
            if (MainLoop.remainingBlockers) {
                var remaining = MainLoop.remainingBlockers;
                var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
                if (blocker.counted) {
                    MainLoop.remainingBlockers = next
                } else {
                    next = next + .5;
                    MainLoop.remainingBlockers = (8 * remaining + next) / 9
                }
            }
            MainLoop.updateStatus();
            if (!checkIsRunning()) return;
            setTimeout(MainLoop.runner, 0);
            return
        }
        if (!checkIsRunning()) return;
        MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
        if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
            MainLoop.scheduler();
            return
        } else if (MainLoop.timingMode == 0) {
            MainLoop.tickStartTime = _emscripten_get_now()
        }
        MainLoop.runIter(iterFunc);
        if (!checkIsRunning()) return;
        MainLoop.scheduler()
    };
    if (!noSetTiming) {
        if (fps > 0) {
            _emscripten_set_main_loop_timing(0, 1e3 / fps)
        } else {
            _emscripten_set_main_loop_timing(1, 1)
        }
        MainLoop.scheduler()
    }
    if (simulateInfiniteLoop) {
        throw "unwind"
    }
};

var callUserCallback = func => {
    if (ABORT) {
        return
    }
    try {
        func();
        maybeExit()
    } catch (e) {
        handleException(e)
    }
};

// ── MainLoop – safe pause/resume ──
var MainLoop = {
    running: false,
    scheduler: null,
    method: "",
    currentlyRunningMainloop: 0,
    func: null,
    arg: 0,
    timingMode: 0,
    timingValue: 0,
    currentFrameNumber: 0,
    queue: [],
    preMainLoop: [],
    postMainLoop: [],

    _paused: false,

    pause() {
        this._paused = true;
    },
    resume() {
        if (!this._paused) return;
        this._paused = false;
    },

    updateStatus() {
        if (Module["setStatus"]) {
            var message = Module["statusMessage"] || "Please wait...";
            var remaining = MainLoop.remainingBlockers ?? 0;
            var expected = MainLoop.expectedBlockers ?? 0;
            if (remaining) {
                if (remaining < expected) {
                    Module["setStatus"](`${message} (${expected - remaining}/${expected})`)
                } else {
                    Module["setStatus"](message)
                }
            } else {
                Module["setStatus"]("")
            }
        }
    },
    init() {
        Module["preMainLoop"] && MainLoop.preMainLoop.push(Module["preMainLoop"]);
        Module["postMainLoop"] && MainLoop.postMainLoop.push(Module["postMainLoop"])
    },
    runIter(func) {
        if (ABORT || this._paused) return;
        for (var pre of MainLoop.preMainLoop) {
            if (pre() === false) {
                return
            }
        }
        callUserCallback(func);
        for (var post of MainLoop.postMainLoop) {
            post()
        }
    },
    nextRAF: 0,
    fakeRequestAnimationFrame(func) {
        var now = Date.now();
        if (MainLoop.nextRAF === 0) {
            MainLoop.nextRAF = now + 1e3 / 60
        } else {
            while (now + 2 >= MainLoop.nextRAF) {
                MainLoop.nextRAF += 1e3 / 60
            }
        }
        var delay = Math.max(MainLoop.nextRAF - now, 0);
        setTimeout(func, delay)
    },
    requestAnimationFrame(func) {
        if (globalThis.requestAnimationFrame) {
            requestAnimationFrame(func)
        } else {
            MainLoop.fakeRequestAnimationFrame(func)
        }
    }
};

var _emscripten_date_now = () => Date.now();
var nowIsMonotonic = 1;
var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

function _clock_time_get(clk_id, ignored_precision, ptime) {
    ignored_precision = bigintToI53Checked(ignored_precision);
    if (!checkWasiClock(clk_id)) {
        return 28
    }
    var now;
    if (clk_id === 0) {
        now = _emscripten_date_now()
    } else if (nowIsMonotonic) {
        now = _emscripten_get_now()
    } else {
        return 52
    }
    var nsec = Math.round(now * 1e3 * 1e3);
    HEAP64[ptime >> 3] = BigInt(nsec);
    return 0
}

function getFullscreenElement() {
    return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement
}
var safeSetTimeout = (func, timeout) => setTimeout(() => {
    callUserCallback(func)
}, timeout);
var warnOnce = text => {
    warnOnce.shown ||= {};
    if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
        err(text)
    }
};
var readEmAsmArgsArray = [];
var readEmAsmArgs = (sigPtr, buf) => {
    readEmAsmArgsArray.length = 0;
    var ch;
    while (ch = HEAPU8[sigPtr++]) {
        var wide = ch != 105;
        wide &= ch != 112;
        buf += wide && buf % 8 ? 4 : 0;
        readEmAsmArgsArray.push(ch == 112 ? HEAPU32[buf >> 2] : ch == 106 ? HEAP64[buf >> 3] : ch == 105 ? HEAP32[buf >> 2] : HEAPF64[buf >> 3]);
        buf += wide ? 8 : 4
    }
    return readEmAsmArgsArray
};
var runEmAsmFunction = (code, sigPtr, argbuf) => {
    var args = readEmAsmArgs(sigPtr, argbuf);
    return ASM_CONSTS[code](...args)
};
var _emscripten_asm_const_int = (code, sigPtr, argbuf) => runEmAsmFunction(code, sigPtr, argbuf);
var runMainThreadEmAsm = (emAsmAddr, sigPtr, argbuf, sync) => {
    var args = readEmAsmArgs(sigPtr, argbuf);
    return ASM_CONSTS[emAsmAddr](...args)
};
var _emscripten_asm_const_int_sync_on_main_thread = (emAsmAddr, sigPtr, argbuf) => runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
var _emscripten_asm_const_ptr_sync_on_main_thread = (emAsmAddr, sigPtr, argbuf) => runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
var _emscripten_err = str => err(UTF8ToString(str));
var _emscripten_set_window_title = title => document.title = UTF8ToString(title);
var _emscripten_sleep = () => {
    abort("Please compile your program with async support in order to use asynchronous operations like emscripten_sleep")
};
class HandleAllocator {
    allocated = [undefined];
    freelist = [];
    get(id) {
        return this.allocated[id]
    }
    has(id) {
        return this.allocated[id] !== undefined
    }
    allocate(handle) {
        var id = this.freelist.pop() || this.allocated.length;
        this.allocated[id] = handle;
        return id
    }
    free(id) {
        this.allocated[id] = undefined;
        this.freelist.push(id)
    }
}
var ENV = {};
var getExecutableName = () => thisProgram || "./this.program";
var getEnvStrings = () => {
    if (!getEnvStrings.strings) {
        var lang = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8";
        var env = {
            USER: "web_user",
            LOGNAME: "web_user",
            PATH: "/",
            PWD: "/",
            HOME: "/home/web_user",
            LANG: lang,
            _: getExecutableName()
        };
        for (var x in ENV) {
            if (ENV[x] === undefined) delete env[x];
            else env[x] = ENV[x]
        }
        var strings = [];
        for (var x in env) {
            strings.push(`${x}=${env[x]}`)
        }
        getEnvStrings.strings = strings
    }
    return getEnvStrings.strings
};
var _environ_get = (__environ, environ_buf) => {
    var bufSize = 0;
    var envp = 0;
    for (var string of getEnvStrings()) {
        var ptr = environ_buf + bufSize;
        HEAPU32[__environ + envp >> 2] = ptr;
        bufSize += stringToUTF8(string, ptr, Infinity) + 1;
        envp += 4
    }
    return 0
};
var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
    var strings = getEnvStrings();
    HEAPU32[penviron_count >> 2] = strings.length;
    var bufSize = 0;
    for (var string of strings) {
        bufSize += lengthBytesUTF8(string) + 1
    }
    HEAPU32[penviron_buf_size >> 2] = bufSize;
    return 0
};

function _fd_close(fd) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.close(stream);
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno
    }
}
var doReadv = (stream, iov, iovcnt, offset) => {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[iov >> 2];
        var len = HEAPU32[iov + 4 >> 2];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break;
        if (typeof offset != "undefined") {
            offset += curr
        }
    }
    return ret
};

function _fd_read(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doReadv(stream, iov, iovcnt);
        HEAPU32[pnum >> 2] = num;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno
    }
}

function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
    try {
        if (isNaN(offset)) return 61;
        var stream = SYSCALLS.getStreamFromFD(fd);
        FS.llseek(stream, offset, whence);
        HEAP64[newOffset >> 3] = BigInt(stream.position);
        if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno
    }
}
var doWritev = (stream, iov, iovcnt, offset) => {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[iov >> 2];
        var len = HEAPU32[iov + 4 >> 2];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) {
            break
        }
        if (typeof offset != "undefined") {
            offset += curr
        }
    }
    return ret
};

function _fd_write(fd, iov, iovcnt, pnum) {
    try {
        var stream = SYSCALLS.getStreamFromFD(fd);
        var num = doWritev(stream, iov, iovcnt);
        HEAPU32[pnum >> 2] = num;
        return 0
    } catch (e) {
        if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
        return e.errno
    }
}
var _glActiveTexture = (...args) => _emscripten_glActiveTexture(...args);
var _glAttachShader = (...args) => _emscripten_glAttachShader(...args);
var _glBindBuffer = (...args) => _emscripten_glBindBuffer(...args);
var _glBindBufferBase = (...args) => _emscripten_glBindBufferBase(...args);
var _glBindFramebuffer = (...args) => _emscripten_glBindFramebuffer(...args);
var _glBindRenderbuffer = (...args) => _emscripten_glBindRenderbuffer(...args);
var _glBindSampler = (...args) => _emscripten_glBindSampler(...args);
var _glBindTexture = (...args) => _emscripten_glBindTexture(...args);
var _glBindVertexArray = (...args) => _emscripten_glBindVertexArray(...args);
var _glBlendEquationSeparate = (...args) => _emscripten_glBlendEquationSeparate(...args);
var _glBlendFuncSeparate = (...args) => _emscripten_glBlendFuncSeparate(...args);
var _glBufferData = (...args) => _emscripten_glBufferData(...args);
var _glClear = (...args) => _emscripten_glClear(...args);
var _glClearColor = (...args) => _emscripten_glClearColor(...args);
var _glClearDepthf = (...args) => _emscripten_glClearDepthf(...args);
var _glClearStencil = (...args) => _emscripten_glClearStencil(...args);
var _glColorMask = (...args) => _emscripten_glColorMask(...args);
var _glCompileShader = (...args) => _emscripten_glCompileShader(...args);
var _glCopyTexSubImage2D = (...args) => _emscripten_glCopyTexSubImage2D(...args);
var _glCreateProgram = (...args) => _emscripten_glCreateProgram(...args);
var _glCreateShader = (...args) => _emscripten_glCreateShader(...args);
var _glCullFace = (...args) => _emscripten_glCullFace(...args);
var _glDeleteBuffers = (...args) => _emscripten_glDeleteBuffers(...args);
var _glDeleteFramebuffers = (...args) => _emscripten_glDeleteFramebuffers(...args);
var _glDeleteProgram = (...args) => _emscripten_glDeleteProgram(...args);
var _glDeleteRenderbuffers = (...args) => _emscripten_glDeleteRenderbuffers(...args);
var _glDeleteSamplers = (...args) => _emscripten_glDeleteSamplers(...args);
var _glDeleteShader = (...args) => _emscripten_glDeleteShader(...args);
var _glDeleteTextures = (...args) => _emscripten_glDeleteTextures(...args);
var _glDeleteVertexArrays = (...args) => _emscripten_glDeleteVertexArrays(...args);
var _glDepthFunc = (...args) => _emscripten_glDepthFunc(...args);
var _glDepthMask = (...args) => _emscripten_glDepthMask(...args);
var _glDepthRangef = (...args) => _emscripten_glDepthRangef(...args);
var _glDisable = (...args) => _emscripten_glDisable(...args);
var _glDisableVertexAttribArray = (...args) => _emscripten_glDisableVertexAttribArray(...args);
var _glDrawArraysInstanced = (...args) => _emscripten_glDrawArraysInstanced(...args);
var _glDrawBuffers = (...args) => _emscripten_glDrawBuffers(...args);
var _glDrawElementsInstanced = (...args) => _emscripten_glDrawElementsInstanced(...args);
var _glEnable = (...args) => _emscripten_glEnable(...args);
var _glEnableVertexAttribArray = (...args) => _emscripten_glEnableVertexAttribArray(...args);
var _glFramebufferRenderbuffer = (...args) => _emscripten_glFramebufferRenderbuffer(...args);
var _glFramebufferTexture2D = (...args) => _emscripten_glFramebufferTexture2D(...args);
var _glFrontFace = (...args) => _emscripten_glFrontFace(...args);
var _glGenBuffers = (...args) => _emscripten_glGenBuffers(...args);
var _glGenFramebuffers = (...args) => _emscripten_glGenFramebuffers(...args);
var _glGenRenderbuffers = (...args) => _emscripten_glGenRenderbuffers(...args);
var _glGenSamplers = (...args) => _emscripten_glGenSamplers(...args);
var _glGenTextures = (...args) => _emscripten_glGenTextures(...args);
var _glGenVertexArrays = (...args) => _emscripten_glGenVertexArrays(...args);
var _glGenerateMipmap = (...args) => _emscripten_glGenerateMipmap(...args);
var _glGetIntegerv = (...args) => _emscripten_glGetIntegerv(...args);
var _glGetProgramInfoLog = (...args) => _emscripten_glGetProgramInfoLog(...args);
var _glGetProgramiv = (...args) => _emscripten_glGetProgramiv(...args);
var _glGetShaderInfoLog = (...args) => _emscripten_glGetShaderInfoLog(...args);
var _glGetShaderiv = (...args) => _emscripten_glGetShaderiv(...args);
var _glGetStringi = (...args) => _emscripten_glGetStringi(...args);
var _glGetUniformBlockIndex = (...args) => _emscripten_glGetUniformBlockIndex(...args);
var _glGetUniformLocation = (...args) => _emscripten_glGetUniformLocation(...args);
var _glLinkProgram = (...args) => _emscripten_glLinkProgram(...args);
var _glPixelStorei = (...args) => _emscripten_glPixelStorei(...args);
var _glPolygonOffset = (...args) => _emscripten_glPolygonOffset(...args);
var _glReadPixels = (...args) => _emscripten_glReadPixels(...args);
var _glRenderbufferStorage = (...args) => _emscripten_glRenderbufferStorage(...args);
var _glSamplerParameterf = (...args) => _emscripten_glSamplerParameterf(...args);
var _glSamplerParameteri = (...args) => _emscripten_glSamplerParameteri(...args);
var _glScissor = (...args) => _emscripten_glScissor(...args);
var _glShaderSource = (...args) => _emscripten_glShaderSource(...args);
var _glStencilFunc = (...args) => _emscripten_glStencilFunc(...args);
var _glStencilMask = (...args) => _emscripten_glStencilMask(...args);
var _glStencilOp = (...args) => _emscripten_glStencilOp(...args);
var _glTexImage2D = (...args) => _emscripten_glTexImage2D(...args);
var _glTexParameteri = (...args) => _emscripten_glTexParameteri(...args);
var _glTexSubImage2D = (...args) => _emscripten_glTexSubImage2D(...args);
var _glUniform1i = (...args) => _emscripten_glUniform1i(...args);
var _glUniformBlockBinding = (...args) => _emscripten_glUniformBlockBinding(...args);
var _glUseProgram = (...args) => _emscripten_glUseProgram(...args);
var _glVertexAttribDivisor = (...args) => _emscripten_glVertexAttribDivisor(...args);
var _glVertexAttribPointer = (...args) => _emscripten_glVertexAttribPointer(...args);
var _glViewport = (...args) => _emscripten_glViewport(...args);
var _llvm_eh_typeid_for = type => type;
var dynCall = (sig, ptr, args = [], promising = false) => {
    var func = getWasmTableEntry(ptr);
    var rtn = func(...args);

    function convert(rtn) {
        return rtn
    }
    return convert(rtn)
};
var FS_createPath = (...args) => FS.createPath(...args);
var FS_unlink = (...args) => FS.unlink(...args);
var FS_createLazyFile = (...args) => FS.createLazyFile(...args);
var FS_createDevice = (...args) => FS.createDevice(...args);
var createContext;
var dependenciesInitted = false;
function initDependencies() {
    if (dependenciesInitted) return;
    dependenciesInitted = true;
    console.log("Initializing dependencies...");
    var fs_obj = typeof FS !== "undefined" ? FS : window.FS;
    if (fs_obj) {
        console.log("Initializing FS...");
        if (!fs_obj.nameTable) fs_obj.staticInit();
        if (!fs_obj.initialized) fs_obj.init();
    } else { console.error("FS NOT FOUND!"); }
    if (typeof FS !== "undefined") {
    }
    createContext = (...args) => Browser.createContext(...args);
Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;
Module["pauseMainLoop"] = MainLoop.pause;
Module["resumeMainLoop"] = MainLoop.resume;
MainLoop.init();
    window.initGLFrame = () => registerPreMainLoop(() => GL.newRenderingFrameStarted());
for (let i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));
var miniTempWebGLFloatBuffersStorage = new Float32Array(288);
for (var i = 0; i <= 288; ++i) {
    miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i)
}
var miniTempWebGLIntBuffersStorage = new Int32Array(288);
for (var i = 0; i <= 288; ++i) {
    miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i)
}
}
{
    if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
    if (Module["preloadPlugins"]) preloadPlugins = Module["preloadPlugins"];
    if (Module["print"]) out = Module["print"];
    if (Module["printErr"]) err = Module["printErr"];
    if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    if (Module["preInit"]) {
        if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
        while (Module["preInit"].length > 0) {
            Module["preInit"].shift()()
        }
    }
}
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["createContext"] = (...args) => createContext(...args);
Module["FS_preloadFile"] = (...args) => window.FS_preloadFile(...args);
Module["FS_unlink"] = FS_unlink;
Module["FS_createPath"] = FS_createPath;
Module["FS_createDevice"] = FS_createDevice;
Object.defineProperty(Module, "FS", { get: () => typeof FS !== "undefined" ? FS : window.FS });
Module["FS_createDataFile"] = (...args) => FS_createDataFile(...args);
Module["FS_createLazyFile"] = (...args) => FS_createLazyFile(...args);

var stackAlloc = (...args) => __emscripten_stack_alloc(...args);
var stringToUTF8OnStack = str => {
    var len = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(len);
    stringToUTF8(str, ret, len);
    return ret;
};

var getWasmTableEntry = funcPtr => wasmTable.get(funcPtr);
var _malloc, _free, _realloc, _main, _setThrew, __emscripten_tempret_set, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, ___cxa_decrement_exception_refcount, ___cxa_increment_exception_refcount, ___cxa_can_catch, ___cxa_get_exception_ptr, memory, __indirect_function_table, wasmMemory, wasmTable;

function assignWasmExports(wasmExports) {
    _malloc = wasmExports["zk"];
    _free = wasmExports["Ak"];
    _realloc = wasmExports["Bk"];
    _main = Module["_main"] = wasmExports["Ck"];
    _setThrew = wasmExports["Dk"];
    __emscripten_tempret_set = wasmExports["Ek"];
    __emscripten_stack_restore = wasmExports["Fk"];
    __emscripten_stack_alloc = wasmExports["Gk"];
    _emscripten_stack_get_current = wasmExports["Hk"];
    ___cxa_decrement_exception_refcount = wasmExports["Ik"];
    ___cxa_increment_exception_refcount = wasmExports["Jk"];
    ___cxa_can_catch = wasmExports["Kk"];
    ___cxa_get_exception_ptr = wasmExports["Lk"];
    memory = wasmMemory = wasmExports["wk"];
    __indirect_function_table = wasmTable = wasmExports["yk"]
}

// wasmImports and invoke functions are loaded from separate files:
// runtime_invoke_functions.js and runtime_wasm_imports.js

function callMain(args = []) {
    var entryFunction = _main;
    args.unshift(thisProgram);
    var argc = args.length;
    var argv = stackAlloc((argc + 1) * 4);
    var argv_ptr = argv;
    for (var arg of args) {
        HEAPU32[argv_ptr >> 2] = stringToUTF8OnStack(arg);
        argv_ptr += 4
    }
    HEAPU32[argv_ptr >> 2] = 0;
    try {
        var ret = entryFunction(argc, argv);
        exitJS(ret, true);
        return ret
    } catch (e) {
        return handleException(e)
    }
}

function run(args = arguments_) {
    if (runDependencies > 0) {
        dependenciesFulfilled = run;
        return
    }
    preRun();
    if (runDependencies > 0) {
        dependenciesFulfilled = run;
        return
    }

    function doRun() {
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        Module["onRuntimeInitialized"]?.();
        var noInitialRun = Module["noInitialRun"] || false;
        if (!noInitialRun) callMain(args);
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(() => {
            setTimeout(() => Module["setStatus"](""), 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}