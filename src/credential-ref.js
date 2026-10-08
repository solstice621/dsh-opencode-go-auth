/**
 * The credential-reference grammar the Harness credential store accepts: a
 * POSIX shell identifier, branded by the credentials package but a plain string
 * at runtime. Kept local so this plugin loads without importing that package.
 */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isCredentialRefName(value) {
  return typeof value === 'string' && REF_PATTERN.test(value);
}

export function credentialRef(value) {
  if (!isCredentialRefName(value)) throw new TypeError(`credential ref "${value}" must match ${String(REF_PATTERN)}`);
  return value;
}
