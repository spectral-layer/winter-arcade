import { Buffer } from "buffer";

// serve per librerie che si aspettano Buffer globale (alcuni adapter / deps)
globalThis.Buffer = Buffer;

// opzionale ma spesso utile per dipendenze che controllano process.env
globalThis.process = globalThis.process || { env: {} };
