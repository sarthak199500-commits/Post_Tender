/**
 * Composes the full detail view of a single project.
 *
 * GET /projects/{id} returns only the bare Project scalar (name, budget, progress,
 * status, workOrderId). Everything an admin actually wants to see on a project —
 * the contract terms, the vendor, the milestones, the evidence packages the vendor
 * submitted, progress reports, bills and documents — lives in three other services
 * and is joined here on the client, the same way api/workOrderDetails.ts does it.
 *
 * Every join degrades to an empty result rather than throwing, so one unauthorised
 * or missing sub-resource cannot blank the page.
 */
import axiosInstance from './axiosInstance';
import { fetchWorkOrderDetail } from './workOrderDetails';
import type { WorkOrderDetail, ProgressReportRow } from './workOrderDetails';
import type { Bill, Milestone } from '../types/domain';

/** A file attached to a vendor's milestone evidence package. */
export interface SubmissionDocument {
    id: string;
    name: string;
    type?: string;
    url?: string;
    size?: string;
    uploadedAt?: string;
}

/** The evidence package a vendor assembles for one milestone. */
export interface MilestoneSubmissionRow {
    id: string;
    milestoneId: string;
    projectId?: string;
    notes?: string;
    status: string;
    createdAt?: string;
    submittedAt?: string | null;
    isImmutable: boolean;
    linkedReportIds?: string[];
    documents?: SubmissionDocument[];
}

/** A document from the vendor's own repository (CommonService). */
export interface VendorDocumentRow {
    id: string;
    vendorId: string;
    name: string;
    type: string;
    size: string;
    url: string;
    uploadedAt: string;
    status: string;
}

export interface ProjectDetail {
    id: string;
    name: string;
    status: string;
    budget: number;
    utilized: number;
    financialUtilization: number;
    workOrder: WorkOrderDetail | null;
    milestones: Milestone[];
    /** Keyed by milestone id — a milestone with no package submitted yet is absent. */
    submissions: Record<string, MilestoneSubmissionRow>;
    reports: ProgressReportRow[];
    bills: Bill[];
    documents: VendorDocumentRow[];
}

interface RawProject {
    id: string;
    workOrderId?: string;
    name?: string;
    budget?: number;
    status?: string;
}

/** Resolves to [] instead of rejecting. */
const soft = async <T,>(url: string): Promise<T[]> => {
    try {
        const { data } = await axiosInstance.get<T[]>(url);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

export const fetchProjectDetail = async (id: string): Promise<ProjectDetail | null> => {
    let raw: RawProject;
    try {
        raw = (await axiosInstance.get<RawProject>(`/projects/${id}`)).data;
    } catch {
        return null;
    }
    if (!raw?.id) return null;

    // The work order carries the contract terms, the vendor and the milestones. Without
    // one there is nothing to join against, but the project itself still renders.
    const detail = raw.workOrderId ? await fetchWorkOrderDetail(raw.workOrderId) : null;
    const workOrder = detail?.workOrder ?? null;
    const milestones = workOrder?.milestones ?? [];

    const [rawReports, allBills, allDocuments] = await Promise.all([
        soft<ProgressReportRow>(`/progressreports/project/${raw.id}`),
        soft<Bill>('/bills'),
        soft<VendorDocumentRow>('/documents'),
    ]);

    // One request per milestone; the endpoint is keyed by milestone and there is no
    // by-project variant. Reviewers get every vendor's package, vendors only their own.
    const submissionLists = await Promise.all(
        milestones.map(m => soft<MilestoneSubmissionRow>(`/milestonesubmissions/milestone/${m.id}`)),
    );
    const submissions: Record<string, MilestoneSubmissionRow> = {};
    submissionLists.forEach((list, i) => {
        // Newest first, as the endpoint orders by CreatedAt descending.
        if (list.length > 0) submissions[milestones[i].id] = list[0];
    });

    // GET /progressreports/project/{id} returns the raw rows, so the milestone title and
    // the inspector's remarks are resolved here rather than read off the payload.
    const milestoneTitle = new Map(milestones.map(m => [m.id, m.title]));
    const reports = rawReports
        .map(r => ({
            ...r,
            remarks: r.remarks ?? r.inspectorRemarks,
            milestone: r.milestoneId
                ? { title: milestoneTitle.get(r.milestoneId) ?? 'Milestone' }
                : undefined,
        }))
        .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

    const bills = allBills
        .filter(b => b.workOrderId === raw.workOrderId)
        .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());

    // Documents are vendor-scoped in CommonService — there is no work-order link on the
    // record — so this is everything the vendor filed, not just this project's papers.
    const vendorId = workOrder?.vendor.id;
    const documents = vendorId ? allDocuments.filter(d => d.vendorId === vendorId) : [];

    const budget = raw.budget ?? workOrder?.totalValue ?? 0;
    const utilized = bills
        .filter(b => b.status === 'Paid')
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    return {
        id: raw.id,
        name: raw.name ?? 'Untitled project',
        status: raw.status ?? 'Unknown',
        budget,
        utilized,
        financialUtilization: budget > 0 ? Math.round((utilized / budget) * 100) : 0,
        workOrder,
        milestones,
        submissions,
        reports,
        bills,
        documents,
    };
};
