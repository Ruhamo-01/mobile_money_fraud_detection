import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, UserCheck, AlertTriangle, Lock,
  Database, Activity, Settings, LogOut, Plus, Download, Save,
  CheckCircle, XCircle, RefreshCw, Trash2, Edit2, X
} from 'lucide-react';
import { fmtDate } from '../utils/helpers';
const API = '';

// ── Shared primitives ──────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-white border-2 border-slate-300 rounded-2xl mb-6 shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const v = {
    primary: 'bg-gradient-to-br from-emerald-500 to-sky-500 text-white hover:shadow-lg hover:-translate-y-0.5',
    danger:  'bg-rose-600 text-white hover:bg-rose-700',
    ghost:   'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' };
  return (
    <button className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all ${v[variant]} ${s[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Badge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
    active ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
           : 'bg-rose-100 text-rose-700 border border-rose-300'
  }`}>
    {active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {active ? 'Active' : 'Inactive'}
  </span>
);

const RiskBadge = ({ level }) => {
  const l = (level || '').toLowerCase();
  const cls = l === 'high'   ? 'bg-rose-100 text-rose-700 border-rose-300'
            : l === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-300'
            :                  'bg-emerald-100 text-emerald-700 border-emerald-300';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cls}`}>{level || 'LOW'}</span>;
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const FormField = ({ label, children }) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-sm font-normal focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white" {...props} />
);

const Sel = ({ children, ...props }) => (
  <select className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-sm font-normal focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white" {...props}>
    {children}
  </select>
);

