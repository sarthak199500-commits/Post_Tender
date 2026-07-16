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

