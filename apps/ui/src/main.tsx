import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { initFormatter } from './utils/formatter';
import { initializePlatform } from './platform';
import './index.css';

// Initialize tree-sitter WASM as early as possible
initFormatter().catch((error) => {
  console.error('[main] Failed to initialize formatter:', error);
});

// Initialize platform bridge (Tauri or Web) before rendering
initializePlatform()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  })
  .catch((error) => {
    console.error('[main] Failed to initialize platform:', error);
    // Render anyway — components may degrade gracefully
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  });
