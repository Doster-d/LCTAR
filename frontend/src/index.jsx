import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Landing from './Landing';


console.log('[DEBUG] index.jsx: Starting app');
const container = document.getElementById('root');
console.log('[DEBUG] index.jsx: Container found:', container);
if (!container) {
  console.error('[DEBUG] index.jsx: No root container found!');
}
// @ts-ignore
const root = createRoot(container);
console.log('[DEBUG] index.jsx: Root created, rendering App');
root.render(<App />);
console.log('[DEBUG] index.jsx: App rendered');
root.render(<Landing />);
// root.render(<App />);
