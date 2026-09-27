import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, NavLink, Outlet, createBrowserRouter, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { HealthDto } from '../../shared/types.ts';
import { api } from './api.ts';
import { FeedbackPage } from './pages/FeedbackPage.tsx';
import { ProblemsPage } from './pages/ProblemsPage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { WorkspacePage } from './pages/WorkspacePage.tsx';
import './styles.css';

function Layout() {
  const [health, setHealth] = useState<HealthDto | null>(null);
  useEffect(() => {
    api.health().then(setHealth, () => setHealth(null));
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          DesignKata
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Problems
          </NavLink>
          <NavLink to="/progress">Progress</NavLink>
        </nav>
        {health && (
          <span className={`ai-pill ${health.ai.enabled ? '' : 'off'}`} title={health.database}>
            <span className="dot" aria-hidden="true" />
            {health.ai.enabled ? `AI review on: ${health.ai.model}` : 'Rules only: AI review not configured'}
          </span>
        )}
      </header>
      <Outlet />
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  return (
    <div className="shell">
      <div className="error-box" style={{ marginTop: 48 }}>
        <p>{error instanceof Error ? error.message : 'This page does not exist.'}</p>
        <Link to="/">Back to the problems</Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <ProblemsPage /> },
      { path: '/attempts/:attemptId', element: <WorkspacePage /> },
      { path: '/submissions/:submissionId', element: <FeedbackPage /> },
      { path: '/progress', element: <ProgressPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
