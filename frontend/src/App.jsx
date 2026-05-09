import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ActivationGate from './ActivationGate';
import {
  clearActivationState,
  isPinActivationEnforced,
  withActivationHeaders,
} from './activationAuth';

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

async function probeProtectedBackend(backendUrl) {
  const rootPath = 'C:\\';
  const probeUrl = `${backendUrl}/api/scan-projects?root=${encodeURIComponent(rootPath)}`;
  return fetch(probeUrl, withActivationHeaders({}, { requireToken: true }));
}

export default function App() {
  const [activated, setActivated] = useState(null);
  const [backendUrl] = useState(DEFAULT_BACKEND_URL);

  const handleUnauthorized = useCallback(() => {
    clearActivationState();
    setActivated(false);
  }, []);

  // Check activation status on mount
  useEffect(() => {
    async function checkActivation() {
      try {
        const token = localStorage.getItem('activation_token');
        const hardware = localStorage.getItem('activation_hardware');
        
        if (token && hardware) {
          // Validate token with backend
          const isValid = await invoke('validate_activation_token', {
            backendUrl,
            hardwareFingerprint: hardware,
            token: token,
          });
          setActivated(isValid);
        } else {
          setActivated(false);
        }
      } catch (err) {
        console.error('Activation check failed:', err);
        setActivated(false);
      }
    }
    checkActivation();
  }, [backendUrl]);

  if (activated === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!activated) {
    return <ActivationGate backendUrl={backendUrl} onActivated={() => setActivated(true)} />;
  }

  return <MainApp backendUrl={backendUrl} onUnauthorized={handleUnauthorized} />;
}

function MainApp({ backendUrl, onUnauthorized }) {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [startupError, setStartupError] = useState(null);
  const [accessMessage, setAccessMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startupProbe() {
      try {
        if (isPinActivationEnforced() && !localStorage.getItem('activation_token')) {
          setStartupError('missing-activation-token');
          setBackendStatus('failed');
          return;
        }

        const healthRes = await fetch(
          `${backendUrl}/api/health`,
          withActivationHeaders({}, { requireToken: false })
        );
        if (healthRes.status === 401) {
          onUnauthorized();
          return;
        }
        if (!healthRes.ok) {
          throw new Error(`Health check failed with status ${healthRes.status}`);
        }

        const protectedRes = await probeProtectedBackend(backendUrl);
        if (protectedRes.status === 401) {
          onUnauthorized();
          return;
        }

        // Some backends may return 400/404 for a synthetic probe path; that still
        // confirms token wiring and avoids blocking launcher startup.
        if (!protectedRes.ok && protectedRes.status !== 400 && protectedRes.status !== 404) {
          throw new Error(`Protected probe failed with status ${protectedRes.status}`);
        }

        if (!cancelled) {
          setStartupError(null);
          setBackendStatus('ready');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Activation token missing')) {
          onUnauthorized();
          return;
        }

        if (!cancelled) {
          setBackendStatus('failed');
        }
      }
    }

    startupProbe();
    return () => {
      cancelled = true;
    };
  }, [backendUrl, onUnauthorized]);

  async function handleProtectedAccessCheck() {
    setAccessMessage('Checking protected backend access...');
    try {
      const response = await probeProtectedBackend(backendUrl);

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok && response.status !== 400 && response.status !== 404) {
        throw new Error(`Protected call failed with status ${response.status}`);
      }

      setAccessMessage('Protected backend access is available.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Activation token missing')) {
        onUnauthorized();
        return;
      }
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
        {startupError === 'missing-activation-token' ? (
          <p>No activation token found while PIN activation is enforced. Please reactivate in launcher.</p>
        ) : (
          <p>Unable to verify backend startup. Please confirm the backend service is running.</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>Shopvac v0.1.0</h1>
      <p>App launcher and activation shell for Chamber-19 tools</p>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h2>Available Apps</h2>
        <ul>
          <li><a href={backendUrl}>Transmittal Builder</a></li>
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

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
        <p>Machine activated. Backend: {localStorage.getItem('activation_hardware')?.slice(0, 16)}...</p>
      </div>
    </div>
  );
}
