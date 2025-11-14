import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';

const App = React.lazy(() =>
  import('./mainApp').catch(() =>
    Promise.resolve({
      default: () => (
        <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
          <h2>Missing App component</h2>
          <p>Create <code>src/mainApp.tsx</code> with <code>export default</code>.</p>
        </div>
      ),
    })
  )
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found: ensure public/index.html has <div id="root"></div>');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </React.StrictMode>
);