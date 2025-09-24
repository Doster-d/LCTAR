import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import Landing from './Landing';


const container = document.getElementById('root');
// @ts-ignore
const root = createRoot(container);
root.render(<Landing />);
// root.render(<App />);