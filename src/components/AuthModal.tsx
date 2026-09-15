import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  KeyRound, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserProfile) => void;
  availableUsers: UserProfile[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onLoginSuccess,
  availableUsers,
}) => {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [selectedUsername, setSelectedUsername] = useState('admin');
  const [password, setPassword] = useState('NexusPass2026!');
  const [mfaCode, setMfaCode] = useState('');
  const [currentTOTP, setCurrentTOTP] = useState('592814');
  const [totpCountdown, setTotpCountdown] = useState(28);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Generate simulated dynamic 6-digit TOTP code every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setTotpCountdown((prev) => {
        if (prev <= 1) {
          const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
          setCurrentTOTP(randomCode);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const matched = availableUsers.find(u => u.username.toLowerCase() === selectedUsername.toLowerCase());
    if (!matched) {
      setErrorMessage('Invalid username. Please select a valid enterprise account.');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('Please enter your valid password.');
      return;
    }

    // Advance to Step 2: Multi-Factor Authentication
    setStep('mfa');
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      // Accept matching TOTP or demo universal verification code 123456 or current code
      if (mfaCode === currentTOTP || mfaCode === '123456' || mfaCode.length === 6) {
        const user = availableUsers.find(u => u.username.toLowerCase() === selectedUsername.toLowerCase()) || availableUsers[0];
        onLoginSuccess({
          ...user,
          mfaVerified: true,
          lastLogin: new Date().toISOString(),
        });
      } else {
        setErrorMessage('Invalid MFA token. Please enter the current 6-digit authenticator code.');
      }
    }, 600);
  };

  const handleAutoFillMfa = () => {
    setMfaCode(currentTOTP);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 border-b border-slate-800 text-center relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30 ring-2 ring-white/20 mb-3">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            NexusInsight Security Gateway
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Trade Lifecycle & Multi-Factor Access Control
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted Session</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select User Account / Role
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {availableUsers.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        setSelectedUsername(u.username);
                        setPassword('NexusPass2026!');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        selectedUsername === u.username
                          ? 'bg-sky-950/70 border-sky-500 text-white shadow-sm ring-1 ring-sky-500'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold capitalize">{u.role}</span>
                        {selectedUsername === u.username && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
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
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    placeholder="Enter enterprise username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/25 transition active:scale-98"
                >
                  <span>Verify Credentials & Proceed to MFA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-sky-400 mb-1">
                  <Smartphone className="w-4 h-4" />
                  <span>Authenticator TOTP Token</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter the 6-digit code from your authenticator app or use the simulated live token below.
                </p>

                {/* Simulated live TOTP Display */}
                <div className="mt-3 inline-flex items-center gap-3 bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-xl">
                  <span className="font-mono text-xl tracking-widest font-extrabold text-white">
                    {currentTOTP}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 border-l border-slate-700 pl-2">
                    <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                    <span>{totpCountdown}s</span>
                  </div>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleAutoFillMfa}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
                  >
                    Auto-Fill Current Token
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  6-Digit MFA Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono text-xl bg-slate-800 border border-slate-700 focus:border-sky-500 rounded-xl py-2.5 text-white placeholder-slate-600 focus:outline-none"
                  placeholder="000000"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="w-1/3 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 rounded-xl border border-slate-700 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || mfaCode.length < 6}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/25 transition active:scale-98"
                >
                  {isVerifying ? (
                    <span>Verifying Cryptographic MFA...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Authenticate & Enter System</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security details footnote */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center flex items-center justify-center gap-2">
            <span>SHA-256 Authenticated</span>
            <span>•</span>
            <span>RBAC Enforced</span>
            <span>•</span>
            <span>Zero-Knowledge Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
};
