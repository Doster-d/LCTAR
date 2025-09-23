import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import WavyGridPage from './WavyGridPage';


const container = document.getElementById('root');
// @ts-ignore
const root = createRoot(container);
root.render(<WavyGridPage />);
// root.render(<App />);