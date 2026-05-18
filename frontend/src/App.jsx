import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { withToolkitBearer } from '@chamber-19/desktop-toolkit/activation/bearer';
import { DashboardOverview } from '@chamber-19/desktop-toolkit/dashboard';

// Foundry broker URL for the Ops tab. Override via VITE_FOUNDRY_BROKER_URL
// for non-default deployments.
const FOUNDRY_BROKER_URL =
  import.meta.env.VITE_FOUNDRY_BROKER_URL || 'http://127.0.0.1:57420';
const FOUNDRY_API_KEY = import.meta.env.VITE_FOUNDRY_API_KEY || '';

// ── Update gate ───────────────────────────────────────────────────────────────

function UpdateGate({ children }) {
  const [state, setState] = useState('checking'); // checking | current | update-available | applying | error
  const [updateInfo, setUpdateInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    invoke('check_launcher_update')
      .then((info) => {
        if (info.update_available) {
          setUpdateInfo(info);
          setState('update-available');
        } else {
          setState('current');
        }
      })
      .catch((err) => {
        // Network failure -- let the app open rather than blocking
        console.warn('Update check failed, continuing:', err);
        setState('current');
      });
  }, []);

  async function handleInstall() {
    setState('applying');
    try {
      await invoke('apply_launcher_update', { downloadUrl: updateInfo.download_url });
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  }

  if (state === 'checking') {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Checking for updates...</p>
      </div>
    );
  }

  if (state === 'update-available') {
    return (
      <div style={styles.updateScreen}>
        <h2 style={styles.heading}>Update available</h2>
        <p style={styles.meta}>
          v{updateInfo.current_version} -&gt; v{updateInfo.latest_version}
        </p>
        {updateInfo.notes && (
          <pre style={styles.notes}>{updateInfo.notes}</pre>
        )}
        <button style={styles.button} onClick={handleInstall}>
          Install and restart
        </button>
      </div>
    );
  }

  if (state === 'applying') {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Downloading update...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={styles.center}>
        <p style={{ color: '#B85C5C' }}>Update failed: {errorMsg}</p>
        <p style={styles.muted}>Close and reopen the app to try again.</p>
      </div>
    );
  }

  return children;
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center', height: '100vh',
    background: '#1C1B19', color: '#e8e4dc',
    fontFamily: 'DM Sans, system-ui, sans-serif',
  },
  updateScreen: {
    display: 'flex', flexDirection: 'column', gap: 16,
    justifyContent: 'center', alignItems: 'flex-start',
    height: '100vh', padding: '0 48px',
    background: '#1C1B19', color: '#e8e4dc',
    fontFamily: 'DM Sans, system-ui, sans-serif',
  },
  heading: { margin: 0, fontSize: 22, fontWeight: 600 },
  meta: { margin: 0, color: '#C4884D', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 },
  notes: {
    margin: 0, maxWidth: 520, maxHeight: 200, overflow: 'auto',
    fontSize: 12, color: '#a09a90', whiteSpace: 'pre-wrap',
    background: '#151412', padding: 12, borderRadius: 4,
  },
  button: {
    padding: '10px 20px', border: 'none', borderRadius: 4,
    background: '#C4884D', color: '#1C1B19',
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  muted: { color: '#6b645c', margin: 0 },
};

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

// Available apps with their backend URLs
const AVAILABLE_APPS = {
  'batch-fnr': {
    label: 'Batch Find & Replace',
    url: import.meta.env.VITE_BATCH_FNR_URL || 'http://127.0.0.1:8000',
    probeEndpoint: '/api/scan-folder',
  },
  'drawing-list-manager': {
    label: 'Drawing List Manager',
    url: import.meta.env.VITE_DRAWING_LIST_MANAGER_URL || 'http://127.0.0.1:8002',
    probeEndpoint: '/api/project/recent',
  },
  'transmittal-builder': {
    label: 'Transmittal Builder',
    url: import.meta.env.VITE_TRANSMITTAL_BUILDER_URL || import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8001',
    probeEndpoint: '/api/scan-projects',
  },
};

