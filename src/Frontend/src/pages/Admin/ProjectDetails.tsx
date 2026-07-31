import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Paperclip,
  Receipt,
  Target,
} from 'lucide-react';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import { rupees, rupeesCompact } from '../../utils/currency';
import { fetchProjectDetail } from '../../api/projectDetails';
import type { ProjectDetail } from '../../api/projectDetails';
import { statusChipClass } from '../../utils/statusTone';

type TabKey = 'overview' | 'milestones' | 'reports' | 'documents' | 'bills';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const badge = (status: string) => statusChipClass(status);

/**
 * The files endpoint needs the bearer token, so a plain <a href> 401s. Fetch as a blob
 * (the axios interceptor attaches the token) and hand the browser a local object URL.
 */
const downloadFile = async (url: string, name: string) => {
  try {
    const path = url.replace(/^\/api/, '');   // baseURL already ends in /api
    const res = await axiosInstance.get(path, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error(e);
    alert('Failed to download the file.');
  }
};

const mediaUrl = (url: string) => (url.startsWith('http') ? url : `${GATEWAY_BASE}${url}`);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-card border border-slate-200 p-12 text-center text-slate-600">{children}</div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-card border border-slate-200 shadow-sm p-6">
    <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">{title}</h2>
    {children}
  </div>
);

