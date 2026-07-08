import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Camera, Check, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const API = '';

export default function AbroadVerify() {
  const [searchParams]   = useSearchParams();
  const token            = searchParams.get('token');

  const [step, setStep]  = useState('loading'); // loading | info | camera | done | error
  const [transferInfo, setTransferInfo]  = useState(null);
  const [errorMsg, setErrorMsg]          = useState('');
  const [successMsg, setSuccessMsg]      = useState('');
  const [stream, setStream]              = useState(null);
  const [faceCaptured, setFaceCaptured]  = useState(false);
  const [faceBase64, setFaceBase64]      = useState(null);
  const [faceMsg, setFaceMsg]            = useState('');
  const [verifying, setVerifying]        = useState(false);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // Attach stream to video element whenever both are ready
  useEffect(() => {
    if (stream && videoRef.current && !faceCaptured) {
      videoRef.current.srcObject = stream;
      videoRef.current.style.transform = 'scaleX(-1)';
    }
  }, [stream, step, faceCaptured]);

  // Stop camera when component unmounts
  useEffect(() => {
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [stream]);

  // Load transfer info from token
  useEffect(() => {
    if (!token) { setStep('error'); setErrorMsg('No verification token found in this link.'); return; }
    fetch(`${API}/api/abroad/verify-token?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setTransferInfo(d); setStep('info'); }
        else           { setStep('error');  setErrorMsg(d.error || 'Invalid or expired link.'); }
      })
      .catch(() => { setStep('error'); setErrorMsg('Could not reach the server. Make sure the system is running.'); });
  }, [token]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      setStream(s);
      setStep('camera');
      // Attach stream after React re-renders the <video> element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.style.transform = 'scaleX(-1)';
        }
      }, 0);
    } catch {
      setFaceMsg('Camera access denied. Please allow camera access and try again.');
    }
  };

  const captureAndVerify = async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

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
    if (avg < 35) { setFaceMsg('Image too dark — move to a brighter area.'); return; }
    if (avg > 235) { setFaceMsg('Image too bright — reduce direct lighting.'); return; }

    // Scale to 800px wide
    const scaled = document.createElement('canvas');
    scaled.width  = 800;
    scaled.height = Math.round(canvas.height * 800 / canvas.width);
    scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
    const b64 = scaled.toDataURL('image/jpeg', 0.92).split(',')[1];

    // Validate face first
    setFaceMsg('Validating face…');
    try {
      const vr = await fetch(`${API}/api/validate-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_base64: b64 })
      });
      const vd = await vr.json();
      if (!vr.ok || !(vd.success || vd.face_detected) || vd.face_count < 1) {
        setFaceMsg(vd.error || 'No face detected. Ensure your face is clearly visible.');
        return;
      }
    } catch {
      setFaceMsg('Could not reach server. Make sure the system is running.');
      return;
    }

    // Stop camera and show captured image
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setFaceBase64(b64);
    setFaceCaptured(true);
    setFaceMsg('Face captured — tap Complete Transfer to proceed.');
  };

  const completeTransfer = async () => {
    if (!faceBase64) return;
    setVerifying(true);
    setFaceMsg('Verifying identity and completing transfer…');
    try {
      const r = await fetch(`${API}/api/abroad/complete-transfer`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ token, face_base64: faceBase64 })
      });
      const d = await r.json();
      if (d.success) {
        setSuccessMsg(`Transfer of ${Number(d.amount).toLocaleString()} RWF to ${d.recipient} completed successfully.`);
        setStep('done');
      } else {
        setFaceMsg(d.error || 'Transaction failed. Please try again.');
        setFaceCaptured(false);
        setFaceBase64(null);
      }
    } catch {
      setFaceMsg('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const retake = () => {
    setFaceBase64(null);
    setFaceCaptured(false);
    setFaceMsg('');
    startCamera();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Loading verification details…</p>
      </div>
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border-2 border-rose-200 rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-rose-800 mb-2">Verification Link Invalid</h2>
        <p className="text-sm text-rose-600">{errorMsg}</p>
        <p className="text-xs text-slate-400 mt-4">If you need to complete a transfer, please log in to your MoMo Shield account and try again.</p>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border-2 border-emerald-200 rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-emerald-800 mb-2">Transfer Completed</h2>
        <p className="text-sm text-emerald-700">{successMsg}</p>
        <p className="text-xs text-slate-400 mt-4">You can close this page.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-5 flex items-start gap-3">
          <Shield className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-bold text-emerald-800">Face Verification — Abroad Transfer</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your account is registered abroad. Verify your face to complete this transfer.
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* Transfer summary */}
          {transferInfo && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Sending to</span>
                <span className="font-mono font-semibold text-slate-800">{transferInfo.recipient_phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Amount</span>
                <span className="font-bold text-slate-900">{Number(transferInfo.amount).toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Network</span>
                <span className="font-semibold text-slate-700">{transferInfo.network}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Your location</span>
                <span className="font-semibold text-amber-700">Abroad — {transferInfo.destination}</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          {step === 'info' && (
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-slate-700 mb-5">
                To confirm your identity and complete this transfer, please scan your face using the button below.
              </p>
              <button
                onClick={startCamera}
                className="w-full py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Open Camera & Verify Face
              </button>
            </div>
          )}

          {/* Camera view */}
          {step === 'camera' && (
            <div>
              <div className="rounded-xl overflow-hidden bg-slate-900 mb-3 relative" style={{ minHeight: 200 }}>
                {!faceCaptured && (
                  <video ref={videoRef} autoPlay muted playsInline
                    className="w-full object-cover"
                    style={{ maxHeight: 240 }} />
                )}
                {faceCaptured && faceBase64 && (
                  <img src={`data:image/jpeg;base64,${faceBase64}`}
                    alt="Face captured"
                    className="w-full object-cover"
                    style={{ maxHeight: 240 }} />
                )}
                {stream && !faceCaptured && (
                  <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">
                    Position your face in the frame
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {/* Status message */}
              {faceMsg && (
                <div className={`p-3 rounded-lg text-xs mb-3 font-medium border ${
                  faceMsg.includes('captured') || faceMsg.includes('Validating')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {faceMsg}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                {!faceCaptured && stream && (
                  <button onClick={captureAndVerify}
                    className="flex-1 py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all inline-flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Capture Face
                  </button>
                )}
                {faceCaptured && (
                  <>
                    <button onClick={retake}
                      className="flex-1 py-3 border border-slate-300 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all inline-flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Retake
                    </button>
                    <button onClick={completeTransfer} disabled={verifying}
                      className="flex-1 py-3 bg-gradient-to-br from-emerald-500 to-sky-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
                      <Shield className="w-4 h-4" />
                      {verifying ? 'Processing…' : 'Complete Transfer'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">MoMo Shield — Rwanda Mobile Money Protection · Secured by Biometric AI</p>
        </div>
      </div>
    </div>
  );
}