const Toast = ({ msg, onClose }) => msg.show ? (
  <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold border ${
    msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                           : 'bg-rose-50 text-rose-800 border-rose-300'
  }`}>
    {msg.type === 'success' ? <CheckCircle className="flex-shrink-0 w-4 h-4" /> : <XCircle className="flex-shrink-0 w-4 h-4" />}
    {msg.message}
    <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
  </div>
) : null;

const NavItem = ({ id, icon: Icon, label, badge, activeTab, setActiveTab, onClick }) => (
  <button
    onClick={() => { setActiveTab(id); onClick && onClick(); }}
    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left relative ${
      activeTab === id
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon className="flex-shrink-0 w-4 h-4" />
    {label}
    {badge > 0 && (
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
        {badge}
      </span>
    )}
  </button>
);

const StatCard = ({ value, label, color = 'text-emerald-600' }) => (
  <div className="p-5 text-center transition-all bg-white border-2 shadow-lg border-slate-200 rounded-2xl hover:border-emerald-300 hover:shadow-xl">
    <div className={`font-mono text-2xl font-bold ${color} mb-1`}>{value}</div>
    <div className="mt-1 text-xs font-bold tracking-wide uppercase text-slate-600">{label}</div>
  </div>
);

// ── XAI Explanation Panel ──────────────────────────────────────────────────
const XAIPanel = ({ explanation, loading }) => {
  if (loading) return (
    <div className="flex items-center gap-2 p-3 mt-3 text-xs border bg-slate-50 border-slate-200 rounded-xl text-slate-500 animate-pulse">
      <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500 flex-shrink-0" />
      Generating explanation…
    </div>
  );
  if (!explanation) return null;
  if (!explanation.available) return (
    <div className="p-3 mt-3 text-xs border bg-rose-50 border-rose-200 rounded-xl text-rose-700">
      {explanation.error || 'Explanation unavailable'}
    </div>
  );

  const factors = explanation.top_factors || [];
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.shap_value || f.importance || 0.001)), 0.001);
  const rules = explanation.triggered_rules || {};
  const triggeredList = Object.entries(rules)
    .filter(([k, v]) => k !== 'amount_vs_typical' && v === 1)
    .map(([k]) => k.replace(/_/g, ' '));

  return (
    <div className="mt-3 overflow-hidden border border-violet-200 rounded-xl">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-violet-50 border-violet-200">
        <Activity className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
        <span className="text-xs font-bold text-violet-800">ML Explanation</span>
        <span className="ml-auto text-[10px] text-violet-500 font-medium bg-violet-100 px-2 py-0.5 rounded-full">
          {explanation.method}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3 bg-white">
        {triggeredList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {triggeredList.map(r => (
              <span key={r} className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full border border-rose-200 capitalize">{r}</span>
            ))}
          </div>
        )}
        {factors.slice(0, 5).map((f, i) => {
          const isRisk = f.direction === 'increases_risk';
          const impact = Math.abs(f.shap_value || f.importance || 0);
          const pct = Math.min(impact / maxImpact * 100, 100);
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-800">{f.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isRisk ? '↑ Risk' : '↓ Risk'}
                </span>
              </div>
              <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${isRisk ? 'bg-rose-400' : 'bg-emerald-400'}`}
                  style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
              </div>
              {f.detail && <p className="text-[10px] text-slate-500 mt-0.5">{f.detail}</p>}
            </div>
          );
        })}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-3 text-[10px] text-slate-500 text-center">
          <div>Score <strong className="block text-sm text-slate-800">{((explanation.fraud_score || 0) * 100).toFixed(1)}%</strong></div>
          <div>Threshold <strong className="block text-sm text-slate-800">{((explanation.threshold || 0.38) * 100).toFixed(0)}%</strong></div>
          <div>Risk <strong className={`block text-sm ${explanation.fraud_score >= 0.65 ? 'text-rose-600' : explanation.fraud_score >= (explanation.threshold || 0.38) ? 'text-amber-600' : 'text-emerald-600'}`}>
            {explanation.fraud_score >= 0.65 ? 'HIGH' : explanation.fraud_score >= (explanation.threshold || 0.38) ? 'MEDIUM' : 'LOW'}
          </strong></div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats]         = useState({});
  const [providers, setProviders] = useState([]);
  const [users, setUsers]         = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [accessLogs, setAccessLogs]   = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [adminExpandedAlert, setAdminExpandedAlert] = useState(null);
  const [adminAlertExplanations, setAdminAlertExplanations] = useState({});
  const [adminXaiLoading, setAdminXaiLoading] = useState(null);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showUserModal, setShowUserModal]         = useState(false);
  const [editingProvider, setEditingProvider]     = useState(null);
  const [editingUser, setEditingUser]             = useState(null);
  const [userSearch, setUserSearch]               = useState('');

  const [providerForm, setProviderForm] = useState({ name:'', email:'', phone:'', national_id:'', sex:'', status:'1', password:'' });
  const [userForm, setUserForm]         = useState({ name:'', email:'', phone:'', national_id:'', sex:'', balance:'', status:'1' });
  const [settings, setSettings] = useState({ system_name:'MoMo Shield', max_transfer:2000000, fraud_threshold:0.38, session_timeout:1440, max_pin_attempts:3 });

  const TOKEN = () => localStorage.getItem('session_token');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('session_token') || ''),
  });

  const notify = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 4000);
  };

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { navigate('/login'); return; }
    fetch(`${API}/api/validate-session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token })
    }).then(r => r.json()).then(d => {
      if (!d.success || d.dashboard_type !== 'admin') navigate('/login');
    }).catch(() => navigate('/login'));
    loadOverviewData();
    loadProviders();
    loadPerformanceData();
    loadSettings();
  }, []);

  useEffect(() => { loadTabData(activeTab); }, [activeTab]);

  const loadTabData = (tab) => {
    if (tab === 'overview')     loadOverviewData();
    if (tab === 'providers')    loadProviders();
    if (tab === 'users')        loadUsers();
    if (tab === 'fraud-alerts') loadFraudAlerts();
    if (tab === 'security')     loadAccessLogs();
    if (tab === 'performance')  loadPerformanceData();
    if (tab === 'settings')     loadSettings();
  };

  const loadOverviewData = async () => {
    try {
      const r = await fetch(`${API}/api/dashboard/stats`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setStats(prev => ({ ...prev, ...d.stats }));
    } catch {}
  };

  const loadProviders = async () => {
    try {
      const r = await fetch(`${API}/api/admin/providers`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setProviders((d.providers || []).map(p => ({ ...p, status: p.is_active ? '1' : '0', created_at: p.created_date || p.created_at })));
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const r = await fetch(`${API}/api/admin/users`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setUsers((d.users || []).map(u => ({
        phone: u.phone_number || u.phone, name: u.full_name || u.name,
        email: u.email, national_id: u.national_id,
        sex: u.sex || u.gender, balance: u.account_balance ?? u.balance ?? 0,
        is_active: u.is_active,
      })));
    } catch {}
  };

  const loadFraudAlerts = async () => {
    try {
      const r = await fetch(`${API}/api/admin/fraud-alerts`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setFraudAlerts(d.alerts || []);
    } catch {}
  };

  const loadAccessLogs = async () => {
    try {
      const r = await fetch(`${API}/api/admin/access-logs?limit=100`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setAccessLogs(d.logs || []);
    } catch {}
  };

  const loadPerformanceData = async () => {
    try {
      const [hr, sr] = await Promise.all([
        fetch(`${API}/api/health`),
        fetch(`${API}/api/dashboard/stats`, { headers: authHeaders() }),
      ]);
      const hd = await hr.json(); const sd = await sr.json();
      setStats(prev => ({ ...prev, health: hd, txStats: sd.success ? sd.stats : null }));
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const r = await fetch(`${API}/api/admin/settings`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success && d.settings) setSettings(prev => ({ ...prev, ...d.settings }));
    } catch {}
  };

  const createBackup = async () => {
    try {
      notify('Creating backup…');
      const r = await fetch(`${API}/api/admin/backup`, { method: 'POST', headers: authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify(d.error || 'Backup failed.', 'error'); return; }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const cd   = r.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.href = url; a.download = match ? match[1] : `momo_shield_backup_${Date.now()}.sql`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('Backup downloaded successfully.');
    } catch (e) { notify(`Backup error: ${e.message}`, 'error'); }
  };

  const logout = () => {
    const token = localStorage.getItem('session_token');
    fetch(`${API}/api/logout`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_token: token }) }).catch(()=>{});
    localStorage.clear();
    navigate('/login');
  };

  const openAddProvider  = () => { setEditingProvider(null); setProviderForm({ name:'', email:'', phone:'', national_id:'', sex:'', status:'1', password:'' }); setShowProviderModal(true); };
  const openEditProvider = (p) => { setEditingProvider(p); setProviderForm({ name:p.name, email:p.email, phone:p.phone, national_id:p.national_id, sex:p.sex, status:p.status, password:'' }); setShowProviderModal(true); };
  const openEditUser     = (u) => { setEditingUser(u); setUserForm({ name:u.name, email:u.email, phone:u.phone, national_id:u.national_id, sex:u.sex, balance:u.balance, status: u.is_active ? '1' : '0' }); setShowUserModal(true); };

  const saveProvider = async (e) => {
    e.preventDefault();
    const url  = editingProvider ? `${API}/api/admin/update-provider` : `${API}/api/admin/add-provider`;
    const body = editingProvider ? { ...providerForm, provider_id: editingProvider.id } : providerForm;
    try {
      const r = await fetch(url, { method:'POST', headers: authHeaders(), body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { setShowProviderModal(false); loadProviders(); notify(editingProvider ? 'Manager updated.' : 'Manager added.'); }
      else notify(d.error || 'Failed to save manager.', 'error');
    } catch { notify('Server error.', 'error'); }
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/api/admin/update-user-multi`, {
        method:'POST', headers: authHeaders(),
        body: JSON.stringify({ phone_number: editingUser.phone, full_name: userForm.name, email: userForm.email, national_id: userForm.national_id, sex: userForm.sex, account_balance: userForm.balance, is_active: userForm.status === '1' })
      });
      const d = await r.json();
      if (d.success) { setShowUserModal(false); loadUsers(); notify('Customer updated.'); }
      else notify(d.error || 'Failed to save customer.', 'error');
    } catch { notify('Server error.', 'error'); }
  };

  const deleteProvider = async (id) => {
    if (!window.confirm('Delete this manager?')) return;
    try {
      const r = await fetch(`${API}/api/admin/delete-provider`, { method:'POST', headers: authHeaders(), body: JSON.stringify({ provider_id: id }) });
      const d = await r.json();
      if (d.success) { loadProviders(); notify('Manager deleted.'); }
      else notify(d.error || 'Failed to delete.', 'error');
    } catch { notify('Server error.', 'error'); }
  };

  const deleteUser = async (phone) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      const r = await fetch(`${API}/api/admin/delete-user`, { method:'POST', headers: authHeaders(), body: JSON.stringify({ phone_number: phone }) });
      const d = await r.json();
      if (d.success) { loadUsers(); notify('Customer deleted.'); }
      else notify(d.error || 'Failed to delete.', 'error');
    } catch { notify('Server error.', 'error'); }
  };

  const saveSettings = async () => {
    try {
      const r = await fetch(`${API}/api/admin/settings`, { method:'POST', headers: authHeaders(), body: JSON.stringify(settings) });
      const d = await r.json();
      if (d.success) notify('Settings saved.'); else notify(d.error || 'Failed to save.', 'error');
    } catch { notify('Server error.', 'error'); }
  };

  const fetchAdminExplanation = async (alert, deep = false) => {
    const cacheKey = deep ? `${alert.id}_deep` : alert.id;
    if (!deep && alert.explanation) {
      setAdminAlertExplanations(prev => ({ ...prev, [alert.id]: alert.explanation }));
      setAdminExpandedAlert(adminExpandedAlert === alert.id ? null : alert.id);
      return;
    }
    if (adminAlertExplanations[cacheKey]) {
      setAdminExpandedAlert(adminExpandedAlert === cacheKey ? null : cacheKey);
      return;
    }
    setAdminXaiLoading(cacheKey);
    setAdminExpandedAlert(cacheKey);
    const endpoint = deep ? '/api/explain-transaction/deep' : '/api/explain-transaction';
    try {
      const r = await fetch(`${API}${endpoint}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ phone_number: alert.phone_number, amount: alert.amount || 0, network: alert.network || 'MTN' })
      });
      const d = await r.json();
      setAdminAlertExplanations(prev => ({
        ...prev,
        [cacheKey]: d.success ? d.explanation : { available: false, error: d.error }
      }));
    } catch {
      setAdminAlertExplanations(prev => ({ ...prev, [cacheKey]: { available: false, error: 'Network error' } }));
    } finally { setAdminXaiLoading(null); }
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.phone?.includes(userSearch) || u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const navSections = [
    {
      label: 'Overview',
      items: [
        { id: 'overview',     icon: LayoutDashboard, label: 'Overview' },
        { id: 'performance',  icon: Activity,        label: 'Performance' },
      ]
    },
    {
      label: 'Management',
      items: [
        { id: 'providers',    icon: Users,        label: 'Managers' },
        { id: 'users',        icon: UserCheck,    label: 'Customers' },
        { id: 'fraud-alerts', icon: AlertTriangle, label: 'Fraud Alerts', badge: stats.fraud_alerts },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'security', icon: Lock,     label: 'Security' },
        { id: 'backup',   icon: Database, label: 'Backup' },
        { id: 'settings', icon: Settings, label: 'Settings' },
      ]
    },
  ];

  return (
    <div className="flex min-h-screen bg-white">
      <Toast msg={toast} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* ── Sidebar ── */}
      <aside className="w-[230px] flex-shrink-0 bg-white border-2 border-slate-300 rounded-2xl m-4 h-[calc(100vh-32px)] flex flex-col relative z-10 overflow-hidden shadow-lg">
        {/* Logo */}
        <div className="p-5 text-center border-b border-slate-300">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center mx-auto mb-2.5">
            <Shield className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
            MoMo Shield
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Admin Dashboard</div>
        </div>

        {/* Admin badge */}
        <div className="p-3.5 border-b border-slate-300 text-center">
          <div className="text-xs font-bold text-slate-700">System Administrator</div>
          <div className="text-[11px] mt-2 bg-emerald-100 border border-emerald-300 rounded-lg py-2 px-3 font-semibold text-emerald-700">
            Full Access
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3.5 flex-1 min-h-0 overflow-y-auto">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3.5 pt-3.5 pb-1.5">{section.label}</div>
              {section.items.map(item => (
                <NavItem
                  key={item.id}
                  {...item}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onClick={() => loadTabData(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={logout}
          className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-500 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-all"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="relative flex flex-col flex-1 h-screen p-6 overflow-y-auto">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
              <p className="mt-1 text-sm text-slate-600">Real-time fraud protection statistics</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
              <StatCard label="Total Customers"  value={stats.total_users       ?? '—'} color="text-emerald-600" />
              <StatCard label="Active Managers"  value={stats.active_providers  ?? '—'} color="text-sky-600" />
              <StatCard label="Fraud Alerts"     value={stats.fraud_alerts      ?? '—'} color="text-rose-600" />
              <StatCard label="Transfers Today"  value={stats.transfers_today   ?? '—'} color="text-violet-600" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">System Health</h3>
                </div>
                <div className="p-5">
                  {stats.health ? (
                    <div className="space-y-2">
                      {Object.entries(stats.health).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                          <span className="text-sm font-medium capitalize text-slate-700">{k.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-bold text-slate-900">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">Loading…</p>}
                </div>
              </Card>
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Quick Stats (7 days)</h3>
                </div>
                <div className="p-5">
                  {stats.txStats ? (
                    <div className="space-y-2">
                      {[
                        ['Transfers',    stats.txStats.transfers_7d           ?? 0, 'text-slate-900'],
                        ['Fraud Blocked',stats.txStats.fraud_blocked_7d       ?? 0, 'text-rose-600'],
                        ['Fraud Rate',   `${stats.txStats.fraud_rate_7d ?? 0}%`, 'text-amber-600'],
                        ['Face Verified',stats.txStats.face_verified_transfers ?? 0, 'text-emerald-600'],
                        ['Volume',       `${Number(stats.txStats.total_volume_7d ?? 0).toLocaleString()} RWF`, 'text-sky-600'],
                      ].map(([label, val, cls]) => (
                        <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                          <span className="text-sm font-medium text-slate-600">{label}</span>
                          <span className={`text-sm font-bold ${cls}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">Loading…</p>}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* MANAGERS */}
        {activeTab === 'providers' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Managers</h1>
              <p className="mt-1 text-sm text-slate-600">Manage manager's accounts</p>
            </div>
            <Card>
              <div className="flex items-center justify-between p-5 border-b border-slate-300">
                <h2 className="text-base font-bold text-slate-900">All Managers ({providers.length})</h2>
                <Btn onClick={openAddProvider}><Plus className="w-4 h-4" /> Add Manager</Btn>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {['ID','Name','Email','Phone','National ID','Sex','Status','Created','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-bold tracking-wider text-left uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {providers.length === 0 ? (
                      <tr><td colSpan="9" className="px-4 py-10 text-sm text-center text-slate-500">No managers found</td></tr>
                    ) : providers.map(p => (
                      <tr key={p.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">{p.id}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{p.email}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{p.phone}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">{p.national_id}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{p.sex}</td>
                        <td className="px-4 py-3"><Badge active={p.status === '1'} /></td>
                        <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(p.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Btn size="sm" variant="ghost" onClick={() => openEditProvider(p)}><Edit2 className="w-3.5 h-3.5" /></Btn>
                            <Btn size="sm" variant="danger" onClick={() => deleteProvider(p.id)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* CUSTOMERS */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
              <p className="mt-1 text-sm text-slate-600">Manage customer accounts</p>
            </div>
            <Card>
              <div className="flex flex-col items-start justify-between gap-3 p-5 border-b sm:flex-row sm:items-center border-slate-300">
                <h2 className="text-base font-bold text-slate-900">All Customers ({filteredUsers.length})</h2>
                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by phone or name…"
                  className="px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none w-full sm:w-64" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {['Phone','Name','Email','National ID','Sex','Balance','Status','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-bold tracking-wider text-left uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="8" className="px-4 py-10 text-sm text-center text-slate-500">No customers found</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u.phone} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{u.phone}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{u.email}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">{u.national_id}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{u.sex}</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-700">{Number(u.balance).toLocaleString()} RWF</td>
                        <td className="px-4 py-3"><Badge active={u.is_active} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Btn size="sm" variant="ghost" onClick={() => openEditUser(u)}><Edit2 className="w-3.5 h-3.5" /></Btn>
                            <Btn size="sm" variant="danger" onClick={() => deleteUser(u.phone)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* FRAUD ALERTS */}
        {activeTab === 'fraud-alerts' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Fraud Alerts</h1>
              <p className="mt-1 text-sm text-slate-600">All ML-flagged and rule-triggered events</p>
            </div>
            <Card>
              <div className="flex items-center justify-between p-5 border-b border-slate-300">
                <h2 className="text-base font-bold text-slate-900">Alerts ({fraudAlerts.length})</h2>
                <Btn size="sm" variant="ghost" onClick={loadFraudAlerts}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Btn>
              </div>
              <div className="p-5">
                {fraudAlerts.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                    <p className="text-sm font-semibold text-slate-700">No fraud alerts</p>
                    <p className="mt-1 text-xs text-slate-500">All transactions are clear</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fraudAlerts.map(a => (
                      <div key={a.id} className="p-4 transition-colors border bg-slate-50 border-slate-200 rounded-xl hover:border-slate-300">
                        <div className="flex items-start gap-4">
                          <RiskBadge level={a.risk_level} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{a.message || a.alert_message || '—'}</p>
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {fmtDate(a.created_at)} · Score: <span className="font-bold text-slate-700">{((a.fraud_score || 0) * 100).toFixed(1)}%</span> · {a.action || '—'}
                            </p>
                            <XAIPanel
                              explanation={
                                adminExpandedAlert === a.id            ? adminAlertExplanations[a.id] :
                                adminExpandedAlert === `${a.id}_deep`  ? adminAlertExplanations[`${a.id}_deep`] :
                                null
                              }
                              loading={adminXaiLoading === a.id || adminXaiLoading === `${a.id}_deep`}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button onClick={() => fetchAdminExplanation(a, false)}
                              className={`px-2.5 py-1.5 text-xs rounded border transition-all inline-flex items-center gap-1 ${
                                adminExpandedAlert === a.id
                                  ? 'bg-violet-100 text-violet-700 border-violet-300'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300'
                              }`}>
                              <Activity className="w-3 h-3" />
                              {adminExpandedAlert === a.id ? 'Hide' : 'Explain'}
                            </button>
                            <button onClick={() => fetchAdminExplanation(a, true)}
                              className={`px-2.5 py-1.5 text-xs rounded border transition-all inline-flex items-center gap-1 ${
                                adminExpandedAlert === `${a.id}_deep`
                                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                              }`}>
                              <Activity className="w-3 h-3" />
                              {adminExpandedAlert === `${a.id}_deep` ? 'Hide' : 'Deep'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Security</h1>
              <p className="mt-1 text-sm text-slate-600">System security features and access logs</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Security Features</h3>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    ['Biometric Face Verification', true],
                    ['PIN Security & Lockout', true],
                    ['Travel SIM Control', true],
                    ['ML Fraud Detection', true],
                    ['SHAP Explainability', true],
                    ['Session Token Auth', true],
                  ].map(([label, on]) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${on ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500'}`}>
                        {on ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="mb-0">
                <div className="flex items-center justify-between p-5 border-b border-slate-300">
                  <h3 className="text-base font-bold text-slate-800">Access Logs</h3>
                  <Btn size="sm" variant="ghost" onClick={loadAccessLogs}><RefreshCw className="w-3.5 h-3.5" /></Btn>
                </div>
                <div className="p-5 space-y-2 overflow-y-auto max-h-96">
                  {accessLogs.length === 0 ? <p className="text-sm text-slate-500">No logs found</p> : accessLogs.map(log => (
                    <div key={log.id} className={`p-3 rounded-xl text-xs border-l-4 ${log.status === 'SUCCESS' ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold uppercase tracking-wide ${log.status === 'SUCCESS' ? 'text-emerald-700' : 'text-rose-700'}`}>{log.event_type}</span>
                        <span className="font-mono text-slate-500">{log.ip_address}</span>
                      </div>
                      <div className="font-semibold text-slate-800">{log.full_name || 'Unknown'} <span className="font-normal text-slate-600">— {log.identifier}</span></div>
                      {log.detail && <div className="text-slate-600 mt-0.5">{log.detail}</div>}
                      <div className="text-slate-500 mt-0.5 font-mono">{fmtDate(log.created_at)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* BACKUP */}
        {activeTab === 'backup' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Database Backup</h1>
              <p className="mt-1 text-sm text-slate-600">Download a full PostgreSQL dump of the system database</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Create Backup</h3>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-500">Downloads a full PostgreSQL dump of the <span className="font-semibold text-slate-700">momo_fraud</span> database as a <code className="px-1 rounded bg-slate-100">.sql</code> file.</p>
                  <Btn variant="success" className="justify-center w-full" onClick={createBackup}>
                    <Download className="w-4 h-4" /> Download Backup Now
                  </Btn>
                  <div className="pt-4 border-t border-slate-200">
                    <label className="block mb-2 text-xs font-semibold tracking-wider uppercase text-slate-600">Restore from Backup</label>
                    <p className="mb-3 text-sm text-slate-500">Select a <code className="px-1 rounded bg-slate-100">.sql</code> file exported from this system.</p>
                    <input type="file" accept=".sql" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                    <p className="px-3 py-2 mt-3 text-xs border rounded-lg text-amber-700 bg-amber-50 border-amber-200">
                      Restore requires running <code>psql</code> manually on the server.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">What Gets Backed Up</h3>
                </div>
                <div className="p-5 space-y-2">
                  {[
                    ['users',             'Customer accounts, balances, face encodings'],
                    ['service_providers', 'Manager accounts'],
                    ['money_transfers',   'Transfer records with fraud scores'],
                    ['fraud_alerts',      'All fraud detection events'],
                    ['travel_records',    'SIM travel blocks'],
                    ['access_logs',       'Login/logout audit trail'],
                    ['user_sessions',     'Active sessions'],
                    ['system_settings',   'Admin configuration'],
                  ].map(([table, desc]) => (
                    <div key={table} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                      <code className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex-shrink-0">{table}</code>
                      <span className="text-xs text-slate-600">{desc}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* PERFORMANCE */}
        {activeTab === 'performance' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Performance</h1>
              <p className="mt-1 text-sm text-slate-600">Transaction and ML model statistics</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
              <StatCard label="Transfers (7d)"   value={stats.txStats?.transfers_7d           ?? '—'} color="text-slate-900" />
              <StatCard label="Fraud Blocked"    value={stats.txStats?.fraud_blocked_7d       ?? '—'} color="text-rose-600" />
              <StatCard label="Fraud Rate"       value={`${stats.txStats?.fraud_rate_7d ?? '—'}%`}   color="text-amber-600" />
              <StatCard label="Face Verified"    value={stats.txStats?.face_verified_transfers ?? '—'} color="text-emerald-600" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Transaction Statistics</h3>
                </div>
                <div className="p-5">
                  {stats.txStats ? (
                    <div className="space-y-2">
                      {[
                        ['Transfers Today',  stats.txStats.transfers_today            ?? 0, 'text-slate-900'],
                        ['Transfers (7d)',   stats.txStats.transfers_7d               ?? 0, 'text-slate-900'],
                        ['Fraud Blocked',    stats.txStats.fraud_blocked_7d           ?? 0, 'text-rose-600'],
                        ['Fraud Rate (7d)',  `${stats.txStats.fraud_rate_7d ?? 0}%`,      'text-amber-600'],
                        ['Volume (7d)',      `${Number(stats.txStats.total_volume_7d ?? 0).toLocaleString()} RWF`, 'text-sky-700'],
                        ['Face Verified',    stats.txStats.face_verified_transfers    ?? 0, 'text-emerald-600'],
                      ].map(([label, val, cls]) => (
                        <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <span className="text-sm font-medium text-slate-600">{label}</span>
                          <span className={`text-sm font-bold ${cls}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">Loading…</p>}
                </div>
              </Card>
              <Card className="mb-0">
                <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Live ML Model</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Model',     stats.health?.ml_model  ?? '—'],
                      ['Threshold', stats.health?.threshold ?? '—'],
                      ['Fraud F1',  stats.health?.fraud_f1  ?? '—'],
                      ['Status',    stats.health?.status    ?? '—'],
                    ].map(([label, val]) => (
                      <div key={label} className="p-4 text-center border bg-slate-50 border-slate-200 rounded-xl">
                        <div className="font-mono text-base font-black text-slate-900">{String(val)}</div>
                        <div className="mt-1 text-xs text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
              <p className="mt-1 text-sm text-slate-600">Changes take effect immediately and persist to the database</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-5 text-center border-b border-slate-300">
                <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-800">System Configuration</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                  <div>
                    <FormField label="System Name">
                      <Input value={settings.system_name} onChange={e => setSettings({...settings, system_name: e.target.value})} />
                      <p className="mt-1 text-xs text-slate-500">Display name shown in the dashboard header.</p>
                    </FormField>
                    <FormField label="Max Transfer Amount (RWF)">
                      <Input type="number" value={settings.max_transfer} onChange={e => setSettings({...settings, max_transfer: e.target.value})} />
                      <p className="mt-1 text-xs text-slate-500">Transfers above this amount are blocked.</p>
                    </FormField>
                    <FormField label="Fraud Detection Threshold (0.0 – 1.0)">
                      <div className="flex items-center gap-3">
                        <Input type="number" step="0.01" min="0.01" max="0.99" value={settings.fraud_threshold}
                          onChange={e => setSettings({...settings, fraud_threshold: parseFloat(e.target.value) || settings.fraud_threshold})}
                          className="flex-1" />
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-300 px-3 py-2.5 rounded-xl whitespace-nowrap">
                          Live: {stats.health?.threshold ?? settings.fraud_threshold}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">ML score above this triggers REQUIRE_FACE or BLOCK. Recommended: 0.35–0.50.</p>
                    </FormField>
                  </div>
                  <div>
                    <FormField label="Session Timeout (minutes)">
                      <Input type="number" min="5" max="1440" value={settings.session_timeout} onChange={e => setSettings({...settings, session_timeout: e.target.value})} />
                      <p className="mt-1 text-xs text-slate-500">How long before an inactive session expires. Default: 1440 (24 hours).</p>
                    </FormField>
                    <FormField label="Max PIN Attempts Before Lockout">
                      <Input type="number" min="1" max="10" value={settings.max_pin_attempts} onChange={e => setSettings({...settings, max_pin_attempts: e.target.value})} />
                      <p className="mt-1 text-xs text-slate-500">Wrong PIN attempts before account locks. Default: 3.</p>
                    </FormField>
                    <div className="pt-4">
                      <Btn className="justify-center w-full" onClick={saveSettings}>
                        <Save className="w-4 h-4" /> Save All Settings
                      </Btn>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

      </main>

      {/* ── Provider Modal ── */}
      {showProviderModal && (
        <Modal title={editingProvider ? 'Edit Manager' : 'Add Manager'} onClose={() => setShowProviderModal(false)}>
          <form onSubmit={saveProvider}>
            <FormField label="Full Name"><Input value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} required /></FormField>
            <FormField label="Email"><Input type="email" value={providerForm.email} onChange={e => setProviderForm({...providerForm, email: e.target.value})} required /></FormField>
            <FormField label="Phone"><Input value={providerForm.phone} onChange={e => setProviderForm({...providerForm, phone: e.target.value})} placeholder="2507XXXXXXXX" /></FormField>
            <FormField label="National ID"><Input value={providerForm.national_id} onChange={e => setProviderForm({...providerForm, national_id: e.target.value})} /></FormField>
            <FormField label="Sex">
              <Sel value={providerForm.sex} onChange={e => setProviderForm({...providerForm, sex: e.target.value})}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Sel>
            </FormField>
            <FormField label="Status">
              <Sel value={providerForm.status} onChange={e => setProviderForm({...providerForm, status: e.target.value})}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Sel>
            </FormField>
            {!editingProvider && (
              <FormField label="Password"><Input type="password" value={providerForm.password} onChange={e => setProviderForm({...providerForm, password: e.target.value})} required /></FormField>
            )}
            <div className="flex gap-3 pt-2">
              <Btn type="button" variant="ghost" className="justify-center flex-1" onClick={() => setShowProviderModal(false)}>Cancel</Btn>
              <Btn type="submit" className="justify-center flex-1">{editingProvider ? 'Update' : 'Add'} Manager</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* ── User Modal ── */}
      {showUserModal && (
        <Modal title="Edit Customer" onClose={() => setShowUserModal(false)}>
          <form onSubmit={saveUser}>
            <FormField label="Full Name"><Input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required /></FormField>
            <FormField label="Email"><Input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></FormField>
            <FormField label="Phone"><Input value={userForm.phone} readOnly className="cursor-not-allowed bg-slate-50" /></FormField>
            <FormField label="National ID"><Input value={userForm.national_id} onChange={e => setUserForm({...userForm, national_id: e.target.value})} /></FormField>
            <FormField label="Sex">
              <Sel value={userForm.sex} onChange={e => setUserForm({...userForm, sex: e.target.value})}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Sel>
            </FormField>
            <FormField label="Account Balance (RWF)"><Input type="number" step="0.01" value={userForm.balance} onChange={e => setUserForm({...userForm, balance: e.target.value})} /></FormField>
            <FormField label="Status">
              <Sel value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value})}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Sel>
            </FormField>
            <div className="flex gap-3 pt-2">
              <Btn type="button" variant="ghost" className="justify-center flex-1" onClick={() => setShowUserModal(false)}>Cancel</Btn>
              <Btn type="submit" className="justify-center flex-1">Update Customer</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
