// index.tsx (raíz del proyecto)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './workflow.css';

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
