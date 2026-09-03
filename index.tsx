import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
