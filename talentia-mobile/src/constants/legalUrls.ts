/**
 * Legal document URLs for Privacy / Terms.
 * Prefer EXPO_PUBLIC_LEGAL_BASE_URL (e.g. https://api.talentia.app),
 * then EXPO_PUBLIC_BACKEND_URL, then the public marketing domain.
 */
export function getLegalBaseUrl(): string {
  const legal = process.env.EXPO_PUBLIC_LEGAL_BASE_URL?.trim();
  if (legal) return legal.replace(/\/$/, '');
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (backend) return backend.replace(/\/$/, '');
  return 'https://talentia.app';
}

export function getPrivacyPolicyUrl(): string {
  return `${getLegalBaseUrl()}/privacy`;
}

export function getTermsOfUseUrl(): string {
  return `${getLegalBaseUrl()}/terms`;
}
