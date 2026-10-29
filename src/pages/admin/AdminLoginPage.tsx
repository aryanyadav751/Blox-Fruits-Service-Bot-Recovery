import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api.ts';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigate: (path: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ 
  onLoginSuccess, 
  onNavigate 
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the staff administration password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.adminLogin(password.trim());
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your staff password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-400/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-400/20">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Staff Portal Access
          </h1>
          <p className="text-xs text-slate-400">
            Authenticated staff dashboard for managing carry requests, item valuations, and in-game escrow.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Staff Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter staff passcode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In as Staff'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Secured with HMAC-SHA256 Signed HTTP-Only Sessions</span>
          </div>
          <p>
            Configured in <code className="text-slate-400 font-mono">ADMIN_PASSWORD</code> env variable (default dev: <code className="text-slate-400 font-mono">bloxfruit_staff_2026</code>).
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Return to Public Site
          </button>
        </div>
      </div>
    </div>
  );
};
