import axiosInstance from './axiosInstance';

/**
 * The notification feed is deliberately two halves merged together.
 *
 * STATE is derived here, client-side, from signals that already exist in the domain
 * (overdue work orders, bills awaiting action, milestones pending approval, open
 * defects, open queries). These are conditions that are true right now, so deriving
 * them is always current and there is nothing meaningful to mark as "read".
 *
 * EVENTS come from GET /api/alerts — durable rows written when something happened at a
 * point in time (a bill was returned, a visit was scheduled, an admin broadcast a
 * notice). Those need to survive the underlying record moving on, and they carry a
 * per-user read mark.
 *
 * Everything here is real data — nothing is invented. If a service is down its list
 * degrades to empty rather than blanking the whole feed.
 */

export type NotificationType = 'critical' | 'warning' | 'info' | 'success';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    /** ISO timestamp used for sorting and the relative "x ago" label. */
    timestamp: string;
    /** In-app route this notification points at. */
    link?: string;
    /** True for a persisted alert; derived state entries are not markable. */
    persisted?: boolean;
    /** Only meaningful when persisted. */
    isRead?: boolean;
}

interface AlertDto {
    id: string;
    type?: string;
    title?: string;
    message?: string;
    link?: string | null;
    createdAt?: string;
    isRead?: boolean;
}

/** Persisted, per-user alerts. Degrades to [] like every other feed source. */
async function persistedAlerts(): Promise<AppNotification[]> {
    try {
        const res = await axiosInstance.get<AlertDto[]>('/alerts');
        return (res.data ?? []).map(a => ({
            id: a.id,
            type: (a.type as NotificationType) || 'info',
            title: a.title ?? '',
            message: a.message ?? '',
            timestamp: a.createdAt ?? '',
            link: a.link ?? undefined,
            persisted: true,
            isRead: !!a.isRead,
        }));
    } catch {
        return [];
    }
}

/** Marks one persisted alert read, then drops the cache so the badge recounts. */
export async function markAlertRead(id: string): Promise<void> {
    try {
        await axiosInstance.post(`/alerts/${id}/read`);
        invalidateNotifications();
    } catch { /* leave it unread rather than lying about it */ }
}

export async function markAllAlertsRead(): Promise<void> {
    try {
        await axiosInstance.post('/alerts/read-all');
        invalidateNotifications();
    } catch { /* no-op */ }
}

/* ── entity shapes (only the fields this feed reads) ─────────────────────── */

interface WorkOrderDto {
    id: string;
    workOrderNo?: string;
    vendorId?: string;
    status: string;
    endDate?: string;
    createdAt?: string;
}

interface BillDto {
    id: string;
    billNo?: string;
    vendorId?: string;
    workOrderId?: string;
    status: string;
    amount?: number | string;
    submittedAt?: string;
}

interface PendingMilestoneDto {
    id: string;
    title?: string;
    projectName?: string;
    vendorName?: string;
    targetDate?: string;
}

interface DefectDto {
    id: string;
    description?: string;
    severity?: string;
    status: string;
}

interface InspectionDto {
    id: string;
    projectId?: string;
    projectName?: string;
    inspectionDate?: string;
    defects?: DefectDto[];
}

interface QueryDto {
    id: string;
    vendorId?: string;
    subject?: string;
    status: string;
    createdAt?: string;
}

interface ProgressReportDto {
    id: string;
    projectId?: string;
    status: string;
    reportedAt?: string;
    workDescription?: string;
}

interface VendorDto { id: string; userId?: string; name?: string }

interface InspectionVisitDto {
    id: string;
    inspectorId?: string;
    scheduledDate: string;
    purpose?: string;
    status: string;
}

interface InspectorDto { id: string; userId?: string }

/* ── helpers ────────────────────────────────────────────────────────────── */

async function getList<T>(url: string, params?: Record<string, string>): Promise<T[]> {
    try {
        const res = await axiosInstance.get<T[]>(url, params ? { params } : undefined);
        return res.data || [];
    } catch {
        return [];
    }
}

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** "2 hours ago" / "3 days ago" — relative label for the dropdown. */
export function timeAgo(iso: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
}

/* ── per-role feeds ─────────────────────────────────────────────────────── */

