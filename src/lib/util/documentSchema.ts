export const DOCUMENT_FORMAT = 'text-chart-magic';
export const CURRENT_DOCUMENT_SCHEMA_VERSION = 1;

export const MAX_DOCUMENT_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_HISTORY_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_HISTORY_IMPORT_ENTRIES = 500;
export const MAX_REMOTE_RESPONSE_BYTES = 2 * 1024 * 1024;
export const MAX_SERIALIZED_STATE_CHARACTERS = 1_000_000;
export const MAX_STATE_JSON_BYTES = 4 * 1024 * 1024;
export const REMOTE_FETCH_TIMEOUT_MS = 15_000;

export const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;
