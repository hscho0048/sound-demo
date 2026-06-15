const STORAGE_KEY = 'soundcare.sensitiveApplianceState';

function readState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures; the UI can still reflect the current click.
  }
}

export function getSensitiveApplianceEnabled(deviceId) {
  if (!deviceId) return false;
  return readState()[deviceId] === true;
}

export function setSensitiveApplianceEnabled(deviceId, enabled) {
  if (!deviceId) return;
  const state = readState();
  state[deviceId] = Boolean(enabled);
  writeState(state);
}
