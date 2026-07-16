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

export async function fetchAdminDashboard() {
    const [tendersRes, workordersRes, inspectionsRes, billsRes, vendorsRes] = await Promise.all([
        axiosInstance.get('/tenders').catch(() => ({ data: [] })),
        axiosInstance.get('/workorders').catch(() => ({ data: [] })),
        axiosInstance.get('/inspections').catch(() => ({ data: [] })),
        axiosInstance.get('/bills').catch(() => ({ data: [] })),
        axiosInstance.get('/vendors').catch(() => ({ data: [] }))
    ]);

    const tenders: any[] = tendersRes.data || [];
    const workorders: any[] = workordersRes.data || [];
    const inspections: any[] = inspectionsRes.data || [];
    const bills: any[] = billsRes.data || [];
    const vendors: any[] = vendorsRes.data || [];

    const now = new Date();

    const activeTenders = tenders.filter((t: any) => t.status !== 'Closed').length;
    const totalValue = tenders.reduce((sum: number, t: any) => sum + (Number(t.budget) || 0), 0);
    const inProgressWOs = workorders.filter((w: any) => w.status === 'Accepted').length;
    const completedWOs = workorders.filter((w: any) => w.status === 'Completed');
    const overdueWOs = workorders.filter((w: any) => w.status !== 'Completed' && w.endDate && new Date(w.endDate) < now);

    const delayedProjects = overdueWOs.length;
    const avgTimeOverdue = overdueWOs.length
        ? Math.round(overdueWOs.reduce((sum: number, w: any) => sum + Math.max(0, daysBetween(now, new Date(w.endDate))), 0) / overdueWOs.length)
        : 0;
    // Proxy for "on-time completion" — WorkOrder has no actual-completion-date field to
    // compare against EndDate, so this is a completion-rate approximation, not a true on-time metric.
    const onTimeCompletionPct = workorders.length ? Math.round((completedWOs.length / workorders.length) * 100) : 0;

    const paymentsMade = bills.reduce((sum: number, b: any) => sum + (b.status === 'Paid' ? (Number(b.amount) || 0) : 0), 0);
    const budgetUtilizationPct = totalValue > 0 ? Math.round((paymentsMade / totalValue) * 100) : 0;
    const activeVendors = vendors.filter((v: any) => v.status === 'Active').length;
    const inspectionsPending = inspections.filter((i: any) => i.status === 'Follow-up Required').length;

    const statusCounts: Record<string, number> = {};
    tenders.forEach((t: any) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
    const statusColors: Record<string, string> = { Open: '#3b82f6', Awarded: '#10b981', Closed: '#64748b' };
    const status = Object.entries(statusCounts).map(([name, value]) => ({ name, value, color: statusColors[name] || '#94a3b8' }));

    // Replaces the old "Projects by Department" chart — no department field exists
    // anywhere on Tender/WorkOrder/Project, so this shows Work Orders by Status instead.
    const woStatusCounts: Record<string, number> = {};
    workorders.forEach((w: any) => { woStatusCounts[w.status] = (woStatusCounts[w.status] || 0) + 1; });
    const maxWoCount = Math.max(1, ...Object.values(woStatusCounts));
    const department = Object.entries(woStatusCounts).map(([name, value]) => ({ name, value, pct: Math.round((value / maxWoCount) * 100) }));

    // Buckets work orders by creation month, using each one's CURRENT status.
    // Real data, but not a true historical trend (we don't store status-change history).
    const monthBuckets: Record<string, { completed: number; inProgress: number; overdue: number }> = {};
    workorders.forEach((w: any) => {
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

    const recentTenders = tenders.slice(0, 5).map((t: any) => {
        const wo = workorders.find((w: any) => w.tenderId === t.id);
        const startDate = wo?.startDate || t.publishDate;
        const endDate = wo?.endDate || t.closeDate;
        return {
            id: t.tenderNo || String(t.id).substring(0, 8),
            woNumber: wo?.workOrderNo || 'N/A',
            projectName: t.title,
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
        vendorHealth: vendors.slice(0, 5).map((v: any) => ({
            id: v.id, name: v.name, vendorCode: v.vendorCode, status: v.status, performanceScore: v.performanceScore
        }))
    };
}

export async function fetchVendorDashboard() {
    const currentUser = getCurrentUser();
    const vendorsRes = await axiosInstance.get('/vendors').catch(() => ({ data: [] }));
    const vendors: any[] = vendorsRes.data || [];
    const me = vendors.find((v: any) => v.userId === currentUser?.id);

    const emptyState = {
        stats: { assignedWorkOrders: 0, activeProjects: 0, completedMilestones: 0, totalMilestones: 0, defectsToRectify: 0, totalReworkCount: 0 },
        bills: {} as Record<string, number>,
        recentProjects: [] as any[]
    };
    if (!me) return emptyState;

    const [workordersRes, projectsRes, milestonesRes, billsRes, inspectionsRes] = await Promise.all([
        axiosInstance.get('/workorders', { params: { vendorId: me.id } }).catch(() => ({ data: [] })),
        axiosInstance.get('/projects').catch(() => ({ data: [] })),
        axiosInstance.get('/execution/milestones').catch(() => ({ data: [] })),
        axiosInstance.get('/bills').catch(() => ({ data: [] })),
        axiosInstance.get('/inspections').catch(() => ({ data: [] }))
    ]);

    const myWorkOrders: any[] = workordersRes.data || [];
    const myWorkOrderIds = new Set(myWorkOrders.map((w: any) => w.id));

    const myProjects = (projectsRes.data || []).filter((p: any) => myWorkOrderIds.has(p.workOrderId));
    const myProjectIds = new Set(myProjects.map((p: any) => p.id));

    const myMilestones = (milestonesRes.data || []).filter((m: any) =>
        (m.workOrderId && myWorkOrderIds.has(m.workOrderId)) || (m.projectId && myProjectIds.has(m.projectId))
    );

    const myBills: any[] = (billsRes.data || []).filter((b: any) => myWorkOrderIds.has(b.workOrderId));

    const myInspections: any[] = (inspectionsRes.data || []).filter((i: any) => myProjectIds.has(i.projectId));
    const openDefects = myInspections.reduce((sum: number, i: any) => sum + (i.defects?.filter((d: any) => d.status === 'Open').length || 0), 0);
    const totalDefects = myInspections.reduce((sum: number, i: any) => sum + (i.defects?.length || 0), 0);

    const billsByStatus: Record<string, number> = {};
    myBills.forEach((b: any) => { billsByStatus[b.status] = (billsByStatus[b.status] || 0) + 1; });

    const recentProjects = myProjects.slice(0, 5).map((p: any) => {
        const projMilestones = myMilestones.filter((m: any) => m.projectId === p.id || m.workOrderId === p.workOrderId);
        return {
            id: p.id,
            name: p.name,
            status: p.status,
            progress: Number(p.progress) || 0,
            budget: Number(p.budget) || 0,
            milestonesDone: projMilestones.filter((m: any) => m.status === 'Completed').length,
            milestonesTotal: projMilestones.length
        };
    });

    return {
        stats: {
            assignedWorkOrders: myWorkOrders.length,
            activeProjects: myProjects.filter((p: any) => p.status !== 'Completed').length,
            completedMilestones: myMilestones.filter((m: any) => m.status === 'Completed').length,
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
    const inspectorsRes = await axiosInstance.get('/inspectors').catch(() => ({ data: [] }));
    const inspectors: any[] = inspectorsRes.data || [];
    const me = inspectors.find((i: any) => i.userId === currentUser?.id);

    const [workordersRes, visitsRes, reportsRes] = await Promise.all([
        me ? axiosInstance.get('/workorders', { params: { inspectorId: me.id } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        axiosInstance.get('/inspectionvisits').catch(() => ({ data: [] })),
        axiosInstance.get('/progressreports').catch(() => ({ data: [] }))
    ]);

    const myWorkOrders: any[] = workordersRes.data || [];
    const myVisits: any[] = me ? (visitsRes.data || []).filter((v: any) => v.inspectorId === me.id) : [];

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingSchedule = myVisits
        .filter((v: any) => v.status === 'Scheduled')
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, 5)
        // InspectionVisit has no true "location" field — using its Purpose as the closest real substitute.
        .map((v: any) => ({ scheduledDate: v.scheduledDate, location: v.purpose, status: v.status }));

    const upcomingWeek = myVisits.filter((v: any) => v.status === 'Scheduled' && new Date(v.scheduledDate) <= weekFromNow).length;

    // ProgressReport has no InspectorId — this is a system-wide pending-review count,
    // not scoped to this inspector's own work orders (no join path exists for that yet).
    const pendingReviewsCount = (reportsRes.data || []).filter((r: any) => r.status === 'Submitted').length;

    return {
        kpis: {
            pendingVisits: myWorkOrders.length, // rendered as "Assigned Work Orders"
            completedVisits: pendingReviewsCount, // rendered as "Pending Reviews"
            upcomingWeek // rendered as "Upcoming Visits"
        },
        recentVisits: myVisits
            .filter((v: any) => v.status === 'Completed')
            .sort((a: any, b: any) => new Date(b.actualVisitDate || b.scheduledDate).getTime() - new Date(a.actualVisitDate || a.scheduledDate).getTime())
            .slice(0, 5)
            .map((v: any) => ({
                entityName: 'Inspection Visit',
                changesInfo: v.remarks || v.purpose,
                timestamp: v.actualVisitDate || v.scheduledDate
            })),
        upcomingSchedule
    };
}

export async function fetchDepartmentDashboard() {
    const [workordersRes, reportsRes, billsRes, queriesRes, auditRes, vendorsRes, projectsRes, milestonesRes] = await Promise.all([
        axiosInstance.get('/workorders').catch(() => ({ data: [] })),
        axiosInstance.get('/progressreports').catch(() => ({ data: [] })),
        axiosInstance.get('/bills').catch(() => ({ data: [] })),
        axiosInstance.get('/queries').catch(() => ({ data: [] })),
        axiosInstance.get('/auditlogs').catch(() => ({ data: [] })),
        axiosInstance.get('/vendors').catch(() => ({ data: [] })),
        axiosInstance.get('/projects').catch(() => ({ data: [] })),
        axiosInstance.get('/execution/milestones').catch(() => ({ data: [] }))
    ]);

    const workorders: any[] = workordersRes.data || [];
    const reports: any[] = reportsRes.data || [];
    const bills: any[] = billsRes.data || [];
    const queries: any[] = queriesRes.data || [];
    const auditLogs: any[] = auditRes.data || [];
    const vendors: any[] = vendorsRes.data || [];
    const projects: any[] = projectsRes.data || [];
    const milestones: any[] = milestonesRes.data || [];

    const vendorById = new Map(vendors.map((v: any) => [v.id, v]));
    const workOrderById = new Map(workorders.map((w: any) => [w.id, w]));
    const projectById = new Map(projects.map((p: any) => [p.id, p]));
    const milestoneById = new Map(milestones.map((m: any) => [m.id, m]));

    const now = new Date();
    const approvedThisMonth = bills.filter((b: any) =>
        b.status === 'Paid' && b.paidAt &&
        new Date(b.paidAt).getMonth() === now.getMonth() &&
        new Date(b.paidAt).getFullYear() === now.getFullYear()
    ).length;

    const inspectorReports = reports.slice(0, 20).map((r: any) => ({
        id: r.id,
        projectName: projectById.get(r.projectId)?.name || 'Unknown Project',
        vendorName: vendorById.get(r.vendorId)?.name || 'Unknown',
        physicalPercentage: r.physicalPercentage,
        workDescription: r.workDescription,
        reportedAt: r.reportedAt,
        status: r.status,
        milestoneTitle: r.milestoneId ? (milestoneById.get(r.milestoneId)?.title || 'N/A') : 'N/A'
    }));

    const billsPending = bills.slice(0, 20).map((b: any) => {
        const wo = workOrderById.get(b.workOrderId);
        return {
            id: b.id,
            billNo: b.billNo,
            workOrderNo: wo?.workOrderNo || 'N/A',
            vendorName: wo ? (vendorById.get(wo.vendorId)?.name || 'N/A') : 'N/A',
            amount: b.amount,
            taxAmount: b.taxAmount,
            submittedAt: b.submittedAt,
            status: b.status,
            paymentVoucherNo: b.paymentVoucherNo
        };
    });

    return {
        kpis: {
            totalWorkOrders: workorders.length,
            pendingReports: reports.filter((r: any) => r.status === 'Submitted' || r.status === 'Reviewed').length,
            billsPendingApproval: bills.filter((b: any) => b.status === 'Submitted' || b.status === 'Under Review').length,
            totalFundRequests: bills.filter((b: any) => b.status === 'Approved').length,
            approvedThisMonth,
            openQueries: queries.filter((q: any) => q.status === 'Open' || q.status === 'In Progress').length
        },
        inspectorReports,
        billsPending,
        recentActivity: auditLogs.map((l: any) => ({ action: l.action, timestamp: l.timestamp, changesInfo: l.changesInfo, entityName: l.entityName }))
    };
}

export async function fetchFinancialDashboard() {
    const [billsRes, workordersRes, vendorsRes, tendersRes] = await Promise.all([
        axiosInstance.get('/bills').catch(() => ({ data: [] })),
        axiosInstance.get('/workorders').catch(() => ({ data: [] })),
        axiosInstance.get('/vendors').catch(() => ({ data: [] })),
        axiosInstance.get('/tenders').catch(() => ({ data: [] }))
    ]);

    const bills: any[] = billsRes.data || [];
    const workorders: any[] = workordersRes.data || [];
    const vendors: any[] = vendorsRes.data || [];
    const tenders: any[] = tendersRes.data || [];

    const vendorById = new Map(vendors.map((v: any) => [v.id, v]));
    const workOrderById = new Map(workorders.map((w: any) => [w.id, w]));

    const totalBudgetAllocated = tenders.reduce((sum: number, t: any) => sum + (Number(t.budget) || 0), 0);
    const totalFundsReleased = bills.filter((b: any) => b.status === 'Paid').reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
    const pendingApprovalValue = bills.filter((b: any) => b.status === 'Approved').reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
    const rejectedBillsCount = bills.filter((b: any) => b.status === 'Returned' || b.status === 'Rejected').length;

    const enrich = (b: any) => {
        const wo = workOrderById.get(b.workOrderId);
        return {
            id: b.id,
            billNo: b.billNo,
            workOrderNo: wo?.workOrderNo || 'N/A',
            vendorName: wo ? (vendorById.get(wo.vendorId)?.name || 'N/A') : 'N/A',
            amount: b.amount,
            taxAmount: b.taxAmount,
            totalAmount: (Number(b.amount) || 0) + (Number(b.taxAmount) || 0),
            submittedAt: b.submittedAt,
            status: b.status,
            paidAt: b.paidAt,
            paymentVoucherNo: b.paymentVoucherNo
        };
    };

    const pendingApprovals = bills.filter((b: any) => b.status === 'Approved').map(enrich);
    const paymentHistory = bills
        .filter((b: any) => b.status === 'Paid')
        .sort((a: any, b: any) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        .slice(0, 50)
        .map(enrich);

    return {
        kpis: { totalBudgetAllocated, totalFundsReleased, pendingApprovalValue, rejectedBillsCount },
        pendingApprovals,
        paymentHistory
    };
}
