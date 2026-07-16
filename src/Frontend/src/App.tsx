import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from './store';
import { logout } from './store/authSlice';
import { Login } from './pages/Login';
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
import IssueWorkOrder from './pages/Admin/IssueWorkOrder';
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

const NavItem = ({ to, icon, text, hasChevron = false, indent = false, onChevronClick, chevronRotated, onClick, active }: any) => {
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

const Layout = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const [progressCollapsed, setProgressCollapsed] = React.useState(!location.pathname.startsWith('/vendor/progress'));
  const [showNotifications, setShowNotifications] = React.useState(false);

  const collapsibleConfigRoutes = [
    '/admin/masters/locations',
    '/admin/masters/defect-categories',
    '/admin/masters/milestone-templates'
  ];
  const isConfigRouteActive = collapsibleConfigRoutes.some(route => location.pathname === route);
  const [configCollapsed, setConfigCollapsed] = React.useState(!isConfigRouteActive);

  const collapsibleTenderRoutes = [
    '/admin/masters/tenders',
    '/admin/masters/tenders/add',
    '/admin/masters/tender-types',
    '/admin/tenders/awarded'
  ];
  const isTenderRouteActive = collapsibleTenderRoutes.some(route => location.pathname === route);
  const [tendersCollapsed, setTendersCollapsed] = React.useState(!isTenderRouteActive);

  const collapsibleVendorRoutes = [
    '/vendors',
    '/admin/masters/vendors/add',
    '/admin/masters/vendor-categories'
  ];
  const isVendorRouteActive = collapsibleVendorRoutes.some(route => location.pathname === route);
  const [vendorsCollapsed, setVendorsCollapsed] = React.useState(!isVendorRouteActive);

  const collapsibleUsersRoutes = [
    '/admin/masters/users/add',
    '/admin/masters/inspectors',
    '/admin/masters/departments'
  ];
  const isUsersRouteActive = collapsibleUsersRoutes.some(route => location.pathname === route);
  const [usersCollapsed, setUsersCollapsed] = React.useState(!isUsersRouteActive);

  const collapsibleFinancialsRoutes = [
    '/admin/billing',
    '/admin/payments',
    '/admin/masters/tax-configurations'
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
  }, [location.pathname]);

  React.useEffect(() => {
    const activeConfig = collapsibleConfigRoutes.some(route => location.pathname === route);
    if (activeConfig) setConfigCollapsed(false);

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
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {user && (
        <aside className="sidebar">
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
                    <NavItem to="/admin/masters/tender-types" text="Tender Types" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>} />
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
                    <NavItem to="/vendors" text="Vendor List" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>} />
                    <NavItem to="/admin/masters/vendors/add" text="Add Vendor" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>} />
                    <NavItem to="/admin/masters/vendor-categories" text="Vendor Categories" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>} />
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
                    <NavItem to="/admin/payments" text="Payments" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>} />
                    <NavItem to="/admin/masters/tax-configurations" text="Tax Configurations" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  text="User Management"
                  hasChevron={true}
                  chevronRotated={!usersCollapsed}
                  active={isUsersRouteActive}
                  onClick={() => setUsersCollapsed(prev => !prev)}
                />
                {!usersCollapsed && (
                  <>
                    <NavItem to="/admin/masters/inspectors" text="Inspectors" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>} />
                    <NavItem to="/admin/masters/departments" text="Departments" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>} />
                  </>
                )}

                <NavItem
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></svg>}
                  text="System Config"
                  hasChevron={true}
                  chevronRotated={!configCollapsed}
                  active={isConfigRouteActive}
                  onClick={() => setConfigCollapsed(prev => !prev)}
                />
                {!configCollapsed && (
                  <>
                    <NavItem to="/admin/masters/locations" text="Locations" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>} />
                    <NavItem to="/admin/masters/defect-categories" text="Defect Categories" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
                    <NavItem to="/admin/masters/milestone-templates" text="Milestone Templates" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>} />
                  </>
                )}

                <NavItem to="/admin/reports" text="Reports" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>} />
                <NavItem to="/admin/alerts" text="Alerts" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>} />
                <NavItem to="/admin/documents" text="Documents" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>} />
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
              </>
            ) : user.role === 'Department' ? (
              <>
                <NavItem to="/department/dashboard" text="Dashboard" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>} />
                <NavItem to="/admin/work-orders" text="Work Orders" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>} />
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
          <div className="pg-meta">
            <div id="page-title" className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</div>
            <p id="page-subtitle">Real-time Overview of All Tenders</p>
          </div>
          <div className="top-ctrls">
            <div className="top-filter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              01 May 2024 - 31 May 2024
            </div>
            <div className="top-filter">
              All Departments
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            <div className="notif-wrap relative">
              <div className="notif-btn cursor-pointer" onClick={() => setShowNotifications(!showNotifications)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" style={{ animation: 'pulseRing 2s ease-out infinite' }}></div>
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
              </div>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl z-50 overflow-hidden" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', animation: 'scaleIn 0.2s ease both', transformOrigin: 'top right' }}>
                  <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(0,0,0,0.04)', background: 'linear-gradient(to bottom, #f8f9fc, #fff)' }}>
                    <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                    <span className="text-xs font-bold cursor-pointer transition-colors hover:text-indigo-800" style={{ color: '#4f6ef7' }}>Mark all read</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-4 hover:bg-blue-50/40 cursor-pointer transition-colors" style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <p className="text-sm font-semibold text-slate-800">System Maintenance Scheduled</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Downtime expected tonight at 2:00 AM.</p>
                      <span className="text-[10px] text-slate-400 font-bold mt-2 block">1 hour ago</span>
                    </div>
                    <div className="p-4 hover:bg-blue-50/40 cursor-pointer transition-colors" style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <p className="text-sm font-semibold text-slate-800">New Work Order Issued</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">WO-2024-05 has been published.</p>
                      <span className="text-[10px] text-slate-400 font-bold mt-2 block">2 hours ago</span>
                    </div>
                  </div>
                  <div className="p-3 text-center cursor-pointer transition-colors hover:bg-blue-50/50" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', background: 'linear-gradient(to top, #f8f9fc, #fff)' }}>
                    <span className="text-xs font-bold" style={{ color: '#4f6ef7' }}>View All Alerts</span>
                  </div>
                </div>
              )}
            </div>
            <div className="user-block" onClick={() => { if (window.confirm('Are you sure you want to logout?')) dispatch(logout()); }}>
              <div className="user-av">{user?.name?.substring(0, 2).toUpperCase() || 'US'}</div>
              <div>
                <div className="user-nm">{user?.name || 'User'}</div>
                <div className="user-rl">{user?.role || 'Guest'}</div>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
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
      <Route path="/admin/milestone-approvals" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><AdminMilestoneApprovals /></Layout></PrivateRoute>} />
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
    </Routes>
  );
}

export default App;