/**
 * The oversight feed, shared by Admin, PMU, Department and Finance.
 *
 * `role` is needed for two reasons: GET /execution/milestones/pending excludes Finance
 * (it is a reviewer endpoint), so calling it for them only produced a 403 on every page;
 * and several destinations are Admin/PMU-only routes, so linking Department or Finance
 * at them just bounces them back to their own dashboard.
 */
async function adminFeed(role: string): Promise<AppNotification[]> {
    const isAdminLike = role === 'Admin' || role === 'PMU';
    const canReviewMilestones = isAdminLike || role === 'Department';

    const [workorders, bills, milestones, inspections, queries] = await Promise.all([
        getList<WorkOrderDto>('/workorders'),
        getList<BillDto>('/bills'),
        canReviewMilestones
            ? getList<PendingMilestoneDto>('/execution/milestones/pending')
            : Promise.resolve([] as PendingMilestoneDto[]),
        getList<InspectionDto>('/inspections'),
        getList<QueryDto>('/queries'),
    ]);

    // Where each role is actually allowed to act on the thing being announced.
    const billLink = role === 'Finance' ? '/finance/dashboard'
        : role === 'Department' ? '/department/dashboard'
            : '/admin/billing';

    const now = Date.now();
    const out: AppNotification[] = [];

    workorders
        .filter(w => w.status !== 'Completed' && w.endDate && new Date(w.endDate).getTime() < now)
        .forEach(w => {
            const daysLate = Math.floor((now - new Date(w.endDate!).getTime()) / 86400000);
            out.push({
                id: `wo-overdue-${w.id}`,
                type: 'critical',
                title: 'Work Order Overdue',
                message: `${w.workOrderNo || 'Work order'} passed its end date by ${daysLate} day${daysLate === 1 ? '' : 's'}.`,
                timestamp: w.endDate!,
                link: `/admin/work-orders/${w.id}`,
            });
        });

    bills
        .filter(b => b.status === 'Submitted' || b.status === 'Under Review')
        .forEach(b => out.push({
            id: `bill-pending-${b.id}`,
            type: 'warning',
            title: 'Bill Awaiting Approval',
            message: `${b.billNo || 'Bill'} for ${rupees(Number(b.amount))} is ${b.status.toLowerCase()}.`,
            timestamp: b.submittedAt || '',
            link: billLink,
        }));

    milestones.forEach(m => out.push({
        id: `ms-pending-${m.id}`,
        type: 'info',
        title: 'Milestone Pending Approval',
        message: `${m.title || 'Milestone'}${m.vendorName ? ` from ${m.vendorName}` : ''} is awaiting review.`,
        timestamp: m.targetDate || '',
        link: '/admin/milestone-approvals',
    }));

    inspections.forEach(i => {
        const open = (i.defects || []).filter(d => d.status === 'Open');
        if (open.length) {
            out.push({
                id: `defects-${i.id}`,
                type: 'warning',
                title: 'Open Quality Defects',
                message: `${open.length} unresolved defect${open.length === 1 ? '' : 's'}${i.projectName ? ` on ${i.projectName}` : ''}.`,
                timestamp: i.inspectionDate || '',
                link: isAdminLike ? '/admin/projects' : undefined,
            });
        }
    });

    queries
        .filter(q => q.status === 'Open' || q.status === 'In Progress')
        .forEach(q => out.push({
            id: `query-${q.id}`,
            type: 'info',
            title: 'Open Vendor Query',
            message: q.subject || 'A vendor query is awaiting a response.',
            timestamp: q.createdAt || '',
            link: isAdminLike ? '/admin/queries' : undefined,
        }));

    return out;
}

