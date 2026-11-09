import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DeviceTierProvider } from './platform/DeviceTierContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeviceTierProvider>
      <App />
    </DeviceTierProvider>
  </StrictMode>,
);
