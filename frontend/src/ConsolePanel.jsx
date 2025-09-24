/* @refresh reset */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { subscribe, getBuffer, clearLogs } from './consoleCapture';

const levelColor = (level) => ({
  log: '#ddd',
  info: '#8ecaff',
  warn: '#ffca3a',
  error: '#ff595e'
}[level] || '#fff');

export default function ConsolePanel() {
  const [logs, setLogs] = useState(getBuffer());
  const [autoScroll, setAutoScroll] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const unsub = subscribe(() => {
      setLogs(getBuffer());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleClear = useCallback(() => {
    clearLogs();
    setLogs([]);
  }, []);

  return (
    <div className="console-panel" style={{ transform: collapsed ? 'translateY(calc(-100% + 24px))' : 'translateY(0)' }}>
      <div className="console-panel__header">
        <span>Logs ({logs.length})</span>
        <div className="console-panel__actions">
          <label style={{ marginRight: 8 }}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /> Auto
          </label>
          <button onClick={() => setCollapsed(c => !c)}>{collapsed ? '▼' : '▲'}</button>
          <button onClick={handleClear}>Clear</button>
        </div>
      </div>
      <div className="console-panel__body">
        {logs.filter(l => l.level === 'warn' || l.level === 'error').map(l => (
          <div key={l.id} className={`console-line level-${l.level}`}>
            <span className="time">{new Date(l.time).toLocaleTimeString()}</span>
            <span className="tag" style={{ background: levelColor(l.level) }}>{l.level}</span>
            {l.args.map((a,i) => <span key={i} className="arg">{formatArg(a)}</span>)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function formatArg(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'object') {
    try { return JSON.stringify(a); } catch { return '[object]'; }
  }
  return String(a);
}
