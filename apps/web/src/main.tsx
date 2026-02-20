import ReactDOM from 'react-dom/client';
import App from '@ui/App';
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { initFormatter } from '@ui/utils/formatter';
import { initializePlatform } from '@ui/platform';
import '@ui/index.css';

declare global {
  interface Window {
    __UNSUPPORTED_BROWSER?: boolean;
  }
}

if (window.__UNSUPPORTED_BROWSER) {
  // eslint-disable-next-line no-console
  console.warn('[main] Browser unsupported — skipping app render');
} else {
  initFormatter().catch((error) => {
    console.error('[main] Failed to initialize formatter:', error);
  });

  const root = ReactDOM.createRoot(document.getElementById('root')!);

  const renderApp = () =>
    root.render(
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    );

  initializePlatform()
    .then(renderApp)
    .catch((error) => {
      console.error('[main] Failed to initialize platform:', error);
      renderApp();
    });
}
