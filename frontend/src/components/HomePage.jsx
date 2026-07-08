import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Menu, X, ArrowRight,
  Users, Activity, AlertTriangle, TrendingUp,
  Smartphone, UserCheck, Brain, Lock, Fingerprint, Globe
} from 'lucide-react';

const API = '';

export default function HomePage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({
    total_users: '—', transfers_today: '—',
    fraud_blocked_7d: '—', fraud_rate_7d: '—'
  });

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/public/stats`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {});
  }, []);

  const features = [
    { icon: Brain,       label: 'ML Fraud Detection',      sub: 'XGBoost · 97.3% AUC' },
    { icon: Fingerprint, label: 'Face Verification',        sub: 'Biometric identity gate' },
    { icon: Lock,        label: 'PIN Security',             sub: '3-strike lockout' },
    { icon: Globe,       label: 'Travel Abroad Control',  sub: 'Verify identity when abroad' },
  ];

  const roles = [
    {
      icon: Smartphone,
      color: 'emerald',
      title: 'Customer',
      desc: 'Send money, check balance, and manage your account securely.',
    },
    {
      icon: UserCheck,
      color: 'violet',
      title: 'Manager',
      desc: 'Monitor fraud alerts, look up customers, and manage travel controls.',
    },
    {
      icon: Users,
      color: 'rose',
      title: 'Administrator',
      desc: 'Full system control — users, managers, settings, and backups.',
    },
  ];

  const colorMap = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    violet:  { bg: 'bg-violet-100',  text: 'text-violet-600',  border: 'border-violet-200',  btn: 'bg-violet-600 hover:bg-violet-700' },
    rose:    { bg: 'bg-rose-100',    text: 'text-rose-600',    border: 'border-rose-200',    btn: 'bg-rose-600 hover:bg-rose-700' },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white border-b border-slate-200 shadow-sm' : 'bg-white/90 backdrop-blur-sm'}`}>
        <div className="flex items-center justify-between max-w-6xl px-5 mx-auto h-14">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">MoMo Shield</span>
          </div>

          <div className="items-center hidden gap-6 md:flex">
            <a href="#features" className="text-sm font-medium transition-colors text-slate-600 hover:text-slate-900">Features</a>
            <a href="#dashboards" className="text-sm font-medium transition-colors text-slate-600 hover:text-slate-900">Dashboards</a>
            <button onClick={() => navigate('/login')} className="text-sm transition-colors text-slate-600 hover:text-slate-900">Sign In</button>
            <button onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-semibold text-white transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700">
              Get Started
            </button>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg md:hidden text-slate-600 hover:bg-slate-100">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="px-5 py-4 space-y-1 bg-white border-t md:hidden border-slate-200">
            {['#features', '#dashboards'].map((href, i) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-sm font-medium text-slate-700 hover:text-emerald-600">
                {['Features', 'Dashboards'][i]}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => navigate('/login')} className="w-full py-2.5 text-sm font-medium border border-slate-300 rounded-lg text-slate-700">Sign In</button>
              <button onClick={() => navigate('/login')} className="w-full py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg">Get Started</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="px-5 pb-20 text-center pt-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 mb-6 text-xs font-semibold border rounded-full text-emerald-700 bg-emerald-100 border-emerald-200">
            ML-Powered · Rwanda MoMo · Real-Time
          </span>
          <h1 className="mb-5 text-4xl font-black leading-tight sm:text-5xl md:text-6xl text-slate-900">
            Protect Every<br />
            <span className="text-emerald-600">Mobile Transaction</span>
          </h1>
          <p className="max-w-xl mx-auto mb-8 text-base font-medium leading-relaxed sm:text-lg text-slate-600">
            MoMo Shield uses machine learning and biometric verification to detect and block fraud before it reaches your customers.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate('/login')}
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-sm">
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center px-7 py-3.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors text-sm bg-white">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-5 py-12 bg-white border-y border-slate-200">
        <div className="grid max-w-4xl grid-cols-2 gap-4 mx-auto md:grid-cols-4">
          {[
            { label: 'Customers',       value: stats.total_users,      icon: Users,         color: 'text-emerald-600' },
            { label: 'Transfers Today', value: stats.transfers_today,  icon: Activity,      color: 'text-sky-600' },
            { label: 'Fraud Blocked',   value: stats.fraud_blocked_7d, icon: AlertTriangle, color: 'text-rose-600' },
            { label: 'Fraud Rate (7d)', value: `${stats.fraud_rate_7d}%`, icon: TrendingUp, color: 'text-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="py-4 text-center">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
              <div className={`text-2xl font-black font-mono ${color}`}>{value ?? '—'}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-5 py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold sm:text-3xl text-slate-900">Built for Security</h2>
            <p className="text-sm text-slate-600">Four layers of protection on every transaction.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-4 p-5 transition-all bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-sm">
                <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARDS ── */}
      <section id="dashboards" className="px-5 py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-2xl font-bold sm:text-3xl text-slate-900">Three Roles, One Platform</h2>
            <p className="text-sm text-slate-600">Each role gets a purpose-built dashboard.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {roles.map(({ icon: Icon, color, title, desc }) => {
              const c = colorMap[color];
              return (
                <div key={title} className={`border ${c.border} rounded-2xl p-6 hover:shadow-md transition-all`}>
                  <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <h3 className="mb-1 text-base font-bold text-slate-900">{title}</h3>
                  <p className="mb-5 text-sm leading-relaxed text-slate-600">{desc}</p>
                  <button onClick={() => navigate('/login')}
                    className={`w-full py-2 text-xs font-semibold text-white rounded-lg ${c.btn} transition-colors`}>
                    Open Dashboard
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 py-8 border-t border-slate-200 bg-slate-50">
        <div className="flex flex-col items-center justify-between max-w-6xl gap-4 mx-auto sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg w-7 h-7 bg-gradient-to-br from-emerald-500 to-sky-500">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">MoMo Shield</span>
            <span className="text-xs text-slate-400">v2.0</span>
          </div>
          <p className="text-xs font-medium text-slate-500">ML-Powered Mobile Money Fraud Detection · Rwanda · MTN </p>
          <button onClick={() => navigate('/login')}
            className="text-xs font-semibold transition-colors text-emerald-700 hover:text-emerald-800">
            Sign In →
          </button>
        </div>
      </footer>
    </div>
  );
}
