const ACTIVATION_TOKEN_KEYS = ['activation_token', 'tb_activation_token'];
const ACTIVATION_HARDWARE_KEYS = ['activation_hardware', 'tb_activation_hardware'];

export function isPinActivationEnforced() {
  return (
    typeof __ENFORCE_PIN_ACTIVATION__ !== 'undefined' &&
    __ENFORCE_PIN_ACTIVATION__
  );
}

export function getActivationToken() {
  try {
    for (const key of ACTIVATION_TOKEN_KEYS) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
  } catch {
    return null;
  }
  return null;
}

export function withActivationHeaders(init = {}, options = {}) {
  const { requireToken = false } = options;
  const headers = new Headers(init.headers || {});
  const token = getActivationToken();

  if (!token && requireToken && isPinActivationEnforced()) {
    throw new Error('Activation token missing. Please reactivate from launcher.');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    ...init,
    headers,
  };
}

export function clearActivationState() {
  for (const key of ACTIVATION_TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
  for (const key of ACTIVATION_HARDWARE_KEYS) {
    localStorage.removeItem(key);
  }
}
