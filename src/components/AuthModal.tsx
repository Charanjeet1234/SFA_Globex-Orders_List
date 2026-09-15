import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  KeyRound, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  QrCode,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { UserProfile } from '../types';
import { 
  SFA_MASTER_PASSWORD, 
  SFA_TOTP_SECRET, 
  SFA_ISSUER, 
  verifyTOTP, 
  getTOTPUri 
} from '../utils/totp';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  availableUsers: UserProfile[];
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  availableUsers,
  isMandatory = false,
}) => {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [selectedUsername, setSelectedUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  // Generate QR code for Google Authenticator setup whenever selectedUsername changes
  useEffect(() => {
    let isMounted = true;
    const uri = getTOTPUri(selectedUsername, SFA_TOTP_SECRET, SFA_ISSUER);
    QRCode.toDataURL(uri, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeUrl(url);
        }
      })
      .catch((err) => console.error('QR code generation error', err));

    return () => {
      isMounted = false;
    };
  }, [selectedUsername]);

  // Focus on 6-digit input when advancing to MFA step
  useEffect(() => {
    if (step === 'mfa' && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  // Handle Step 1: Password validation
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const matched = availableUsers.find(
      (u) => u.username.toLowerCase() === selectedUsername.toLowerCase()
    );
    if (!matched) {
      setErrorMessage('Invalid username. Please select an authorized enterprise account.');
      return;
    }

    if (password.trim() !== SFA_MASTER_PASSWORD) {
      setErrorMessage('Incorrect password. Please enter the authorized password for SFA Globex.');
      return;
    }

    // Advance to Step 2: Google Authenticator MFA
    setStep('mfa');
    setMfaCode('');
  };

  // Handle Step 2: User-entered Google Authenticator 6-digit code validation
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (mfaCode.trim().length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code from your Google Authenticator app.');
      return;
    }

    setIsVerifying(true);

    try {
      const isValid = await verifyTOTP(mfaCode, SFA_TOTP_SECRET);

      if (isValid) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });

        const user =
          availableUsers.find(
            (u) => u.username.toLowerCase() === selectedUsername.toLowerCase()
          ) || availableUsers[0];

        setTimeout(() => {
          setIsVerifying(false);
          onLoginSuccess({
            ...user,
            mfaVerified: true,
            lastLogin: new Date().toISOString(),
          });
        }, 300);
      } else {
        setIsVerifying(false);
        setErrorMessage(
          'Invalid verification code. Open your Google Authenticator app, check the current 6-digit code for SFA Globex, and try again.'
        );
      }
    } catch {
      setIsVerifying(false);
      setErrorMessage('Verification failed. Please check your authenticator code and try again.');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(SFA_TOTP_SECRET);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-6 animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-6 border-b border-slate-800 text-center relative">
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-white/20 mb-2.5">
            <Lock className="w-6 h-6 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-1">
            sfaglobex.ae • Secure Portal
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">
            SFA Globex Security Gateway
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
            Authorized Ferro Alloys & Metals Trade Operations
          </p>

          {/* Stepper Progress */}
          <div className="mt-3.5 flex items-center justify-center gap-2 text-[11px] font-semibold">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition ${
              step === 'credentials' 
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}>
              <span>1. Enter Password</span>
            </div>
            <span className="text-slate-600">→</span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition ${
              step === 'mfa' 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' 
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}>
              <Smartphone className="w-3.5 h-3.5" />
              <span>2. Authenticator Code</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* STEP 1: PASSWORD AUTHENTICATION */}
          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Select User Account
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {availableUsers.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        setSelectedUsername(u.username);
                        setErrorMessage('');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        selectedUsername === u.username
                          ? 'bg-blue-950/70 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold capitalize">{u.role}</span>
                        {selectedUsername === u.username && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{u.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={selectedUsername}
                    onChange={(e) => setSelectedUsername(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="Enter enterprise username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Enterprise Password
                </label>
                
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="submit-password-btn"
                  disabled={!password.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-blue-500/25 transition active:scale-98"
                >
                  <span>Verify Password & Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: USER ADDS CODE FROM GOOGLE AUTHENTICATOR */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 border border-emerald-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Two-Factor Authentication
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Open your <strong className="text-slate-200">Google Authenticator</strong> app and enter the 6-digit code for SFA Globex.
                </p>
              </div>

              {/* 6-Digit Code Input Box */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-center uppercase tracking-wider">
                  Enter 6-Digit Code
                </label>
                <div className="relative">
                  <input
                    ref={mfaInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setMfaCode(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black bg-slate-800/90 border-2 border-slate-700 focus:border-emerald-500 rounded-xl py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                    placeholder="------"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center mt-1.5">
                  Code changes every 30 seconds in your Authenticator app
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMessage('');
                  }}
                  className="w-1/3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/80 rounded-xl border border-slate-700 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  id="verify-mfa-submit-btn"
                  disabled={isVerifying || mfaCode.length < 6}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/25 transition active:scale-98"
                >
                  {isVerifying ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify & Enter System</span>
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible Authenticator App Setup (QR Code) */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="w-full flex items-center justify-between text-xs text-blue-400 hover:text-blue-300 font-medium py-1.5 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Need to set up Google Authenticator?</span>
                  </span>
                  {showSetupGuide ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showSetupGuide && (
                  <div className="mt-2 p-3 bg-slate-800/70 border border-slate-700 rounded-xl text-center space-y-3 animate-in fade-in">
                    <p className="text-[11px] text-slate-300">
                      Scan this QR code with <strong>Google Authenticator</strong> (or Microsoft Authenticator) to add SFA Globex:
                    </p>

                    {qrCodeUrl ? (
                      <div className="p-2 bg-white rounded-lg shadow inline-block mx-auto">
                        <img 
                          src={qrCodeUrl} 
                          alt="Google Authenticator Setup QR Code" 
                          className="w-32 h-32 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center mx-auto animate-pulse">
                        <QrCode className="w-8 h-8 text-slate-500" />
                      </div>
                    )}

                    <div className="text-left bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Manual Setup Key:</div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-amber-300 font-bold tracking-wider">
                          SFAG LOBE XDUB AI27
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] transition"
                        >
                          {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Footer security tag */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-center gap-2">
            <span>SFA Globex FZCO</span>
            <span>•</span>
            <span>RFC 6238 TOTP Protected</span>
            <span>•</span>
            <span>Dubai, UAE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
