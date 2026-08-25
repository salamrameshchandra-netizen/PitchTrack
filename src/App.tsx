/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BowlerProfile, OverRecord } from './types';
import { getAllBowlers, getAllOvers } from './lib/db';
import { LivePitchTracker } from './components/LivePitchTracker';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { BowlerManager } from './components/BowlerManager';
import {
  Activity,
  Target,
  Users,
  Moon,
  Sun,
  Database,
  FileText,
  Shield,
  Layers,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'analytics' | 'bowlers'>('live');
  const [bowlers, setBowlers] = useState<BowlerProfile[]>([]);
  const [overs, setOvers] = useState<OverRecord[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Database Records
  const loadData = async () => {
    try {
      const [fetchedBowlers, fetchedOvers] = await Promise.all([
        getAllBowlers(),
        getAllOvers(),
      ]);
      setBowlers(fetchedBowlers);
      setOvers(fetchedOvers);
    } catch (err) {
      console.error('Error loading data from local database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Theme Toggle Effect - defaults to dark for Bento aesthetic
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleOverSaved = (newOver: OverRecord) => {
    setOvers((prev) => [newOver, ...prev]);
    loadData();
  };

  const handleSelectBowlerForOver = (bowlerId: string) => {
    setActiveTab('live');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Bento Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-600/30 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>PITCHPRO</span>
                  <span className="text-slate-400 font-medium text-xs tracking-widest uppercase bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                    ANALYTICS
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 font-mono tracking-tight hidden sm:block">
                  Cricket Ball Pitching Map • Length Matrix • Local DB
                </p>
              </div>
            </div>

            {/* Navigation Tabs (Bento Pill Bar) */}
            <nav className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/90 p-1 rounded-xl">
              <button
                id="tab-live-pitch-tracker"
                type="button"
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'live'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Live Pitch</span>
              </button>

              <button
                id="tab-analytics-dashboard"
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Historical Analytics</span>
              </button>

              <button
                id="tab-bowler-squad"
                type="button"
                onClick={() => setActiveTab('bowlers')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'bowlers'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Bowlers ({bowlers.length})</span>
              </button>
            </nav>

            {/* Status Indicator & Theme */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-slate-950 border border-slate-800/90 rounded-xl px-3 py-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Local DB</span>
                <span className="font-mono text-indigo-400 font-bold">{overs.length} Overs</span>
              </div>

              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800/80 hover:bg-slate-900 transition-colors"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Loading pitch tracking records...</p>
          </div>
        ) : (
          <>
            {activeTab === 'live' && (
              <LivePitchTracker
                bowlers={bowlers}
                onBowlersUpdated={loadData}
                onOverSaved={handleOverSaved}
                onNavigateToDashboard={() => setActiveTab('analytics')}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                bowlers={bowlers}
                overs={overs}
                onOverDeleted={loadData}
                onNavigateToLive={() => setActiveTab('live')}
                onNavigateToBowlers={() => setActiveTab('bowlers')}
              />
            )}

            {activeTab === 'bowlers' && (
              <BowlerManager
                bowlers={bowlers}
                overs={overs}
                onBowlersUpdated={loadData}
                onSelectBowlerForOver={handleSelectBowlerForOver}
              />
            )}
          </>
        )}
      </main>

      {/* Bento Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">PITCHPRO ANALYTICS</span>
            <span>•</span>
            <span className="text-slate-400">Bento Grid Performance Engine</span>
          </div>
          <div className="text-slate-500 font-mono text-[11px]">
            Yorker (0-1.5m) • Overpitch (1.5-3m) • Full (3-5m) • Good (5-7m) • Short-Good (7-9m) • Short (9-12m)
          </div>
        </div>
      </footer>
    </div>
  );
}
