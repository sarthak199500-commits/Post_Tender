import React from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from './store';
import { logout } from './store/authSlice';
import { fetchNotifications, timeAgo } from './api/notificationsService';
import type { AppNotification, NotificationType } from './api/notificationsService';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import logoWhite from './assets/logo-white.png';
import { VendorDirectory } from './pages/Vendors/VendorDirectory';
import { CreateWorkOrderForm } from './pages/WorkOrders/CreateWorkOrderForm';
import { VendorWorkOrderView } from './pages/WorkOrders/VendorWorkOrderView';
import { AdminBilling } from './pages/Admin/AdminBilling';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AwardedTenders } from './pages/Admin/AwardedTenders';
import { GlobalProjects } from './pages/Admin/GlobalProjects';
import { AdminMilestoneApprovals } from './pages/Admin/AdminMilestoneApprovals';
import { AuditLogs } from './pages/Admin/AuditLogs';
import { ReportsMIS } from './pages/Admin/ReportsMIS';
import { WorkOrderManagement } from './pages/Admin/WorkOrderManagement';
import { WorkOrderDetails } from './pages/Admin/WorkOrderDetails';
import { AddVendorCategory } from './pages/Admin/AddVendorCategory';
import { AddVendor } from './pages/Admin/AddVendor';
import { AddTender } from './pages/Admin/AddTender';
import { AllottedTenders } from './pages/Admin/AllottedTenders';
import AddInspector from './pages/Admin/AddInspector';
import TenderTypeMaster from './pages/Admin/TenderTypeMaster';
import TenderList from './pages/Admin/TenderList';
import InspectorList from './pages/Admin/InspectorList';
import DepartmentMaster from './pages/Admin/Masters/DepartmentMaster';
import LocationMaster from './pages/Admin/Masters/LocationMaster';
import DefectCategoryMaster from './pages/Admin/Masters/DefectCategoryMaster';
import MilestoneTemplateMaster from './pages/Admin/Masters/MilestoneTemplateMaster';
import TaxConfigurationMaster from './pages/Admin/Masters/TaxConfigurationMaster';
import { Settings } from './pages/Admin/Settings';
import { AdminPayments } from './pages/Admin/AdminPayments';
import { AdminDocuments } from './pages/Admin/AdminDocuments';
import { AdminAlerts } from './pages/Admin/AdminAlerts';
import { RaiseAlert } from './pages/Admin/RaiseAlert';
import { GenerateReport } from './pages/Admin/GenerateReport';
import { AdminQueries } from './pages/Admin/AdminQueries';
import { AddInternalUser } from './pages/Admin/AddInternalUser';
import { InternalUsersList } from './pages/Admin/InternalUsersList';

import { VendorDashboard } from './pages/Vendor/VendorDashboard';
import { BillingClaims } from './pages/Vendor/BillingClaims';
import { QualityDefects } from './pages/Vendor/QualityDefects';
import { ProgressReporting } from './pages/Vendor/ProgressReporting';
import { MilestoneUpdates } from './pages/Vendor/MilestoneUpdates';
import { DocumentUploads } from './pages/Vendor/DocumentUploads';
import { QueriesClarifications } from './pages/Vendor/QueriesClarifications';
import { ProgressHistory } from './pages/Vendor/ProgressHistory';
import { MilestoneSubmissionPage } from './pages/Vendor/MilestoneSubmissionPage';

import InspectorDashboard from './pages/Inspector/InspectorDashboard';
import InspectorWorkOrders from './pages/Inspector/InspectorWorkOrders';
import InspectorVisits from './pages/Inspector/InspectorVisits';
import ProgressReview from './pages/Inspector/ProgressReview';
import InspectorWorkOrderDetails from './pages/Inspector/InspectorWorkOrderDetails';
import ReviewReportDetail from './pages/Inspector/ReviewReportDetail';
import { InspectorDefects } from './pages/Inspector/InspectorDefects';

import DepartmentDashboard from './pages/Department/DepartmentDashboard';
import { FinancialDashboard } from './pages/Finance/FinancialDashboard';

