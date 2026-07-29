import axiosInstance from './axiosInstance';

/**
 * All five dashboards below compose real data client-side by fetching the
 * plain list endpoints from each microservice and joining them via the
 * foreign-key IDs already present on the entities (there is no backend
 * aggregation/BFF layer). A few figures can't be derived honestly from the
 * current schema (e.g. month-over-month deltas need historical snapshots we
 * don't store, and there's no "department" field on Tender/WorkOrder/Project)
 * — those are called out inline rather than filled with invented numbers.
 */

/* ── entity shapes (only the fields the dashboards read) ────────────────── */

interface TenderDto {
    id: string;
    tenderNo?: string;
    title?: string;
    tenderType?: string;
    status: string;
    budget?: number | string;
    publishDate?: string;
    closeDate?: string;
}

interface WorkOrderDto {
    id: string;
    tenderId?: string;
    vendorId?: string;
    workOrderNo?: string;
    status: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
}

interface DefectDto { status: string; }

interface InspectionDto {
    projectId?: string;
    status: string;
    defects?: DefectDto[];
}

interface BillDto {
    id: string;
    billNo?: string;
    workOrderId?: string;
    status: string;
    amount?: number | string;
    taxAmount?: number | string;
    submittedAt?: string;
    paidAt?: string;
    paymentVoucherNo?: string | null;
}

interface VendorDto {
    id: string;
    userId?: string;
    name?: string;
    vendorCode?: string;
    status?: string;
    performanceScore?: number;
}

interface ProjectDto {
    id: string;
    workOrderId?: string;
    name?: string;
    status?: string;
    budget?: number | string;
}

interface MilestoneDto {
    id: string;
    workOrderId?: string;
    projectId?: string;
    status?: string;
    title?: string;
}

interface ProgressReportDto {
    id: string;
    projectId?: string;
    vendorId?: string;
    milestoneId?: string | null;
    workDescription?: string;
    reportedAt?: string;
    status: string;
}

interface QueryDto { status: string; }

interface AuditLogDto {
    action?: string;
    timestamp?: string;
    changesInfo?: string;
    entityName?: string;
}

interface InspectorDto { id: string; userId?: string; }

