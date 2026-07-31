/**
 * Shared status vocabulary and styling.
 *
 * Six pages each kept their own private status->classes map, and they disagreed:
 * "Submitted" was blue on the billing page, indigo on the project page and a CSS
 * `b-ip` chip on the department dashboard; "Inspection Requested" was amber in one
 * place and blue in another; "Returned" was red here and orange there; "Under
 * Review" was purple on one screen and amber on the next. The same word rendered
 * a different colour depending on which screen you were standing on, which made
 * the colour meaningless as a signal.
 *
 * This is the same fix `defectSeverity.ts` applied to severity: one list, one
 * palette, one fallback that reads as unknown rather than as harmless.
 */

/**
 * The tones a status can carry. Deliberately about *meaning*, not hue — the hue
 * is an implementation detail below, and changing it should not require
 * revisiting every status.
 */
export type StatusTone =
  | 'neutral'    // not started / archived — nothing to act on
  | 'info'       // in flight, moving through the workflow normally
  | 'attention'  // waiting on somebody to act
  | 'success'    // terminal-good
  | 'returned'   // sent back for rework — not a failure, but not progress
  | 'danger';    // terminal-bad

const TONE_STYLES: Record<StatusTone, { solid: string; soft: string }> = {
  neutral:   { solid: 'bg-slate-100 text-slate-600',   soft: 'bg-slate-50 text-slate-600 border-slate-200' },
  info:      { solid: 'bg-brand-100 text-brand-700',   soft: 'bg-brand-50 text-brand-700 border-brand-200' },
  attention: { solid: 'bg-amber-100 text-amber-700',   soft: 'bg-amber-50 text-amber-700 border-amber-200' },
  success:   { solid: 'bg-emerald-100 text-emerald-700', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  returned:  { solid: 'bg-orange-100 text-orange-700', soft: 'bg-orange-50 text-orange-700 border-orange-200' },
  danger:    { solid: 'bg-red-100 text-red-700',       soft: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Every status string the API is known to return, across work orders, milestones,
 * bills, projects, tenders and vendors. Keys are matched case-insensitively and
 * ignoring spaces, so 'QueryRaised' and 'Query Raised' both resolve.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  // — not started / archived —
  draft: 'neutral',
  closed: 'neutral',
  inactive: 'neutral',
  cancelled: 'danger',

  // — moving through the workflow —
  open: 'info',
  submitted: 'info',
  activated: 'info',
  inprogress: 'info',
  reviewed: 'info',
  pendingvendoracceptance: 'info',
  scheduled: 'info',

  // — somebody has to act —
  pending: 'attention',
  followuprequired: 'attention',
  pendingreview: 'attention',
  underreview: 'attention',
  authorityapproval: 'attention',
  inspectionrequested: 'attention',
  partiallypaid: 'attention',

  // — terminal-good —
  approved: 'success',
  accepted: 'success',
  verified: 'success',
  confirmed: 'success',
  completed: 'success',
  resolved: 'success',
  paid: 'success',
  active: 'success',
  awarded: 'success',
  released: 'success',

  // — sent back for rework —
  returned: 'returned',
  queryraised: 'returned',

  // — terminal-bad —
  rejected: 'danger',
  delayed: 'danger',
  overdue: 'danger',
  blacklisted: 'danger',
};

const normalise = (status: string) => status.toLowerCase().replace(/[\s_-]/g, '');

/** The tone for a status, or `undefined` if we do not recognise it. */
export const statusTone = (status: string): StatusTone | undefined =>
  STATUS_TONES[normalise(status)];

/**
 * Chip classes for a status.
 *
 * `solid` (the default) is the filled chip used in tables and lists; `soft` is the
 * bordered, lighter chip used on detail pages. An unrecognised status renders
 * neutral rather than borrowing a meaningful tone, so unexpected data from the API
 * looks unremarkable instead of looking approved.
 */
export const statusChipClass = (
  status: string,
  variant: 'solid' | 'soft' = 'solid',
): string => TONE_STYLES[statusTone(status) ?? 'neutral'][variant];
