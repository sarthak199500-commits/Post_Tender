/**
 * Shared currency formatting utilities for the Post-Tender Management System.
 * All monetary values use Indian Rupee (₹) with Indian numbering system.
 */

/** Format a number in Indian comma style: 1,23,45,678 */
export const formatINR = (value: number): string =>
  value.toLocaleString('en-IN');

/** Format with ₹ prefix: ₹1,23,45,678 */
export const rupees = (value: number): string =>
  `₹${formatINR(value)}`;

/** Compact format: ₹2.50 Cr or ₹12.50 L (for KPI cards / charts) */
export const rupeesCompact = (value: number): string => {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000)   return `₹${(value / 100_000).toFixed(2)} L`;
  if (value >= 1_000)     return `₹${(value / 1_000).toFixed(1)} K`;
  return rupees(value);
};

/** Compact hint: "≈ ₹34.44 Cr" or "≈ ₹5.00 L" */
export const rupeesWithHint = (value: number): string =>
  `≈ ${rupeesCompact(value)}`;

/**
 * Groups a raw digit string the Indian way: last three digits, then pairs.
 * 12000000 -> 1,20,00,000
 *
 * String-based rather than toLocaleString because this runs on partially typed
 * input: "12." and "" are valid intermediate states that Number() would mangle
 * into "NaN" or "0" while the user is still typing.
 */
export const groupIndianDigits = (raw: string): string => {
  const [intPart = '', ...decParts] = raw.split('.');
  const digits = intPart.replace(/\D/g, '');

  let grouped = digits;
  if (digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }

  // A trailing "." must survive so the user can carry on typing the paise.
  return decParts.length > 0 ? `${grouped}.${decParts.join('').replace(/\D/g, '')}` : grouped;
};

/**
 * Strips grouping back to a plain numeric string suitable for an API payload.
 * Keeps at most one decimal point and drops everything else.
 */
export const stripGrouping = (display: string): string => {
  const cleaned = display.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

