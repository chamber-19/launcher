import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { withToolkitBearer } from '@chamber-19/desktop-toolkit/activation/bearer';

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

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>Launcher v0.1.0</h1>
      <p>Universal activation shell for Chamber 19 tools</p>

      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h2>Available Apps</h2>
        <ul>
          {Object.entries(AVAILABLE_APPS).map(([id, app]) => (
            <li key={id}>
              <a href={app.url}>{app.label}</a>
            </li>
          ))}
        </ul>
        <button
          onClick={handleProtectedAccessCheck}
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#1d5bd1',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Check protected backend access
        </button>
        {accessMessage && (
          <p style={{ marginTop: '10px', fontSize: '13px', color: '#444' }}>{accessMessage}</p>
        )}
      </div>
    </div>
  );
}