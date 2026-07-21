import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  ShieldAlert,
  BellRing,
  Database,
  Check,
  HelpCircle,
  Save,
  RefreshCw
} from 'lucide-react';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'policies' | 'notifications' | 'diagnostics'>('general');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form States
  const [generalSettings, setGeneralSettings] = useState({
    portalName: 'Post-Tender Management System',
    supportEmail: 'support@posttender.gov.in',
    helpline: '+91 11 2345 6789',
    sessionTimeout: '30'
  });

  const [policySettings, setPolicySettings] = useState({
    defectLiabilityPeriod: '12',
    retentionMoney: '5.0',
    liquidatedDamagesRate: '0.50',
    maxLiquidatedDamages: '10.0'
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailOnAssignment: true,
    smsOnMilestone: true,
    alertOnSlaBreach: true,
    weeklyMisDigest: false
  });

  // Load from LocalStorage
  useEffect(() => {
    const savedGeneral = localStorage.getItem('pt_settings_general');
    if (savedGeneral) setGeneralSettings(JSON.parse(savedGeneral));

    const savedPolicies = localStorage.getItem('pt_settings_policies');
    if (savedPolicies) setPolicySettings(JSON.parse(savedPolicies));

    const savedNotifications = localStorage.getItem('pt_settings_notifications');
    if (savedNotifications) setNotificationSettings(JSON.parse(savedNotifications));
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pt_settings_general', JSON.stringify(generalSettings));
    localStorage.setItem('pt_settings_policies', JSON.stringify(policySettings));
    localStorage.setItem('pt_settings_notifications', JSON.stringify(notificationSettings));
    showToast('Settings saved successfully!');
  };

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to system defaults?')) {
      const defaultGeneral = {
        portalName: 'Post-Tender Management System',
        supportEmail: 'support@posttender.gov.in',
        helpline: '+91 11 2345 6789',
        sessionTimeout: '30'
      };
      const defaultPolicies = {
        defectLiabilityPeriod: '12',
        retentionMoney: '5.0',
        liquidatedDamagesRate: '0.50',
        maxLiquidatedDamages: '10.0'
      };
      const defaultNotifications = {
        emailOnAssignment: true,
        smsOnMilestone: true,
        alertOnSlaBreach: true,
        weeklyMisDigest: false
      };

      setGeneralSettings(defaultGeneral);
      setPolicySettings(defaultPolicies);
      setNotificationSettings(defaultNotifications);

      localStorage.setItem('pt_settings_general', JSON.stringify(defaultGeneral));
      localStorage.setItem('pt_settings_policies', JSON.stringify(defaultPolicies));
      localStorage.setItem('pt_settings_notifications', JSON.stringify(defaultNotifications));
      showToast('Settings reset to system defaults.');
    }
  };

  // Styles
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-2';
  const inputCls = 'w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 focus:bg-white text-slate-800 transition-colors text-sm';

  const tabItemCls = (tab: string) => `
    flex items-center gap-3 px-6 py-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap
    ${activeTab === tab
      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
      : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50/80'}
  `;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 bg-slate-50 min-h-screen">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 transition-all duration-300 animate-slide-in">
          <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg">
            <Check className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-600 animate-spin-slow" />
            System Configuration
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Manage global preferences, workflow policies, thresholds, and notification alerts.</p>
        </div>
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Defaults
        </button>
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row">

        {/* Sidebar Tabs */}
        <div className="border-r border-slate-100 bg-slate-50/30 w-full md:w-64 divide-y divide-slate-100 flex md:flex-col shrink-0 overflow-x-auto md:overflow-x-visible">
          <div className={tabItemCls('general')} onClick={() => setActiveTab('general')}>
            <SettingsIcon className="w-4.5 h-4.5" />
            General Setup
          </div>
          <div className={tabItemCls('policies')} onClick={() => setActiveTab('policies')}>
            <ShieldAlert className="w-4.5 h-4.5" />
            Policies & Rules
          </div>
          <div className={tabItemCls('notifications')} onClick={() => setActiveTab('notifications')}>
            <BellRing className="w-4.5 h-4.5" />
            Notification Toggles
          </div>
          <div className={tabItemCls('diagnostics')} onClick={() => setActiveTab('diagnostics')}>
            <Database className="w-4.5 h-4.5" />
            Diagnostics & Status
          </div>
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 p-8 md:p-10">
          <form onSubmit={handleSave} className="space-y-8">

            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3 mb-6">General System Setup</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls} htmlFor="portalName">Portal Display Name</label>
                    <input
                      id="portalName"
                      type="text"
                      className={inputCls}
                      value={generalSettings.portalName}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, portalName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="sessionTimeout">Global Session Timeout (Minutes)</label>
                    <input
                      id="sessionTimeout"
                      type="number"
                      className={inputCls}
                      value={generalSettings.sessionTimeout}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                      min="5"
                      max="1440"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls} htmlFor="supportEmail">Support/Escalation Email</label>
                    <input
                      id="supportEmail"
                      type="email"
                      className={inputCls}
                      value={generalSettings.supportEmail}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, supportEmail: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="helpline">Helpline Hotline Number</label>
                    <input
                      id="helpline"
                      type="text"
                      className={inputCls}
                      value={generalSettings.helpline}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, helpline: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'policies' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3 mb-6">Workflow Rules & SLA Policies</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="defectLiabilityPeriod" className="text-sm font-semibold text-slate-700">Defect Liability Period (Months)</label>
                      <span title="Period after completion where vendor is liable for rectifying defects."><HelpCircle className="w-4 h-4 text-slate-600 cursor-pointer" /></span>
                    </div>
                    <input
                      id="defectLiabilityPeriod"
                      type="number"
                      className={inputCls}
                      value={policySettings.defectLiabilityPeriod}
                      onChange={e => setPolicySettings(prev => ({ ...prev, defectLiabilityPeriod: e.target.value }))}
                      min="1"
                      max="120"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="retentionMoney" className="text-sm font-semibold text-slate-700">Retention Money percentage (%)</label>
                      <span title="Percentage withheld from payments to secure performance."><HelpCircle className="w-4 h-4 text-slate-600 cursor-pointer" /></span>
                    </div>
                    <input
                      id="retentionMoney"
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={policySettings.retentionMoney}
                      onChange={e => setPolicySettings(prev => ({ ...prev, retentionMoney: e.target.value }))}
                      min="0"
                      max="20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="liquidatedDamagesRate" className="text-sm font-semibold text-slate-700">Liquidated Damages Rate per week (%)</label>
                      <span title="Delay damages percentage charged per week of delay."><HelpCircle className="w-4 h-4 text-slate-600 cursor-pointer" /></span>
                    </div>
                    <input
                      id="liquidatedDamagesRate"
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={policySettings.liquidatedDamagesRate}
                      onChange={e => setPolicySettings(prev => ({ ...prev, liquidatedDamagesRate: e.target.value }))}
                      min="0"
                      max="5"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="maxLiquidatedDamages" className="text-sm font-semibold text-slate-700">Max Liquidated Damages cap (%)</label>
                      <span title="Upper limit cap for delay penalty."><HelpCircle className="w-4 h-4 text-slate-600 cursor-pointer" /></span>
                    </div>
                    <input
                      id="maxLiquidatedDamages"
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={policySettings.maxLiquidatedDamages}
                      onChange={e => setPolicySettings(prev => ({ ...prev, maxLiquidatedDamages: e.target.value }))}
                      min="0"
                      max="50"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3 mb-6">Automated Notifications & Toggles</h2>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl cursor-pointer transition-colors">
                    <div>
                      <span className="font-bold text-slate-800 block text-sm">Work Order Assigned Email</span>
                      <span className="text-xs font-medium text-slate-600">Auto-send email copy with contract copy when Admin issues a Work Order.</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      checked={notificationSettings.emailOnAssignment}
                      onChange={e => setNotificationSettings(prev => ({ ...prev, emailOnAssignment: e.target.checked }))}
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl cursor-pointer transition-colors">
                    <div>
                      <span className="font-bold text-slate-800 block text-sm">Milestone Approval SMS Alerts</span>
                      <span className="text-xs font-medium text-slate-600">Notify vendor authorized representative mobile when milestone payment is approved.</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      checked={notificationSettings.smsOnMilestone}
                      onChange={e => setNotificationSettings(prev => ({ ...prev, smsOnMilestone: e.target.checked }))}
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl cursor-pointer transition-colors">
                    <div>
                      <span className="font-bold text-slate-800 block text-sm">SLA & Delayed Alert Reminders</span>
                      <span className="text-xs font-medium text-slate-600">Enable AlertWorker background scheduler to trigger reminders on delayed physical progress.</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      checked={notificationSettings.alertOnSlaBreach}
                      onChange={e => setNotificationSettings(prev => ({ ...prev, alertOnSlaBreach: e.target.checked }))}
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 rounded-2xl cursor-pointer transition-colors">
                    <div>
                      <span className="font-bold text-slate-800 block text-sm">Weekly Executive MIS Digest</span>
                      <span className="text-xs font-medium text-slate-600">Send summary report of all execution dashboards to PMU authority on Mondays.</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      checked={notificationSettings.weeklyMisDigest}
                      onChange={e => setNotificationSettings(prev => ({ ...prev, weeklyMisDigest: e.target.checked }))}
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b pb-3 mb-6">Diagnostics & System Status</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">API Gateway</span>
                    <span className="font-mono text-sm text-slate-800 font-semibold">{import.meta.env.VITE_API_URL ?? 'http://localhost:5249'}</span>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Architecture</span>
                    <span className="font-mono text-sm text-slate-800 font-semibold">7 Microservices · YARP</span>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Data Store</span>
                    <span className="font-mono text-sm text-slate-800 font-semibold">SQLite (database-per-service)</span>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Runtime Status</span>
                    <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                      Local Dev Environment
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2">Configuration reference — values reflect local settings, not a live health probe.</p>

                <div className="bg-slate-50 border rounded-2xl p-5 space-y-2 mt-6">
                  <h3 className="text-sm font-bold text-slate-700">Environment Metadata</h3>
                  <div className="text-xs font-semibold text-slate-600 grid grid-cols-2 gap-y-2">
                    <div>Environment: <span className="font-mono text-slate-800 bg-slate-200/50 px-1.5 py-0.5 rounded">Development</span></div>
                    <div>App Version: <span className="font-mono text-slate-800 bg-slate-200/50 px-1.5 py-0.5 rounded">v1.2.0</span></div>
                    <div>SDK Runtime: <span className="font-mono text-slate-800 bg-slate-200/50 px-1.5 py-0.5 rounded">.NET 8.0</span></div>
                    <div>Auth Provider: <span className="font-mono text-slate-800 bg-slate-200/50 px-1.5 py-0.5 rounded">JWT Bearer</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            {activeTab !== 'diagnostics' && (
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-xl text-sm shadow-lg shadow-indigo-100 transition-all hover:shadow-indigo-200 active:scale-95"
                >
                  <Save className="w-4.5 h-4.5" />
                  Save Settings
                </button>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};
