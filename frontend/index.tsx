import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './workflow.css';
import { LocaleProvider } from './i18n';
import { AuthProvider } from './hooks/useAuth';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LocaleProvider>
  </React.StrictMode>
);
