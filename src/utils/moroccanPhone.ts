/**
 * Moroccan mobile numbers are normalized to E.164 before they reach Auth.
 * ANRT's national plan uses a 10-digit domestic number and mobile prefixes
 * 06/07 (the app intentionally rejects fixed-line and service numbers).
 */
export type MoroccanPhoneError = 'empty' | 'invalid';

export function normalizeMoroccanMobile(input: string): string {
  const value = input.trim();
  if (!value) throw new Error('Saisissez votre numéro de téléphone mobile.');

  // Permit common visual separators only; reject letters and other symbols.
  if (!/^\+?[\d\s().-]+$/.test(value)) {
    throw new Error('Vérifiez le format du numéro de téléphone mobile.');
  }
  let digits = value.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (digits.startsWith('00212')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `212${digits.slice(1)}`;
  if (!/^212[67]\d{8}$/.test(digits)) {
    throw new Error('Entrez un numéro mobile marocain valide commençant par 06 ou 07.');
  }
  return `+${digits}`;
}

export function isValidOptionalEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function maskMoroccanPhone(phone: string): string {
  const normalized = normalizeMoroccanMobile(phone);
  return `${normalized.slice(0, 5)} •• •• ${normalized.slice(-2)}`;
}
