import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Search, Users, Send, LogOut, Home, RefreshCw, Check, ArrowUpRight, ArrowDownLeft, ShieldAlert } from 'lucide-react';
import { fmtRWF, fmtDate, showAlert, setLoading } from '../utils/helpers';

const API = '';
const TOKEN = () => localStorage.getItem('session_token');

const NavItem = ({ page, icon: Icon, label, badge, activePage, onNavigate }) => (
  <button
    onClick={() => onNavigate(page)}
    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all w-full text-left font-sans relative ${
      activePage === page
        ? 'bg-emerald-500/10 text-emerald-500'
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
      className={`px-4 py-2.5 rounded-lg font-semibold text-xs transition-all font-sans inline-flex items-center gap-1.5 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const AlertMsg = ({ msg }) => (
  msg.show && (
    <div className={`p-2.5 rounded-lg text-xs mb-4 ${
      msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
      msg.type === 'error' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
      'bg-sky-500/10 text-sky-500 border border-sky-500/20'
    }`}>
      {msg.message}
    </div>
  )
);

const StatCard = ({ value, label }) => (
  <div className="p-6 text-center bg-white border-2 shadow-lg border-slate-300 rounded-2xl">
    <div className="font-mono text-2xl font-bold text-emerald-500">{value}</div>
    <div className="text-xs text-slate-500 mt-1.5">{label}</div>
  </div>
);

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('overview');
  const [stats, setStats] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMsg, setLookupMsg] = useState({ show: false, message: '', type: 'success' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupTransactions, setLookupTransactions] = useState([]);
  const [lookupFraudAlerts, setLookupFraudAlerts] = useState([]);
  
  // Travel control state
  const [travelPhone, setTravelPhone] = useState('');
  const [travelDepart, setTravelDepart] = useState('');
  const [travelReturn, setTravelReturn] = useState('');
  const [travelDest, setTravelDest] = useState('');
  const [travelMsg, setTravelMsg] = useState({ show: false, message: '', type: 'success' });
  
  const [reactPhone, setReactPhone] = useState('');
  const [reactMsg, setReactMsg] = useState({ show: false, message: '', type: 'success' });
  const [checkTravelPhone, setCheckTravelPhone] = useState('');
  const [travelStatus, setTravelStatus] = useState(null);
  
  let currentUser = null;
  
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
    // Set min dates for travel inputs
  };
  
  const init = async () => {
    try {
      const r = await fetch(`${API}/api/validate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: TOKEN() })
      });
      const d = await r.json();
      if (!d.success) {
        navigate('/login');
        return;
      }
      currentUser = d.user;
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
        fetch(`${API}/api/dashboard/stats`),
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
      const r = await fetch(`${API}/api/fraud/alerts`);
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
      const r = await fetch(`${API}/api/admin/users`);
      const d = await r.json();
      if (d.success) {
        setUsers(d.users || []);
      }
    } catch (e) {
      console.error('Users error:', e);
    }
  };
  
  const ackAlert = async (alertId) => {
    try {
      const r = await fetch(`${API}/api/fraud/alerts/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId })
      });
      const d = await r.json();
      if (d.success) {
        setAlerts(alerts.filter(a => a.id !== alertId));
        loadStats();
      }
    } catch (e) {
      console.error('Ack error:', e);
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
    try {
      const r = await fetch(`${API}/api/admin/user-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+250' + lookupPhone })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setLookupMsg, 'User found successfully', 'success');
        setLookupResult(d.user);

        // Fetch transaction history
        try {
          const tr = await fetch(`${API}/api/admin/user-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: '+250' + lookupPhone })
          });
          const td = await tr.json();
          if (td.success) setLookupTransactions(td.transactions || []);
        } catch {}

        // Fetch fraud alerts for this user
        try {
          const fr = await fetch(`${API}/api/admin/user-fraud-alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: '+250' + lookupPhone })
          });
          const fd = await fr.json();
          if (fd.success) setLookupFraudAlerts(fd.alerts || []);
        } catch {}

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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          <div className="text-xs font-semibold">Manager</div>
          <div className="text-[11px] text-slate-500 mt-2 bg-emerald-500/8 border border-emerald-500/20 rounded-lg py-2 px-3 font-mono font-semibold text-emerald-500">
            System Access
          </div>
        </div>
        
        <nav className="p-3.5 flex-1 min-h-0 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">Overview</div>
          <NavItem page="overview" icon={LayoutDashboard} label="Overview" activePage={activePage} onNavigate={(p) => { setActivePage(p); loadStats(); loadAlerts(true); }} />
          <NavItem page="alerts" icon={AlertTriangle} label="Fraud Alerts" badge={stats.unacked_alerts > 0 ? stats.unacked_alerts : null} activePage={activePage} onNavigate={(p) => { setActivePage(p); loadAlerts(); }} />
          
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">User Management</div>
          <NavItem page="user-lookup" icon={Search} label="User Lookup" activePage={activePage} onNavigate={setActivePage} />
          <NavItem page="users" icon={Users} label="All Users" activePage={activePage} onNavigate={(p) => { setActivePage(p); loadUsers(); }} />
          
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
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
                System Overview
              </h1>
              <p className="mt-1 text-sm text-slate-500">Real-time fraud protection statistics</p>
            </div>
            
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5 mb-6">
              <StatCard value={stats.total_users ?? '—'} label="Total Users" />
              <StatCard value={stats.active_users ?? '—'} label="Active Users" />
              <StatCard value={stats.users_abroad ?? '—'} label="Users Abroad" />
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
                  <h2 className="text-base font-semibold">Recent Fraud Alerts</h2>
                </div>
                <div className="p-0">
                  {alerts.length === 0 ? (
                    <div className="p-10 text-sm text-center text-slate-500">No alerts</div>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-4 border-b border-slate-300">
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
                        <button
                          onClick={() => ackAlert(alert.id)}
                          className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-500 border border-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Dismiss
                        </button>
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
      <h2 className="text-base font-semibold">Transaction History</h2>
    </div>
    <div className="p-0">
      {lookupTransactions.length === 0 ? (
        <div className="p-8 text-sm text-center text-slate-500">No transactions found</div>
      ) : (
        lookupTransactions.map((tx, i) => {
          const isSent = tx.sender_phone === ('+250' + lookupPhone);
          return (
            <div key={tx.id ?? i} className="flex items-center gap-3 p-4 text-xs border-b border-slate-200">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isSent ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
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
                tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                tx.status === 'blocked' ? 'bg-rose-500/10 text-rose-500' :
                'bg-amber-500/10 text-amber-500'
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
      <h2 className="text-base font-semibold">Fraud Alerts</h2>
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
              (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500/10 text-red-500' :
              (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500/10 text-amber-500' :
              'bg-emerald-500/10 text-emerald-500'
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
                  <h2 className="text-base font-semibold">Fraud Model Status</h2>
                </div>
                <div className="p-6">
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-xs text-slate-500">Model</span>
                    <span className="font-mono text-xs font-semibold">{stats.ml_model || 'Loading…'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-xs text-slate-500">Threshold</span>
                    <span className="font-mono text-xs font-semibold">{stats.threshold || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-xs text-slate-500">Status</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase">Loaded</span>
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
              <h1 className="text-2xl font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
                Fraud Alerts
              </h1>
              <p className="mt-1 text-sm text-slate-500">Unacknowledged fraud detection alerts</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center mb-2.5">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-semibold">All Alerts</h2>
              </div>
              <div className="p-0">
                {alerts.length === 0 ? (
                  <div className="p-10 text-sm text-center text-slate-500">No alerts</div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-4 border-b border-slate-300">
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
                      <button
                        onClick={() => ackAlert(alert.id)}
                        className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-500 border border-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
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
      <h1 className="text-2xl font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
        User Lookup
      </h1>
      <p className="mt-1 text-sm text-slate-500">Search user by phone number</p>
    </div>
    
    <div className="max-w-[600px] mx-auto">
      <Card>
        <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
            <Search className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-base font-semibold">Search by Phone Number</h2>
        </div>
        <div className="p-6">
          <AlertMsg msg={lookupMsg} />
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-900 mb-1.5">User Phone Number</label>
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
            <h2 className="text-base font-semibold">User Details</h2>
          </div>
          <div className="p-6">
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="text-slate-500">Name</span>
              <span className="font-mono font-semibold">{lookupResult.name || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="text-slate-500">Phone</span>
              <span className="font-mono font-semibold">{lookupResult.phone || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="text-slate-500">Email</span>
              <span className="font-mono font-semibold">{lookupResult.email || '—'}</span>
            </div>
            <div className="flex justify-between py-3 text-xs border-b border-slate-200">
              <span className="text-slate-500">Balance</span>
              <span className="font-mono font-semibold">{fmtRWF(lookupResult.balance || 0)}</span>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <span className="text-slate-500">Status</span>
              <span className="font-mono font-semibold">{lookupResult.is_active ? 'Active' : 'Inactive'}</span>
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
            <h2 className="text-base font-semibold">Transaction History</h2>
          </div>
          <div className="p-0">
            {lookupTransactions.length === 0 ? (
              <div className="p-8 text-sm text-center text-slate-500">No transactions found</div>
            ) : (
              lookupTransactions.map((tx, i) => {
                const isSent = tx.sender_phone === ('+250' + lookupPhone);
                return (
                  <div key={tx.id ?? i} className="flex items-center gap-3 p-4 text-xs border-b border-slate-200">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSent ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
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
                      tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                      tx.status === 'blocked' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
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
            <h2 className="text-base font-semibold">Fraud Alerts</h2>
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
                    (alert.risk_level || '').toLowerCase() === 'high' ? 'bg-red-500/10 text-red-500' :
                    (alert.risk_level || '').toLowerCase() === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-emerald-500/10 text-emerald-500'
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
        
        {/* All Users Page */}
        {activePage === 'users' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
                All Users
              </h1>
              <p className="mt-1 text-sm text-slate-500">System user management</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 flex items-center justify-center mb-2.5">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-semibold">User Registry</h2>
              </div>
              <div className="p-0">
                {users.length === 0 ? (
                  <div className="p-10 text-sm text-center text-slate-500">Loading users...</div>
                ) : (
                  users.map((user) => (
                    <div key={user.phone_number} className="flex items-center justify-between p-4 text-xs border-b border-slate-300">
                      <div>
                        <div className="font-semibold">{user.full_name || '—'}</div>
                        <div className="font-mono text-slate-500">{user.phone_number || '—'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold">{fmtRWF(user.account_balance || 0)}</div>
                        <div className="text-slate-500">{user.is_active ? 'Active' : 'Inactive'}</div>
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
              <h1 className="text-2xl font-bold text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
                Travel Control
              </h1>
              <p className="mt-1 text-sm text-slate-500">Manage user travel registrations and SIM blocking</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center mb-2.5">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-semibold">Register Travel</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Block SIM when user travels abroad</p>
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
                        onChange={(e) => setTravelDepart(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1.5">Return Date</label>
                      <input
                        type="date"
                        value={travelReturn}
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
                  <h2 className="text-base font-semibold">Reactivate on Return</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Re-enable transfers after user returns</p>
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
                    <div className="mt-3 p-2.5 rounded-lg text-xs bg-sky-500/10 text-sky-500 border border-sky-500/20">
                      {JSON.stringify(travelStatus)}
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