let _FHIR = null;
async function getFHIR() {
  if (_FHIR) return _FHIR;
  try {
    const mod = await import('fhirclient');
    _FHIR = mod?.default || mod;
    return _FHIR;
  } catch (e) {
    throw new Error('fhirclient ist nicht installiert. Bitte "npm i fhirclient" ausführen.');
  }
}

export function detectSmartParams() {
  const sp = new URLSearchParams(window.location.search);
  return {
    iss: sp.get('iss') || null,
    launch: sp.get('launch') || null,
    hasAuthCode: !!(sp.get('code') || sp.get('state')),
  };
}

// Returns a client if we are on the redirect/callback or an already-established session
export async function ensureReady() {
  try {
    const FHIR = await getFHIR();
    const client = await FHIR.oauth2.ready();
    return client;
  } catch (e) {
    return null;
  }
}

export async function authorize({ iss, launch, clientId, redirectUri, scope }) {
  if (!iss) throw new Error('SMART/FHIR Base (iss) fehlt');
  const FHIR = await getFHIR();
  return FHIR.oauth2.authorize({ iss, launch, clientId, redirectUri, scope, pkce: true });
}

export async function getContext(client) {
  const [patientId, encounterId, fhirUser] = await Promise.all([
    client.getPatientId().catch(() => null),
    client.getEncounterId().catch(() => null),
    client.getFhirUser().catch(() => null),
  ]);
  return { patientId, encounterId, fhirUser };
}

export function makeLFormsClient(client, ids = {}) {
  const doReq = async (arg) => {
    if (typeof arg === 'string') return client.request(arg, { flat: true });
    if (arg && typeof arg === 'object') {
      const { url, method, headers, body } = arg;
      return client.request({ url, method, headers, body }, { flat: true });
    }
    throw new Error('Ungültiges Request-Argument');
  };
  const readStub = (type, id) => ({
    id,
    read: () => (id ? doReq(`${type}/${encodeURIComponent(id)}`) : Promise.resolve(null)),
    request: doReq,
  });
  const getFhirVersion = async () => {
    try {
      const meta = await doReq('metadata');
      return meta?.fhirVersion || '4.0.1';
    } catch { return '4.0.1'; }
  };
  return {
    request: doReq,
    getFhirVersion,
    patient: readStub('Patient', ids.patient),
    encounter: readStub('Encounter', ids.encounter),
    user: readStub('Practitioner', ids.user),
  };
}

export function getSmartBase(client) {
  try { return client?.state?.serverUrl || null; } catch { return null; }
}

export function scheduleRefresh(client, onRefreshed = () => {}) {
  try {
    const state = client.state || {};
    const tr = state.tokenResponse || {};
    const hasRefresh = !!tr.refresh_token;
    const expiresIn = Number(tr.expires_in || 0);
    if (!hasRefresh || !expiresIn) return null;
    const createdAt = Number(state.createdAt || Date.now() / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    const expiry = createdAt + expiresIn;
    const delayMs = Math.max(5, (expiry - nowSec - 60)) * 1000; // 60s vorher
    const timer = setTimeout(async () => {
      try { await client.refresh(); onRefreshed(); scheduleRefresh(client, onRefreshed); }
      catch (e) { console.warn('SMART Refresh fehlgeschlagen', e); }
    }, delayMs);
    return timer;
  } catch (e) { console.warn('scheduleRefresh error', e); return null; }
}

export function signOut() {
  try {
    // Entferne nur SMART-/fhirclient-bezogene Keys in sessionStorage
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
    keys.forEach(k => { if (/smart|fhirclient/i.test(String(k))) sessionStorage.removeItem(k); });
  } catch {}
  // Query-Parameter entfernen (iss/launch/code/state) und Seite neuladen
  const url = new URL(window.location.href);
  ['iss','launch','code','state','scope','aud'].forEach(p => url.searchParams.delete(p));
  window.location.assign(url.toString());
}
