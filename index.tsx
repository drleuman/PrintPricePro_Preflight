// index.tsx (raíz del proyecto)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './workflow.css';

// Auto-recovery for PDF.js worker cache issues
window.addEventListener('error', (e: any) => {
  const msg = String(e?.message || '');
  if (msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('pdf.worker')) {
    console.warn('Cache issue detected, reloading page...');
    window.location.reload();
  }
});

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('No root element found for React app');
}