export const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetchProjectDetail(id)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(err => { console.error(err); if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="text-slate-600">Loading project…</div>;
  if (!detail) return (
    <div>
      <Link to="/admin/projects" className="text-brand-700 font-bold text-sm hover:underline">&larr; Back to Execution</Link>
      <div className="mt-6 text-red-700 font-bold">Project not found.</div>
    </div>
  );

  const wo = detail.workOrder;
  const submissionCount = Object.keys(detail.submissions).length;

  // The badge counts files the tab actually offers, not packages: the agreement, every
  // document attached to a milestone package, and the vendor's repository.
  const packageDocumentCount = Object.values(detail.submissions)
    .reduce((sum, s) => sum + (s.documents?.length ?? 0), 0);
  const documentCount = (wo?.agreementDocumentUrl ? 1 : 0) + packageDocumentCount + detail.documents.length;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'milestones', label: 'Milestones', count: detail.milestones.length },
    { key: 'reports', label: 'Progress Reports', count: detail.reports.length },
    { key: 'documents', label: 'Documents', count: documentCount },
    { key: 'bills', label: 'Bills', count: detail.bills.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/projects" className="text-brand-700 font-bold text-sm hover:underline inline-flex items-center gap-1">
          &larr; Back to Execution
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-800">{detail.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge(detail.status)}`}>{detail.status}</span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {wo?.workOrderNo ?? '—'} · Vendor: <span className="font-medium text-slate-700">{wo?.vendor.name ?? 'Unknown vendor'}</span>
              {wo?.tender.title ? <> · Tender: <span className="font-medium text-slate-700">{wo.tender.title}</span></> : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Contract Value</p>
            <p className="text-2xl font-bold text-slate-800">{rupeesCompact(detail.budget)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-card border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2 text-sm font-medium text-slate-600">
            <Target className="w-4 h-4" />
            <span>Financial Utilization</span>
          </div>
          <span className="font-bold text-slate-800">{detail.financialUtilization}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${detail.financialUtilization}%` }} />
        </div>
        <p className="text-xs text-slate-600 mt-1">{rupeesCompact(detail.utilized)} of {rupeesCompact(detail.budget)} utilized</p>
      </div>

      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-2 text-xs font-bold text-slate-500">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Scope of Work">
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{wo?.scopeDescription ?? 'No work order linked to this project.'}</p>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Payment Terms">
                <p className="text-sm text-slate-600 leading-relaxed">{wo?.paymentTerms ?? '—'}</p>
              </Card>
              <Card title="Penalty / LD Terms">
                <p className="text-sm text-slate-600 leading-relaxed">{wo?.liquidatedDamagesTerms ?? '—'}</p>
              </Card>
            </div>
          </div>
          <div className="space-y-6">
            <Card title="Vendor">
              <div className="font-bold text-slate-800">{wo?.vendor.name ?? 'Unknown vendor'}</div>
              <div className="text-sm text-slate-600">{wo?.vendor.vendorCode ?? '—'}</div>
              <div className="text-sm text-slate-600 mt-1">{wo?.vendor.email ?? '—'}</div>
            </Card>
            <Card title="Assigned Inspector">
              <div className="font-bold text-slate-800">{wo?.inspector?.name ?? 'Unassigned'}</div>
              <div className="text-sm text-slate-600">{wo?.inspector?.type ?? ''}</div>
            </Card>
            <Card title="Execution Timeline">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="text-xs text-slate-600">Start Date</div>
                    <div className="font-semibold text-slate-800">{fmtDate(wo?.startDate)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="text-xs text-slate-600">Completion Deadline</div>
                    <div className="font-semibold text-slate-800">{fmtDate(wo?.endDate)}</div>
                  </div>
                </div>
              </div>
            </Card>
            {wo && (
              <Link
                to={`/admin/work-orders/${wo.id}`}
                className="flex items-center justify-center gap-2 w-full bg-white border border-slate-200 rounded-card px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open Work Order
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Milestones ───────────────────────────────────────────────────── */}
      {tab === 'milestones' && (
        detail.milestones.length === 0 ? <Empty>No milestones defined for this work order.</Empty> : (
          <div className="space-y-4">
            {detail.milestones.map((m, idx) => {
              const sub = detail.submissions[m.id];
              const overdue = m.status !== 'Completed' && !!m.targetDate && new Date(m.targetDate) < new Date();
              return (
                <div key={m.id} className="bg-white rounded-card border border-slate-200 shadow-sm p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {m.status === 'Completed'
                            ? <CheckCircle className="w-4 h-4 text-emerald-700" />
                            : <Clock className="w-4 h-4 text-slate-600" />}
                          <span className="font-semibold text-slate-800">{m.title}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Target {fmtDate(m.targetDate)}
                          {m.completionDate ? ` · Completed ${fmtDate(m.completionDate)}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-800">{m.weightage}%</div>
                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Weight</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-brand-700">{m.paymentPercentage}%</div>
                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Payout</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        overdue ? 'bg-red-100 text-red-700' : badge(m.status)
                      }`}>
                        {overdue ? 'Overdue' : m.status}
                      </span>
                    </div>
                  </div>

                  {/* The evidence package the vendor assembled for this milestone. */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    {sub ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge(sub.status)}`}>
                            Package {sub.status}
                          </span>
                          <span className="text-xs text-slate-600">
                            {sub.submittedAt ? `Submitted ${fmtDateTime(sub.submittedAt)}` : `Created ${fmtDateTime(sub.createdAt)}`}
                          </span>
                          <Link
                            to={`/inspector/milestones/${m.id}/submission?projectId=${detail.id}`}
                            className="ml-auto text-sm font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"
                          >
                            View submission <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        {sub.notes && (
                          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-card p-3 whitespace-pre-line">{sub.notes}</p>
                        )}
                        {sub.documents && sub.documents.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {sub.documents.map(d => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => d.url && downloadFile(d.url, d.name)}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-control px-3 py-2 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                {d.name}
                                {d.type ? <span className="text-slate-500 font-medium">· {d.type}</span> : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">No submission package filed by the vendor for this milestone yet.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Progress reports ─────────────────────────────────────────────── */}
      {tab === 'reports' && (
        detail.reports.length === 0 ? <Empty>The vendor has not submitted any progress reports on this project.</Empty> : (
          <div className="space-y-4">
            {detail.reports.map(r => (
              <div key={r.id} className="bg-white rounded-card border border-slate-200 shadow-sm p-6">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <div className="text-xs text-slate-600">Reported on</div>
                    <div className="font-semibold text-slate-800">{fmtDateTime(r.reportedAt)}</div>
                    {r.milestone && <div className="text-sm font-semibold text-brand-700 mt-1">Milestone: {r.milestone.title}</div>}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge(r.status)}`}>{r.status}</span>
                </div>

                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-card p-3 mt-4 whitespace-pre-line">{r.workDescription}</p>

                {r.remarks && (
                  <div className="mt-3">
                    <div className="text-[10px] text-orange-700 font-bold uppercase tracking-widest mb-1">Inspector Remarks</div>
                    <p className="text-sm text-orange-800 bg-orange-50 border border-orange-100 rounded-card p-3">{r.remarks}</p>
                  </div>
                )}

                {r.mediaUrls && r.mediaUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.mediaUrls.map((url, i) => (
                      <a
                        key={i}
                        href={mediaUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-control px-3 py-2 hover:bg-brand-100 transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Photo {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Documents ────────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="space-y-6">
          {wo?.agreementDocumentUrl && (
            <Card title="Contract Document">
              <button
                type="button"
                onClick={() => downloadFile(wo.agreementDocumentUrl, `${wo.workOrderNo}-agreement`)}
                className="flex items-center gap-3 p-3 bg-brand-50 rounded-card text-brand-700 hover:bg-brand-100 transition-colors w-full text-left"
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm">Signed Agreement</div>
                  <div className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Work order {wo.workOrderNo}</div>
                </div>
                <Download className="w-4 h-4 ml-auto" />
              </button>
            </Card>
          )}

          <Card title="Milestone Submission Documents">
            {submissionCount === 0 ? (
              <p className="text-sm text-slate-600">No milestone packages submitted yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {detail.milestones.map(m => {
                  const sub = detail.submissions[m.id];
                  if (!sub || !sub.documents || sub.documents.length === 0) return null;
                  return (
                    <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="text-sm font-semibold text-slate-800 mb-2">{m.title}</div>
                      <div className="flex flex-wrap gap-2">
                        {sub.documents.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => d.url && downloadFile(d.url, d.name)}
                            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-control px-3 py-2 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {d.name}
                            {d.type ? <span className="text-slate-500 font-medium">· {d.type}</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* CommonService keys documents to the vendor, not the work order, so this is the
              vendor's whole repository rather than a project-specific folder. */}
          <Card title="Vendor Document Repository">
            {detail.documents.length === 0 ? (
              <p className="text-sm text-slate-600">This vendor has not uploaded any documents.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100">
                      <th className="py-2 pr-4">Document</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Uploaded</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.documents.map(d => (
                      <tr key={d.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-800 text-sm">{d.name || d.url.split('/').pop()}</div>
                          <div className="text-xs text-slate-600">{d.size}</div>
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-600">{d.type}</td>
                        <td className="py-3 pr-4 text-sm text-slate-600">{fmtDate(d.uploadedAt)}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badge(d.status)}`}>
                            {d.status || 'Uploaded'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadFile(d.url, d.name)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
                          >
                            <Download className="w-4 h-4" /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Bills ────────────────────────────────────────────────────────── */}
      {tab === 'bills' && (
        detail.bills.length === 0 ? <Empty>No bills raised against this work order.</Empty> : (
          <div className="bg-white rounded-card border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100">
                    <th className="p-4">Bill</th>
                    <th className="p-4">Submitted</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.bills.map(b => (
                    <tr key={b.id} className="border-b border-slate-50 last:border-0">
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                          <Receipt className="w-4 h-4 text-slate-500" /> {b.billNo}
                        </div>
                        {b.type && <div className="text-xs text-slate-600 mt-0.5">{b.type}</div>}
                        {b.rejectionReason && (
                          <div className="text-xs text-red-700 mt-1 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {b.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-600">{fmtDate(b.submittedAt)}</td>
                      <td className="p-4 text-right text-sm font-bold text-slate-800">
                        <span className="inline-flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />{rupees(b.amount).replace('₹', '')}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badge(b.status)}`}>{b.status}</span>
                      </td>
                      <td className="p-4 text-right">
                        {b.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => downloadFile(b.attachmentUrl!, `${b.billNo}`)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
                          >
                            <Download className="w-4 h-4" /> Download
                          </button>
                        ) : <span className="text-sm text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};
