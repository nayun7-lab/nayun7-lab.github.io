// sw.js — Service Worker that injects COOP/COEP headers to enable
// SharedArrayBuffer / cross-origin isolation, which in turn unlocks
// multi-threaded sqlite-wasm + the synchronous OPFS VFS.
//
// Current state of this playground: ENGINE WORKS WITHOUT THIS WORKER.
// We use the async OPFS VFS (sqlite-wasm `vfs=opfs`), which does not require
// COOP/COEP. The performance gap is small for typical classroom queries.
//
// You only need to enable this Service Worker if you want to upgrade to the
// synchronous OPFS VFS (sqlite-wasm `opfs-sahpool`) or run multi-threaded
// WASM. To enable, uncomment the navigator.serviceWorker.register block at
// the bottom of `app/main.js`.
//
// Reference pattern: https://blog.tomayac.com/2025/03/08/setting-coop-coep-headers-on-static-hosting-like-github-pages/

const COOP = "same-origin";
const COEP = "require-corp";

self.addEventListener("install", () => {
    self.skipWaiting();
});
self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    // We only need to inject headers for same-origin top-level navigations
    // and same-origin resources. Cross-origin (CDN) responses are returned
    // unmodified (and we set them as cross-origin embedder allowed via the
    // require-corp flag below).
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

    event.respondWith(
        fetch(req).then((response) => {
            const headers = new Headers(response.headers);
            headers.set("Cross-Origin-Opener-Policy", COOP);
            headers.set("Cross-Origin-Embedder-Policy", COEP);
            // For cross-origin assets we serve, require explicit CORP.
            if (!headers.has("Cross-Origin-Resource-Policy")) {
                headers.set("Cross-Origin-Resource-Policy", "same-origin");
            }
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        }).catch((e) => {
            return new Response("Network fetch failed: " + (e && e.message),
                { status: 502, statusText: "Bad Gateway" });
        })
    );
});
