import React, { Suspense } from 'react';

const LazyApp = React.lazy(() =>
  import('./mainApp').catch(() =>
    Promise.resolve({
      default: () => (
        <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
          <h2>Missing App component</h2>
          <p>Create <code>src/mainApp.tsx</code> or adjust imports.</p>
        </div>
      ),
    })
  )
);

export default function AppWrapper() {
  return (
    <Suspense fallback={null}>
      <LazyApp />
    </Suspense>
  );
}

