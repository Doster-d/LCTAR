// Simple console capture utility: overrides console methods and notifies listeners.
// Keeps a ring buffer to avoid unbounded memory growth.

const LEVELS = ["warn", "error"];
const MAX_ENTRIES = 1000;

let buffer = [];
let listeners = new Set();

function notify(entry) {
  for (const cb of listeners) {
    try { cb(entry, buffer); } catch (e) { /* ignore listener errors */ }
  }
}

export function getBuffer() { return buffer.slice(); }
export function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }

LEVELS.forEach(level => {
  const original = console[level];
  console[level] = function patchedConsole(...args) {
    const entry = { id: Date.now() + Math.random(), level, args, time: new Date().toISOString() };
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) buffer = buffer.slice(buffer.length - MAX_ENTRIES);
    notify(entry);
    original.apply(console, args);
  };
});

export function clearLogs() { buffer = []; notify({ system: true, clear: true }); }
