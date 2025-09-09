export const SMART_CONFIG = {
  // Hinweis: Dies ist ein Public-Client (PKCE). In produktiven Umgebungen
  // muss die client_id beim SMART-/FHIR-Server registriert sein.
  clientId: 'lhc-forms-demo-public',
  // Redirect zurück auf dieselbe Seite (index.html)
  get redirectUri() { return window.location.origin + window.location.pathname; },
  // Sinnvolle Default-Scopes für Lesen + Kontext + Refresh
  defaultScopes: 'launch/patient openid profile fhirUser patient/*.read offline_access',
};

