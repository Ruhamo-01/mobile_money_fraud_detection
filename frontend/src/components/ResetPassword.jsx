import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Check, AlertTriangle } from 'lucide-react';

const API = '';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword]     = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [alert, setAlert]                 = useState({ show: false, message: '', type: 'danger' });

  useEffect(() => {
    if (!token) {
      setAlert({ show: true, message: 'Invalid or missing reset link. Please request a new one.', type: 'danger' });
    }
  }, [token]);

  const validate = () => {
    if (!newPassword || newPassword.length < 8) return 'Password must be at least 8 characters.';
    if (!/\d/.test(newPassword))               return 'Password must contain at least one number.';
    if (!/[a-zA-Z]/.test(newPassword))         return 'Password must contain at least one letter.';
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(newPassword)) return 'Password must contain at least one special character.';
    if (newPassword !== confirmPass)            return 'Passwords do not match.';
    return null;
  };

  const doReset = async () => {
    const err = validate();
    if (err) { setAlert({ show: true, message: err, type: 'danger' }); return; }
    if (!token) return;

    setLoading(true);
    setAlert({ show: false, message: '', type: 'danger' });
    try {
      const r = await fetch(`${API}/api/reset-password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      });
      const d = await r.json();
      if (d.success) {
        setDone(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setAlert({ show: true, message: d.error || 'Reset failed. The link may have expired.', type: 'danger' });
      }
    } catch (e) {
      setAlert({ show: true, message: 'Server error. Please try again.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center p-5 bg-slate-50 relative">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(5,150,105,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="w-full max-w-[440px] relative z-10 mt-16">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-sky-500 rounded-2xl inline-flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
            MoMo Shield
          </h1>
        </div>

        <div className="bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-xl">
          <div className="text-center pt-7 px-8">
            <h2 className="text-lg font-bold text-slate-900">
              {done ? ' Password Reset!' : ' Set New Password'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {done ? 'Redirecting you to login…' : 'Enter your new password below'}
            </p>
          </div>
          <hr className="border-slate-300 mt-4" />

          <div className="p-7">
            {/* Alert */}
            {alert.show && (
              <div className={`p-3 rounded text-sm mb-4 flex items-start gap-2 ${
                alert.type === 'success'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {alert.message}
              </div>
            )}

            {done ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-slate-600 text-sm">Your password has been reset successfully.</p>
                <p className="text-slate-400 text-xs mt-1">Taking you to login in 3 seconds…</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-5 w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, letter + number + symbol"
                      className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      onKeyDown={(e) => e.key === 'Enter' && doReset()}
                      className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* Password rules hint */}
                <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-3 mb-5 text-xs space-y-1.5">
                  {[
                    ['At least 8 characters',           newPassword.length >= 8],
                    ['Contains a letter',               /[a-zA-Z]/.test(newPassword)],
                    ['Contains a number',               /\d/.test(newPassword)],
                    ['Contains a special character',    /[!@#$%^&*(),.?":{}|<>_\-]/.test(newPassword)],
                    ['Passwords match',                 newPassword && newPassword === confirmPass],
                  ].map(([label, ok]) => (
                    <div key={label} className={`flex items-center gap-1.5 font-medium ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                      <Check className={`w-3 h-3 flex-shrink-0 ${ok ? 'opacity-100' : 'opacity-30'}`} />
                      {label}
                    </div>
                  ))}
                </div>

                <button
                  onClick={doReset}
                  disabled={loading || !token}
                  className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm tracking-wider hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full mt-2.5 py-2.5 bg-transparent text-slate-500 border border-slate-300 rounded-[14px] font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Back to Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}