import ReactDOM from 'react-dom/client';
import App from '@ui/App';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { initFormatter } from '@ui/utils/formatter';
import { initializePlatform } from '@ui/platform';
import '@ui/index.css';

initFormatter().catch((error) => {
  console.error('[main] Failed to initialize formatter:', error);
});

initializePlatform()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  })
  .catch((error) => {
    console.error('[main] Failed to initialize platform:', error);
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
  });