const PrivateRoute = ({ children, roles }: { children: React.ReactElement, roles?: string[] }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role as string)) return <Navigate to="/" replace />;

  return children;
};

const DashboardHome = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  if (user?.role === 'Admin' || user?.role === 'PMU') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user?.role === 'Vendor') {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  if (user?.role === 'Department') {
    return <Navigate to="/department/dashboard" replace />;
  }

  if (user?.role === 'Finance') {
    return <Navigate to="/finance/dashboard" replace />;
  }

  return (
    <div className="p-12 h-full bg-slate-50 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-extrabold text-blue-600 mb-4 tracking-tight">Welcome, {user?.name}</h1>
      <p className="text-xl text-slate-500 max-w-2xl text-center leading-relaxed">
        You are logged in as <strong className="text-slate-800">{user?.role}</strong>.
      </p>
    </div>
  );
};

interface NavItemProps {
  to?: string;
  icon: React.ReactNode;
  text: string;
  hasChevron?: boolean;
  indent?: boolean;
  onChevronClick?: () => void;
  chevronRotated?: boolean;
  onClick?: () => void;
  active?: boolean;
}

const NavItem = ({ to, icon, text, hasChevron = false, indent = false, onChevronClick, chevronRotated, onClick, active }: NavItemProps) => {
  const location = useLocation();
  const isActive = active !== undefined ? active : (to ? (location.pathname === to || (location.pathname.startsWith(to + '/') && !location.pathname.startsWith(to + '/history'))) : false);

  const content = (
    <>
      <div className="nav-l">
        <div className="nav-ic">{icon}</div>
        {text}
      </div>
      {hasChevron && (
        <div
          onClick={onChevronClick ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            onChevronClick();
          } : undefined}
          style={{
            transform: (hasChevron && chevronRotated) ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: onChevronClick ? '4px' : '0px',
            marginRight: onChevronClick ? '-4px' : '0px',
            cursor: onChevronClick ? 'pointer' : 'default'
          }}
        >
          <svg className="nav-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}
    </>
  );

  if (!to) {
    return (
      <div onClick={onClick} className={`nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', paddingLeft: indent ? '42px' : '14px' }}>
        {content}
      </div>
    );
  }

  return (
    <Link to={to} onClick={onClick} className={`nav-item ${isActive ? 'active' : ''}`} style={{ textDecoration: 'none', paddingLeft: indent ? '42px' : '14px' }}>
      {content}
    </Link>
  );
};

const NOTIF_DOT: Record<NotificationType, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#10b981',
};

// Header title/subtitle per route so the topbar reflects the current page
// instead of always reading "Dashboard".
const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': { title: 'Dashboard', subtitle: 'Real-time overview of all tenders' },
  '/admin/work-orders': { title: 'Work Orders', subtitle: 'Manage and track all work orders' },
  '/admin/work-orders/new': { title: 'Create Work Order', subtitle: 'Issue a new work order to a vendor' },
  '/admin/tenders/awarded': { title: 'Awarded Tenders', subtitle: 'Tenders awarded and ready for execution' },
  '/admin/projects': { title: 'Execution & Progress', subtitle: 'Live view of project execution' },
  '/admin/milestone-approvals': { title: 'Milestone Approvals', subtitle: 'Review and approve submitted milestones' },
  '/admin/audit-logs': { title: 'Audit Logs', subtitle: 'System activity and change history' },
  '/admin/reports': { title: 'Reports & MIS', subtitle: 'Analytics and management reports' },
  '/admin/reports/generate': { title: 'Generate Report', subtitle: 'Build a custom report' },
  '/admin/billing': { title: 'Billing', subtitle: 'Vendor bills and claims' },
  '/admin/payments': { title: 'Payments', subtitle: 'Disbursements and payment tracking' },
  '/admin/documents': { title: 'Documents', subtitle: 'Uploaded documents and agreements' },
  '/admin/alerts': { title: 'Alerts', subtitle: 'System and project alerts' },
  '/admin/alerts/raise': { title: 'Raise Alert', subtitle: 'Publish a new alert' },
  '/admin/queries': { title: 'Queries & Clarifications', subtitle: 'Vendor queries and responses' },
  '/admin/settings': { title: 'Settings', subtitle: 'Configure your workspace' },
  '/vendors': { title: 'Vendor Directory', subtitle: 'All registered vendors' },
  '/admin/masters/vendor-categories': { title: 'Vendor Categories', subtitle: 'Manage vendor category master' },
  '/admin/masters/vendors/add': { title: 'Add Vendor', subtitle: 'Register a new vendor' },
  '/admin/masters/tenders': { title: 'Tender List', subtitle: 'All tenders in the system' },
  '/admin/masters/tenders/add': { title: 'Add Tender', subtitle: 'Create a new tender' },
  '/admin/masters/tender-types': { title: 'Tender Types', subtitle: 'Manage tender type master' },
  '/admin/masters/inspectors': { title: 'Inspectors', subtitle: 'Manage inspector master' },
  '/admin/masters/inspectors/add': { title: 'Add Inspector', subtitle: 'Register a new inspector' },
  '/admin/masters/users': { title: 'Internal Users', subtitle: 'Staff accounts for Admin, PMU, Finance and Department' },
  '/admin/masters/users/add': { title: 'Add Internal User', subtitle: 'Create an internal user account' },
  '/admin/masters/departments': { title: 'Departments', subtitle: 'Manage department master' },
  '/admin/masters/locations': { title: 'Locations', subtitle: 'Manage location master' },
  '/admin/masters/defect-categories': { title: 'Defect Categories', subtitle: 'Manage defect category master' },
  '/admin/masters/milestone-templates': { title: 'Milestone Templates', subtitle: 'Reusable milestone templates' },
  '/admin/masters/tax-configurations': { title: 'Tax Configurations', subtitle: 'Manage tax configuration master' },
  '/vendor/dashboard': { title: 'Dashboard', subtitle: 'Your work orders and progress at a glance' },
  '/vendor/work-orders': { title: 'Work Orders', subtitle: 'Work orders assigned to you' },
  '/vendor/bills': { title: 'Bill Submission', subtitle: 'Submit and track your bills' },
  '/vendor/defects': { title: 'Quality Defects', subtitle: 'Reported defects and resolutions' },
  '/vendor/progress': { title: 'Progress Reporting', subtitle: 'Report progress on your projects' },
  '/vendor/progress/history': { title: 'Progress History', subtitle: 'Your submitted progress reports' },
  '/vendor/milestones': { title: 'Milestone Updates', subtitle: 'Update and submit your milestones' },
  '/vendor/documents': { title: 'Document Uploads', subtitle: 'Upload required documents' },
  '/vendor/queries': { title: 'Queries & Clarifications', subtitle: 'Raise and track your queries' },
  '/inspector/dashboard': { title: 'Dashboard', subtitle: 'Your inspection assignments' },
  '/inspector/work-orders': { title: 'Work Orders', subtitle: 'Work orders assigned for inspection' },
  '/inspector/progress-review': { title: 'Progress Review', subtitle: 'Review vendor progress submissions' },
  '/inspector/visits': { title: 'Audit Visits', subtitle: 'Scheduled and completed site visits' },
  '/inspector/defects': { title: 'Quality Defects', subtitle: 'Defects raised during inspection' },
  '/department/dashboard': { title: 'Dashboard', subtitle: 'Department overview' },
  '/finance/dashboard': { title: 'Dashboard', subtitle: 'Financial overview' },
};

const prettifySegment = (seg: string) =>
  seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getPageMeta = (pathname: string): { title: string; subtitle: string } => {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // Strip trailing dynamic/id segments (e.g. /admin/work-orders/42) and retry.
  const parts = pathname.split('/').filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const candidate = '/' + parts.join('/');
    if (PAGE_META[candidate]) return PAGE_META[candidate];
  }
  const last = pathname.split('/').filter(Boolean).pop();
  return { title: last ? prettifySegment(last) : 'Dashboard', subtitle: '' };
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const [progressCollapsed, setProgressCollapsed] = React.useState(!location.pathname.startsWith('/vendor/progress'));
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(true);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const userRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const pageMeta = getPageMeta(location.pathname);
  const isAdminLike = user?.role === 'Admin' || user?.role === 'PMU';

  // Derived from live service data — see api/notificationsService.ts. Cached for
  // 60s there, so the remount on every route change doesn't refetch.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setNotifLoading(true);
    fetchNotifications(user.role, user.id)
      .then(list => { if (!cancelled) setNotifications(list); })
      .finally(() => { if (!cancelled) setNotifLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // Close either dropdown when clicking outside it.
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotifications(false);
      if (userRef.current && !userRef.current.contains(target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // All reference/master data lives under one "Masters" group (centralized IA).
  const collapsibleMastersRoutes = [
    '/admin/masters/tender-types',
    '/admin/masters/vendor-categories',
    '/admin/masters/tax-configurations',
    '/admin/masters/locations',
    '/admin/masters/departments',
    '/admin/masters/defect-categories',
    '/admin/masters/milestone-templates'
  ];
  const isMastersRouteActive = collapsibleMastersRoutes.some(route => location.pathname === route);
  const [mastersCollapsed, setMastersCollapsed] = React.useState(!isMastersRouteActive);

  // Domain groups now hold operational views only — masters moved out.
  const collapsibleTenderRoutes = [
    '/admin/masters/tenders',
    '/admin/masters/tenders/add',
    '/admin/tenders/awarded'
  ];
  const isTenderRouteActive = collapsibleTenderRoutes.some(route => location.pathname === route);
  const [tendersCollapsed, setTendersCollapsed] = React.useState(!isTenderRouteActive);

  const collapsibleVendorRoutes = [
    '/vendors'
  ];
  const isVendorRouteActive = collapsibleVendorRoutes.some(route => location.pathname === route);
  const [vendorsCollapsed, setVendorsCollapsed] = React.useState(!isVendorRouteActive);

  const collapsibleUsersRoutes = [
    '/admin/masters/users',
    '/admin/masters/users/add',
    '/admin/masters/inspectors'
  ];
  const isUsersRouteActive = collapsibleUsersRoutes.some(route => location.pathname === route);
  const [usersCollapsed, setUsersCollapsed] = React.useState(!isUsersRouteActive);

  const collapsibleFinancialsRoutes = [
    '/admin/billing',
    '/admin/payments'
  ];
  const isFinancialsRouteActive = collapsibleFinancialsRoutes.some(route => location.pathname === route);
  const [financialsCollapsed, setFinancialsCollapsed] = React.useState(!isFinancialsRouteActive);

  const collapsibleExecutionRoutes = [
    '/admin/projects',
    '/admin/milestone-approvals'
  ];
  const isExecutionRouteActive = collapsibleExecutionRoutes.some(route => location.pathname === route);
  const [executionCollapsed, setExecutionCollapsed] = React.useState(!isExecutionRouteActive);

  React.useEffect(() => {
    if (location.pathname.startsWith('/vendor/progress')) {
      setProgressCollapsed(false);
    }
    // Close the mobile drawer whenever the route changes (e.g. a nav link tap).
    setMobileNavOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const activeMasters = collapsibleMastersRoutes.some(route => location.pathname === route);
    if (activeMasters) setMastersCollapsed(false);

    const activeTender = collapsibleTenderRoutes.some(route => location.pathname === route);
    if (activeTender) setTendersCollapsed(false);

    const activeVendor = collapsibleVendorRoutes.some(route => location.pathname === route);
    if (activeVendor) setVendorsCollapsed(false);

    const activeUsers = collapsibleUsersRoutes.some(route => location.pathname === route);
    if (activeUsers) setUsersCollapsed(false);

    const activeFinancials = collapsibleFinancialsRoutes.some(route => location.pathname === route);
    if (activeFinancials) setFinancialsCollapsed(false);

    const activeExecution = collapsibleExecutionRoutes.some(route => location.pathname === route);
    if (activeExecution) setExecutionCollapsed(false);
    // The route arrays are stable per-render literals; only the pathname matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {user && (
        <div
          className={`sidebar-backdrop ${mobileNavOpen ? 'open' : ''}`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      {user && (
        <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
          <Link to="/" className="sb-logo" style={{ textDecoration: 'none' }}>
            <div className="flex items-center justify-center w-full py-2">
              <img src={logoWhite} alt="Post Tender Logo" className="w-48 h-auto object-contain drop-shadow-md" />
            </div>
          </Link>
          <nav className="sb-nav">
            {user.role === 'Admin' || user.role === 'PMU' ? (
              <>
                <NavItem to="/admin/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/admin/work-orders" text="Work Orders" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>} />
                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></svg>}
                  text="Tenders"
                  hasChevron={true}
                  chevronRotated={!tendersCollapsed}
                  active={isTenderRouteActive}
                  onClick={() => setTendersCollapsed(prev => !prev)}
                />
                {!tendersCollapsed && (
                  <>
                    <NavItem to="/admin/masters/tenders" text="Tender List" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>} />

                    <NavItem to="/admin/tenders/awarded" text="Awarded Tenders" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
                  </>
                )}
                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  text="Vendors"
                  hasChevron={true}
                  chevronRotated={!vendorsCollapsed}
                  active={isVendorRouteActive}
                  onClick={() => setVendorsCollapsed(prev => !prev)}
                />
                {!vendorsCollapsed && (
                  <>
                    <NavItem to="/vendors" text="Vendor Directory" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                  text="Execution & Progress"
                  hasChevron={true}
                  chevronRotated={!executionCollapsed}
                  active={isExecutionRouteActive}
                  onClick={() => setExecutionCollapsed(prev => !prev)}
                />
                {!executionCollapsed && (
                  <>
                    <NavItem to="/admin/projects" text="Execution" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                    <NavItem to="/admin/milestone-approvals" text="Milestone Approvals" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
                  text="Financials"
                  hasChevron={true}
                  chevronRotated={!financialsCollapsed}
                  active={isFinancialsRouteActive}
                  onClick={() => setFinancialsCollapsed(prev => !prev)}
                />
                {!financialsCollapsed && (
                  <>
                    <NavItem to="/admin/billing" text="Billing" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>} />
                    <NavItem to="/admin/payments" text="Payments" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  text="Users"
                  hasChevron={true}
                  chevronRotated={!usersCollapsed}
                  active={isUsersRouteActive}
                  onClick={() => setUsersCollapsed(prev => !prev)}
                />
                {!usersCollapsed && (
                  <>
                    <NavItem to="/admin/masters/users" text="Internal Users" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>} />
                    <NavItem to="/admin/masters/inspectors" text="Inspectors" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>}
                  text="Masters"
                  hasChevron={true}
                  chevronRotated={!mastersCollapsed}
                  active={isMastersRouteActive}
                  onClick={() => setMastersCollapsed(prev => !prev)}
                />
                {!mastersCollapsed && (
                  <>
                    <NavItem to="/admin/masters/tender-types" text="Tender Types" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>} />
                    <NavItem to="/admin/masters/vendor-categories" text="Vendor Categories" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} />
                    <NavItem to="/admin/masters/tax-configurations" text="Tax Configurations" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></svg>} />
                    <NavItem to="/admin/masters/locations" text="Locations" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>} />
                    <NavItem to="/admin/masters/departments" text="Departments" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>} />
                    <NavItem to="/admin/masters/defect-categories" text="Defect Categories" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
                    <NavItem to="/admin/masters/milestone-templates" text="Milestone Templates" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>} />
                  </>
                )}

                <NavItem to="/admin/reports" text="Reports" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>} />
                <NavItem to="/admin/queries" text="Queries & Clarif." icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>} />
                <NavItem to="/admin/alerts" text="Alerts" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>} />
                <NavItem to="/admin/documents" text="Documents" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>} />
                <NavItem to="/admin/audit-logs" text="Audit Logs" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>} />
                <NavItem to="/admin/settings" text="Settings" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>} />

                <div className="pt-5 pb-2 px-4 mt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.14em]">Quick Actions</span>
                </div>


                <NavItem to="/admin/alerts/raise" text="Raise Alert" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
                <NavItem to="/admin/reports/generate" text="Generate Report" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21" /><path d="M16 16l-4-4-4 4" /></svg>} />
              </>
            ) : user.role === 'Inspector' ? (
              <>
                <NavItem to="/inspector/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/inspector/work-orders" text="Work Orders" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>} />
                <NavItem to="/inspector/progress-review" text="Progress Review" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
                <NavItem to="/inspector/visits" text="Audit Visits" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>} />
                <NavItem to="/inspector/defects" text="Quality Defects" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
              </>
            ) : user.role === 'Department' ? (
              <>
                <NavItem to="/department/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/admin/work-orders" text="Work Orders" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>} />
                <NavItem to="/admin/milestone-approvals" text="Milestone Approvals" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
                <NavItem to="/admin/reports" text="Reports" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>} />
                <NavItem to="/admin/audit-logs" text="Audit Logs" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>} />
              </>
            ) : user.role === 'Finance' ? (
              <>
                <NavItem to="/finance/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/admin/reports" text="Reports" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>} />
                <NavItem to="/admin/audit-logs" text="Audit Logs" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>} />
              </>
            ) : (
              <>
                <NavItem to="/vendor/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/vendor/work-orders" text="Work Orders" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>} />
                <NavItem
                  to="/vendor/progress"
                  text="Progress Reporting"
                  hasChevron
                  chevronRotated={!progressCollapsed}
                  onChevronClick={() => setProgressCollapsed(prev => !prev)}
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                />
                {!progressCollapsed && (
                  <NavItem to="/vendor/progress/history" text="Progress History" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
                )}
                <NavItem to="/vendor/milestones" text="Milestone Updates" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>} />
                <NavItem to="/vendor/documents" text="Document Uploads" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>} />
                <NavItem to="/vendor/bills" text="Bill Submission" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>} />
                <NavItem to="/vendor/defects" text="Quality Defects" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
                <NavItem to="/vendor/queries" text="Queries & Clarif." icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>} />
              </>
            )}
          </nav>
        </aside>
      )}

      <div className="main-wrapper">
        <header className="topbar">
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div className="pg-meta">
            <div id="page-title" className="text-2xl font-bold text-slate-800 tracking-tight">{pageMeta.title}</div>
            <p id="page-subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className="top-ctrls">
            <div className="notif-wrap relative" ref={notifRef}>
              <div className="notif-btn cursor-pointer" onClick={() => setShowNotifications(v => !v)} role="button" aria-label="Notifications">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                {notifications.length > 0 && (
                  <>
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" style={{ animation: 'pulseRing 2s ease-out infinite' }}></div>
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
                  </>
                )}
              </div>
              {showNotifications && (
                <div className="topbar-dropdown absolute right-0 mt-2 w-80 bg-white rounded-2xl z-50 overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', animation: 'scaleIn 0.2s ease both', transformOrigin: 'top right' }}>
                  <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(0,0,0,0.04)', background: 'linear-gradient(to bottom, #f8f9fc, #fff)' }}>
                    <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{notifications.length} active</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifLoading && (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">Loading…</div>
                    )}
                    {!notifLoading && notifications.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">You're all caught up.</div>
                    )}
                    {!notifLoading && notifications.slice(0, 12).map(n => (
                      <div
                        key={n.id}
                        onClick={() => { setShowNotifications(false); if (n.link) navigate(n.link); }}
                        className="p-4 hover:bg-blue-50/40 cursor-pointer transition-colors flex gap-3"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}
                      >
                        <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: NOTIF_DOT[n.type] }} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                          {n.timestamp && <span className="text-[10px] text-slate-400 font-bold mt-2 block">{timeAgo(n.timestamp)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isAdminLike && (
                    <div
                      onClick={() => { setShowNotifications(false); navigate('/admin/alerts'); }}
                      className="p-3 text-center cursor-pointer transition-colors hover:bg-blue-50/50"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.04)', background: 'linear-gradient(to top, #f8f9fc, #fff)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: '#4f6ef7' }}>View All Alerts</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="notif-wrap relative" ref={userRef}>
              <div className="user-block" onClick={() => setShowUserMenu(v => !v)} role="button" aria-label="Account menu">
                <div className="user-av">{user?.name?.substring(0, 2).toUpperCase() || 'US'}</div>
                <div>
                  <div className="user-nm">{user?.name || 'User'}</div>
                  <div className="user-rl">{user?.role || 'Guest'}</div>
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {showUserMenu && (
                <div className="topbar-dropdown absolute right-0 mt-2 w-60 bg-white rounded-2xl z-50 overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', animation: 'scaleIn 0.2s ease both', transformOrigin: 'top right' }}>
                  <div className="p-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'linear-gradient(to bottom, #f8f9fc, #fff)' }}>
                    <p className="text-sm font-bold text-slate-800 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>{user?.role}</span>
                  </div>
                  {isAdminLike && (
                    <div
                      onClick={() => { setShowUserMenu(false); navigate('/admin/settings'); }}
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50/50 transition-colors text-sm font-semibold text-slate-700"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                      Settings
                    </div>
                  )}
                  <div
                    onClick={() => { setShowUserMenu(false); dispatch(logout()); navigate('/login'); }}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-red-50 transition-colors text-sm font-semibold text-red-600"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Log out
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content" tabIndex={0}>
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout><DashboardHome /></Layout></PrivateRoute>} />
      <Route path="/admin/dashboard" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminDashboard /></Layout></PrivateRoute>} />
      <Route path="/admin/tenders/awarded" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AwardedTenders /></Layout></PrivateRoute>} />
      <Route path="/admin/projects" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><GlobalProjects /></Layout></PrivateRoute>} />
      {/* Department too — POST /execution/milestones/{id}/approve already accepts it. */}
      <Route path="/admin/milestone-approvals" element={<PrivateRoute roles={['Admin', 'PMU', 'Department']}><Layout><AdminMilestoneApprovals /></Layout></PrivateRoute>} />
      <Route path="/admin/work-orders" element={<PrivateRoute roles={['Admin', 'PMU', 'Department', 'Finance']}><Layout><WorkOrderManagement /></Layout></PrivateRoute>} />
      <Route path="/admin/work-orders/:id" element={<PrivateRoute roles={['Admin', 'PMU', 'Department', 'Finance']}><Layout><WorkOrderDetails /></Layout></PrivateRoute>} />
      <Route path="/admin/audit-logs" element={<PrivateRoute roles={['Admin', 'PMU', 'Department', 'Finance']}><Layout><AuditLogs /></Layout></PrivateRoute>} />
      <Route path="/admin/reports" element={<PrivateRoute roles={['Admin', 'PMU', 'Department', 'Finance']}><Layout><ReportsMIS /></Layout></PrivateRoute>} />
      <Route path="/admin/billing" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminBilling /></Layout></PrivateRoute>} />
      <Route path="/vendors" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><VendorDirectory /></Layout></PrivateRoute>} />
      <Route path="/admin/work-orders/new" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><CreateWorkOrderForm /></Layout></PrivateRoute>} />
      <Route path="/admin/settings" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="/admin/payments" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminPayments /></Layout></PrivateRoute>} />
      <Route path="/admin/documents" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminDocuments /></Layout></PrivateRoute>} />
      <Route path="/admin/alerts" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminAlerts /></Layout></PrivateRoute>} />
      <Route path="/admin/alerts/raise" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><RaiseAlert /></Layout></PrivateRoute>} />
      <Route path="/admin/reports/generate" element={<PrivateRoute roles={['Admin', 'PMU', 'Department', 'Finance']}><Layout><GenerateReport /></Layout></PrivateRoute>} />
      <Route path="/admin/queries" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminQueries /></Layout></PrivateRoute>} />

      {/* Masters Routes */}
      <Route path="/admin/masters/vendor-categories" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddVendorCategory /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/vendors/add" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddVendor /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/tenders/add" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddTender /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/allotted-tenders" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AllottedTenders /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/tender-types" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><TenderTypeMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/tenders" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><TenderList /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/tenders/edit/:id" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddTender /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/inspectors" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><InspectorList /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/inspectors/add" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddInspector /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/users" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><InternalUsersList /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/users/add" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AddInternalUser /></Layout></PrivateRoute>} />

      <Route path="/admin/masters/departments" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><DepartmentMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/locations" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><LocationMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/defect-categories" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><DefectCategoryMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/milestone-templates" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><MilestoneTemplateMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/tax-configurations" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><TaxConfigurationMaster /></Layout></PrivateRoute>} />

      {/* Vendor Routes */}
      <Route path="/vendor/dashboard" element={<PrivateRoute roles={['Vendor']}><Layout><VendorDashboard /></Layout></PrivateRoute>} />
      <Route path="/vendor/work-orders" element={<PrivateRoute roles={['Vendor']}><Layout><VendorWorkOrderView /></Layout></PrivateRoute>} />
      <Route path="/vendor/bills" element={<PrivateRoute roles={['Vendor']}><Layout><BillingClaims /></Layout></PrivateRoute>} />
      <Route path="/vendor/defects" element={<PrivateRoute roles={['Vendor']}><Layout><QualityDefects /></Layout></PrivateRoute>} />
      <Route path="/vendor/progress" element={<PrivateRoute roles={['Vendor']}><Layout><ProgressReporting /></Layout></PrivateRoute>} />
      <Route path="/vendor/progress/history" element={<PrivateRoute roles={['Vendor']}><Layout><ProgressHistory /></Layout></PrivateRoute>} />
      <Route path="/vendor/milestones" element={<PrivateRoute roles={['Vendor']}><Layout><MilestoneUpdates /></Layout></PrivateRoute>} />
      <Route path="/vendor/milestones/:milestoneId/submit" element={<PrivateRoute roles={['Vendor']}><Layout><MilestoneSubmissionPage /></Layout></PrivateRoute>} />
      <Route path="/vendor/documents" element={<PrivateRoute roles={['Vendor']}><Layout><DocumentUploads /></Layout></PrivateRoute>} />
      <Route path="/vendor/queries" element={<PrivateRoute roles={['Vendor']}><Layout><QueriesClarifications /></Layout></PrivateRoute>} />

      {/* Inspector Routes */}
      <Route path="/inspector/dashboard" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorDashboard /></Layout></PrivateRoute>} />
      <Route path="/inspector/work-orders" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorWorkOrders /></Layout></PrivateRoute>} />
      <Route path="/inspector/work-orders/:id" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorWorkOrderDetails /></Layout></PrivateRoute>} />
      <Route path="/inspector/visits" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorVisits /></Layout></PrivateRoute>} />
      <Route path="/inspector/visits/schedule" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorVisits /></Layout></PrivateRoute>} />
      <Route path="/inspector/progress-review" element={<PrivateRoute roles={['Inspector']}><Layout><ProgressReview /></Layout></PrivateRoute>} />
      <Route path="/inspector/progress-review/:id" element={<PrivateRoute roles={['Inspector']}><Layout><ReviewReportDetail /></Layout></PrivateRoute>} />
      <Route path="/inspector/defects" element={<PrivateRoute roles={['Inspector']}><Layout><InspectorDefects /></Layout></PrivateRoute>} />
      <Route path="/inspector/milestones/:milestoneId/submission" element={<PrivateRoute roles={['Inspector', 'Admin', 'PMU']}><Layout><MilestoneSubmissionPage /></Layout></PrivateRoute>} />

      {/* Department Routes */}
      <Route path="/department/dashboard" element={<PrivateRoute roles={['Department']}><Layout><DepartmentDashboard /></Layout></PrivateRoute>} />

      {/* Finance Routes */}
      <Route path="/finance/dashboard" element={<PrivateRoute roles={['Finance']}><Layout><FinancialDashboard /></Layout></PrivateRoute>} />

      {/* Anything unmatched. Without this an unknown URL renders an empty tree. */}
      <Route path="*" element={<PrivateRoute><Layout><NotFound /></Layout></PrivateRoute>} />
    </Routes>
  );
}

export default App;
