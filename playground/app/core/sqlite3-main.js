// sqlite3-main.js — Lazy main-thread sqlite3 instance for the DB importer.
//
// The playground engine runs in a Worker, which has no way to open an
// uploaded .sqlite file directly. Instead the importer opens the bytes in a
// temporary MAIN-THREAD sqlite3 instance (via sqlite3_deserialize), converts
// the contents to a SQL dump, and replays that dump on the real engine.
// The instance is created on first use and cached.

import sqlite3InitModule from "../../vendor/sqlite-wasm/index.mjs";

let _sqlite3P = null;

export function getMainSqlite3() {
    if (!_sqlite3P) {
        _sqlite3P = sqlite3InitModule({
            print: () => {},
            printErr: (...a) => console.warn("[sqlite3-import]", ...a),
        });
    }
    return _sqlite3P;
}
