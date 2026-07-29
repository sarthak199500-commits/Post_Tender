/**
 * Composes the full detail view of a work order.
 *
 * GET /workorders/{id} returns the work-order scalar plus its tender (same service) and
 * the ids of its projects. Vendor, inspector, milestones and progress reports live in
 * other services, so they are joined here on the client — the pattern this codebase uses
 * everywhere instead of service-to-service calls.
 *
 * Every join degrades to a placeholder rather than throwing: the detail pages used to
 * read `wo.tender.title` straight off the raw payload, and because the API never
 * populated it the whole React tree unmounted to a blank page.
 */
import axiosInstance from './axiosInstance';
import type { Milestone } from '../types/domain';

export interface WorkOrderDetail {
    id: string;
    workOrderNo: string;
    status: string;
    totalValue: number;
    scopeDescription: string;
    paymentTerms: string;
    liquidatedDamagesTerms: string;
    agreementDocumentUrl: string;
    startDate: string;
    endDate: string;
    tender: { title: string; budget: number; tenderNo: string };
    vendor: { id: string; name: string; vendorCode: string; email: string };
    inspector: { name: string; type: string } | null;
    milestones: Milestone[];
}

export interface ProgressReportRow {
    id: string;
    workDescription: string;
    reportedAt: string;
    status: string;
    mediaUrls?: string[];
    remarks?: string;
    inspectorRemarks?: string;
    milestoneId?: string | null;
    milestone?: { title: string };
}

interface RawWorkOrder {
    id: string;
    workOrderNo?: string;
    status?: string;
    totalValue?: number;
    scopeDescription?: string;
    paymentTerms?: string;
    liquidatedDamagesTerms?: string;
    agreementDocumentUrl?: string;
    startDate?: string;
    endDate?: string;
    tenderId?: string;
    vendorId?: string;
    inspectorId?: string | null;
    tender?: { title?: string; budget?: number; tenderNo?: string } | null;
    projectIds?: string[];
}

/** Resolves to [] instead of rejecting, so one unauthorised join cannot blank the page. */
const soft = async <T,>(url: string): Promise<T[]> => {
    try {
        const { data } = await axiosInstance.get<T[]>(url);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

export const fetchWorkOrderDetail = async (
    id: string,
): Promise<{ workOrder: WorkOrderDetail; reports: ProgressReportRow[] } | null> => {
    let raw: RawWorkOrder;
    try {
        raw = (await axiosInstance.get<RawWorkOrder>(`/workorders/${id}`)).data;
    } catch {
        return null;
    }
    if (!raw?.id) return null;

    const [vendors, inspectors, milestones] = await Promise.all([
        soft<{ id: string; name?: string; vendorCode?: string; contactEmail?: string; email?: string }>('/vendors'),
        soft<{ id: string; userId?: string; name?: string; type?: string }>('/inspectors'),
        soft<Milestone>(`/execution/milestones?workOrderId=${id}`),
    ]);

    // A work order activates into one project, but the payload carries a list; read
    // reports for all of them so nothing is dropped if that ever changes.
    const reportLists = await Promise.all(
        (raw.projectIds ?? []).map(pid => soft<ProgressReportRow>(`/progressreports/project/${pid}`)),
    );
    const milestoneTitle = new Map(milestones.map(m => [m.id, m.title]));
    const reports = reportLists
        .flat()
        .map(r => ({
            ...r,
            remarks: r.remarks ?? r.inspectorRemarks,
            milestone: r.milestoneId
                ? { title: milestoneTitle.get(r.milestoneId) ?? 'Milestone' }
                : undefined,
        }))
        .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

    // ExecutionService returns milestones in insertion order, which is not schedule order
    // once any are added later. The detail pages number them 1..n as they render, so an
    // unsorted list labels the final milestone "2".
    milestones.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());

    const vendor = vendors.find(v => v.id === raw.vendorId);
    const inspector = raw.inspectorId
        ? inspectors.find(i => i.id === raw.inspectorId || i.userId === raw.inspectorId)
        : undefined;

    return {
        workOrder: {
            id: raw.id,
            workOrderNo: raw.workOrderNo ?? '—',
            status: raw.status ?? 'Unknown',
            totalValue: raw.totalValue ?? 0,
            scopeDescription: raw.scopeDescription || 'No scope recorded.',
            paymentTerms: raw.paymentTerms || 'Not specified.',
            liquidatedDamagesTerms: raw.liquidatedDamagesTerms || 'Not specified.',
            agreementDocumentUrl: raw.agreementDocumentUrl ?? '',
            startDate: raw.startDate ?? '',
            endDate: raw.endDate ?? '',
            tender: {
                title: raw.tender?.title ?? 'Untitled Tender',
                budget: raw.tender?.budget ?? 0,
                tenderNo: raw.tender?.tenderNo ?? '—',
            },
            vendor: {
                id: vendor?.id ?? raw.vendorId ?? '',
                name: vendor?.name ?? 'Unknown vendor',
                vendorCode: vendor?.vendorCode ?? '—',
                email: vendor?.contactEmail ?? vendor?.email ?? '—',
            },
            inspector: inspector ? { name: inspector.name ?? '—', type: inspector.type ?? '—' } : null,
            milestones,
        },
        reports,
    };
};
