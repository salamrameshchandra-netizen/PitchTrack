import React, { useState, useEffect } from 'react';
import {
  BowlerProfile,
  OverRecord,
  BallDelivery,
  LengthZone,
  LineZone,
  BallOutcome,
  WicketType,
  DeliveryVariation,
  LENGTH_ZONES_CONFIG,
  LINE_ZONES_CONFIG,
  BowlingStyle,
  BowlingSide,
  BOWLING_SIDE_CONFIG,
} from '../types';
import { CricketPitch } from './CricketPitch';
import { saveOver, saveBowler, getAllBowlers } from '../lib/db';
import { exportDetailedAnalyticsPDF } from '../lib/pdfExport';
import {
  UserPlus,
  Target,
  FileDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Flame,
  Activity,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Zap,
  Trash2,
  Users,
  ArrowRightLeft,
  X,
  Check,
} from 'lucide-react';

interface LivePitchTrackerProps {
  bowlers: BowlerProfile[];
  onBowlersUpdated: () => void;
  onOverSaved: (over: OverRecord) => void;
  onNavigateToDashboard: () => void;
}

export const LivePitchTracker: React.FC<LivePitchTrackerProps> = ({
  bowlers,
  onBowlersUpdated,
  onOverSaved,
  onNavigateToDashboard,
}) => {
  // Selected Bowler
  const [selectedBowlerId, setSelectedBowlerId] = useState<string>(bowlers[0]?.id || '');
  const [showAddBowlerModal, setShowAddBowlerModal] = useState(false);
  const [newBowlerName, setNewBowlerName] = useState('');
  const [newBowlerTeam, setNewBowlerTeam] = useState('');
  const [newBowlerStyle, setNewBowlerStyle] = useState<BowlingStyle>('Right-arm Fast');
  const [newBowlerJersey, setNewBowlerJersey] = useState<string>('');
  const [newBowlerNotes, setNewBowlerNotes] = useState('');

  // Match / Over Header Details
  const [matchName, setMatchName] = useState('Championship Match');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('Home Ground');
  const [overNumber, setOverNumber] = useState(1);

  // Current Over In-Progress Balls
  const [currentBalls, setCurrentBalls] = useState<BallDelivery[]>([]);
  const [overCompleteModalOpen, setOverCompleteModalOpen] = useState(false);
  const [nextBowlerId, setNextBowlerId] = useState<string>('');
  const [lastSavedOver, setLastSavedOver] = useState<OverRecord | null>(null);

  // Active Ball Delivery Form State
  const [batterHand, setBatterHand] = useState<'RHB' | 'LHB'>('RHB');
  const [bowlingSide, setBowlingSide] = useState<BowlingSide>('over_the_wicket');
  const [selectedPitchCoords, setSelectedPitchCoords] = useState<{
    xPercent: number;
    yPercent: number;
    pitchDistanceMeters: number;
    pitchLineOffsetMeters: number;
    lengthZone: LengthZone;
    lineZone: LineZone;
  }>({
    xPercent: 50,
    yPercent: 50,
    pitchDistanceMeters: 6.0,
    pitchLineOffsetMeters: 0,
    lengthZone: 'good_length',
    lineZone: 'stumps',
  });

  const [variation, setVariation] = useState<DeliveryVariation>('Standard');
  const [ballNotes, setBallNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    if (bowlers.length > 0 && (!selectedBowlerId || !bowlers.some((b) => b.id === selectedBowlerId))) {
      setSelectedBowlerId(bowlers[0].id);
    }
  }, [bowlers, selectedBowlerId]);

  const activeBowler = bowlers.find((b) => b.id === selectedBowlerId) || bowlers[0];

  // Helper to open End Over popup with preselected next bowler
  const handleOpenEndOverModal = () => {
    // In cricket, bowling changes occur at the end of each over from the opposite end
    const alternateBowler = bowlers.find((b) => b.id !== activeBowler?.id);
    setNextBowlerId(alternateBowler ? alternateBowler.id : (activeBowler?.id || ''));
    setOverCompleteModalOpen(true);
  };

  // Helper to show brief toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Direct manual length selection update
  const handleLengthZoneSelect = (zone: LengthZone) => {
    const config = LENGTH_ZONES_CONFIG[zone];
    const midDistance = (config.minDistMeters + config.maxDistMeters) / 2;
    const yPct = (midDistance / 12.0) * 100;

    setSelectedPitchCoords((prev) => ({
      ...prev,
      lengthZone: zone,
      pitchDistanceMeters: Number(midDistance.toFixed(2)),
      yPercent: Number(yPct.toFixed(1)),
    }));
  };

  // Direct manual line selection update
  const handleLineZoneSelect = (line: LineZone) => {
    let xPct = 50;
    const isRHB = batterHand === 'RHB';
    if (isRHB) {
      if (line === 'wide_off') xPct = 12;
      else if (line === 'outside_off') xPct = 34;
      else if (line === 'stumps') xPct = 50;
      else if (line === 'pads') xPct = 68;
      else xPct = 88;
    } else {
      if (line === 'down_leg') xPct = 12;
      else if (line === 'pads') xPct = 34;
      else if (line === 'stumps') xPct = 50;
      else if (line === 'outside_off') xPct = 68;
      else xPct = 88;
    }

    setSelectedPitchCoords((prev) => ({
      ...prev,
      lineZone: line,
      xPercent: xPct,
    }));
  };

  // Pitch click callback
  const handlePitchClick = (coords: {
    xPercent: number;
    yPercent: number;
    pitchDistanceMeters: number;
    pitchLineOffsetMeters: number;
    lengthZone: LengthZone;
    lineZone: LineZone;
  }) => {
    setSelectedPitchCoords(coords);
  };

  // Deliveries count
  const legalBalls = currentBalls;

  // Add Ball Delivery to Current Over
  const handleLogBall = () => {
    if (!activeBowler) {
      showToast('Please select or add a bowler first.');
      return;
    }

    const newBall: BallDelivery = {
      id: `ball-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      bowlerId: activeBowler.id,
      bowlerName: activeBowler.name,
      overId: `over-live-${overNumber}`,
      overNumber,
      ballNumberInOver: currentBalls.length + 1,
      legalBallNumber: currentBalls.length + 1,
      isLegal: true,
      xPercent: selectedPitchCoords.xPercent,
      yPercent: selectedPitchCoords.yPercent,
      pitchDistanceMeters: selectedPitchCoords.pitchDistanceMeters,
      pitchLineOffsetMeters: selectedPitchCoords.pitchLineOffsetMeters,
      lengthZone: selectedPitchCoords.lengthZone,
      lineZone: selectedPitchCoords.lineZone,
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      variation,
      batterHand,
      bowlingSide,
      notes: ballNotes.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    const updatedBalls = [...currentBalls, newBall];
    setCurrentBalls(updatedBalls);

    // Reset single ball notes
    setBallNotes('');
    const sideName = bowlingSide === 'around_the_wicket' ? 'Around Wkt' : 'Over Wkt';
    showToast(`Ball #${newBall.ballNumberInOver} recorded (${sideName}, ${LENGTH_ZONES_CONFIG[newBall.lengthZone].shortName})`);

    // Check if over is completed (6 balls) - Pop option to End Over and Change Bowler
    if (updatedBalls.length >= 6) {
      const alternateBowler = bowlers.find((b) => b.id !== activeBowler?.id);
      setNextBowlerId(alternateBowler ? alternateBowler.id : (activeBowler?.id || ''));
      setOverCompleteModalOpen(true);
    }
  };

  // Undo Last Ball
  const handleUndoLastBall = () => {
    if (currentBalls.length === 0) return;
    const updated = [...currentBalls];
    updated.pop();
    setCurrentBalls(updated);
    showToast('Last ball removed');
  };

  // Reset Over
  const handleConfirmResetOver = () => {
    setCurrentBalls([]);
    setShowResetConfirmModal(false);
    showToast('Current over deliveries cleared');
  };

  // Save Completed Over to Local Database and Change Bowler
  const handleSaveCompletedOver = async (proceedToNextOver: boolean = true) => {
    if (!activeBowler || currentBalls.length === 0) return;

    // The bowler who bowled this over must be recorded accurately
    const bowlerWhoBowled = activeBowler;
    const totalRuns = currentBalls.reduce((sum, b) => sum + b.runsScored, 0);
    const totalWickets = currentBalls.filter((b) => b.isWicket).length;
    const totalExtras = currentBalls.filter((b) => !b.isLegal).length;
    const legalCount = currentBalls.filter((b) => b.isLegal).length;
    const isMaiden = legalCount >= 6 && totalRuns === 0;

    const overRecord: OverRecord = {
      id: `over-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      matchId: `match-${matchDate}-${matchName.replace(/\s+/g, '_')}`,
      matchName,
      matchDate,
      venue,
      bowlerId: bowlerWhoBowled.id,
      bowlerName: bowlerWhoBowled.name,
      bowlingStyle: bowlerWhoBowled.bowlingStyle,
      overNumber,
      balls: currentBalls,
      totalRuns,
      totalWickets,
      totalExtras,
      legalBallsCount: legalCount,
      isMaiden,
      isComplete: true,
      completedAt: new Date().toISOString(),
      notes: `Over #${overNumber} by ${bowlerWhoBowled.name}: ${totalRuns} runs, ${totalWickets} wickets`,
    };

    await saveOver(overRecord);
    setLastSavedOver(overRecord);
    onOverSaved(overRecord);
    onBowlersUpdated();

    setOverCompleteModalOpen(false);

    if (proceedToNextOver) {
      setOverNumber((prev) => prev + 1);
      setCurrentBalls([]);

      // Transition to selected next bowler
      const targetBowlerId = nextBowlerId || bowlerWhoBowled.id;
      const chosenNextBowler = bowlers.find((b) => b.id === targetBowlerId) || bowlerWhoBowled;

      if (targetBowlerId !== bowlerWhoBowled.id) {
        setSelectedBowlerId(targetBowlerId);
        showToast(`Over #${overNumber} finished! Next Over #${overNumber + 1}: Bowler changed to ${chosenNextBowler.name}`);
      } else {
        showToast(`Over #${overNumber} finished! Next Over #${overNumber + 1}: Continuing with ${bowlerWhoBowled.name}`);
      }
    } else {
      showToast(`Over #${overNumber} saved to Local Database!`);
    }
  };

  // Add Bowler Inline Form Submit
  const handleCreateBowler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBowlerName.trim()) return;

    const newBowler: BowlerProfile = {
      id: `bowler-${Date.now()}`,
      name: newBowlerName.trim(),
      team: newBowlerTeam.trim() || 'Club Team',
      bowlingStyle: newBowlerStyle,
      jerseyNumber: newBowlerJersey ? Number(newBowlerJersey) : undefined,
      notes: newBowlerNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalOversBowled: 0,
      totalBallsBowled: 0,
      totalRunsConceded: 0,
      totalWickets: 0,
      totalMaidens: 0,
      totalDots: 0,
    };

    await saveBowler(newBowler);
    onBowlersUpdated();

    // If Over Complete pop is open, set newly added bowler as the next bowler
    if (overCompleteModalOpen) {
      setNextBowlerId(newBowler.id);
    } else {
      setSelectedBowlerId(newBowler.id);
    }

    setNewBowlerName('');
    setNewBowlerTeam('');
    setNewBowlerJersey('');
    setNewBowlerNotes('');
    setShowAddBowlerModal(false);
    showToast(`Bowler "${newBowler.name}" added successfully!`);
  };

  // Export current active over directly to PDF
  const handleExportCurrentOverPDF = () => {
    if (currentBalls.length === 0) {
      showToast('Log at least one ball before exporting.');
      return;
    }

    const tempOver: OverRecord = {
      id: `over-temp-${Date.now()}`,
      matchId: 'live-match',
      matchName,
      matchDate,
      venue,
      bowlerId: activeBowler?.id || 'bowler',
      bowlerName: activeBowler?.name || 'Bowler',
      bowlingStyle: activeBowler?.bowlingStyle,
      overNumber,
      balls: currentBalls,
      totalRuns: currentBalls.reduce((s, b) => s + b.runsScored, 0),
      totalWickets: currentBalls.filter((b) => b.isWicket).length,
      totalExtras: currentBalls.filter((b) => !b.isLegal).length,
      legalBallsCount: currentBalls.filter((b) => b.isLegal).length,
      isMaiden: currentBalls.reduce((s, b) => s + b.runsScored, 0) === 0,
      isComplete: false,
    };

    exportDetailedAnalyticsPDF({
      title: `Over #${overNumber} Pitch Map Report - ${activeBowler?.name}`,
      bowler: activeBowler,
      overs: [tempOver],
      dateRangeLabel: `Live Over #${overNumber} (${matchDate})`,
      includePitchMap: true,
    });
  };

  // Over Statistics Breakdown
  const totalOverRuns = currentBalls.reduce((sum, b) => sum + b.runsScored, 0);
  const totalOverWickets = currentBalls.filter((b) => b.isWicket).length;
  const totalOverDots = currentBalls.filter((b) => b.outcome === 'dot').length;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce font-medium text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bento Header Card: Active Bowler & Match Configuration */}
      <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Active Bowler Bento Pod */}
          <div className="lg:col-span-5 flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-lg font-bold font-mono text-indigo-400 shrink-0 shadow-inner">
              {activeBowler?.name ? activeBowler.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'BW'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Active Bowler</span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  {activeBowler?.bowlingStyle || 'No Bowler Selected'}
                </span>
              </div>
              {bowlers.length === 0 ? (
                <button
                  id="add-bowler-empty-state-btn"
                  type="button"
                  onClick={() => setShowAddBowlerModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Bowler to Start</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    id="bowler-selector-dropdown"
                    value={selectedBowlerId}
                    onChange={(e) => setSelectedBowlerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    {bowlers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} • {b.team || 'Squad'}
                      </option>
                    ))}
                  </select>
                  <button
                    id="add-new-bowler-btn"
                    type="button"
                    onClick={() => setShowAddBowlerModal(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    title="Add New Bowler"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">+ Bowler</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Match & Over Info Bento Capsules */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-2.5">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Over #</span>
              <input
                id="over-number-input"
                type="number"
                min={1}
                max={100}
                value={overNumber}
                onChange={(e) => setOverNumber(Number(e.target.value))}
                className="w-full bg-transparent border-none p-0 text-base font-mono font-bold text-indigo-400 focus:ring-0"
              />
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Date</span>
              <input
                id="match-date-input"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-xs font-mono text-slate-200 focus:ring-0"
              />
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Match</span>
              <input
                id="match-name-input"
                type="text"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                placeholder="Match Name"
                className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-200 focus:ring-0 truncate"
              />
            </div>
          </div>

          {/* Quick PDF & Analytics Actions */}
          <div className="lg:col-span-3 flex items-center justify-end gap-2.5">
            <button
              id="export-current-over-pdf-btn"
              type="button"
              onClick={handleExportCurrentOverPDF}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors"
              title="Extract Over to PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Over PDF</span>
            </button>
            <button
              id="view-analytics-dash-btn"
              type="button"
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Live Over Score HUD (Bento Ribbon) */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          
          {/* Over Progression Balls Ribbon */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
              Over {overNumber}
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const ball = legalBalls[num - 1];
                const isCurrent = legalBalls.length === num - 1;

                return (
                  <div
                    key={num}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      ball
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : isCurrent
                        ? 'border-2 border-indigo-500 bg-indigo-950/40 text-indigo-400 animate-pulse'
                        : 'border border-slate-800 text-slate-600 bg-slate-950'
                    }`}
                    title={ball ? `Ball #${num}: ${LENGTH_ZONES_CONFIG[ball.lengthZone].name} (${ball.lineZone})` : `Ball #${num}`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Over Score Metrics Capsules */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase font-mono">Balls Logged</span>
              <span className="text-sm font-mono font-bold text-white">{currentBalls.length} / 6</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase font-mono">Selected Zone</span>
              <span className="text-sm font-mono font-bold text-indigo-400">
                {LENGTH_ZONES_CONFIG[selectedPitchCoords.lengthZone].shortName}
              </span>
            </div>

            {currentBalls.length > 0 && (
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={handleUndoLastBall}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                  title="Undo Last Ball"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  className="px-2.5 py-1.5 text-[11px] font-mono text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors border border-rose-900/40 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {legalBalls.length >= 6 && (
              <button
                id="btn-hud-end-over"
                type="button"
                onClick={handleOpenEndOverModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/40 animate-pulse ml-2 cursor-pointer transition-all"
                title="End over and change bowler"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>End Over & Change Bowler</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Bento Split: Pitch Visualizer (Left) + Delivery Input Controller (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Bento Card: Interactive Pitch Map */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col items-center relative overflow-hidden shadow-xl">
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Pitching Zone</span>
              </h2>
            </div>

            {/* Bowling Side & Batter Stance Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Bowling Side Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-semibold" title="Bowling Side / Angle">
                <button
                  id="btn-toggle-bowling-side-over"
                  type="button"
                  onClick={() => setBowlingSide('over_the_wicket')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                    bowlingSide === 'over_the_wicket'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Over the Wicket (OTW)"
                >
                  Over Wkt
                </button>
                <button
                  id="btn-toggle-bowling-side-around"
                  type="button"
                  onClick={() => setBowlingSide('around_the_wicket')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                    bowlingSide === 'around_the_wicket'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Around the Wicket (ATW)"
                >
                  Around Wkt
                </button>
              </div>

              {/* Batter Stance Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBatterHand('RHB')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                    batterHand === 'RHB'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  RHB
                </button>
                <button
                  type="button"
                  onClick={() => setBatterHand('LHB')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                    batterHand === 'LHB'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  LHB
                </button>
              </div>
            </div>
          </div>

          {/* 2D Pitch Visualizer */}
          <CricketPitch
            interactive={true}
            selectedCoordinates={selectedPitchCoords}
            onPitchClick={handlePitchClick}
            ballsToDisplay={currentBalls}
            batterHand={batterHand}
            bowlingSide={bowlingSide}
            onBowlingSideToggle={setBowlingSide}
            showZoneLabels={true}
          />
        </div>

        {/* Right Bento Column: Ball Delivery Logging Form */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Bento Card 1: Pitch Length Zones Selector */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                1. Ball Pitch Length Zone
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {LENGTH_ZONES_CONFIG[selectedPitchCoords.lengthZone].name} ({selectedPitchCoords.pitchDistanceMeters}m)
              </span>
            </div>

            {/* 6 Length Zone Bento Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(['yorker', 'over_pitch', 'full_length', 'good_length', 'short_of_good_length', 'short'] as LengthZone[]).map((zone) => {
                const cfg = LENGTH_ZONES_CONFIG[zone];
                const isSelected = selectedPitchCoords.lengthZone === zone;

                let themeZoneStyle = 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700';
                if (isSelected) {
                  if (zone === 'good_length') themeZoneStyle = 'bg-emerald-950/60 border-2 border-emerald-500 text-emerald-300 shadow-md';
                  else if (zone === 'yorker') themeZoneStyle = 'bg-rose-950/60 border-2 border-rose-500 text-rose-300 shadow-md';
                  else if (zone === 'over_pitch') themeZoneStyle = 'bg-blue-950/60 border-2 border-blue-500 text-blue-300 shadow-md';
                  else if (zone === 'full_length') themeZoneStyle = 'bg-amber-950/60 border-2 border-amber-500 text-amber-300 shadow-md';
                  else if (zone === 'short_of_good_length') themeZoneStyle = 'bg-pink-950/60 border-2 border-pink-500 text-pink-300 shadow-md';
                  else themeZoneStyle = 'bg-purple-950/60 border-2 border-purple-500 text-purple-300 shadow-md';
                }

                return (
                  <button
                    key={zone}
                    id={`btn-length-${zone}`}
                    type="button"
                    onClick={() => handleLengthZoneSelect(zone)}
                    className={`relative p-3 rounded-2xl border text-left transition-all ${themeZoneStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{cfg.shortName}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      {cfg.minDistMeters}m - {cfg.maxDistMeters}m
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pitch Line Selector Bento Pod */}
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Line of Delivery
                </span>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {LINE_ZONES_CONFIG[selectedPitchCoords.lineZone].name}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {(['wide_off', 'outside_off', 'stumps', 'pads', 'down_leg'] as LineZone[]).map((line) => {
                  const cfg = LINE_ZONES_CONFIG[line];
                  const isSelected = selectedPitchCoords.lineZone === line;

                  return (
                    <button
                      key={line}
                      type="button"
                      onClick={() => handleLineZoneSelect(line)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {cfg.shortName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bento Card 2: Bowling Angle, Variation & Notes */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/30 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                2. Bowling Angle, Variation & Notes
              </h3>
              <span className="text-[11px] font-mono font-bold text-slate-400">
                {bowlingSide === 'around_the_wicket' ? 'Around the Wicket' : 'Over the Wicket'}
              </span>
            </div>

            {/* Bowling Angle, Variation & Notes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Bowling Side (Angle)
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBowlingSide('over_the_wicket')}
                    className={`py-2 px-1 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                      bowlingSide === 'over_the_wicket'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Over (OTW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBowlingSide('around_the_wicket')}
                    className={`py-2 px-1 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                      bowlingSide === 'around_the_wicket'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Around (ATW)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Delivery Variation
                </label>
                <select
                  value={variation}
                  onChange={(e) => setVariation(e.target.value as DeliveryVariation)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-medium cursor-pointer"
                >
                  <option value="Standard">Standard Delivery</option>
                  <option value="Outswinger">Outswinger</option>
                  <option value="Inswinger">Inswinger</option>
                  <option value="Reverse Swing">Reverse Swing</option>
                  <option value="Off-Cutter">Off-Cutter</option>
                  <option value="Leg-Cutter">Leg-Cutter</option>
                  <option value="Slower Ball">Slower Ball</option>
                  <option value="Knuckle Ball">Knuckle Ball</option>
                  <option value="Bouncer">Bouncer</option>
                  <option value="Yorker">Yorker</option>
                  <option value="Googly">Googly</option>
                  <option value="Flipper">Flipper</option>
                  <option value="Doosra">Doosra</option>
                  <option value="Arm Ball">Arm Ball</option>
                  <option value="Carrom Ball">Carrom Ball</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Delivery Notes / Observation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Beat outside edge, seam movement"
                  value={ballNotes}
                  onChange={(e) => setBallNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* BIG ACTION: RECORD BALL & END OVER POP OPTION BUTTON */}
            <div className="pt-2 space-y-2">
              {currentBalls.length >= 6 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    id="btn-card-end-over"
                    type="button"
                    onClick={handleOpenEndOverModal}
                    className="py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                    <span>End Over & Change Bowler</span>
                  </button>

                  <button
                    id="record-and-log-ball-btn"
                    type="button"
                    onClick={handleLogBall}
                    className="py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                    title="Log ball 7+ in case of extra balls or extended overs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Extra Ball #{currentBalls.length + 1}</span>
                  </button>
                </div>
              ) : (
                <button
                  id="record-and-log-ball-btn"
                  type="button"
                  onClick={handleLogBall}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>
                    Record Ball #{currentBalls.length + 1} ({bowlingSide === 'around_the_wicket' ? 'Around Wkt' : 'Over Wkt'} • {LENGTH_ZONES_CONFIG[selectedPitchCoords.lengthZone].shortName})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Over Complete & Change Bowler Pop Modal */}
      {overCompleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-700/80 shadow-2xl space-y-5 animate-scaleUp relative">
            {/* Top Close Dismiss Button */}
            <button
              type="button"
              onClick={() => setOverCompleteModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close and review pitch"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Badge & Title */}
            <div className="space-y-1 pr-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Over #{overNumber} Complete • {currentBalls.length} Deliveries Bowled</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 pt-1">
                <span>End Over & Change Bowler</span>
              </h3>
              <p className="text-xs text-slate-400">
                Over #{overNumber} bowled by <strong className="text-white font-semibold">{activeBowler?.name}</strong> ({activeBowler?.bowlingStyle}) • {matchName}
              </p>
            </div>

            {/* Deliveries Strip Breakdown */}
            <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800/80 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                <span>Over Deliveries</span>
                <span className="text-indigo-400">{currentBalls.length} Balls</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {currentBalls.slice(0, 6).map((ball, i) => {
                  const zoneCfg = LENGTH_ZONES_CONFIG[ball.lengthZone];
                  return (
                    <div
                      key={ball.id || i}
                      className="p-1.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center space-y-0.5"
                    >
                      <div className="text-[10px] font-mono text-slate-400 font-bold">#{ball.ballNumberInOver}</div>
                      <div
                        className="text-[11px] font-bold truncate px-1 rounded"
                        style={{ color: zoneCfg.color }}
                      >
                        {zoneCfg.shortName}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">
                        {ball.bowlingSide === 'around_the_wicket' ? 'ATW' : 'OTW'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mini Summary Stats Bento */}
            <div className="bg-slate-950/50 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center border border-slate-800/60">
              <div>
                <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Good Length</div>
                <div className="text-lg font-mono font-bold text-emerald-400">
                  {currentBalls.filter((b) => b.lengthZone === 'good_length').length}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Full / Yorker</div>
                <div className="text-lg font-mono font-bold text-indigo-400">
                  {currentBalls.filter((b) => b.lengthZone === 'yorker' || b.lengthZone === 'over_pitch' || b.lengthZone === 'full_length').length}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Release Angle</div>
                <div className="text-xs font-mono font-bold text-amber-400 mt-1">
                  {currentBalls.filter((b) => b.bowlingSide === 'around_the_wicket').length} ATW • {currentBalls.filter((b) => b.bowlingSide !== 'around_the_wicket').length} OTW
                </div>
              </div>
            </div>

            {/* Change Bowler Selector Section */}
            <div className="space-y-2.5 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  <span>Next Bowler for Over #{overNumber + 1}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddBowlerModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Bowler</span>
                </button>
              </div>

              {/* Bowler Selection Options */}
              <div className="space-y-2">
                <select
                  id="select-next-over-bowler"
                  value={nextBowlerId}
                  onChange={(e) => setNextBowlerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:border-indigo-500 cursor-pointer"
                >
                  {bowlers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.bowlingStyle}) {b.id === activeBowler?.id ? '— [Current Bowler]' : '— [Change to this bowler]'}
                    </option>
                  ))}
                </select>

                {/* Bowler Quick Pills Selection */}
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {bowlers.map((b) => {
                    const isSelected = nextBowlerId === b.id;
                    const isCurrent = b.id === activeBowler?.id;

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setNextBowlerId(b.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate text-white">{b.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate">{b.bowlingStyle}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300 font-mono shrink-0">
                              Just Bowled
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                id="btn-confirm-end-over-and-change"
                type="button"
                onClick={() => handleSaveCompletedOver(true)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>
                  End Over & Start Over #{overNumber + 1} with {bowlers.find((b) => b.id === nextBowlerId)?.name || 'Next Bowler'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCurrentOverPDF}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>Export Over PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOverCompleteModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Review Pitch Deliveries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Bowler Modal */}
      {showAddBowlerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Add New Bowler Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBowlerModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBowler} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Bowler Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. James Anderson"
                  value={newBowlerName}
                  onChange={(e) => setNewBowlerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Team / Squad
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. England XI"
                    value={newBowlerTeam}
                    onChange={(e) => setNewBowlerTeam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Jersey #
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 9"
                    value={newBowlerJersey}
                    onChange={(e) => setNewBowlerJersey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Bowling Style *
                </label>
                <select
                  value={newBowlerStyle}
                  onChange={(e) => setNewBowlerStyle(e.target.value as BowlingStyle)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                >
                  <option value="Right-arm Fast">Right-arm Fast</option>
                  <option value="Right-arm Fast-Medium">Right-arm Fast-Medium</option>
                  <option value="Right-arm Medium">Right-arm Medium</option>
                  <option value="Right-arm Off-Break">Right-arm Off-Break (Off Spin)</option>
                  <option value="Right-arm Leg-Break">Right-arm Leg-Break (Leg Spin)</option>
                  <option value="Left-arm Fast">Left-arm Fast</option>
                  <option value="Left-arm Fast-Medium">Left-arm Fast-Medium</option>
                  <option value="Left-arm Orthodox">Left-arm Orthodox (Finger Spin)</option>
                  <option value="Left-arm Chinaman">Left-arm Chinaman (Wrist Spin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Coach Notes / Characteristics
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Excellent seam movement, tight line"
                  value={newBowlerNotes}
                  onChange={(e) => setNewBowlerNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBowlerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Save Bowler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Current Over In-App Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/50 text-rose-400 border border-rose-800/40">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Current Over?</h3>
                <p className="text-xs text-slate-400">All {currentBalls.length} unsaved deliveries in this over will be cleared.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-reset-over-btn"
                type="button"
                onClick={handleConfirmResetOver}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Over</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
