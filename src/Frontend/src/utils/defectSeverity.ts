/**
 * Shared defect-severity vocabulary and styling.
 *
 * Severity was previously inlined as a ternary at each render site, which drifted: the
 * inspector page used rose for High while the vendor page used red, and every site fell
 * back to the Low style for anything unrecognised — so "Critical" (documented on the
 * entity but never offered in the UI) would have rendered as the calmest chip on screen.
 * One list, one palette, one fallback that reads as unknown rather than harmless.
 */

/** The only values the API accepts, ordered least to most severe. */
export const DEFECT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export type DefectSeverity = typeof DEFECT_SEVERITIES[number];

const SEVERITY_STYLES: Record<DefectSeverity, string> = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-blue-100 text-blue-700',
};

/**
 * Chip classes for a severity. An unrecognised value renders slate rather than
 * borrowing Low's blue, so bad data looks wrong instead of looking benign.
 */
export const severityChipClass = (severity: string): string =>
  SEVERITY_STYLES[severity as DefectSeverity] ?? 'bg-slate-100 text-slate-600';
