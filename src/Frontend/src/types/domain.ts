/**
 * Shared shapes for API entities as the frontend consumes them.
 *
 * These mirror the JSON the services return (camelCase of the C# entities) but only
 * declare the fields pages actually read — extra fields arriving from the API are
 * fine. Most reference fields are optional because different endpoints return the
 * same entity with different levels of enrichment.
 */

export interface Vendor {
    id: string;
    userId?: string;
    name: string;
    vendorCode?: string;
    gstNo?: string;
    email?: string;
    contactEmail?: string;
    authPersonName?: string;
    status?: string;
    performanceScore?: number;
}

export interface Milestone {
    id: string;
    workOrderId?: string;
    projectId?: string;
    title: string;
    weightage: number;
    paymentPercentage: number;
    targetDate: string;
    status: string;
    completionDate?: string | null;
}

export interface WorkOrder {
    id: string;
    workOrderNo: string;
    tenderId?: string;
    vendorId?: string;
    inspectorId?: string;
    status: string;
    totalValue: number;
    scopeDescription?: string;
    paymentTerms?: string;
    liquidatedDamagesTerms?: string;
    agreementDocumentUrl?: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    milestones?: Milestone[];
}

export interface Project {
    id: string;
    workOrderId?: string;
    name: string;
    status?: string;
    budget?: number;
    utilized?: number;
    ldAmount?: number;
    vendorName?: string;
    workOrderNo?: string;
    endDate?: string;
    milestones?: Milestone[];
    workOrder?: WorkOrder;
}

export interface Bill {
    id: string;
    billNo: string;
    workOrderId?: string;
    vendorId?: string;
    type?: string;
    status: string;
    amount: number;
    taxAmount?: number;
    attachmentUrl?: string;
    submittedAt?: string;
    paidAt?: string;
    paymentVoucherNo?: string | null;
    reasonReturned?: string | null;
    milestoneIds?: string[];
}

export interface ProgressReport {
    id: string;
    projectId: string;
    vendorId?: string;
    milestoneId?: string | null;
    workDescription: string;
    latitude?: number;
    longitude?: number;
    mediaUrls?: string[];
    reportedAt: string;
    status: string;
    remarks?: string;
    recommendation?: string;
}

export interface QueryMessage {
    id: string;
    senderName: string;
    senderRole: string;
    content: string;
    timestamp: string;
}

export interface QueryThread {
    id: string;
    vendorId?: string;
    subject: string;
    status: string;
    createdAt: string;
    messages?: QueryMessage[];
}

export interface InspectionDefect {
    id: string;
    description: string;
    severity: string;
    status: string;
    reworkReportUrl?: string;
}

export interface Inspection {
    id: string;
    projectId?: string;
    projectName?: string;
    inspectionDate?: string;
    remarks?: string;
    status: string;
    defects?: InspectionDefect[];
}

export interface InspectionVisit {
    id: string;
    workOrderId?: string;
    inspectorId?: string;
    scheduledDate: string;
    actualVisitDate?: string | null;
    purpose?: string;
    remarks?: string;
    status: string;
}

export interface Inspector {
    id: string;
    userId?: string;
    name: string;
    type?: string;
    companyName?: string;
    email?: string;
}

export interface TenderAllotment {
    id: string;
    tenderId: string;
    tenderNo?: string;
    tenderTitle?: string;
    tenderBudget?: number;
    l1VendorId?: string | null;
    l1VendorName?: string | null;
    l2VendorId?: string | null;
    l2VendorName?: string | null;
    l3VendorId?: string | null;
    l3VendorName?: string | null;
    createdAt?: string;
}
