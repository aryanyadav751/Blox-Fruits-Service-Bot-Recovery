import React from 'react';
import { ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Core Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>In-Game Trade Value Only</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              This service operates exclusively on Roblox in-game trade values measured in Millions (M). 
              We never accept or ask for real currency (no USD, INR, cash, or wire transfers).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Zero Account Access</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We will NEVER request your Roblox password, security cookies, 2FA codes, or credentials. 
              All services are delivered as in-game co-op carries and party invites.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>50/50 Payment Escrow</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              50% deposit upfront via in-game trade window, remaining 50% only when your carry is fully completed. 
              Combine multiple fruits and gamepasses to reach the agreed value.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span>Blox Fruit Services · Community-driven in-game carry platform</span>
          </div>
          <div>
            <span>Not affiliated with Roblox Corporation or Gamer Robot Inc.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
