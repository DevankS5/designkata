import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main>
      <h1>DesignKata</h1>
      <p>LLD practice with feedback you can check.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
