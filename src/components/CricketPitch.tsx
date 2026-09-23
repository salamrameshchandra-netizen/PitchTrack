import React, { useState, useRef } from 'react';
import { LengthZone, LineZone, LENGTH_ZONES_CONFIG, BallDelivery, BallOutcome, BowlingSide, BOWLING_SIDE_CONFIG } from '../types';
import { Target, Info, Crosshair, Sparkles, CornerDownRight } from 'lucide-react';

interface CricketPitchProps {
  interactive?: boolean;
  selectedCoordinates?: { xPercent: number; yPercent: number; lengthZone: LengthZone; lineZone: LineZone } | null;
  onPitchClick?: (coords: {
    xPercent: number;
    yPercent: number;
    pitchDistanceMeters: number;
    pitchLineOffsetMeters: number;
    lengthZone: LengthZone;
    lineZone: LineZone;
  }) => void;
  ballsToDisplay?: BallDelivery[];
  highlightBallId?: string;
  batterHand?: 'RHB' | 'LHB';
  bowlingSide?: BowlingSide;
  onBowlingSideToggle?: (side: BowlingSide) => void;
  showZoneLabels?: boolean;
  showHeatmap?: boolean;
  viewPerspective?: 'bowler' | 'batsman';
}

export const CricketPitch: React.FC<CricketPitchProps> = ({
  interactive = false,
  selectedCoordinates = null,
  onPitchClick,
  ballsToDisplay = [],
  highlightBallId,
  batterHand = 'RHB',
  bowlingSide = 'over_the_wicket',
  onBowlingSideToggle,
  showZoneLabels = true,
  showHeatmap = false,
  viewPerspective = 'bowler',
}) => {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [hoveredBall, setHoveredBall] = useState<BallDelivery | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Conversion logic:
  // Pitch total visual length is ~12.5 meters from batting stumps to bowler end
  // yPercent: 0% = Batting stumps (0m), 100% = 12.5m away (deep short pitch)
  // xPercent: 0% = Far off-side / wide off (-1.5m), 50% = Middle stump (0m), 100% = Leg side (+1.5m for RHB)
  const calculateZonesFromPercent = (xPct: number, yPct: number): {
    pitchDistanceMeters: number;
    pitchLineOffsetMeters: number;
    lengthZone: LengthZone;
    lineZone: LineZone;
  } => {
    // 0% yPct is right at the batting crease (0m), 100% is 12.5m away
    const pitchDistanceMeters = Number(((yPct / 100) * 12.0).toFixed(2));
    // xPct: 50 is center line (0m offset), 0 is -1.5m, 100 is +1.5m
    const pitchLineOffsetMeters = Number((((xPct - 50) / 50) * 1.5).toFixed(2));

    let lengthZone: LengthZone = 'good_length';
    if (pitchDistanceMeters <= 1.5) {
      lengthZone = 'yorker';
    } else if (pitchDistanceMeters <= 3.0) {
      lengthZone = 'over_pitch';
    } else if (pitchDistanceMeters <= 5.0) {
      lengthZone = 'full_length';
    } else if (pitchDistanceMeters <= 7.0) {
      lengthZone = 'good_length';
    } else if (pitchDistanceMeters <= 9.0) {
      lengthZone = 'short_of_good_length';
    } else {
      lengthZone = 'short';
    }

    // Determine line based on batter hand (RHB vs LHB)
    // For RHB: Left side (<50%) is Off-Side, Right side (>50%) is Leg-Side
    // For LHB: Left side (<50%) is Leg-Side, Right side (>50%) is Off-Side
    let lineZone: LineZone = 'stumps';
    const isRHB = batterHand === 'RHB';

    if (isRHB) {
      if (xPct < 22) lineZone = 'wide_off';
      else if (xPct < 44) lineZone = 'outside_off';
      else if (xPct <= 56) lineZone = 'stumps';
      else if (xPct <= 78) lineZone = 'pads';
      else lineZone = 'down_leg';
    } else {
      if (xPct < 22) lineZone = 'down_leg';
      else if (xPct < 44) lineZone = 'pads';
      else if (xPct <= 56) lineZone = 'stumps';
      else if (xPct <= 78) lineZone = 'outside_off';
      else lineZone = 'wide_off';
    }

    return {
      pitchDistanceMeters,
      pitchLineOffsetMeters,
      lengthZone,
      lineZone,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !onPitchClick || !pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    let xPct = ((clientX - rect.left) / rect.width) * 100;
    let yPct = ((clientY - rect.top) / rect.height) * 100;

    // Clamp
    xPct = Math.max(2, Math.min(98, xPct));
    yPct = Math.max(2, Math.min(98, yPct));

    const result = calculateZonesFromPercent(xPct, yPct);
    onPitchClick({
      xPercent: Number(xPct.toFixed(1)),
      yPercent: Number(yPct.toFixed(1)),
      ...result,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    setCursorPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  // Length bands definition in percentage of pitch visual height (from top 0% batting crease to bottom 100% bowler pitch length)
  const zoneBands = [
    { zone: 'yorker' as LengthZone, topPct: 0, heightPct: 12.5, label: 'Yorker / Full Toss (0-1.5m)' },
    { zone: 'over_pitch' as LengthZone, topPct: 12.5, heightPct: 12.5, label: 'Overpitch / Half-Volley (1.5-3m)' },
    { zone: 'full_length' as LengthZone, topPct: 25, heightPct: 16.6, label: 'Full Length (3-5m)' },
    { zone: 'good_length' as LengthZone, topPct: 41.6, heightPct: 16.7, label: 'Good Length (5-7m)' },
    { zone: 'short_of_good_length' as LengthZone, topPct: 58.3, heightPct: 16.7, label: 'Short of Good Length (7-9m)' },
    { zone: 'short' as LengthZone, topPct: 75, heightPct: 25, label: 'Short Pitch / Bouncer (9-12m+)' },
  ];

  const getOutcomeColor = (outcome: BallOutcome, isWicket: boolean) => {
    if (isWicket) return '#dc2626'; // Bright Red
    if (outcome === 'dot') return '#64748b'; // Slate
    if (outcome === '1_run' || outcome === '2_runs' || outcome === '3_runs') return '#0284c7'; // Blue
    if (outcome === '4_runs') return '#eab308'; // Yellow/Gold
    if (outcome === '6_runs') return '#9333ea'; // Purple
    if (outcome === 'wide' || outcome === 'no_ball') return '#f97316'; // Orange
    return '#10b981';
  };

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Pitch Header / Batter & Bowling Side Info */}
      <div className="w-full max-w-[440px] flex items-center justify-between px-3 py-2 mb-2 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Batting</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 font-mono font-bold text-[11px]">
            {batterHand} ({batterHand === 'RHB' ? 'Right' : 'Left'})
          </span>
        </div>

        {/* Bowling Side indicator / quick switch */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold hidden sm:inline">Bowling:</span>
          {onBowlingSideToggle ? (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => onBowlingSideToggle('over_the_wicket')}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                  bowlingSide === 'over_the_wicket'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Over the Wicket"
              >
                Over (OTW)
              </button>
              <button
                type="button"
                onClick={() => onBowlingSideToggle('around_the_wicket')}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                  bowlingSide === 'around_the_wicket'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Around the Wicket"
              >
                Around (ATW)
              </button>
            </div>
          ) : (
            <span
              className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] border ${
                bowlingSide === 'around_the_wicket'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
              }`}
            >
              {bowlingSide === 'around_the_wicket' ? 'Around Wkt (ATW)' : 'Over Wkt (OTW)'}
            </span>
          )}
        </div>
      </div>

      {/* Main Pitch Bento Canvas Container */}
      <div className="relative w-full max-w-[440px] aspect-[9/15] bg-slate-950 rounded-2xl p-3 shadow-2xl border border-slate-800 overflow-hidden flex flex-col justify-between">
        
        {/* Subtle Pitch Grid Lines Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* The Pitch Strip */}
        <div
          ref={pitchRef}
          id="cricket-pitch-strip"
          onPointerDown={handlePointerDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCursorPos(null)}
          className={`relative w-[82%] h-full mx-auto bg-gradient-to-b from-[#1a2234] via-[#151c2c] to-[#121824] border-x-2 border-dashed border-slate-700/60 shadow-2xl rounded-lg transition-all overflow-hidden ${
            interactive ? 'cursor-crosshair active:scale-[0.995]' : ''
          }`}
        >
          {/* Pitch Length Zones Overlays (Bento Aesthetic) */}
          {zoneBands.map((band) => {
            const config = LENGTH_ZONES_CONFIG[band.zone];
            const isSelected = selectedCoordinates?.lengthZone === band.zone;

            // Zone theme styles matching Bento Grid specification
            let zoneClass = 'bg-slate-900/30 border-white/10 text-slate-400';
            if (band.zone === 'good_length') {
              zoneClass = 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400';
            } else if (band.zone === 'yorker') {
              zoneClass = 'bg-rose-950/40 border-rose-500/50 text-rose-400';
            } else if (band.zone === 'full_length') {
              zoneClass = 'bg-amber-950/30 border-amber-500/40 text-amber-400';
            } else if (band.zone === 'over_pitch') {
              zoneClass = 'bg-blue-950/30 border-blue-500/40 text-blue-400';
            } else if (band.zone === 'short_of_good_length') {
              zoneClass = 'bg-pink-950/30 border-pink-500/40 text-pink-400';
            } else if (band.zone === 'short') {
              zoneClass = 'bg-purple-950/30 border-purple-500/40 text-purple-400';
            }

            return (
              <div
                key={band.zone}
                id={`pitch-zone-${band.zone}`}
                className={`absolute left-1 right-1 border rounded-md transition-all flex items-center justify-between px-2 text-[10px] font-semibold ${zoneClass} ${
                  isSelected ? 'ring-2 ring-indigo-400 bg-indigo-900/50 shadow-lg' : 'hover:brightness-125'
                }`}
                style={{
                  top: `${band.topPct}%`,
                  height: `${band.heightPct - 0.5}%`,
                  backgroundColor: showHeatmap ? `${config.color}33` : undefined,
                }}
              >
                {showZoneLabels && (
                  <>
                    <span
                      className="px-1.5 py-0.5 rounded shadow-sm text-[9px] uppercase tracking-wider font-mono font-bold backdrop-blur-sm pointer-events-none"
                      style={{
                        backgroundColor: `${config.color}cc`,
                        color: '#ffffff',
                      }}
                    >
                      {config.shortName}
                    </span>
                    <span className="text-[9px] text-slate-300 font-mono bg-slate-950/70 border border-slate-800 px-1.5 py-0.2 rounded pointer-events-none">
                      {config.minDistMeters}m-{config.maxDistMeters}m
                    </span>
                  </>
                )}
              </div>
            );
          })}

          {/* Stumps & Crease Markings (Top / Batsman End) */}
          <div className="absolute top-0 left-0 right-0 h-10 pointer-events-none">
            {/* Bowling Crease / Stumps Line */}
            <div className="absolute top-2 left-0 right-0 h-[2px] bg-slate-300 shadow-sm" />
            
            {/* Stumps visual (3 wickets + bails) */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 z-20">
              <div className="w-1.5 h-3.5 bg-amber-200 border border-amber-900 rounded-t shadow-md" title="Off Stump" />
              <div className="w-1.5 h-3.5 bg-amber-200 border border-amber-900 rounded-t shadow-md" title="Middle Stump" />
              <div className="w-1.5 h-3.5 bg-amber-200 border border-amber-900 rounded-t shadow-md" title="Leg Stump" />
            </div>

            {/* Popping Crease (1.22m in front of stumps) */}
            <div className="absolute top-7 left-[-20%] right-[-20%] h-[2px] bg-white/70 shadow-sm flex items-center justify-between px-3">
              <span className="text-[8px] font-bold text-slate-300 font-mono uppercase tracking-wider bg-slate-950/80 px-1 rounded border border-slate-800">
                Popping Crease
              </span>
            </div>

            {/* Return Creases (side lines) */}
            <div className="absolute top-0 bottom-0 left-2 w-[2px] bg-white/40" />
            <div className="absolute top-0 bottom-0 right-2 w-[2px] bg-white/40" />
          </div>

          {/* Center Pitch Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-indigo-500/20 border-r border-dashed border-indigo-400/30 pointer-events-none" />

          {/* Off & Leg Wide Guidelines */}
          <div className="absolute top-0 bottom-0 left-[18%] w-[1px] bg-rose-500/30 border-r border-dotted border-rose-500/40 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-[18%] w-[1px] bg-rose-500/30 border-r border-dotted border-rose-500/40 pointer-events-none" />

          {/* Historical / Displayed Balls */}
          {ballsToDisplay.map((ball, idx) => {
            const isHighlighted = highlightBallId === ball.id;
            const ballColor = LENGTH_ZONES_CONFIG[ball.lengthZone]?.color || '#6366f1';

            return (
              <div
                key={ball.id || idx}
                id={`ball-marker-${ball.id || idx}`}
                onMouseEnter={() => setHoveredBall(ball)}
                onMouseLeave={() => setHoveredBall(null)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer z-30 transition-transform ${
                  isHighlighted ? 'scale-150 ring-4 ring-indigo-400 animate-pulse' : 'hover:scale-125'
                }`}
                style={{
                  left: `${ball.xPercent}%`,
                  top: `${ball.yPercent}%`,
                  width: '20px',
                  height: '20px',
                  backgroundColor: ballColor,
                  boxShadow: '0 0 12px rgba(255,255,255,0.7), 0 2px 5px rgba(0,0,0,0.8)',
                  border: '2px solid #ffffff',
                }}
              >
                <span className="w-full h-full flex items-center justify-center text-[10px] font-black text-white leading-none font-mono">
                  {ball.ballNumberInOver || idx + 1}
                </span>
              </div>
            );
          })}

          {/* Currently Selected Coordinate Marker during active logging */}
          {selectedCoordinates && (
            <div
              id="selected-pitch-marker"
              className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none animate-bounce"
              style={{
                left: `${selectedCoordinates.xPercent}%`,
                top: `${selectedCoordinates.yPercent}%`,
              }}
            >
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(99,102,241,0.9)]">
                  <Crosshair className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="absolute -bottom-6 px-2 py-0.5 bg-slate-950 border border-slate-800 text-indigo-300 text-[9px] font-mono rounded-md font-bold whitespace-nowrap shadow-xl">
                  {LENGTH_ZONES_CONFIG[selectedCoordinates.lengthZone].shortName}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Cursor Distance Preview */}
          {interactive && cursorPos && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-8 z-30 bg-slate-950/90 text-indigo-300 px-2 py-0.5 rounded-md text-[10px] font-mono shadow-xl border border-indigo-500/30 whitespace-nowrap"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
              }}
            >
              {((cursorPos.y / 100) * 12.0).toFixed(1)}m from stumps
            </div>
          )}

          {/* Dynamic Bowling Angle Trajectory Guideline */}
          {selectedCoordinates && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              <line
                x1={bowlingSide === 'around_the_wicket' ? '28%' : '72%'}
                y1="94%"
                x2={`${selectedCoordinates.xPercent}%`}
                y2={`${selectedCoordinates.yPercent}%`}
                stroke={bowlingSide === 'around_the_wicket' ? '#f59e0b' : '#818cf8'}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeOpacity="0.8"
              />
              <circle
                cx={bowlingSide === 'around_the_wicket' ? '28%' : '72%'}
                cy="94%"
                r="3.5"
                fill={bowlingSide === 'around_the_wicket' ? '#f59e0b' : '#6366f1'}
                stroke="#ffffff"
                strokeWidth="1"
              />
            </svg>
          )}

          {/* Bowling Crease & Release End (Bottom / Bowler End) */}
          <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-auto flex flex-col justify-end bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent">
            {/* Bowling Crease Line */}
            <div className="relative w-full h-[2px] bg-slate-400 shadow-sm">
              {/* Non-striker Stumps Visual (3 wickets in middle) */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 z-20 pointer-events-none" title="Non-striker Stumps">
                <div className="w-1 h-3 bg-amber-200 border border-amber-900 rounded-t shadow-xs" />
                <div className="w-1 h-3 bg-amber-200 border border-amber-900 rounded-t shadow-xs" />
                <div className="w-1 h-3 bg-amber-200 border border-amber-900 rounded-t shadow-xs" />
              </div>
            </div>

            {/* Bowling Side Switcher / Run-up indicators at Bowler Stumps */}
            <div className="flex items-center justify-between px-1.5 py-1 z-20">
              {/* Around the Wicket side */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBowlingSideToggle?.('around_the_wicket');
                }}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 ${
                  bowlingSide === 'around_the_wicket'
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md scale-105'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-700/60 hover:text-white hover:border-slate-500'
                } ${interactive && onBowlingSideToggle ? 'cursor-pointer' : 'cursor-default'}`}
                title="Around the Wicket (ATW)"
              >
                <span>ATW</span>
                {bowlingSide === 'around_the_wicket' && <span className="text-[7px] uppercase font-black">● Active</span>}
              </button>

              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider font-semibold pointer-events-none">
                Delivery Crease
              </span>

              {/* Over the Wicket side */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBowlingSideToggle?.('over_the_wicket');
                }}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all flex items-center gap-1 ${
                  bowlingSide === 'over_the_wicket'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md scale-105'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-700/60 hover:text-white hover:border-slate-500'
                } ${interactive && onBowlingSideToggle ? 'cursor-pointer' : 'cursor-default'}`}
                title="Over the Wicket (OTW)"
              >
                {bowlingSide === 'over_the_wicket' && <span className="text-[7px] uppercase font-black">● Active</span>}
                <span>OTW</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Helper Overlay Prompt */}
        {interactive && !selectedCoordinates && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl border border-indigo-500/40 pointer-events-none animate-pulse">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-200">Click on the pitch to place ball</span>
          </div>
        )}
      </div>

      {/* Ball Hover Tooltip Modal Card (Bento Style) */}
      {hoveredBall && (
        <div className="w-full max-w-[440px] mt-2 p-3 bg-slate-900 text-white text-xs rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between animate-fadeIn">
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span className="text-white font-semibold">Ball #{hoveredBall.ballNumberInOver} ({hoveredBall.bowlerName})</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  hoveredBall.bowlingSide === 'around_the_wicket'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30'
                }`}
              >
                {hoveredBall.bowlingSide === 'around_the_wicket' ? 'Around Wkt (ATW)' : 'Over Wkt (OTW)'}
              </span>
              {hoveredBall.variation && hoveredBall.variation !== 'Standard' && (
                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] font-mono">
                  {hoveredBall.variation}
                </span>
              )}
            </div>
            <div className="text-slate-400 text-[11px] mt-1 flex items-center gap-2 font-mono">
              <span>Length: <strong className="text-amber-400">{LENGTH_ZONES_CONFIG[hoveredBall.lengthZone].shortName}</strong> ({hoveredBall.pitchDistanceMeters}m)</span>
              <span>•</span>
              <span>Line: <strong className="text-indigo-300">{hoveredBall.lineZone}</strong></span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-xs text-indigo-400">
              {LENGTH_ZONES_CONFIG[hoveredBall.lengthZone].name}
            </div>
            {hoveredBall.notes && (
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{hoveredBall.notes}</div>
            )}
          </div>
        </div>
      )}

      {/* Bento Grid Legend for Length Zones */}
      <div className="w-full max-w-[440px] mt-2.5 grid grid-cols-3 gap-1.5 text-[10px] font-mono">
        {(['yorker', 'over_pitch', 'full_length', 'good_length', 'short_of_good_length', 'short'] as LengthZone[]).map((zone) => {
          const cfg = LENGTH_ZONES_CONFIG[zone];
          return (
            <div
              key={zone}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-900/60 rounded-xl border border-slate-800/80 shadow-xs"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="truncate text-slate-300 font-semibold">{cfg.shortName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
