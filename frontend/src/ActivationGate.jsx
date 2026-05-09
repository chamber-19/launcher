import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function ActivationGate({ backendUrl, children }) {
  const [step, setStep] = useState('pin'); // 'pin' or 'success'
  const [pin, setPin] = useState('');
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  // Get hardware fingerprint on mount
  useEffect(() => {
    async function getHardware() {
      try {
        const fp = await invoke('get_hardware_fingerprint');
        setHardware(fp.hash);
        
        // Try to restore existing token from storage
        const savedToken = localStorage.getItem('activation_token');
        if (savedToken) {
          setToken(savedToken);
          setStep('success');
        }
      } catch (err) {
        console.error('Failed to get hardware fingerprint:', err);
        setError('Failed to initialize. Please restart the app.');
      }
    }
    getHardware();
  }, []);

  // Request PIN from server (office network only)
  async function handleRequestPin() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('request_activation_pin', {
        backendUrl: backendUrl || 'http://127.0.0.1:8000',
      });
      setPin('');
      setError(null);
      // Now wait for user to enter PIN
    } catch (err) {
      setError(err || 'Failed to request PIN. Are you on the office network?');
    }
    setLoading(false);
  }

  // Activate with PIN + hardware
  async function handleActivate() {
    if (!pin) {
      setError('Please enter the PIN');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activationToken = await invoke('activate_machine', {
        backendUrl: backendUrl || 'http://127.0.0.1:8000',
        pin: pin,
        hardwareFingerprint: hardware,
      });

      // Store token in browser storage
      localStorage.setItem('activation_token', activationToken);
      localStorage.setItem('activation_hardware', hardware);
      
      setToken(activationToken);
      setStep('success');
    } catch (err) {
      setError(err || 'Activation failed. Please try again.');
    }
    setLoading(false);
  }

  if (token) {
    return children;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '400px',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>Activate App</h1>
        <p style={{ margin: '0 0 30px 0', color: '#666', fontSize: '14px' }}>
          Enter the PIN displayed on your activation code
        </p>

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleActivate()}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
              marginBottom: '10px',
              letterSpacing: '2px',
              textAlign: 'center',
            }}
          />
          <button
            onClick={handleActivate}
            disabled={loading || !pin}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: loading || !pin ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !pin ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#ffe6e6',
              color: '#d32f2f',
              borderRadius: '4px',
              fontSize: '14px',
              marginBottom: '15px',
            }}
          >
            {error}
          </div>
        )}

        <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: '#999' }}>
          Must be on office network
        </p>
      </div>
    </div>
  );
}