async function probeProtectedBackend(backendUrl, probeEndpoint = '/api/scan-projects') {
  const rootPath = 'C:\\';
  const probeUrl = probeEndpoint.includes('?')
    ? `${backendUrl}${probeEndpoint}`
    : `${backendUrl}${probeEndpoint}?root=${encodeURIComponent(rootPath)}`;
  return fetch(probeUrl, await withToolkitBearer({}));
}

export default function App() {
  return (
    <UpdateGate>
      <MainApp backendUrl={DEFAULT_BACKEND_URL} />
    </UpdateGate>
  );
}

function MainApp({ backendUrl }) {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [startupError, setStartupError] = useState(null);
  const [accessMessage, setAccessMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startupProbe() {
      try {
        // Health endpoint -- doesn't require auth.
        const healthRes = await fetch(`${backendUrl}/api/health`);
        if (!healthRes.ok) {
          throw new Error(`Health check failed with status ${healthRes.status}`);
        }

        // Protected probe -- attaches a fresh toolkit bearer.
        const protectedRes = await probeProtectedBackend(backendUrl);

        // Some backends may return 400/404 for a synthetic probe path; that
        // still confirms token wiring and avoids blocking launcher startup.
        if (!protectedRes.ok && protectedRes.status !== 400 && protectedRes.status !== 404) {
          throw new Error(`Protected probe failed with status ${protectedRes.status}`);
        }

        if (!cancelled) {
          setStartupError(null);
          setBackendStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : String(error));
          setBackendStatus('failed');
        }
      }
    }

    startupProbe();
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  async function handleProtectedAccessCheck() {
    setAccessMessage('Checking protected backend access...');
    try {
      const response = await probeProtectedBackend(backendUrl);

      if (!response.ok && response.status !== 400 && response.status !== 404) {
        throw new Error(`Protected call failed with status ${response.status}`);
      }

      setAccessMessage('Protected backend access is available.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAccessMessage(`Protected backend call failed: ${message}`);
    }
  }

  if (backendStatus === 'checking') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Checking backend status...
      </div>
    );
  }

  if (backendStatus === 'failed') {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <h1>Launcher startup failed</h1>
        <p>{startupError || 'Unable to verify backend startup. Please confirm the backend service is running.'}</p>
      </div>
    );
  }

  return <MainAppShell accessMessage={accessMessage} handleProtectedAccessCheck={handleProtectedAccessCheck} />;
}

function MainAppShell({ accessMessage, handleProtectedAccessCheck }) {
  const [activeTab, setActiveTab] = useState('apps');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#09090b', color: '#fafafa' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: '1px solid #27272a' }}>
        <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>Chamber 19 Launcher</strong>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <TabButton active={activeTab === 'apps'} onClick={() => setActiveTab('apps')}>Apps</TabButton>
          <TabButton active={activeTab === 'ops'} onClick={() => setActiveTab('ops')}>Ops</TabButton>
        </nav>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'apps' ? (
          <div style={{ padding: 24, maxWidth: 720 }}>
            <p style={{ color: '#a1a1aa', marginBottom: 16 }}>Universal activation shell for Chamber 19 tools.</p>
            <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', margin: '0 0 10px' }}>Available apps</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(AVAILABLE_APPS).map(([id, app]) => (
                <li key={id} style={{ padding: '10px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
                  <a href={app.url} style={{ color: '#fafafa', textDecoration: 'none', fontWeight: 500 }}>{app.label}</a>
                </li>
              ))}
            </ul>
            <button
              onClick={handleProtectedAccessCheck}
              style={{
                marginTop: 16,
                padding: '8px 14px',
                border: '1px solid #27272a',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Check protected backend access
            </button>
            {accessMessage && (
              <p style={{ marginTop: 10, fontSize: 12, color: '#a1a1aa' }}>{accessMessage}</p>
            )}
          </div>
        ) : (
          <DashboardOverview
            brokerUrl={FOUNDRY_BROKER_URL}
            apiKey={FOUNDRY_API_KEY || undefined}
          />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: 'none',
        background: active ? '#27272a' : 'transparent',
        color: active ? '#fafafa' : '#a1a1aa',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
      }}
    >
      {children}
    </button>
  );
}