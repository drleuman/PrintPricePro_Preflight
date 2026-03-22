import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './workflow.css';
import { LocaleProvider } from './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
