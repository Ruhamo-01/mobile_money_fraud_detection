import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Camera, Check, RefreshCw, UserPlus, AlertTriangle, X } from 'lucide-react';
import { sendLoginNotification, sendRegistrationEmail } from '../utils/emailService';

const API = '';

export default function Login() {
  const navigate = useNavigate();
  
  // View state
  const [view, setView] = useState('login'); // login, register, forgot
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginAlert, setLoginAlert] = useState({ show: false, message: '', type: 'danger' });
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Register state
  const [regStep, setRegStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [gender, setGender] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regAlert, setRegAlert] = useState({ show: false, message: '', type: 'danger' });
  
  // Face capture state
  const [stream, setStream] = useState(null);
  const [faceBase64, setFaceBase64] = useState(null);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [qualityWarn, setQualityWarn] = useState({ show: false, message: '' });
  const [faceValidating, setFaceValidating] = useState(false);
  const [faceValid, setFaceValid] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotAlert, setForgotAlert] = useState({ show: false, message: '', type: 'danger' });
  
  // Refs
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  
  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);
  
  // NID auto-detect gender
  const onNidInput = (value) => {
    setNationalId(value);
    if (value.length === 16) {
      const genderCode = value.substring(5, 8);
      if (genderCode === '800') setGender('Male');
      else if (genderCode === '700') setGender('Female');
    }
  };
  
  // NID Validation
  const validateNID = (nid) => {
    if (!/^\d{16}$/.test(nid)) return 'National ID must be exactly 16 digits.';
    if (nid[0] !== '1') return 'National ID must start with 1 (Rwanda country code).';
    const year = parseInt(nid.substring(1, 5));
    const curYear = new Date().getFullYear();
    if (year < 1900 || year > curYear) return `Birth year in ID (positions 2–5) must be between 1900 and ${curYear}.`;
    const genderCode = nid.substring(5, 8);
    if (genderCode !== '800' && genderCode !== '700') {
      return 'Positions 6–8 of National ID must be 800 (Male) or 700 (Female).';
    }
    return null;
  };
  
  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      setStream(mediaStream);
      setFaceCaptured(false);
      setFaceBase64(null);
      setQualityWarn({ show: false, message: '' });
      // srcObject attached by useEffect below after React re-renders the video element
    } catch (e) {
      setRegAlert({ show: true, message: 'Camera access denied. Please allow camera access and try again — face registration is required.', type: 'danger' });
    }
  };

  // Attach stream to video element whenever stream becomes available
  useEffect(() => {
    if (stream && faceVideoRef.current) {
      faceVideoRef.current.srcObject = stream;
      faceVideoRef.current.style.transform = 'scaleX(-1)';
    }
  }, [stream]);
  
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    // ADD THESE 2 LINES:
    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }
  };
  
  const capturePhoto = () => {
    const video = faceVideoRef.current;
    const canvas = faceCanvasRef.current;
    if (!video || !canvas) return;

    // Draw at native resolution — NO mirror (video CSS handles the mirror display)
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Brightness check
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4)
      total += 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    const avg = total / (data.length / 4);

    if (avg < 30) {
      setQualityWarn({ show: true, message: 'Image too dark — move to a brighter area and try again.' });
      return;
    }
    if (avg > 240) {
      setQualityWarn({ show: true, message: 'Image too bright — reduce glare or move away from direct light.' });
      return;
    }

    setQualityWarn({ show: false, message: '' });

    // Scale to 800px wide for reliable face detection
    const scaled = document.createElement('canvas');
    scaled.width  = 800;
    scaled.height = Math.round(canvas.height * 800 / canvas.width);
    scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
    const base64 = scaled.toDataURL('image/jpeg', 0.92).split(',')[1];

    setFaceBase64(base64);
    setFaceCaptured(true);
    stopCamera();

    // Validate face with backend
    setFaceValidating(true);
    validateFaceCapture(base64);
  };
  
  const validateFaceCapture = async (base64Image) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 s timeout
    try {
      const response = await fetch(`${API}/api/validate-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_base64: base64Image }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      // Parse JSON regardless of HTTP status so we always get the error message
      const result = await response.json();

      if (response.ok && (result.success || result.face_detected) && result.face_count > 0) {
        setFaceValid(true);
        setQualityWarn({ show: false, message: '' });
      } else {
        setFaceValid(false);
        const msg = result.error || result.message || 'No face detected. Please ensure your face is clearly visible and try again.';
        setQualityWarn({ show: true, message: `${msg}` });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Face validation error:', error);
      setFaceValid(false);
      if (error.name === 'AbortError') {
        setQualityWarn({ show: true, message: 'Face validation timed out. The server is taking too long — make sure python app.py is running and try again.' });
      } else {
        setQualityWarn({ show: true, message: 'Could not reach the server. Make sure python app.py is running on port 5000 and try again.' });
      }
    } finally {
      setFaceValidating(false);
    }
  };
  
  const retakePhoto = () => {
    setFaceBase64(null);
    setFaceCaptured(false);
    setFaceValid(false);
    startCamera();
  };
  
  // Login handler
  const doLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginAlert({ show: true, message: 'Please fill in all fields.', type: 'danger' });
      return;
    }
    
    setLoginLoading(true);
    try {
      const r = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('session_token', d.session_token);
        localStorage.setItem('user', JSON.stringify(d.user));
        localStorage.setItem('flash_message', 'Logged in successfully!');
        localStorage.setItem('flash_type', 'success');

        // Send login notification — customers only, not admins or managers
        if (d.dashboard_type === 'user') {
          sendLoginNotification({
            name : d.user?.name  || '',
            email: d.user?.email || loginEmail,
            phone: d.user?.phone || '',
          });
        }

        const dashboardUrl = d.dashboard_url || '/user_dashboard';
        navigate(dashboardUrl);
      } else {
        setLoginAlert({ show: true, message: d.error || 'Login failed.', type: 'danger' });
      }
    } catch (e) {
      setLoginAlert({ show: true, message: 'Server error. Please try again.', type: 'danger' });
    } finally {
      setLoginLoading(false);
    }
  };
  
  // Register handlers
  const regNext = (from) => {
    setRegAlert({ show: false, message: '', type: 'danger' });
    if (from === 0) {
      if (!fullName) { setRegAlert({ show: true, message: 'Full name is required.', type: 'danger' }); return; }
      if (!regEmail || !regEmail.includes('@')) { setRegAlert({ show: true, message: 'Invalid email.', type: 'danger' }); return; }
      if (!regPhone.match(/^(78|79|72|73)\d{7}$/)) {
        setRegAlert({ show: true, message: 'Phone must be 9 digits starting with 78, 79, 72, or 73.', type: 'danger' }); return;
      }
      setRegStep(1);
    } else if (from === 1) {
      const nidErr = validateNID(nationalId);
      if (nidErr) { setRegAlert({ show: true, message: nidErr, type: 'danger' }); return; }
      if (regPassword.length < 8 || !/\d/.test(regPassword) || !/[a-zA-Z]/.test(regPassword) || !/[!@#$%^&*(),.?":{}|<>_\-]/.test(regPassword)) {
        setRegAlert({ show: true, message: 'Password: min 8 chars, include letter, number, special character.', type: 'danger' }); return;
      }
      if (regPassword !== confirmPassword) { setRegAlert({ show: true, message: 'Passwords do not match.', type: 'danger' }); return; }
      setRegStep(2);
    }
  };
  
  const regBack = (from) => {
    setRegStep(from - 1);
    if (from === 2) stopCamera();
  };
  
  const submitRegistration = async () => {
    if (!faceValid || regLoading) return;
    setRegLoading(true);
    try {
      const payload = JSON.stringify({
          fullName: fullName,
          email: regEmail,
          phone: '+250' + regPhone,
          nationalId: nationalId,
          sex: gender,
          password: regPassword,
          face_base64: faceBase64
        });
      if (process.env.NODE_ENV === 'development') {
        console.log('Payload size (KB):', Math.round(payload.length / 1024));
      }
      const r = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      const d = await r.json();
      if (d.success) {
        // Send welcome email via EmailJS
        sendRegistrationEmail({
          name : fullName,
          email: regEmail,
          phone: '+250' + regPhone,
        });
        localStorage.setItem('flash_message', 'Registration successful! Please login.');
        localStorage.setItem('flash_type', 'success');
        setView('login');
      } else {
        setRegAlert({ show: true, message: d.error || 'Registration failed.', type: 'danger' });
      }
    } catch (e) {
      setRegAlert({ show: true, message: 'Server error. Please try again.', type: 'danger' });
    } finally {
      setRegLoading(false);
    }
  };
  
  // Forgot password handler
  const doForgot = async () => {
    if (!forgotEmail) {
      setForgotAlert({ show: true, message: 'Please enter your email.', type: 'danger' });
      return;
    }
    try {
      const r = await fetch(`${API}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const d = await r.json();
      if (d.success) {
        setForgotAlert({ show: true, message: 'Reset link sent to your email.', type: 'success' });
        setForgotEmail('');
      } else {
        setForgotAlert({ show: true, message: d.error || 'Failed to send reset link.', type: 'danger' });
      }
    } catch (e) {
      setForgotAlert({ show: true, message: 'Server error. Please try again.', type: 'danger' });
    }
  };
  
  const Alert = ({ alert }) => (
    alert.show && (
      <div className={`p-3 rounded text-sm mb-4 ${
        alert.type === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
        alert.type === 'danger' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
        alert.type === 'warn' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
        'bg-sky-100 text-sky-700 border border-sky-200'
      }`}>
        {alert.message}
      </div>
    )
  );
  
  const StepDots = () => (
    <div className="flex justify-center gap-1.5 mb-6">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i < regStep ? 'bg-sky-500' : i === regStep ? 'bg-emerald-500 scale-125' : 'bg-slate-400'
          }`}
        />
      ))}
    </div>
  );
  
  return (
    <div className="min-h-screen flex items-start justify-center p-5 bg-slate-50 relative">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-100" style={{
        backgroundImage: 'linear-gradient(rgba(5,150,105,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
      
      <div className="w-full max-w-[440px] relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-sky-500 rounded-2xl inline-flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
            MoMo Shield
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">ML-Powered Mobile Money Fraud Detection</p>
        </div>
        
        {/* Login Card */}
        {view === 'login' && (
          <div className="bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center pt-7 px-8">
              <h2 className="text-xl font-bold text-slate-900">Sign In</h2>
              <p className="text-sm text-slate-600 mt-1">Sign in to your MoMo Shield account</p>
            </div>
            <hr className="border-slate-300" />
            <div className="p-7">
              <Alert alert={loginAlert} />
              <div className="mb-7">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                />
              </div>
              <div className="mb-7">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                  className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                />
              </div>
              <button
                onClick={doLogin}
                disabled={loginLoading}
                className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm tracking-wider hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Logging in…' : 'Login'}
              </button>
              <div className="mt-4 text-center text-sm text-slate-600 flex flex-col gap-2">
                <button onClick={() => setView('forgot')} className="text-sky-500 hover:text-emerald-500 bg-transparent border-none cursor-pointer text-sm">
                  Forgot password?
                </button>
                <div>
                  <span>Don't have an account? </span>
                  <button onClick={() => setView('register')} className="text-emerald-500 font-semibold bg-transparent border-none cursor-pointer text-sm">
                    Register
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Register Card */}
        {view === 'register' && (
          <div className="bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center pt-7 px-8">
              <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
              <p className="text-sm text-slate-600 mt-1">Join MoMo Shield for secure transactions</p>
            </div>
            <hr className="border-slate-300" />
            <div className="p-7 max-h-[80vh] overflow-y-auto">
              <StepDots />
              <Alert alert={regAlert} />
              
              {/* Step 0: Basic Info */}
              {regStep === 0 && (
                <div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    />
                  </div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    />
                  </div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                    <div className="flex">
                      <span className="px-3.5 py-3 bg-white border border-slate-300 border-r-0 rounded-l-[14px] text-emerald-500 text-sm font-semibold font-mono">+250</span>
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="78XXXXXXX"
                        maxLength={9}
                        className="flex-1 px-3.5 py-3 bg-white border border-slate-300 rounded-r-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                      />
                    </div>
                  </div>
                  <button onClick={() => regNext(0)} className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm tracking-wider hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    Continue →
                  </button>
                  <div className="text-center mt-6 text-sm text-slate-600">
                    Already have an account? <button onClick={() => { stopCamera(); setView('login'); }} className="text-emerald-500 font-semibold bg-transparent border-none cursor-pointer text-sm">Login</button>
                  </div>
                </div>
              )}
              
              {/* Step 1: ID + Password */}
              {regStep === 1 && (
                <div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">National ID (16 digits)</label>
                    <input
                      type="text"
                      value={nationalId}
                      onChange={(e) => onNidInput(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="1YYYYMMDD800XXXXX"
                      maxLength={16}
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    />
                    <div className="text-[11px] text-slate-600 mt-1.5 font-medium">
                      Format: 1 + 4-digit birth year + 800 (male) or 700 (female) + remaining digits = 16 total
                    </div>
                  </div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Gender (auto-detected from ID)</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 chars, letter + number + symbol"
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    />
                  </div>
                  <div className="mb-7">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                    />
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => regBack(1)} className="flex-1 py-3 bg-transparent text-emerald-500 border border-emerald-500 rounded-[14px] font-bold text-sm hover:bg-emerald-50 transition-all">
                      ← Back
                    </button>
                    <button onClick={() => regNext(1)} className="flex-1 py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                      Continue →
                    </button>
                  </div>
                </div>
              )}
              
              {/* Step 2: Face Capture */}
              {regStep === 2 && (
                <div>
                  <div className="bg-white border border-dashed border-slate-300 rounded-[14px] p-4 mb-4.5 text-center">
                    <span className="text-xs text-slate-500 block mb-3">
                      Register your face for <span className="text-emerald-500 font-semibold">biometric verification</span>.<br />
                      Used to verify identity during suspicious transfers.
                    </span>
                    
                    {!faceCaptured && !stream && (
                      <div className="w-full max-w-[260px] h-[160px] border-2 border-dashed border-slate-300 rounded-xl mx-auto mb-3 flex items-center justify-center text-slate-500 flex-col gap-2">
                        <UserPlus className="w-9 h-9 opacity-40" />
                        <span className="text-xs">Camera preview</span>
                      </div>
                    )}
                    
                    <video ref={faceVideoRef} autoPlay muted playsInline className={`w-full max-w-[260px] rounded-xl border-2 border-slate-300 mx-auto mb-3 ${stream && !faceCaptured ? 'block' : 'hidden'}`} style={{ transform: 'scaleX(-1)' }} />
                    <canvas ref={faceCanvasRef} className="hidden" />
                    {faceCaptured && faceBase64 && (
                      <img src={`data:image/jpeg;base64,${faceBase64}`} alt="Face capture" className="w-full max-w-[260px] rounded-xl border-2 border-emerald-500 mx-auto mb-3" />
                    )}
                    
                    {faceValid && (
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/12 text-emerald-500 rounded-full px-3 py-1 text-xs font-semibold mt-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Face detected — ready to register
                      </div>
                    )}
                    
                    {qualityWarn.show && (
                      <div className="bg-amber-50 text-amber-800 border border-amber-300 rounded-[14px] p-2.5 text-xs mt-2.5 text-left font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                        {qualityWarn.message}
                      </div>
                    )}
                    
                    <div className="flex gap-2 justify-center flex-wrap mt-3">
                      {!stream && !faceCaptured && (
                        <button onClick={startCamera} className="w-full px-4.5 py-2.5 rounded-[14px] border-none text-xs font-bold cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-500 to-sky-500 text-white hover:shadow-lg hover:-translate-y-0.5">
                          <Camera className="w-4 h-4" />
                          Open Camera
                        </button>
                      )}
                      {stream && !faceCaptured && (
                        <button onClick={capturePhoto} className="px-6 py-3 rounded-[14px] border-none text-sm font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 bg-gradient-to-br from-emerald-500 to-sky-500 text-white hover:shadow-lg hover:-translate-y-0.5">
                          <Check className="w-4 h-4" />
                          Capture
                        </button>
                      )}
                      {faceCaptured && (
                        <button onClick={retakePhoto} className="px-4.5 py-2.5 rounded-[14px] border-none text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 bg-transparent text-emerald-500 border border-emerald-500 hover:bg-emerald-50">
                          <RefreshCw className="w-4 h-4" />
                          Retake Photo
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-emerald-500 text-center mb-4 font-semibold">
                     Face registration is required for account security
                  </div>
                  
                  <button
                    onClick={submitRegistration}
                    disabled={!faceValid || faceValidating || regLoading}
                    className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    {regLoading ? 'Creating Account…' : 'Create Account'}
                  </button>
                  <button onClick={() => regBack(2)} className="w-full mt-2.5 py-2.5 bg-transparent text-emerald-500 border border-emerald-500 rounded-[14px] font-bold text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5">
                    ← Back
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Forgot Password */}
        {view === 'forgot' && (
          <div className="bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center pt-7 px-8">
              <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
              <p className="text-sm text-slate-600 mt-1">Enter your email to receive a reset link</p>
            </div>
            <hr className="border-slate-300" />
            <div className="p-7">
              <Alert alert={forgotAlert} />
              <div className="mb-4.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-[14px] text-slate-900 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/12 outline-none"
                />
              </div>
              <button onClick={doForgot} className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-[14px] font-bold text-sm tracking-wider hover:shadow-lg hover:-translate-y-0.5 transition-all">
                Send Reset Link
              </button>
              <button onClick={() => setView('login')} className="w-full mt-2.5 py-3 bg-transparent text-slate-500 border border-slate-300 rounded-[14px] font-bold text-sm hover:bg-slate-50 transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
