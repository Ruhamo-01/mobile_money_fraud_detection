import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Send, History, Lock, User, Camera, Check, RefreshCw, LogOut, AlertTriangle, Shield, Activity } from 'lucide-react';
import { fmtRWF, fmtDate, showAlert } from '../utils/helpers';

const API = '';
const TOKEN = () => localStorage.getItem('session_token');

const NavItem = ({ page, activePage, setActivePage, icon: Icon, label }) => (
  <button
    onClick={() => setActivePage(page)}
    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all w-full text-left relative ${
      activePage === page
        ? 'bg-emerald-500/10 text-emerald-500'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon className="flex-shrink-0 w-4 h-4" />
    {label}
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
  msg.show ? (
    <div className={`p-3 rounded-lg text-sm mb-4 font-medium ${
      msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
      msg.type === 'error'   ? 'bg-rose-50 text-rose-800 border border-rose-300' :
                               'bg-sky-50 text-sky-800 border border-sky-300'
    }`}>
      {msg.message}
    </div>
  ) : null
);

export default function UserDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('balance');
  const [currentUser, setCurrentUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Transfer state
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [fee, setFee] = useState(0);
  const [transferMsg, setTransferMsg] = useState({ show: false, message: '', type: 'success' });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinModalMsg, setPinModalMsg] = useState({ show: false, message: '' });
  const [hasPin, setHasPin] = useState(true);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [newPinMsg, setNewPinMsg] = useState({ show: false, message: '' });

  // Face verification modal for high-risk transfers
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalMsg, setFaceModalMsg] = useState({ show: false, message: '', type: 'error' });
  const [transferFaceBase64, setTransferFaceBase64] = useState(null);
  const [transferFaceCaptured, setTransferFaceCaptured] = useState(false);
  const [transferFaceStream, setTransferFaceStream] = useState(null);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [pendingPinInput, setPendingPinInput] = useState('');
  const [transferExplanation, setTransferExplanation] = useState(null); // XAI explanation
  
  // Reset PIN state
  const [resetStep, setResetStep] = useState(1);
  const [resetPhone, setResetPhone] = useState('');
  const [resetNationalId, setResetNationalId] = useState('');
  const [resetVerifiedName, setResetVerifiedName] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetFaceBase64, setResetFaceBase64] = useState(null);
  const [resetFaceCaptured, setResetFaceCaptured] = useState(false);
  const [resetFaceValid, setResetFaceValid] = useState(false);
  const [resetStream, setResetStream] = useState(null);
  
  // Update Face state
  const [updateStep, setUpdateStep] = useState(1);
  const [updateFacePhone, setUpdateFacePhone] = useState('');
  const [updateFaceNatId, setUpdateFaceNatId] = useState('');
  const [updateVerifiedName, setUpdateVerifiedName] = useState('');
  const [updateFaceBase64, setUpdateFaceBase64] = useState(null);
  const [updateFaceCaptured, setUpdateFaceCaptured] = useState(false);
  const [updateFaceValid, setUpdateFaceValid] = useState(false);
  const [updateStream, setUpdateStream] = useState(null);
  
  // Profile state
  const [profile, setProfile] = useState(null);
  
  // Refs
  const resetFaceVideoRef = useRef(null);
  const resetFaceCanvasRef = useRef(null);
  const updateFaceVideoRef = useRef(null);
  const updateFaceCanvasRef = useRef(null);
  const transferFaceVideoRef = useRef(null);
  const transferFaceCanvasRef = useRef(null);
  
  useEffect(() => {
    const token = TOKEN();
    if (!token) {
      navigate('/login');
      return;
    }
    init();
  }, []);
  
  useEffect(() => {
    if (activePage === 'balance') loadBalance();
    if (activePage === 'history') loadHistory();
    if (activePage === 'profile') loadProfile();
  }, [activePage]);
  
  useEffect(() => {
    return () => {
      if (resetStream) resetStream.getTracks().forEach(t => t.stop());
      if (updateStream) updateStream.getTracks().forEach(t => t.stop());
      if (transferFaceStream) transferFaceStream.getTracks().forEach(t => t.stop());
    };
  }, [resetStream, updateStream, transferFaceStream]);
  
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
      setCurrentUser(d.user);
      setHasPin(d.has_pin !== false);
      if (d.has_pin === false) setShowSetPinModal(true);
      loadBalance();
    } catch {
      navigate('/login');
    }
  };
  
  const loadBalance = async () => {
    try {
      const r = await fetch(`${API}/api/user/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: TOKEN() })
      });
      const d = await r.json();
      if (d.success) {
        setBalance(d.balance);
        setTransactions(d.transactions || []);
      }
    } catch (e) {
      console.error('Balance error:', e);
    }
  };
  
  const loadHistory = async () => {
    try {
      const r = await fetch(`${API}/api/user/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: TOKEN() })
      });
      const d = await r.json();
      setHistory(d.history || []);  // always set, even on failure
    } catch (e) {
      console.error('History error:', e);
      setHistory([]);  // stop the spinner on error too
    }
  };
  
  const loadProfile = async () => {
    try {
      const r = await fetch(`${API}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: TOKEN() })
      });
      const d = await r.json();
      if (d.success) {
        setProfile(d.user);
      }
    } catch (e) {
      console.error('Profile error:', e);
    }
  };
  
  const lookupRecipient = async () => {
    if (recipientPhone.length !== 9) return;
    // Self-transfer check — compare against current user's phone (last 9 digits)
    const myPhone = currentUser?.phone?.replace('+250', '').replace(/\s/g, '') || '';
    if (recipientPhone === myPhone) {
      setRecipientName(' You cannot send money to yourself.');
      return;
    }
    try {
      const r = await fetch(`${API}/api/user/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_token: TOKEN(),
          phone: '+250' + recipientPhone 
        })
      });
      const d = await r.json();
      if (d.success && d.registered) {
        if (d.blocked) {
          setRecipientName(` ${d.blocked_reason}`);
        } else {
          setRecipientName(` ${d.name}`);
        }
      } else if (d.success && !d.registered) {
        setRecipientName(' Phone not registered in system');
      } else {
        setRecipientName('');
      }
    } catch (e) {
      console.error('Lookup error:', e);
    }
  };
  
  const onAmountInput = (value) => {
    setTransferAmount(value);
    const amount = parseFloat(value) || 0;
    let calculatedFee = 0;
    if (amount >= 1 && amount <= 1000)          calculatedFee = 20;
    else if (amount <= 10000)                   calculatedFee = 100;
    else if (amount <= 150000)                  calculatedFee = 250;
    else if (amount <= 2000000)                 calculatedFee = 1500;
    setFee(calculatedFee);
  };
  
  const doTransfer = async () => {
    if (!recipientPhone || !transferAmount) {
      showAlert(setTransferMsg, 'Please fill in all fields', 'error');
      return;
    }
    // Self-transfer check
    const myPhone = currentUser?.phone?.replace('+250', '').replace(/\s/g, '') || '';
    if (recipientPhone === myPhone) {
      showAlert(setTransferMsg, 'You cannot send money to yourself.', 'error');
      return;
    }
    // Blocked recipient check
    if (recipientName && (recipientName.includes('cannot') || recipientName.includes('deactivated'))) {
      showAlert(setTransferMsg, 'Cannot transfer to this recipient.', 'error');
      return;
    }
    setShowPinModal(true);
  };
  
  const confirmTransfer = async () => {
    if (!pinInput || pinInput.length < 4) {
      setPinModalMsg({ show: true, message: 'Please enter a valid PIN' });
      return;
    }
    
    try {
      // First verify PIN
      const pinR = await fetch(`/api/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({ pin: pinInput })
      });
      const pinD = await pinR.json();
      if (!pinD.success) {
        setPinModalMsg({ show: true, message: pinD.error || 'Incorrect PIN' });
        return;
      }

      const r = await fetch(`/api/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({
          session_token: TOKEN(),
          recipient_phone: '+250' + recipientPhone,
          amount: parseFloat(transferAmount),
          pin: pinInput
        })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setTransferMsg, 'Transfer successful!', 'success');
        setShowPinModal(false);
        setPinInput('');
        setRecipientPhone('');
        setRecipientName('');
        setTransferAmount('');
        setFee(0);
        loadBalance();
      } else if (d.face_required || d.action === 'REQUIRE_FACE') {
        // ML flagged this transfer — face verification required
        setPendingPinInput(pinInput);
        setShowPinModal(false);
        setPinInput('');
        setPinModalMsg({ show: false, message: '' });
        setTransferFaceBase64(null);
        setTransferFaceCaptured(false);
        setFaceModalMsg({ show: false, message: '', type: 'error' });
        setTransferExplanation(d.explanation || null);  // store XAI explanation
        setShowFaceModal(true);
      } else {
        setPinModalMsg({ show: true, message: d.error || 'Transfer failed' });
      }
    } catch (e) {
      setPinModalMsg({ show: true, message: 'Network error. Please try again.' });
    }
  };

  // ── Transfer face verification functions ──────────────────────────────

  const startTransferCamera = async () => {
    await startCamera(transferFaceVideoRef, setTransferFaceStream,
      (msg) => setFaceModalMsg({ show: true, message: msg, type: 'error' }));
  };

  const captureTransferFace = async () => {
    setFaceModalMsg({ show: true, message: 'Validating face…', type: 'success' });
    const { base64, error } = await captureFaceFromVideo(
      transferFaceVideoRef, transferFaceCanvasRef, null);
    if (error) {
      setFaceModalMsg({ show: true, message: error, type: 'error' });
      return;
    }
    setTransferFaceBase64(base64);
    setTransferFaceCaptured(true);
    setFaceModalMsg({ show: true, message: 'Face verified — tap Confirm Transfer to proceed.', type: 'success' });
    stopCameraStream(transferFaceStream, setTransferFaceStream, transferFaceVideoRef);
  };

  const retakeTransferFace = () => {
    setTransferFaceBase64(null);
    setTransferFaceCaptured(false);
    setFaceModalMsg({ show: false, message: '', type: 'error' });
    startTransferCamera();
  };

  const submitFaceVerifiedTransfer = async () => {
    if (!transferFaceBase64) return;
    setFaceVerifying(true);
    setFaceModalMsg({ show: false, message: '', type: 'error' });
    try {
      const r = await fetch(`/api/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({
          session_token  : TOKEN(),
          recipient_phone: '+250' + recipientPhone,
          amount         : parseFloat(transferAmount),
          face_base64    : transferFaceBase64,
        })
      });
      const d = await r.json();
      if (d.success) {
        setShowFaceModal(false);
        setTransferFaceBase64(null);
        setTransferFaceCaptured(false);
        setPendingPinInput('');
        setRecipientPhone('');
        setRecipientName('');
        setTransferAmount('');
        setFee(0);
        showAlert(setTransferMsg, 'Transfer approved after face verification.', 'success');
        loadBalance();
      } else if (d.action === 'BLOCK') {
        setFaceModalMsg({
          show: true,
          message: d.error || 'Transfer blocked by fraud detection.',
          type: 'error'
        });
      } else {
        setFaceModalMsg({
          show: true,
          message: d.error || 'Face verification failed. Please try again.',
          type: 'error'
        });
        setTransferFaceBase64(null);
        setTransferFaceCaptured(false);
      }
    } catch {
      setFaceModalMsg({ show: true, message: 'Network error. Please try again.', type: 'error' });
    } finally {
      setFaceVerifying(false);
    }
  };

  const closeFaceModal = () => {
    setShowFaceModal(false);
    setTransferFaceBase64(null);
    setTransferFaceCaptured(false);
    setTransferExplanation(null);
    setPendingPinInput('');
    if (transferFaceStream) {
      transferFaceStream.getTracks().forEach(t => t.stop());
      setTransferFaceStream(null);
    }
  };
  
  // Reset PIN functions
  const rpVerifyIdentity = async () => {
    try {
      const r = await fetch(`${API}/api/user/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: resetPhone,
          national_id: resetNationalId
        })
      });
      const d = await r.json();
      if (d.success) {
        setResetVerifiedName(d.name);
        setResetStep(2);
      } else {
        showAlert(setTransferMsg, d.error || 'Identity verification failed', 'error');
      }
} catch (e) {
  showAlert(setTransferMsg, e.message || 'Network error. Please try again.', 'error');
}
  };
  
  // ── Shared face capture utility ──────────────────────────────────────
  // Used by reset PIN, update face, and transfer face verification.
  // Returns { base64, error } — validates against /api/validate-face before returning.
  const captureFaceFromVideo = async (videoRef, canvasRef, setMsg) => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return { base64: null, error: 'Camera not ready' };

    // Draw at native resolution — do NOT mirror (face_recognition needs correct orientation)
    // The video element is mirrored via CSS for natural selfie UX
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Brightness check
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    for (let i = 0; i < pixels.length; i += 4)
      brightness += 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
    const avg = brightness / (pixels.length / 4);
    if (avg < 35) return { base64: null, error: 'Image too dark — move to a brighter area.' };
    if (avg > 235) return { base64: null, error: 'Image too bright — reduce direct lighting.' };

    // Scale to 800px wide for reliable face detection
    const scaled = document.createElement('canvas');
    scaled.width  = 800;
    scaled.height = Math.round(canvas.height * 800 / canvas.width);
    scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
    const base64 = scaled.toDataURL('image/jpeg', 0.92).split(',')[1];

    // Validate with backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch(`${API}/api/validate-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_base64: base64 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const d = await r.json();
      if (r.ok && (d.success || d.face_detected) && d.face_count > 0) {
        return { base64, error: null };
      }
      return { base64: null, error: d.error || 'No face detected. Ensure your face is centred and well-lit.' };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        return { base64: null, error: 'Face validation timed out. Make sure python app.py is running and try again.' };
      }
      return { base64: null, error: 'Could not reach server. Make sure python app.py is running on port 5000.' };
    }
  };

  // ── Shared camera start utility ───────────────────────────────────────
  const startCamera = async (videoRef, setStream, setErrMsg) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        // Mirror video for natural selfie UX — canvas capture does NOT mirror
        videoRef.current.style.transform = 'scaleX(-1)';
      }
    } catch {
      setErrMsg('Camera access denied. Please allow camera access and try again.');
    }
  };

  const stopCameraStream = (stream, setStream, videoRef) => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    if (videoRef?.current) { videoRef.current.srcObject = null; }
  };
  
  const resetStartCamera = async () => {
    await startCamera(resetFaceVideoRef, setResetStream,
      (msg) => showAlert(setTransferMsg, msg, 'error'));
  };

  const resetCaptureFace = async () => {
    showAlert(setTransferMsg, 'Validating face…', 'success');
    const { base64, error } = await captureFaceFromVideo(
      resetFaceVideoRef, resetFaceCanvasRef, setTransferMsg);
    if (error) {
      showAlert(setTransferMsg, error, 'error');
      return;
    }
    setResetFaceBase64(base64);
    setResetFaceCaptured(true);
    setResetFaceValid(true);
    stopCameraStream(resetStream, setResetStream, resetFaceVideoRef);
    showAlert(setTransferMsg, 'Face verified successfully.', 'success');
  };

  const resetRetake = () => {
    setResetFaceBase64(null);
    setResetFaceCaptured(false);
    setResetFaceValid(false);
    resetStartCamera();
  };
  
  const doResetPin = async () => {
    if (!resetFaceValid) return;
    try {
      const r = await fetch(`${API}/api/user/reset-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({
          national_id: resetNationalId,
          new_pin: resetNewPin,
          face_base64: resetFaceBase64
        })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setTransferMsg, 'PIN reset successful!', 'success');
        setResetStep(1);
        setResetPhone('');
        setResetNationalId('');
        setResetNewPin('');
        setResetConfirmPin('');
        setResetFaceBase64(null);
        setResetFaceCaptured(false);
        setResetFaceValid(false);
      } else {
        showAlert(setTransferMsg, d.error || 'PIN reset failed', 'error');
      }
    } catch (e) {
      showAlert(setTransferMsg, 'Network error. Please try again.', 'error');
    }
  };
  
  // Update Face functions
  const ufVerifyIdentity = async () => {
    try {
      const r = await fetch(`${API}/api/user/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: updateFacePhone,
          national_id: updateFaceNatId
        })
      });
      const d = await r.json();
      if (d.success) {
        setUpdateVerifiedName(d.name);
        setUpdateStep(2);
      } else {
        showAlert(setTransferMsg, d.error || 'Identity verification failed', 'error');
      }
    } catch (e) {
      showAlert(setTransferMsg, 'Network error. Please try again.', 'error');
    }
  };
  
  const ufStartCamera = async () => {
    await startCamera(updateFaceVideoRef, setUpdateStream,
      (msg) => showAlert(setTransferMsg, msg, 'error'));
  };

  const ufCapture = async () => {
    showAlert(setTransferMsg, 'Validating face…', 'success');
    const { base64, error } = await captureFaceFromVideo(
      updateFaceVideoRef, updateFaceCanvasRef, setTransferMsg);
    if (error) {
      showAlert(setTransferMsg, error, 'error');
      return;
    }
    setUpdateFaceBase64(base64);
    setUpdateFaceCaptured(true);
    setUpdateFaceValid(true);
    stopCameraStream(updateStream, setUpdateStream, updateFaceVideoRef);
    showAlert(setTransferMsg, 'Face verified successfully.', 'success');
  };

  const ufRetake = () => {
    setUpdateFaceBase64(null);
    setUpdateFaceCaptured(false);
    setUpdateFaceValid(false);
    ufStartCamera();
  };
  
  const doUpdateFace = async () => {
    if (!updateFaceValid) return;
    try {
      const r = await fetch(`${API}/api/user/update-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({
          phone_number: updateFacePhone,
          national_id: updateFaceNatId,
          face_base64: updateFaceBase64,
          session_token: TOKEN()
        })
      });
      const d = await r.json();
      if (d.success) {
        showAlert(setTransferMsg, 'Face updated successfully!', 'success');
        setUpdateStep(1);
        setUpdateFacePhone('');
        setUpdateFaceNatId('');
        setUpdateFaceBase64(null);
        setUpdateFaceCaptured(false);
        setUpdateFaceValid(false);
      } else {
        showAlert(setTransferMsg, d.error || 'Face update failed', 'error');
      }
    } catch (e) {
      showAlert(setTransferMsg, 'Network error. Please try again.', 'error');
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

  const doSetPin = async () => {
    if (!newPinInput || newPinInput.length < 4) {
      setNewPinMsg({ show: true, message: 'PIN must be at least 4 digits.' });
      return;
    }
    try {
      const r = await fetch(`/api/set-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + TOKEN()
        },
        body: JSON.stringify({ pin: newPinInput })
      });
      const d = await r.json();
      if (d.success) {
        setHasPin(true);
        setShowSetPinModal(false);
        setNewPinInput('');
      } else {
        setNewPinMsg({ show: true, message: d.error || 'Failed to set PIN.' });
      }
    } catch (e) {
      setNewPinMsg({ show: true, message: 'Network error.' });
    }
  };
  
  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UE';
  
  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-[230px] flex-shrink-0 bg-white border-2 border-slate-300 rounded-2xl m-4 h-[calc(100vh-32px)] flex flex-col relative z-10 overflow-hidden shadow-lg">
        <div className="p-4 text-center border-b border-slate-300">
          <div className="flex items-center justify-center mx-auto mb-2 text-xl font-bold text-white rounded-full w-14 h-14 bg-gradient-to-br from-emerald-500 to-sky-500">
            {initials}
          </div>
          <div className="text-sm font-bold leading-tight text-transparent bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text">
            MoMo Shield
          </div>
          <div className="text-[10px] text-slate-500 font-semibold leading-tight mb-2">Customer Dashboard</div>
          {currentUser && (
            <>
              <div className="text-xs font-bold leading-tight text-slate-800">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 font-mono leading-tight">{currentUser.phone}</div>
            </>
          )}
        </div>
        
        <nav className="p-3.5 flex-1 min-h-0 overflow-y-auto text-left">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3.5 py-3.5 pb-1.5">My Account</div>
          <NavItem page="balance" icon={Wallet} label="Balance" activePage={activePage} setActivePage={setActivePage} />
          <NavItem page="transfer" icon={Send} label="Send Money" activePage={activePage} setActivePage={setActivePage} />
          <NavItem page="history" icon={History} label="History" activePage={activePage} setActivePage={setActivePage} />
          <NavItem page="reset-pin" icon={Lock} label="Reset PIN" activePage={activePage} setActivePage={setActivePage} />
          <NavItem page="update-face" icon={User} label="Update Face" activePage={activePage} setActivePage={setActivePage} />
          <NavItem page="profile" icon={User} label="Profile" activePage={activePage} setActivePage={setActivePage} />
        </nav>
        
        <Button variant="ghost" onClick={doLogout} className="mx-4 mb-4 w-[calc(100%-32px)] justify-center">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </aside>
      
      {/* Main Content */}
      <main className="relative flex flex-col flex-1 h-screen p-6 overflow-y-auto z-5">
        {/* Balance Page */}
        {activePage === 'balance' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                My Balance
              </h1>
              <p className="mt-1 text-sm text-slate-600">Account overview and quick actions</p>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Account Balance</h2>
                </div>
                <div className="text-center p-9">
                  <div className="text-[2.4rem] font-bold font-mono text-emerald-600">{fmtRWF(balance)}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-1.5">Rwanda Francs</div>
                  <div className="mt-6">
                    <Button onClick={() => setActivePage('transfer')} className="px-5 text-xs">Send Money</Button>
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <History className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Recent Activity</h2>
                </div>
                <div className="p-0">
                  {transactions.length === 0 ? (
                    <div className="p-10 text-sm text-center text-slate-500">No recent transactions</div>
                  ) : (
                    transactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 text-sm border-b border-slate-200">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{tx.direction === 'sent' ? '→ ' + (tx.recipient_phone || tx.recipient || '—') : '← ' + (tx.sender_phone || tx.sender || '—')}</div>
                          <div className="text-slate-500 mt-0.5">{fmtDate(tx.created_at)}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${tx.direction === 'sent' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {tx.direction === 'sent' ? '-' : '+'}{fmtRWF(Math.abs(tx.amount))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {/* Transfer Page */}
        {activePage === 'transfer' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Send Money
              </h1>
              <p className="mt-1 text-sm text-slate-600">Secure transfer with real-time fraud protection</p>
            </div>
            
            <div className="max-w-[480px] mx-auto">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">New Transfer</h2>
                </div>
                <div className="p-6">
                  <AlertMsg msg={transferMsg} />
                  
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Recipient Phone</label>
                    <div className="flex items-center border rounded-lg border-slate-300 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/10">
                      <span className="px-3.5 py-2.5 text-slate-500 font-mono text-sm border-r border-slate-300">+250</span>
                      <input
                        type="text"
                        value={recipientPhone}
                        onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setRecipientPhone(val);
                        if (val.length === 9) lookupRecipient();
                        }}
                        onBlur={lookupRecipient}
                        placeholder="78XXXXXXX"
                        maxLength={10}
                        className="flex-1 px-3.5 py-2.5 border-none bg-none text-sm focus:outline-none"
                      />
                    </div>
                    {recipientName && (
                      <div className={`mt-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${
                        recipientName.includes('cannot') || recipientName.includes('deactivated') || recipientName.includes('not registered')
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}>
                        {recipientName}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-slate-900 mb-1.5">Amount (RWF)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transferAmount}
                      onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      onAmountInput(val);
                      }}
                      placeholder="5000"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                    />
                  </div>
                  
                  {transferAmount && (
                    <div className="p-4 mb-5 text-xs border rounded-xl bg-slate-50 border-slate-200">
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="font-medium text-slate-600">Amount</span>
                        <span className="font-semibold text-slate-900">{fmtRWF(parseFloat(transferAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="font-medium text-slate-600">Fee</span>
                        <span className="font-semibold text-slate-900">{fmtRWF(fee)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 pt-2 mt-1 font-bold border-t border-slate-300">
                        <span className="text-slate-700">Total deducted</span>
                        <span className="text-emerald-700">{fmtRWF((parseFloat(transferAmount) || 0) + fee)}</span>
                      </div>
                    </div>
                  )}
                  
                  <Button onClick={doTransfer} className="justify-center w-full">
                    <Send className="w-4 h-4" />
                    Send Money
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {/* History Page */}
        {activePage === 'history' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Transaction History
              </h1>
              <p className="mt-1 text-sm text-slate-600">Your recent money transfers</p>
            </div>
            <Card>
              <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 flex items-center justify-center mb-2.5">
                  <History className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Recent Transfers</h2>
              </div>
              <div className="p-0">
                {history.length === 0 ? (
                  <div className="p-10 text-sm text-center text-slate-500">No transactions yet</div>
                ) : (
                  history.map((tx) => (
                    <div key={tx.reference || tx.id} className="flex items-center justify-between p-4 text-sm border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{tx.direction === 'sent' ? '→ ' + (tx.recipient || tx.recipient_phone || '—') : '← ' + (tx.sender_phone || '—')}</div>
                        <div className="text-slate-500 mt-0.5">{fmtDate(tx.created_at)}</div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                          tx.status === 'blocked'   ? 'bg-rose-100 text-rose-700 border-rose-300' :
                                                      'bg-amber-100 text-amber-700 border-amber-300'
                        }`}>{(tx.status || 'completed').toUpperCase()}</span>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${tx.direction === 'sent' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {tx.direction === 'sent' ? '-' : '+'}{fmtRWF(Math.abs(tx.amount))}
                        </div>
                        <div className="text-slate-500 mt-0.5">Fee: {fmtRWF(tx.fee || 0)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
        
        {/* Profile Page */}
        {activePage === 'profile' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                My Profile
              </h1>
              <p className="mt-1 text-sm text-slate-600">Account information and settings</p>
            </div>
            
            <div className="max-w-[600px] mx-auto">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Account Details</h2>
                </div>
                <div className="p-6">
                  <div className="flex justify-between py-3 text-xs border-b border-slate-200">
                    <span className="font-medium text-slate-600">Full Name</span>
                    <span className="font-semibold text-slate-900">{profile?.name || currentUser?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-xs border-b border-slate-200">
                    <span className="font-medium text-slate-600">Phone Number</span>
                    <span className="font-mono font-semibold text-slate-900">{profile?.phone || currentUser?.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-xs border-b border-slate-200">
                    <span className="font-medium text-slate-600">Email</span>
                    <span className="font-semibold text-slate-900">{profile?.email || currentUser?.email || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-xs border-b border-slate-200">
                    <span className="font-medium text-slate-600">National ID</span>
                    <span className="font-mono font-semibold text-slate-900">{profile?.national_id || currentUser?.nationalId || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-xs">
                    <span className="font-medium text-slate-600">Account Status</span>
                    {(() => {
                      const s = profile?.status || (profile?.is_active ? 'active' : 'inactive');
                      const cfg = {
                        active:   { cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Active' },
                        abroad:   { cls: 'bg-amber-100  text-amber-700  border-amber-300',  label: `Abroad — ${profile?.travel_destination || ''}` },
                        inactive: { cls: 'bg-rose-100   text-rose-700   border-rose-300',   label: 'Inactive' },
                      };
                      const { cls, label } = cfg[s] || cfg.active;
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cls}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                  {profile?.status === 'abroad' && profile?.travel_return && (
                    <div className="flex justify-between py-3 text-xs border-t border-slate-200">
                      <span className="font-medium text-slate-600">Returns</span>
                      <span className="font-semibold text-slate-900">{profile.travel_return?.split('T')[0]}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {/* Reset PIN Page */}
        {activePage === 'reset-pin' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Reset PIN
              </h1>
              <p className="mt-1 text-sm text-slate-600">Verify your identity to reset your transaction PIN</p>
            </div>
            
            <div className="max-w-[480px] mx-auto">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center mb-2.5">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">PIN Reset</h2>
                  <p className="text-xs text-slate-500 mt-0.5">3 steps: identity → new PIN → face scan</p>
                </div>
                <div className="p-6">
                  <AlertMsg msg={transferMsg} />
                  
                  {resetStep === 1 && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium mb-3.5 text-center"><strong>Step 1 of 3</strong> — Verify your identity</p>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={resetPhone}
                          onChange={(e) => setResetPhone(e.target.value)}
                          placeholder="e.g. 0780000000"
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">National ID (16 digits)</label>
                        <input
                          type="text"
                          value={resetNationalId}
                          onChange={(e) => setResetNationalId(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="Enter your 16-digit National ID"
                          maxLength={16}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <Button onClick={rpVerifyIdentity} className="justify-center w-full">
                        <Check className="w-4 h-4" />
                        Verify Identity
                      </Button>
                    </div>
                  )}
                  
                  {resetStep === 2 && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium mb-3.5 text-center">
                        <strong>Step 2 of 3</strong> — Set your new PIN
                        {resetVerifiedName && <span className="block mt-1 font-semibold text-emerald-500">{resetVerifiedName}</span>}
                      </p>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">New PIN (4–6 digits)</label>
                        <input
                          type="password"
                          value={resetNewPin}
                          onChange={(e) => setResetNewPin(e.target.value)}
                          placeholder="••••"
                          maxLength={6}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">Confirm New PIN</label>
                        <input
                          type="password"
                          value={resetConfirmPin}
                          onChange={(e) => setResetConfirmPin(e.target.value)}
                          placeholder="••••"
                          maxLength={6}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <Button onClick={() => setResetStep(3)} disabled={!resetNewPin || resetNewPin !== resetConfirmPin} className="justify-center w-full">
                        Continue
                      </Button>
                    </div>
                  )}
                  
                  {resetStep === 3 && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium mb-3.5 text-center"><strong>Step 3 of 3</strong> — Scan your face to confirm</p>
                      <div className="rounded-xl overflow-hidden bg-black mb-2.5 min-h-[140px] flex items-center justify-center relative">
                        <video ref={resetFaceVideoRef} autoPlay playsInline
                          className={`w-full max-h-[200px] ${resetStream && !resetFaceCaptured ? 'block' : 'hidden'}`}
                          style={{ transform: 'scaleX(-1)' }} />
                        <canvas ref={resetFaceCanvasRef} className="absolute invisible hidden w-0 h-0" />
                        {resetFaceCaptured && resetFaceBase64 && (
                          <img src={`data:image/jpeg;base64,${resetFaceBase64}`} alt="Face capture" className="w-full max-h-[200px] object-cover" />
                        )}
                        {!resetFaceCaptured && !resetStream && (
                          <div className="text-slate-500 text-sm p-7.5 text-center">
                            <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            <span>Click below to scan your face</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2.5 mb-2.5">
                        {!resetStream && !resetFaceCaptured && (
                          <Button onClick={resetStartCamera} className="justify-center flex-1">
                            <Camera className="w-4 h-4" />
                            Open Camera
                          </Button>
                        )}
                        {resetStream && !resetFaceCaptured && (
                          <Button onClick={resetCaptureFace} className="justify-center flex-1">
                            <Check className="w-4 h-4" />
                            Capture &amp; Verify
                          </Button>
                        )}
                        {resetFaceCaptured && (
                          <Button variant="ghost" onClick={resetRetake} className="justify-center flex-1">
                            <RefreshCw className="w-4 h-4" />
                            Retake
                          </Button>
                        )}
                      </div>
                      <Button onClick={doResetPin} disabled={!resetFaceValid} className="justify-center w-full">
                        <Lock className="w-4 h-4" />
                        Reset PIN
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
        
        {/* Update Face Page */}
        {activePage === 'update-face' && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900">
                Update Face
              </h1>
              <p className="mt-1 text-sm text-slate-600">Verify your identity then register a new face scan</p>
            </div>
            
            <div className="max-w-[480px] mx-auto">
              <Card>
                <div className="flex flex-col items-center p-6 text-center border-b border-slate-300">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center mb-2.5">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Update Face</h2>
                  <p className="text-xs text-slate-500 mt-0.5">2 steps: identity → face scan</p>
                </div>
                <div className="p-6">
                  <AlertMsg msg={transferMsg} />
                  
                  {updateStep === 1 && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium mb-3.5 text-center"><strong>Step 1 of 2</strong> — Verify your identity</p>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">Phone Number</label>
                        <input
                          type="tel"
                          value={updateFacePhone}
                          onChange={(e) => setUpdateFacePhone(e.target.value)}
                          placeholder="e.g. 0780000000"
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <div className="mb-5">
                        <label className="block text-xs font-semibold text-slate-900 mb-1.5">National ID (16 digits)</label>
                        <input
                          type="text"
                          value={updateFaceNatId}
                          onChange={(e) => setUpdateFaceNatId(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="Enter your 16-digit National ID"
                          maxLength={16}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                        />
                      </div>
                      <Button onClick={ufVerifyIdentity} className="justify-center w-full">
                        <Check className="w-4 h-4" />
                        Verify Identity
                      </Button>
                    </div>
                  )}
                  
                  {updateStep === 2 && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium mb-3.5 text-center">
                        <strong>Step 2 of 2</strong> — Scan your face
                        {updateVerifiedName && <span className="block mt-1 font-semibold text-emerald-500">{updateVerifiedName}</span>}
                      </p>
                      <p className="text-xs text-slate-600 mb-2.5">Your new face must match the face already on this account. Eyes, nose, mouth and chin must be clearly visible.</p>
                      <div className="rounded-xl overflow-hidden bg-black mb-2.5 min-h-[140px] flex items-center justify-center relative">
                        <video ref={updateFaceVideoRef} autoPlay playsInline
                          className={`w-full max-h-[200px] ${updateStream && !updateFaceCaptured ? 'block' : 'hidden'}`}
                          style={{ transform: 'scaleX(-1)' }} />
                        <canvas ref={updateFaceCanvasRef} className="absolute invisible hidden w-0 h-0" />
                        {updateFaceCaptured && updateFaceBase64 && (
                          <img src={`data:image/jpeg;base64,${updateFaceBase64}`} alt="Face capture" className="w-full max-h-[200px] object-cover" />
                        )}
                        {!updateFaceCaptured && !updateStream && (
                          <div className="text-slate-500 text-sm p-7.5 text-center">
                            <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
                            <span>Click below to open camera</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2.5 mb-2.5">
                        {!updateStream && !updateFaceCaptured && (
                          <Button onClick={ufStartCamera} className="justify-center w-full">
                            <Camera className="w-4 h-4" />
                            Open Camera
                          </Button>
                        )}
                        {updateStream && !updateFaceCaptured && (
                          <Button onClick={ufCapture} className="justify-center w-full">
                            <Check className="w-4 h-4" />
                            Capture &amp; Verify
                          </Button>
                        )}
                        {updateFaceCaptured && (
                          <Button variant="ghost" onClick={ufRetake} className="justify-center flex-1">
                            <RefreshCw className="w-4 h-4" />
                            Retake
                          </Button>
                        )}
                      </div>
                      <Button onClick={doUpdateFace} disabled={!updateFaceValid} className="justify-center w-full">
                        <User className="w-4 h-4" />
                        Update Face
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* Set PIN Banner */}
      {!hasPin && (
        <div className="fixed z-40 flex items-center gap-3 px-6 py-3 text-sm font-semibold text-white -translate-x-1/2 shadow-lg top-4 left-1/2 bg-amber-500 rounded-xl">
          <AlertTriangle className="w-4 h-4" />
          You haven't set a PIN yet — required to send money.
          <button onClick={() => setShowSetPinModal(true)} className="ml-1 underline">Set PIN now</button>
        </div>
      )}

      {/* Set PIN Modal */}
      {showSetPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-8 w-[320px] shadow-2xl text-center">
            <div className="flex items-center justify-center mx-auto mb-4 rounded-full w-14 h-14 bg-gradient-to-br from-amber-500 to-red-500">
              <Lock className="text-white w-7 h-7" />
            </div>
            <h3 className="mb-1 text-base font-bold">Set Your PIN</h3>
            <p className="mb-4 text-xs text-slate-500">Create a 4–6 digit PIN to authorize transfers</p>
            {newPinMsg.show && (
              <div className="p-2 mb-3 text-xs border rounded-lg bg-rose-50 text-rose-800 border-rose-300">
                {newPinMsg.message}
              </div>
            )}
            <input
              type="password"
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 4–6 digit PIN"
              maxLength={6}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 outline-none mb-4"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowSetPinModal(false)} className="justify-center flex-1">
                Later
              </Button>
              <Button onClick={doSetPin} className="justify-center flex-1">
                <Lock className="w-4 h-4" />
                Set PIN
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-8 w-[320px] shadow-2xl text-center">
            <div className="flex items-center justify-center mx-auto mb-4 rounded-full w-14 h-14 bg-gradient-to-br from-emerald-500 to-sky-500">
              <Lock className="text-white w-7 h-7" />
            </div>
            <h3 className="mb-1 text-base font-bold">Enter PIN</h3>
            <p className="mb-4 text-xs text-slate-500">Your 4–6 digit transaction PIN</p>
            {pinModalMsg.show && (
              <div className="p-2 mb-3 text-xs border rounded-lg bg-rose-50 text-rose-800 border-rose-300">
                {pinModalMsg.message}
              </div>
            )}
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              maxLength={6}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none mb-4"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowPinModal(false); setPinInput(''); setPinModalMsg({ show: false, message: '' }); }} className="justify-center flex-1">
                Cancel
              </Button>
              <Button onClick={confirmTransfer} className="justify-center flex-1">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Face Verification Modal (triggered when ML flags a transfer) ── */}
      {showFaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[360px] shadow-2xl overflow-hidden">

            {/* Header — security alert */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Identity Verification Required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This transfer was flagged as high-risk. Scan your face to confirm it's you.
                </p>
              </div>
            </div>

            <div className="p-6">
              {/* Transfer summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Sending to</span>
                  <span className="font-mono font-semibold text-slate-800">+250{recipientPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-slate-900">{Number(transferAmount).toLocaleString()} RWF</span>
                </div>
              </div>

              {/* XAI Explanation Panel */}
              {transferExplanation && transferExplanation.available && (
                <div className="mb-4 border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
                    <Activity className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-bold text-amber-800">Why was this flagged?</span>
                    <span className="ml-auto text-[10px] text-amber-600 font-medium">{transferExplanation.method}</span>
                  </div>
                  <div className="bg-white px-4 py-3 space-y-2">
                    {(transferExplanation.top_factors || []).slice(0, 3).map((f, i) => {
                      const isRisk = f.direction === 'increases_risk';
                      const allFactors = transferExplanation.all_factors || transferExplanation.top_factors || [];
                      const maxImpact = Math.max(...allFactors.map(x => Math.abs(x.shap_value || 0.001)), 0.001);
                      const pct = Math.min(Math.abs(f.shap_value || 0) / maxImpact * 100, 100);
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-slate-700">{f.label}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              isRisk ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isRisk ? '↑ Risk' : '↓ Risk'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isRisk ? 'bg-rose-400' : 'bg-emerald-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {f.detail && <p className="text-[10px] text-slate-500 mt-0.5">{f.detail}</p>}
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      ML Score: <span className="font-bold text-slate-700">{((transferExplanation.fraud_score || 0) * 100).toFixed(1)}%</span>
                      {' '}· Threshold: <span className="font-bold text-slate-700">{((transferExplanation.threshold || 0.38) * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Alert message */}
              {faceModalMsg.show && (
                <div className={`p-3 rounded-lg text-xs mb-4 font-medium border ${
                  faceModalMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  {faceModalMsg.message}
                </div>
              )}

              {/* Camera / preview */}
              <div className="rounded-xl overflow-hidden bg-slate-900 mb-4 relative" style={{ minHeight: 180 }}>
                <video
                  ref={transferFaceVideoRef}
                  autoPlay muted playsInline
                  className={`w-full object-cover ${transferFaceStream && !transferFaceCaptured ? 'block' : 'hidden'}`}
                  style={{ maxHeight: 220 }}
                />
                <canvas ref={transferFaceCanvasRef} className="hidden" />
                {transferFaceCaptured && transferFaceBase64 && (
                  <img
                    src={`data:image/jpeg;base64,${transferFaceBase64}`}
                    alt="Face capture"
                    className="w-full object-cover"
                    style={{ maxHeight: 220 }}
                  />
                )}
                {!transferFaceStream && !transferFaceCaptured && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Camera className="w-10 h-10 opacity-40" />
                    <span className="text-xs">Tap below to open camera</span>
                  </div>
                )}
              </div>

              {/* Camera controls */}
              <div className="flex gap-2 mb-4">
                {!transferFaceStream && !transferFaceCaptured && (
                  <Button onClick={startTransferCamera} className="flex-1 justify-center">
                    <Camera className="w-4 h-4" /> Open Camera
                  </Button>
                )}
                {transferFaceStream && !transferFaceCaptured && (
                  <Button onClick={captureTransferFace} className="flex-1 justify-center">
                    <Check className="w-4 h-4" /> Capture Face
                  </Button>
                )}
                {transferFaceCaptured && (
                  <>
                    <Button variant="ghost" onClick={retakeTransferFace} className="flex-1 justify-center">
                      <RefreshCw className="w-4 h-4" /> Retake
                    </Button>
                    <Button
                      onClick={submitFaceVerifiedTransfer}
                      disabled={faceVerifying}
                      className="flex-1 justify-center"
                    >
                      <Shield className="w-4 h-4" />
                      {faceVerifying ? 'Verifying…' : 'Confirm Transfer'}
                    </Button>
                  </>
                )}
              </div>

              <button
                onClick={closeFaceModal}
                className="w-full py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
