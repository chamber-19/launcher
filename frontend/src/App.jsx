import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ActivationGate from './ActivationGate';

export default function App() {
  const [activated, setActivated] = useState(null);
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');

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
  }, []);

  if (activated === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!activated) {
    return (
      <ActivationGate backendUrl={backendUrl}>
        <MainApp />
      </ActivationGate>
    );
  }

  return <MainApp />;
}

function MainApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>Shopvac v0.1.0</h1>
      <p>App launcher and activation shell for Chamber-19 tools</p>
      
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h2>Available Apps</h2>
        <ul>
          <li><a href="http://127.0.0.1:8000">Transmittal Builder</a></li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
        <p>Machine activated. Backend: {localStorage.getItem('activation_hardware')?.slice(0, 16)}...</p>
      </div>
    </div>
  );
}
