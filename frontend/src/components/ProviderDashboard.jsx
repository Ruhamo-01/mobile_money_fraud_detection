import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Search, Users, Send, LogOut, Home, RefreshCw, Check, ArrowUpRight, ArrowDownLeft, ShieldAlert, Activity } from 'lucide-react';
import { fmtRWF, fmtDate, showAlert } from '../utils/helpers';

const API = '';
const TOKEN = () => localStorage.getItem('session_token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + (localStorage.getItem('session_token') || ''),
});

const NavItem = ({ page, icon: Icon, label, badge, activePage, onNavigate }) => (
  <button
    onClick={() => onNavigate(page)}
    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left relative ${
      activePage === page
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon className="flex-shrink-0 w-4 h-4" />
    {label}
    {badge && (
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
        {badge}
      </span>
    )}
  </button>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border-2 border-slate-300 rounded-2xl mb-6 shadow-lg overflow-hidden ${className}`}>{children}</div>
);

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-gradient-to-br from-emerald-500 to-sky-500 text-white hover:shadow-lg hover:-translate-y-0.5',
    ghost: 'bg-transparent text-slate-500 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
  };
  return (
    <button
      className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-1.5 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const AlertMsg = ({ msg }) => (
  msg.show && (
    <div className={`p-3 rounded-lg text-sm mb-4 font-medium ${
      msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
      msg.type === 'error'   ? 'bg-rose-50 text-rose-800 border border-rose-300' :
                               'bg-sky-50 text-sky-800 border border-sky-300'
    }`}>
      {msg.message}
    </div>
  )
);

const StatCard = ({ value, label }) => (
  <div className="p-6 text-center transition-all bg-white border-2 shadow-lg border-slate-200 rounded-2xl hover:border-emerald-300 hover:shadow-xl">
    <div className="mb-1 font-mono text-2xl font-bold text-emerald-600">{value}</div>
    <div className="text-xs font-semibold text-slate-600 mt-1.5">{label}</div>
  </div>
);

// ── XAI Explanation Panel ─────────────────────────────────────────────────
const ExplainPanel = ({ explanation, loading }) => {
  if (loading) return (
    <div className="flex items-center gap-2 p-3 mt-3 text-sm border bg-slate-50 border-slate-200 rounded-xl text-slate-500 animate-pulse">
      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500 flex-shrink-0" />
      Generating ML explanation…
    </div>
  );
  if (!explanation) return null;
  if (!explanation.available) return (
    <div className="p-3 mt-3 text-sm border bg-rose-50 border-rose-200 rounded-xl text-rose-700">
      {explanation.error || 'Explanation unavailable'}
    </div>
  );
  const factors = explanation.top_factors || [];
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.shap_value || f.importance || 0.001)), 0.001);
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
        {factors.slice(0, 5).map((f, i) => {
          const isRisk = f.direction === 'increases_risk';
          const pct = Math.min(Math.abs(f.shap_value || f.importance || 0) / maxImpact * 100, 100);
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-800">{f.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isRisk ? '↑ Increases Risk' : '↓ Decreases Risk'}
                </span>
              </div>
              <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${isRisk ? 'bg-rose-400' : 'bg-emerald-400'}`}
                  style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                />
              </div>
              {f.detail && <p className="text-[10px] text-slate-500 mt-0.5">{f.detail}</p>}
            </div>
          );
        })}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-3 text-[10px] text-slate-500 text-center">
          <div>Score <strong className="block text-sm text-slate-800">{((explanation.fraud_score || 0) * 100).toFixed(1)}%</strong></div>
          <div>Threshold <strong className="block text-sm text-slate-800">{((explanation.threshold || 0.38) * 100).toFixed(0)}%</strong></div>
          <div>Risk <strong className={`block text-sm ${
            explanation.fraud_score >= 0.65 ? 'text-rose-600' :
            explanation.fraud_score >= (explanation.threshold || 0.38) ? 'text-amber-600' : 'text-emerald-600'
          }`}>{explanation.fraud_score >= 0.65 ? 'HIGH' : explanation.fraud_score >= (explanation.threshold || 0.38) ? 'MEDIUM' : 'LOW'}</strong></div>
        </div>
      </div>
    </div>
  );
};

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('overview');
  const [stats, setStats] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMsg, setLookupMsg] = useState({ show: false, message: '', type: 'success' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupTransactions, setLookupTransactions] = useState([]);
  const [lookupFraudAlerts, setLookupFraudAlerts] = useState([]);

  // XAI state
  const [expandedAlert, setExpandedAlert] = useState(null);   // alert id with open explanation
  const [alertExplanations, setAlertExplanations] = useState({});  // { alertId: explanation }
  const [xaiLoading, setXaiLoading] = useState(null);  // alert id currently loading
  
  // Travel control state
  const [travelPhone, setTravelPhone] = useState('');
  const [travelDepart, setTravelDepart] = useState('');
  const [travelReturn, setTravelReturn] = useState('');
  const [travelDest, setTravelDest] = useState('');
  const [travelMsg, setTravelMsg] = useState({ show: false, message: '', type: 'success' });
  const [minDate, setMinDate] = useState('');
  
  const [reactPhone, setReactPhone] = useState('');
  const [reactMsg, setReactMsg] = useState({ show: false, message: '', type: 'success' });
  const [checkTravelPhone, setCheckTravelPhone] = useState('');
  const [travelStatus, setTravelStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    setMinDates();
    const token = TOKEN();
    if (!token) {
      navigate('/login');
      return;
    }
    init();
  }, []);
  
  const setMinDates = () => {
    const today = new Date().toISOString().split('T')[0];
    setMinDate(today);
  };
  
  const init = async () => {
    try {
      const r = await fetch(`${API}/api/validate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: TOKEN() })
      });
      const d = await r.json();
      if (!d.success || d.dashboard_type !== 'provider') {
        navigate('/login');
        return;
      }
      setCurrentUser(d.user);
      loadStats();
      loadAlerts(true);
    } catch {
      navigate('/login');
    }
  };
  
  const doLogout = () => {
    fetch(`${API}/api/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: TOKEN() })
    }).catch(() => {});
    localStorage.clear();
    navigate('/login');
  };
  
  const loadStats = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch(`${API}/api/dashboard/stats`, { headers: authHeaders() }),
        fetch(`${API}/api/health`)
      ]);
      const statsData = await statsRes.json();
      const healthData = await healthRes.json();
      if (statsData.success) {
        setStats({
          ...statsData.stats,
          ml_model: healthData.ml_model || 'Unknown',
          threshold: healthData.threshold || '—'
        });
      }
    } catch (e) {
      console.error('Stats error:', e);
    }
  };
  
  const loadAlerts = async (previewOnly = false) => {
    try {
      const r = await fetch(`${API}/api/fraud/alerts`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) {
        setAlerts(previewOnly ? (d.alerts || []).slice(0, 3) : (d.alerts || []));
      }
    } catch (e) {
      console.error('Alerts error:', e);
    }
  };
  
  const loadUsers = async () => {
    try {
      const r = await fetch(`${API}/api/admin/users`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) {
        setUsers(d.users || []);
        setUsersLoaded(true);
      }
    } catch (e) {
      console.error('Users error:', e);
      setUsersLoaded(true);
    }
  };
  
  const ackAlert = async (alertId) => {
    try {
      const r = await fetch(`${API}/api/fraud/alerts/acknowledge`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ alert_id: alertId })
      });
      const d = await r.json();
      if (d.success) {
        setAlerts(alerts.filter(a => a.id !== alertId));
        setExpandedAlert(null);
        loadStats();
      }
    } catch (e) {
      console.error('Ack error:', e);
    }
  };

  const fetchExplanation = async (alert) => {
    // Use stored explanation from the alert if available
    const stored = alert.explanation;
    if (stored) {
      setAlertExplanations(prev => ({ ...prev, [alert.id]: stored }));
      setExpandedAlert(expandedAlert === alert.id ? null : alert.id);
      return;
    }
    // Already fetched via API — just toggle
    if (alertExplanations[alert.id]) {
      setExpandedAlert(expandedAlert === alert.id ? null : alert.id);
      return;
    }
    // Fallback: fetch from API (for old alerts without stored explanation)
    setXaiLoading(alert.id);
    setExpandedAlert(alert.id);
    try {
      const r = await fetch(`${API}/api/explain-transaction`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          phone_number: alert.phone_number || alert.phone,
          amount      : alert.amount || 0,
          network     : 'MTN'
        })
      });
      const d = await r.json();
      if (d.success) {
        setAlertExplanations(prev => ({ ...prev, [alert.id]: d.explanation }));
      } else {
        setAlertExplanations(prev => ({ ...prev, [alert.id]: { available: false, error: d.error } }));
      }
    } catch (e) {
      setAlertExplanations(prev => ({ ...prev, [alert.id]: { available: false, error: 'Network error' } }));
    } finally {
      setXaiLoading(null);
    }
  };
  
  const lookupUser = async () => {
    if (!lookupPhone) {
        showAlert(setLookupMsg, 'Please enter a phone number', 'error');
        return;
    }
    setLookupLoading(true);
    setLookupTransactions([]);
    setLookupFraudAlerts([]);
    // Strip any existing +250 or 250 prefix before prepending, to avoid double prefix
    const cleanPhone = lookupPhone.replace(/^\+?250/, '');
    try {
      const r = await fetch(`${API}/api/admin/user-lookup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone_number: '+250' + cleanPhone })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setLookupMsg, 'User found successfully', 'success');
        setLookupResult(d.user);
        // Use embedded data from the lookup response instead of separate broken routes
        setLookupTransactions(d.user?.transactions || []);
        setLookupFraudAlerts(d.user?.alerts || []);

      } else {
        showAlert(setLookupMsg, d.error || 'User not found', 'error');
        setLookupResult(null);
      }
    } catch (e) {
      showAlert(setLookupMsg, 'Network error. Please try again.', 'error');
    } finally {
      setLookupLoading(false);
    }
  };
  
  const registerTravel = async () => {
    if (!travelPhone || !travelDepart || !travelReturn || !travelDest) {
      showAlert(setTravelMsg, 'Please fill in all fields', 'error');
      return;
    }
    try {
      const r = await fetch(`${API}/api/admin/travel/register`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          phone_number: '+250' + travelPhone,
          departure_date: travelDepart,
          return_date: travelReturn,
          destination: travelDest
        })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setTravelMsg, 'Travel registered successfully', 'success');
      } else {
        showAlert(setTravelMsg, d.error || 'Failed to register travel', 'error');
      }
    } catch (e) {
      showAlert(setTravelMsg, 'Network error. Please try again.', 'error');
    }
  };
  
  const reactivateSim = async () => {
    if (!reactPhone) {
      showAlert(setReactMsg, 'Please enter a phone number', 'error');
      return;
    }
    try {
      const r = await fetch(`${API}/api/admin/travel/reactivate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone_number: '+250' + reactPhone })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setReactMsg, 'SIM reactivated successfully', 'success');
      } else {
        showAlert(setReactMsg, d.error || 'Failed to reactivate SIM', 'error');
      }
    } catch (e) {
      showAlert(setReactMsg, 'Network error. Please try again.', 'error');
    }
  };
  
  const checkTravel = async () => {
    if (!checkTravelPhone) return;
    try {
      const r = await fetch(`${API}/api/admin/travel/status`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ phone_number: '+250' + checkTravelPhone })
      });
      const d = await r.json();
      if (d.success) {
        setTravelStatus(d.travel_info);
      } else {
        setTravelStatus(null);
      }
    } catch (e) {
      console.error('Check travel error:', e);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-[230px] flex-shrink-0 bg-white border-2 border-slate-300 rounded-2xl m-4 h-[calc(100vh-32px)] flex flex-col relative z-10 overflow-hidden shadow-lg">
        <div className="p-5.5 border-b border-slate-300 text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-2.5">
            SP
          </div>
          <div className="text-sm font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
            MoMo Shield
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Manager's Dashboard</div>
        </div>
        
        <div className="p-3.5 border-b border-slate-300 text-center">
          <div className="text-xs font-bold text-slate-700">Manager</div>
          <div className="text-[11px] mt-2 bg-emerald-100 border border-emerald-300 rounded-lg py-2 px-3 font-mono font-semibold text-emerald-700">
            System Access
          </div>
        </div>
        
        <nav className="p-3.5 flex-1 min-h-0 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">Overview</div>
          <NavItem page="overview" icon={LayoutDashboard} label="Overview" activePage={activePage} onNavigate={(p) => { setActivePage(p); loadStats(); loadAlerts(true); }} />
          <NavItem page="alerts" icon={AlertTriangle} label="Fraud Alerts" badge={stats.unacked_alerts > 0 ? stats.unacked_alerts : null} activePage={activePage} onNavigate={(p) => { setActivePage(p); loadAlerts(); }} />
          
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">User Management</div>
          <NavItem page="user-lookup" icon={Search} label="Customer Lookup" activePage={activePage} onNavigate={setActivePage} />
          <NavItem page="users" icon={Users} label="All Customers" activePage={activePage} onNavigate={(p) => { setActivePage(p); loadUsers(); }} />
          
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">Admin Functions</div>
          <NavItem page="travel" icon={Send} label="Travel Control" activePage={activePage} onNavigate={setActivePage} />
        </nav>
        
        <Button variant="ghost" onClick={doLogout} className="mx-4 mb-4 w-[calc(100%-32px)] justify-center">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </aside>
      
      {/* Main Content */}
      <main className="relative flex flex-col flex-1 h-screen p-6 overflow-y-auto z-5">
        {/* Overview Page */}
        {activePage === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
                <p className="mt-1 text-sm text-slate-600">Real-time fraud protection statistics</p>
              </div>
              <Button variant="ghost" onClick={() => { loadStats(); loadAlerts(true); }} className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 mb-6">
              <StatCard value={stats.total_users ?? '—'} label="Total Customers" />
              <StatCard value={stats.active_users ?? '—'} label="Active Customers" />
              <StatCard value={stats.users_abroad ?? '—'} label="Customers Abroad" />
              <StatCard value={stats.transfers_today ?? '—'} label="Transfers Today" />
              <StatCard value={stats.fraud_blocked_7d ?? '—'} label="Fraud Blocked (7d)" />
              <StatCard value={(stats.fraud_rate_7d ?? '—') + '%'} label="Fraud Rate (7d)" />
              <StatCard value={stats.face_verified_transfers ?? '—'} label="Face Verified" />
              <StatCard value={fmtRWF(stats.total_volume_7d || 0)} label="Volume (7d)" />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mb-2.5">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Recent Fraud Alerts</h2>
                </div>
                <div className="p-0">
                  {alerts.length === 0 ? (
                    <div className="p-10 text-sm text-center text-slate-500">No alerts</div>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className="p-4 border-b border-slate-200 last:border-0">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500' :
                            (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800">{alert.message || '—'}</div>
                            <div className="text-[11px] text-slate-500 mt-1 font-mono">
                              {fmtDate(alert.created_at)} | Score: {((alert.fraud_score || 0) * 100).toFixed(1)}% | {alert.action || '—'}
                            </div>
                            <ExplainPanel
                              explanation={expandedAlert === alert.id ? alertExplanations[alert.id] : null}
                              loading={xaiLoading === alert.id}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => fetchExplanation(alert)}
                              className={`px-2.5 py-1.5 text-xs rounded border transition-all inline-flex items-center gap-1 ${
                                expandedAlert === alert.id
                                  ? 'bg-violet-100 text-violet-700 border-violet-300'
                                  : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300'
                              }`}
                            >
                              <Activity className="w-3 h-3" />
                              {expandedAlert === alert.id ? 'Hide' : 'Explain'}
                            </button>
                            <button
                              onClick={() => ackAlert(alert.id)}
                              className="px-2.5 py-1.5 text-xs rounded bg-slate-100 text-slate-500 border border-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Transaction History */}
{lookupResult && (
  <Card>
    <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mb-2.5">
        <ArrowUpRight className="w-5 h-5 text-white" />
      </div>
      <h2 className="text-base font-bold text-slate-800">Transaction History</h2>
    </div>
    <div className="p-0">
      {lookupTransactions.length === 0 ? (
        <div className="p-8 text-sm text-center text-slate-500">No transactions found</div>
      ) : (
        lookupTransactions.map((tx, i) => {
          const isSent = tx.sender_phone === ('+250' + lookupPhone);
          return (
            <div key={tx.id ?? i} className="flex items-center gap-3 p-4 text-sm border-b border-slate-200">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isSent ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              }`}>
                {isSent ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{isSent ? `To: ${tx.receiver_phone}` : `From: ${tx.sender_phone}`}</div>
                <div className="text-slate-500 font-mono mt-0.5">{fmtDate(tx.created_at)}</div>
              </div>
              <div className={`font-bold font-mono ${isSent ? 'text-rose-500' : 'text-emerald-500'}`}>
                {isSent ? '-' : '+'}{fmtRWF(tx.amount || 0)}
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                tx.status === 'blocked' ? 'bg-rose-500/10 text-rose-500' :
                'bg-amber-100 text-amber-700 border border-amber-300'
              }`}>
                {tx.status || '—'}
              </div>
            </div>
          );
        })
      )}
    </div>
  </Card>
)}

{/* Fraud Alerts for this user */}
{lookupResult && (
  <Card>
    <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mb-2.5">
        <ShieldAlert className="w-5 h-5 text-white" />
      </div>
      <h2 className="text-base font-bold text-slate-800">Fraud Alerts</h2>
    </div>
    <div className="p-0">
      {lookupFraudAlerts.length === 0 ? (
        <div className="p-8 text-sm text-center text-slate-500">No fraud alerts for this user</div>
      ) : (
        lookupFraudAlerts.map((alert, i) => (
          <div key={alert.id ?? i} className="flex items-start gap-3 p-4 border-b border-slate-200">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
              (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500' :
              (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500' :
              'bg-emerald-500'
            }`} />
            <div className="flex-1">
              <div className="text-sm">{alert.message || '—'}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                {fmtDate(alert.created_at)} | Score: {((alert.fraud_score || 0) * 100).toFixed(1)}% | {alert.action || '—'}
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
              (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
              'bg-emerald-100 text-emerald-700 border border-emerald-300'
            }`}>
              {alert.risk_level || 'low'}
            </span>
          </div>
        ))
      )}
    </div>
  </Card>
)}
              
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Fraud Model Status</h2>
                </div>
                <div className="p-6">
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-xs font-medium text-slate-600">Model</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{stats.ml_model || 'Loading…'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-xs font-medium text-slate-600">Threshold</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{stats.threshold || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-xs font-medium text-slate-600">Status</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase">Loaded</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {/* Alerts Page */}
        {activePage === 'alerts' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Fraud Alerts
              </h1>
              <p className="mt-1 text-sm text-slate-600">Unacknowledged fraud detection alerts</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mb-2.5">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-800">All Alerts</h2>
              </div>
              <div className="p-0">
                {alerts.length === 0 ? (
                  <div className="p-10 text-sm text-center text-slate-500">No alerts</div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="p-4 border-b border-slate-200 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                          (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500' :
                          (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800">{alert.message || '—'}</div>
                          <div className="text-[11px] text-slate-500 mt-1 font-mono">
                            {fmtDate(alert.created_at)} | Score: {((alert.fraud_score || 0) * 100).toFixed(1)}% | {alert.action || '—'}
                          </div>
                          <ExplainPanel
                            explanation={expandedAlert === alert.id ? alertExplanations[alert.id] : null}
                            loading={xaiLoading === alert.id}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => fetchExplanation(alert)}
                            className={`px-2.5 py-1.5 text-xs rounded border transition-all inline-flex items-center gap-1 ${
                              expandedAlert === alert.id
                                ? 'bg-violet-100 text-violet-700 border-violet-300'
                                : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300'
                            }`}
                          >
                            <Activity className="w-3 h-3" />
                            {expandedAlert === alert.id ? 'Hide' : 'Explain'}
                          </button>
                          <button
                            onClick={() => ackAlert(alert.id)}
                            className="px-2.5 py-1.5 text-xs rounded bg-slate-100 text-slate-500 border border-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
        
        {/* User Lookup Page */}
        {activePage === 'user-lookup' && (
  <div>
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">
        User Lookup
      </h1>
      <p className="mt-1 text-sm text-slate-600">Search customer by phone number</p>
    </div>
    
    <div className="max-w-[600px] mx-auto">
      <Card>
        <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
            <Search className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Search by Phone Number</h2>
        </div>
        <div className="p-6">
          <AlertMsg msg={lookupMsg} />
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-900 mb-1.5">Customer Phone Number</label>
            <div className="flex items-center border rounded-lg border-slate-300 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/10">
              <span className="px-3.5 py-2.5 text-slate-500 font-mono text-sm border-r border-slate-300">+250</span>
              <input
                type="text"
                value={lookupPhone}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 9); setLookupPhone(v); }}
                placeholder="78XXXXXXX"
                maxLength={9}
                className="flex-1 px-3.5 py-2.5 border-none bg-none text-sm focus:outline-none"
              />
            </div>
          </div>
          <Button onClick={lookupUser} disabled={lookupLoading} className="justify-center w-full">
            <Search className="w-4 h-4" />
            {lookupLoading ? 'Looking up...' : 'Search User'}
          </Button>
        </div>
      </Card>
      
      {lookupResult && (
        <Card>
          <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Customer Details</h2>
          </div>
          <div className="p-6">
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="font-medium text-slate-600">Name</span>
              <span className="font-semibold text-slate-900">{lookupResult.name || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="font-medium text-slate-600">Phone</span>
              <span className="font-mono font-semibold text-slate-900">{lookupResult.phone || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="font-medium text-slate-600">Email</span>
              <span className="font-semibold text-slate-900">{lookupResult.email || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="font-medium text-slate-600">Balance</span>
              <span className="font-mono font-bold text-emerald-700">{fmtRWF(lookupResult.balance || 0)}</span>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <span className="font-medium text-slate-600">Status</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${lookupResult.is_active ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300'}`}>
                {lookupResult.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </Card>
      )}
      
      {/* Transaction History */}
      {lookupResult && (
        <Card>
          <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mb-2.5">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Transaction History</h2>
          </div>
          <div className="p-0">
            {lookupTransactions.length === 0 ? (
              <div className="p-8 text-sm text-center text-slate-500">No transactions found</div>
            ) : (
              lookupTransactions.map((tx, i) => {
                const isSent = tx.sender_phone === ('+250' + lookupPhone);
                return (
                  <div key={tx.id ?? i} className="flex items-center gap-3 p-4 text-sm border-b border-slate-200">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSent ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    }`}>
                      {isSent ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{isSent ? `To: ${tx.receiver_phone}` : `From: ${tx.sender_phone}`}</div>
                      <div className="text-slate-500 font-mono mt-0.5">{fmtDate(tx.created_at)}</div>
                    </div>
                    <div className={`font-bold font-mono ${isSent ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {isSent ? '-' : '+'}{fmtRWF(tx.amount || 0)}
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                      tx.status === 'blocked'   ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                                                  'bg-amber-100 text-amber-700 border border-amber-300'
                    }`}>
                      {tx.status || '—'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
      
      {/* Fraud Alerts for this user */}
      {lookupResult && (
        <Card>
          <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mb-2.5">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Fraud Alerts</h2>
          </div>
          <div className="p-0">
            {lookupFraudAlerts.length === 0 ? (
              <div className="p-8 text-sm text-center text-slate-500">No fraud alerts for this customer</div>
            ) : (
              lookupFraudAlerts.map((alert, i) => (
                <div key={alert.id ?? i} className="flex items-start gap-3 p-4 border-b border-slate-200">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                    (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500' :
                    (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500' :
                    'bg-emerald-500'
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm">{alert.message || '—'}</div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono">
                      {fmtDate(alert.created_at)} | Score: {((alert.fraud_score || 0) * 100).toFixed(1)}% | {alert.action || '—'}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                    (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                    'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  }`}>
                    {alert.risk_level || 'low'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  </div>
)}
        
        {/* All Customers Page */}
        {activePage === 'users' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                All Customers
              </h1>
              <p className="mt-1 text-sm text-slate-600">Customer management</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 flex items-center justify-center mb-2.5">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Customer Registry</h2>
              </div>
              <div className="p-0">
                {!usersLoaded ? (
                  <div className="p-10 text-sm text-center text-slate-500">Loading customers...</div>
                ) : users.length === 0 ? (
                  <div className="p-10 text-sm text-center text-slate-500">No customers found.</div>
                ) : (
                  users.map((user) => (
                    <div key={user.phone_number} className="flex items-center justify-between p-4 text-sm transition-colors border-b border-slate-200 hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">{user.full_name || '—'}</div>
                        <div className="font-mono text-slate-500 mt-0.5">{user.phone_number || '—'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <div className="font-mono font-bold text-emerald-700">{fmtRWF(user.account_balance || 0)}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          user.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'
                        }`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
        
        {/* Travel Control Page */}
        {activePage === 'travel' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Travel Control
              </h1>
              <p className="mt-1 text-sm text-slate-600">Manage customer travel registrations and SIM blocking</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center mb-2.5">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Register Travel</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Block SIM when customer travels abroad</p>
                </div>
                <div className="p-6">
                  <AlertMsg msg={travelMsg} />
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Phone Number</label>
                    <div className="flex items-center border rounded-lg border-slate-300 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/10">
                      <span className="px-3.5 py-2.5 text-slate-500 font-mono text-sm border-r border-slate-300">+250</span>
                      <input
                        type="text"
                        value={travelPhone}
                        onChange={(e) => setTravelPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="78XXXXXXX"
                        maxLength={9}
                        className="flex-1 px-3.5 py-2.5 border-none bg-none text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1.5">Departure Date</label>
                      <input
                        type="date"
                        value={travelDepart}
                        min={minDate}
                        onChange={(e) => setTravelDepart(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1.5">Return Date</label>
                      <input
                        type="date"
                        value={travelReturn}
                        min={travelDepart || minDate}
                        onChange={(e) => setTravelReturn(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                  </div>
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Destination Country</label>
                    <input
                      type="text"
                      value={travelDest}
                      onChange={(e) => setTravelDest(e.target.value)}
                      placeholder="e.g. Uganda, Kenya, France"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                    />
                  </div>
                  <Button onClick={registerTravel} className="justify-center w-full">
                    <Send className="w-4 h-4" />
                    Block SIM & Register Travel
                  </Button>
                </div>
              </Card>
              
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Reactivate on Return</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Re-enable transfers after customer returns</p>
                </div>
                <div className="p-6">
                  <AlertMsg msg={reactMsg} />
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Phone Number</label>
                    <div className="flex items-center border rounded-lg border-slate-300 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/10">
                      <span className="px-3.5 py-2.5 text-slate-500 font-mono text-sm border-r border-slate-300">+250</span>
                      <input
                        type="text"
                        value={reactPhone}
                        onChange={(e) => setReactPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="78XXXXXXX"
                        maxLength={9}
                        className="flex-1 px-3.5 py-2.5 border-none bg-none text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <Button onClick={reactivateSim} className="justify-center w-full mb-5">
                    <Home className="w-4 h-4" />
                    Confirm Return & Re-enable SIM
                  </Button>
                  <hr className="my-5 border-slate-300" />
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Check Travel Status</label>
                    <div className="flex items-center border rounded-lg border-slate-300 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/10">
                      <span className="px-3.5 py-2.5 text-slate-500 font-mono text-sm border-r border-slate-300">+250</span>
                      <input
                        type="text"
                        value={checkTravelPhone}
                        onChange={(e) => setCheckTravelPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="78XXXXXXX"
                        maxLength={9}
                        className="flex-1 px-3.5 py-2.5 border-none bg-none text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" onClick={checkTravel} className="justify-center w-full">Check Status</Button>
                  {travelStatus && (
                    <div className="p-3 mt-3 space-y-1 text-xs border rounded-xl bg-sky-50 text-sky-800 border-sky-200">
                      {travelStatus.destination_country && <div><span className="font-semibold">Destination:</span> {travelStatus.destination_country}</div>}
                      {travelStatus.departure_date && <div><span className="font-semibold">Departed:</span> {fmtDate(travelStatus.departure_date)}</div>}
                      {travelStatus.return_date && <div><span className="font-semibold">Returns:</span> {fmtDate(travelStatus.return_date)}</div>}
                      <div><span className="font-semibold">SIM Blocked:</span> {travelStatus.sim_deactivated ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}