async function vendorFeed(userId: string): Promise<AppNotification[]> {
    const vendors = await getList<VendorDto>('/vendors');
    const me = vendors.find(v => v.userId === userId);
    if (!me) return [];

    const [bills, workorders, queries] = await Promise.all([
        getList<BillDto>('/bills'),
        getList<WorkOrderDto>('/workorders', { vendorId: me.id }),
        getList<QueryDto>('/queries'),
    ]);

    const myWoIds = new Set(workorders.map(w => w.id));
    const now = Date.now();
    const out: AppNotification[] = [];

    bills
        .filter(b => b.workOrderId && myWoIds.has(b.workOrderId))
        .forEach(b => {
            if (b.status === 'Returned' || b.status === 'Rejected') {
                out.push({
                    id: `bill-${b.status}-${b.id}`,
                    type: 'critical',
                    title: `Bill ${b.status}`,
                    message: `${b.billNo || 'Your bill'} was ${b.status.toLowerCase()} and needs attention.`,
                    timestamp: b.submittedAt || '',
                    link: '/vendor/bills',
                });
            } else if (b.status === 'Paid') {
                out.push({
                    id: `bill-paid-${b.id}`,
                    type: 'success',
                    title: 'Payment Released',
                    message: `${b.billNo || 'Your bill'} for ${rupees(Number(b.amount))} has been paid.`,
                    timestamp: b.submittedAt || '',
                    link: '/vendor/bills',
                });
            }
        });

    workorders
        .filter(w => w.status !== 'Completed' && w.endDate && new Date(w.endDate).getTime() < now)
        .forEach(w => out.push({
            id: `wo-late-${w.id}`,
            type: 'critical',
            title: 'Work Order Overdue',
            message: `${w.workOrderNo || 'Work order'} is past its end date.`,
            timestamp: w.endDate!,
            link: '/vendor/work-orders',
        }));

    queries
        .filter(q => q.vendorId === me.id && (q.status === 'Open' || q.status === 'In Progress'))
        .forEach(q => out.push({
            id: `vquery-${q.id}`,
            type: 'info',
            title: 'Query Update',
            message: q.subject || 'Your query is being processed.',
            timestamp: q.createdAt || '',
            link: '/vendor/queries',
        }));

    return out;
}

async function inspectorFeed(userId: string): Promise<AppNotification[]> {
    const inspectors = await getList<InspectorDto>('/inspectors');
    const me = inspectors.find(i => i.userId === userId);

    const [reports, visits] = await Promise.all([
        getList<ProgressReportDto>('/progressreports'),
        getList<InspectionVisitDto>('/inspectionvisits'),
    ]);

    const out: AppNotification[] = [];

    reports
        .filter(r => r.status === 'Submitted')
        .forEach(r => out.push({
            id: `report-${r.id}`,
            type: 'info',
            title: 'Progress Report Awaiting Review',
            message: r.workDescription || 'A vendor progress report needs your review.',
            timestamp: r.reportedAt || '',
            link: '/inspector/progress-review',
        }));

    if (me) {
        visits
            .filter(v => v.inspectorId === me.id && v.status === 'Scheduled')
            .forEach(v => out.push({
                id: `visit-${v.id}`,
                type: 'info',
                title: 'Upcoming Site Visit',
                message: v.purpose || 'You have a scheduled inspection visit.',
                timestamp: v.scheduledDate,
                link: '/inspector/visits',
            }));
    }

    return out;
}

/* ── public API (module-level cache keeps navigation cheap) ──────────────── */

let cache: { key: string; at: number; data: AppNotification[] } | null = null;
const TTL_MS = 60_000;

/**
 * Builds the notification feed for the given user. Results are cached for 60s
 * because the topbar remounts on every route change.
 */
export async function fetchNotifications(
    role: string,
    userId: string,
    opts?: { force?: boolean }
): Promise<AppNotification[]> {
    const key = `${role}:${userId}`;
    if (!opts?.force && cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
        return cache.data;
    }

    let derived: AppNotification[] = [];
    if (role === 'Admin' || role === 'PMU' || role === 'Department' || role === 'Finance') {
        derived = await adminFeed(role);
    } else if (role === 'Vendor') {
        derived = await vendorFeed(userId);
    } else if (role === 'Inspector') {
        derived = await inspectorFeed(userId);
    }

    // Events first, then the derived state conditions; the sort below interleaves them.
    const data = [...(await persistedAlerts()), ...derived];

    // Newest first; entries without a usable timestamp sink to the bottom.
    data.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
    });

    cache = { key, at: Date.now(), data };
    return data;
}

/** Drops the cache so the next fetch re-reads the services. */
export function invalidateNotifications() {
    cache = null;
}