interface InspectionVisitDto {
    inspectorId?: string;
    status: string;
    scheduledDate: string;
    actualVisitDate?: string;
    purpose?: string;
    remarks?: string;
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function getCurrentUser(): { id: string; role: string } | null {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function daysBetween(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// A list GET that degrades to an empty list on failure, so one dead service
// doesn't blank an entire dashboard.
async function getList<T>(url: string, params?: Record<string, string>): Promise<T[]> {
    try {
        const res = await axiosInstance.get<T[]>(url, params ? { params } : undefined);
        return res.data || [];
    } catch {
        return [];
    }
}

/* ── dashboards ─────────────────────────────────────────────────────────── */

export async function fetchAdminDashboard() {
    const [tenders, workorders, inspections, bills, vendors] = await Promise.all([
        getList<TenderDto>('/tenders'),
        getList<WorkOrderDto>('/workorders'),
        getList<InspectionDto>('/inspections'),
        getList<BillDto>('/bills'),
        getList<VendorDto>('/vendors')
    ]);

    const now = new Date();

    const activeTenders = tenders.filter(t => t.status !== 'Closed').length;
    const totalValue = tenders.reduce((sum, t) => sum + (Number(t.budget) || 0), 0);
    const inProgressWOs = workorders.filter(w => w.status === 'Accepted').length;
    const completedWOs = workorders.filter(w => w.status === 'Completed');
    const overdueWOs = workorders.filter(w => w.status !== 'Completed' && w.endDate && new Date(w.endDate) < now);

    const delayedProjects = overdueWOs.length;
    const avgTimeOverdue = overdueWOs.length
        ? Math.round(overdueWOs.reduce((sum, w) => sum + Math.max(0, daysBetween(now, new Date(w.endDate!))), 0) / overdueWOs.length)
        : 0;
    // Proxy for "on-time completion" — WorkOrder has no actual-completion-date field to
    // compare against EndDate, so this is a completion-rate approximation, not a true on-time metric.
    const onTimeCompletionPct = workorders.length ? Math.round((completedWOs.length / workorders.length) * 100) : 0;

    const paymentsMade = bills.reduce((sum, b) => sum + (b.status === 'Paid' ? (Number(b.amount) || 0) : 0), 0);
    const budgetUtilizationPct = totalValue > 0 ? Math.round((paymentsMade / totalValue) * 100) : 0;
    const activeVendors = vendors.filter(v => v.status === 'Active').length;
    const inspectionsPending = inspections.filter(i => i.status === 'Follow-up Required').length;

    const statusCounts: Record<string, number> = {};
    tenders.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
    const statusColors: Record<string, string> = { Open: '#3b82f6', Awarded: '#10b981', Closed: '#64748b' };
    const status = Object.entries(statusCounts).map(([name, value]) => ({ name, value, color: statusColors[name] || '#94a3b8' }));

    // Replaces the old "Projects by Department" chart — no department field exists
    // anywhere on Tender/WorkOrder/Project, so this shows Work Orders by Status instead.
    const woStatusCounts: Record<string, number> = {};
    workorders.forEach(w => { woStatusCounts[w.status] = (woStatusCounts[w.status] || 0) + 1; });
    const maxWoCount = Math.max(1, ...Object.values(woStatusCounts));
    const department = Object.entries(woStatusCounts).map(([name, value]) => ({ name, value, pct: Math.round((value / maxWoCount) * 100) }));

    // Buckets work orders by creation month, using each one's CURRENT status.
    // Real data, but not a true historical trend (we don't store status-change history).
    const monthBuckets: Record<string, { completed: number; inProgress: number; overdue: number }> = {};
    workorders.forEach(w => {
        if (!w.createdAt) return;
        const key = new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthBuckets[key]) monthBuckets[key] = { completed: 0, inProgress: 0, overdue: 0 };
        if (w.status === 'Completed') monthBuckets[key].completed++;
        else if (w.endDate && new Date(w.endDate) < now) monthBuckets[key].overdue++;
        else monthBuckets[key].inProgress++;
    });
    const progress = Object.entries(monthBuckets)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-6)
        .map(([date, v]) => ({ date, ...v }));

    const recentTenders = tenders.slice(0, 5).map(t => {
        const wo = workorders.find(w => w.tenderId === t.id);
        const startDate = wo?.startDate || t.publishDate;
        const endDate = wo?.endDate || t.closeDate;
        return {
            id: t.tenderNo || String(t.id).substring(0, 8),
            // The routable id behind this row — `id` above is a display tender number.
            // Null when the tender has no work order yet, which disables the row action.
            workOrderId: wo?.id ?? null,
            woNumber: wo?.workOrderNo || 'N/A',
            projectName: t.title || '',
            department: t.tenderType || 'N/A',
            value: Number(t.budget) || 0,
            status: wo?.status || t.status,
            progress: wo ? (wo.status === 'Completed' ? 100 : wo.status === 'Accepted' ? 50 : 0) : 0,
            startDate: startDate ? startDate.split('T')[0] : '-',
            endDate: endDate ? endDate.split('T')[0] : '-'
        };
    });

    return {
        topKpis: { activeTenders, inProgressWOs, totalValue, delayedProjects, inspectionsPending },
        bottomKpis: {
            avgTimeOverdue,
            onTimeCompletionPct,
            budgetUtilizationPct,
            paymentsMade,
            activeVendors,
            // Month-over-month deltas would need historical snapshots we don't store;
            // left neutral (0) rather than fabricated.
            trends: { overdue: 0, onTime: 0, budget: 0, payments: 0, vendors: 0 }
        },
        charts: { status, progress, department },
        recentTenders,
        vendorHealth: vendors.slice(0, 5).map(v => ({
            id: v.id,
            name: v.name ?? '',
            vendorCode: v.vendorCode ?? '',
            status: v.status ?? '',
            performanceScore: v.performanceScore ?? 0
        }))
    };
}

export async function fetchVendorDashboard() {
    const currentUser = getCurrentUser();
    const vendors = await getList<VendorDto>('/vendors');
    const me = vendors.find(v => v.userId === currentUser?.id);

    const emptyState = {
        stats: { assignedWorkOrders: 0, activeProjects: 0, completedMilestones: 0, totalMilestones: 0, defectsToRectify: 0, totalReworkCount: 0 },
        bills: {} as Record<string, number>,
        recentProjects: [] as {
            id: string; name: string; status: string; budget: number;
            milestonesDone: number; milestonesTotal: number;
        }[]
    };
    if (!me) return emptyState;

    const [myWorkOrders, projects, milestones, bills, inspections] = await Promise.all([
        getList<WorkOrderDto>('/workorders', { vendorId: me.id }),
        getList<ProjectDto>('/projects'),
        getList<MilestoneDto>('/execution/milestones'),
        getList<BillDto>('/bills'),
        getList<InspectionDto>('/inspections')
    ]);

    const myWorkOrderIds = new Set(myWorkOrders.map(w => w.id));

    const myProjects = projects.filter(p => p.workOrderId && myWorkOrderIds.has(p.workOrderId));
    const myProjectIds = new Set(myProjects.map(p => p.id));

    const myMilestones = milestones.filter(m =>
        (m.workOrderId && myWorkOrderIds.has(m.workOrderId)) || (m.projectId && myProjectIds.has(m.projectId))
    );

    const myBills = bills.filter(b => b.workOrderId && myWorkOrderIds.has(b.workOrderId));

    const myInspections = inspections.filter(i => i.projectId && myProjectIds.has(i.projectId));
    const openDefects = myInspections.reduce((sum, i) => sum + (i.defects?.filter(d => d.status === 'Open').length || 0), 0);
    const totalDefects = myInspections.reduce((sum, i) => sum + (i.defects?.length || 0), 0);

    const billsByStatus: Record<string, number> = {};
    myBills.forEach(b => { billsByStatus[b.status] = (billsByStatus[b.status] || 0) + 1; });

    const recentProjects = myProjects.slice(0, 5).map(p => {
        const projMilestones = myMilestones.filter(m => m.projectId === p.id || m.workOrderId === p.workOrderId);
        return {
            id: p.id,
            name: p.name ?? '',
            status: p.status ?? '',
            budget: Number(p.budget) || 0,
            milestonesDone: projMilestones.filter(m => m.status === 'Completed').length,
            milestonesTotal: projMilestones.length
        };
    });

    return {
        stats: {
            assignedWorkOrders: myWorkOrders.length,
            activeProjects: myProjects.filter(p => p.status !== 'Completed').length,
            completedMilestones: myMilestones.filter(m => m.status === 'Completed').length,
            totalMilestones: myMilestones.length,
            defectsToRectify: openDefects,
            totalReworkCount: totalDefects
        },
        bills: billsByStatus,
        recentProjects
    };
}

export async function fetchInspectorDashboard() {
    const currentUser = getCurrentUser();
    const inspectors = await getList<InspectorDto>('/inspectors');
    const me = inspectors.find(i => i.userId === currentUser?.id);

    const [myWorkOrders, visits, reports] = await Promise.all([
        me ? getList<WorkOrderDto>('/workorders', { inspectorId: me.id }) : Promise.resolve([] as WorkOrderDto[]),
        getList<InspectionVisitDto>('/inspectionvisits'),
        getList<ProgressReportDto>('/progressreports')
    ]);

    const myVisits = me ? visits.filter(v => v.inspectorId === me.id) : [];

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingSchedule = myVisits
        .filter(v => v.status === 'Scheduled')
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, 5)
        // InspectionVisit has no true "location" field — using its Purpose as the closest real substitute.
        .map(v => ({ scheduledDate: v.scheduledDate, location: v.purpose, status: v.status }));

