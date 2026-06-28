(() => {
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != "undefined" && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != "undefined" && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker) return;
    var isNode = globalThis.process && globalThis.process.versions && globalThis.process.versions.node && globalThis.process.type != "renderer";

    async function loadPackage(metadata) {
        var PACKAGE_PATH = "";
        if (typeof window === "object") {
            PACKAGE_PATH = window["encodeURIComponent"](window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/")
        } else if (typeof process === "undefined" && typeof location !== "undefined") {
            PACKAGE_PATH = encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf("/")) + "/")
        }
        var PACKAGE_NAME = "/home/caiiiycuk/vc/vc-sky/index.data";
        var REMOTE_PACKAGE_BASE = "index.data";
        var REMOTE_PACKAGE_NAME = Module["locateFile"] ? Module["locateFile"](REMOTE_PACKAGE_BASE, "") : REMOTE_PACKAGE_BASE;
        var REMOTE_PACKAGE_SIZE = metadata["remote_package_size"];

        async function fetchRemotePackage(packageName, packageSize) {
            if (isNode) {
                var contents = require("fs").readFileSync(packageName);
                return new Uint8Array(contents).buffer
            }
            if (!Module["dataFileDownloads"]) Module["dataFileDownloads"] = {};
            try {
                var response = await fetch(packageName)
            } catch (e) {
                throw new Error(`Network Error: ${packageName}`, { e })
            }
            if (!response.ok) {
                throw new Error(`${response.status}: ${response.url}`)
            }
            const chunks = [];
            const headers = response.headers;
            const total = Number(headers.get("Content-Length") || packageSize);
            let loaded = 0;
            Module["setStatus"] && Module["setStatus"]("Downloading data...");
            const reader = response.body.getReader();
            while (1) {
                var { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                Module["dataFileDownloads"][packageName] = { loaded, total };
                let totalLoaded = 0;
                let totalSize = 0;
                for (const download of Object.values(Module["dataFileDownloads"])) {
                    totalLoaded += download.loaded;
                    totalSize += download.total
                }
                Module["setStatus"] && Module["setStatus"](`Downloading data... (${totalLoaded}/${totalSize})`)
            }
            const packageData = new Uint8Array(chunks.map(c => c.length).reduce((a, b) => a + b, 0));
            let offset = 0;
            for (const chunk of chunks) {
                packageData.set(chunk, offset);
                offset += chunk.length
            }
            return packageData.buffer
        }

        var fetchPromise;
        var fetched = Module["getPreloadedPackage"] && Module["getPreloadedPackage"](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);
        if (!fetched) {
            fetchPromise = fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE)
        }

        async function runWithFS(Module) {
            function assert(check, msg) {
                if (!check) throw new Error(msg)
            }

            const lowMemory = window.__lowMemoryMode === true;
            const audioPrefixes = ['/vc-assets/local/audio/', '/vc-assets/local/mp3/', '/vc-assets/local/mss/'];
            const isAudio = (path) => audioPrefixes.some(p => path.startsWith(p));

            const allFiles = metadata["files"];
            const dirs = new Set();
            for (const file of allFiles) {
                const path = file["filename"];
                const dir = path.substring(0, path.lastIndexOf('/'));
                if (dir) dirs.add(dir);
            }
            for (const dir of dirs) {
                Module["FS_createPath"]("/", dir, true, true);
            }

            let packageData = null;

            function createLazyFile(filename, start, end) {
                const path = filename;
                const parent = path.substring(0, path.lastIndexOf('/'));
                const name = path.substring(path.lastIndexOf('/') + 1);
                const view = new Uint8Array(packageData.buffer, start, end - start);
                Module["FS_createDataFile"](parent, name, view, true, true, true);
            }

            async function processPackageData(arrayBuffer) {
                assert(arrayBuffer, "Loading data file failed.");
                assert(arrayBuffer.constructor.name === ArrayBuffer.name, "bad input to processPackageData " + arrayBuffer.constructor.name);
                packageData = new Uint8Array(arrayBuffer);

                for (var file of allFiles) {
                    var name = file["filename"];
                    if (lowMemory && isAudio(name)) {
                        continue;
                    }
                    createLazyFile(name, file["start"], file["end"]);
                    Module["removeRunDependency"](`fp ${name}`)
                }
                Module["removeRunDependency"]("datafile_/home/caiiiycuk/vc/vc-sky/index.data")
            }

            for (var file of allFiles) {
                var name = file["filename"];
                if (lowMemory && isAudio(name)) continue;
                Module["addRunDependency"](`fp ${name}`)
            }
            Module["addRunDependency"]("datafile_/home/caiiiycuk/vc/vc-sky/index.data");
            if (!Module["preloadResults"]) Module["preloadResults"] = {};
            Module["preloadResults"][PACKAGE_NAME] = { fromCache: false };
            if (!fetched) {
                fetched = await fetchPromise
            }
            processPackageData(fetched)
        }

        if (Module["calledRun"]) {
            runWithFS(Module)
        } else {
            if (!Module["preRun"]) Module["preRun"] = [];
            Module["preRun"].push(runWithFS)
        }
    }
    loadPackage(DATA_PACKAGE)
})();