    const upcomingWeek = myVisits.filter(v => v.status === 'Scheduled' && new Date(v.scheduledDate) <= weekFromNow).length;

    // ProgressReport has no InspectorId — this is a system-wide pending-review count,
    // not scoped to this inspector's own work orders (no join path exists for that yet).
    const pendingReviewsCount = reports.filter(r => r.status === 'Submitted').length;

    return {
        kpis: {
            pendingVisits: myWorkOrders.length, // rendered as "Assigned Work Orders"
            completedVisits: pendingReviewsCount, // rendered as "Pending Reviews"
            upcomingWeek // rendered as "Upcoming Visits"
        },
        recentVisits: myVisits
            .filter(v => v.status === 'Completed')
            .sort((a, b) => new Date(b.actualVisitDate || b.scheduledDate).getTime() - new Date(a.actualVisitDate || a.scheduledDate).getTime())
            .slice(0, 5)
            .map(v => ({
                entityName: 'Inspection Visit',
                changesInfo: v.remarks || v.purpose,
                timestamp: v.actualVisitDate || v.scheduledDate
            })),
        upcomingSchedule
    };
}

export async function fetchDepartmentDashboard() {
    const [workorders, reports, bills, queries, auditLogs, vendors, projects, milestones] = await Promise.all([
        getList<WorkOrderDto>('/workorders'),
        getList<ProgressReportDto>('/progressreports'),
        getList<BillDto>('/bills'),
        getList<QueryDto>('/queries'),
        getList<AuditLogDto>('/auditlogs'),
        getList<VendorDto>('/vendors'),
        getList<ProjectDto>('/projects'),
        getList<MilestoneDto>('/execution/milestones')
    ]);

    const vendorById = new Map(vendors.map(v => [v.id, v]));
    const workOrderById = new Map(workorders.map(w => [w.id, w]));
    const projectById = new Map(projects.map(p => [p.id, p]));
    const milestoneById = new Map(milestones.map(m => [m.id, m]));

    const now = new Date();
    const approvedThisMonth = bills.filter(b =>
        b.status === 'Paid' && b.paidAt &&
        new Date(b.paidAt).getMonth() === now.getMonth() &&
        new Date(b.paidAt).getFullYear() === now.getFullYear()
    ).length;

    const inspectorReports = reports.slice(0, 20).map(r => ({
        id: r.id,
        projectName: (r.projectId && projectById.get(r.projectId)?.name) || 'Unknown Project',
        vendorName: (r.vendorId && vendorById.get(r.vendorId)?.name) || 'Unknown',
        workDescription: r.workDescription ?? '',
        reportedAt: r.reportedAt ?? '',
        status: r.status,
        milestoneTitle: r.milestoneId ? (milestoneById.get(r.milestoneId)?.title || 'N/A') : 'N/A'
    }));

    const billsPending = bills.slice(0, 20).map(b => {
        const wo = b.workOrderId ? workOrderById.get(b.workOrderId) : undefined;
        return {
            id: b.id,
            billNo: b.billNo ?? '',
            workOrderNo: wo?.workOrderNo || 'N/A',
            vendorName: (wo?.vendorId && vendorById.get(wo.vendorId)?.name) || 'N/A',
            amount: Number(b.amount) || 0,
            taxAmount: Number(b.taxAmount) || 0,
            submittedAt: b.submittedAt ?? '',
            status: b.status,
            paymentVoucherNo: b.paymentVoucherNo ?? null
        };
    });

    return {
        kpis: {
            totalWorkOrders: workorders.length,
            pendingReports: reports.filter(r => r.status === 'Submitted' || r.status === 'Reviewed').length,
            billsPendingApproval: bills.filter(b => b.status === 'Submitted' || b.status === 'Under Review').length,
            totalFundRequests: bills.filter(b => b.status === 'Approved').length,
            approvedThisMonth,
            openQueries: queries.filter(q => q.status === 'Open' || q.status === 'In Progress').length
        },
        inspectorReports,
        billsPending,
        recentActivity: auditLogs.map(l => ({
            action: l.action ?? '',
            timestamp: l.timestamp ?? '',
            changesInfo: l.changesInfo ?? '',
            entityName: l.entityName ?? ''
        }))
    };
}

export async function fetchFinancialDashboard() {
    const [bills, workorders, vendors, tenders] = await Promise.all([
        getList<BillDto>('/bills'),
        getList<WorkOrderDto>('/workorders'),
        getList<VendorDto>('/vendors'),
        getList<TenderDto>('/tenders')
    ]);

    const vendorById = new Map(vendors.map(v => [v.id, v]));
    const workOrderById = new Map(workorders.map(w => [w.id, w]));

    const totalBudgetAllocated = tenders.reduce((sum, t) => sum + (Number(t.budget) || 0), 0);
    const totalFundsReleased = bills.filter(b => b.status === 'Paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const pendingApprovalValue = bills.filter(b => b.status === 'Approved').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const rejectedBillsCount = bills.filter(b => b.status === 'Returned' || b.status === 'Rejected').length;

    const enrich = (b: BillDto) => {
        const wo = b.workOrderId ? workOrderById.get(b.workOrderId) : undefined;
        return {
            id: b.id,
            billNo: b.billNo ?? '',
            workOrderNo: wo?.workOrderNo || 'N/A',
            vendorName: (wo?.vendorId && vendorById.get(wo.vendorId)?.name) || 'N/A',
            amount: Number(b.amount) || 0,
            taxAmount: Number(b.taxAmount) || 0,
            totalAmount: (Number(b.amount) || 0) + (Number(b.taxAmount) || 0),
            submittedAt: b.submittedAt ?? '',
            status: b.status,
            paidAt: b.paidAt ?? '',
            paymentVoucherNo: b.paymentVoucherNo ?? null
        };
    };

    const pendingApprovals = bills.filter(b => b.status === 'Approved').map(enrich);
    const paymentHistory = bills
        .filter(b => b.status === 'Paid')
        .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
        .slice(0, 50)
        .map(enrich);

    return {
        kpis: { totalBudgetAllocated, totalFundsReleased, pendingApprovalValue, rejectedBillsCount },
        pendingApprovals,
        paymentHistory
    };
}
