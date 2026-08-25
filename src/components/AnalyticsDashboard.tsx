import React, { useState, useMemo } from 'react';
import {
  BowlerProfile,
  OverRecord,
  BallDelivery,
  LengthZone,
  LineZone,
  LENGTH_ZONES_CONFIG,
  LINE_ZONES_CONFIG,
} from '../types';
import { CricketPitch } from './CricketPitch';
import { exportDetailedAnalyticsPDF } from '../lib/pdfExport';
import { deleteOver } from '../lib/db';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Calendar,
  FileDown,
  Filter,
  Trash2,
  TrendingUp,
  Target,
  Award,
  Flame,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Activity,
  Info,
  UserPlus,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  bowlers: BowlerProfile[];
  overs: OverRecord[];
  onOverDeleted: () => void;
  onNavigateToLive: () => void;
  onNavigateToBowlers?: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  bowlers,
  overs,
  onOverDeleted,
  onNavigateToLive,
  onNavigateToBowlers,
}) => {
  // Filter States
  const [selectedBowlerId, setSelectedBowlerId] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | '7days' | '30days' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLengthFilter, setSelectedLengthFilter] = useState<LengthZone | 'all'>('all');
  const [expandedOverId, setExpandedOverId] = useState<string | null>(null);
  const [overToDelete, setOverToDelete] = useState<OverRecord | null>(null);

  // Filter Overs based on Bowler & Date Range
  const filteredOvers = useMemo(() => {
    return overs.filter((over) => {
      // Bowler Filter
      if (selectedBowlerId !== 'all' && over.bowlerId !== selectedBowlerId) {
        return false;
      }

      // Date Filter
      const overDate = new Date(over.matchDate || over.completedAt || '');
      const now = new Date();

      if (dateRangePreset === '7days') {
        const past7 = new Date();
        past7.setDate(now.getDate() - 7);
        if (overDate < past7) return false;
      } else if (dateRangePreset === '30days') {
        const past30 = new Date();
        past30.setDate(now.getDate() - 30);
        if (overDate < past30) return false;
      } else if (dateRangePreset === 'custom') {
        if (startDate && new Date(startDate) > overDate) return false;
        if (endDate && new Date(endDate + 'T23:59:59') < overDate) return false;
      }

      return true;
    });
  }, [overs, selectedBowlerId, dateRangePreset, startDate, endDate]);

  // Aggregate Balls from Filtered Overs
  const allFilteredBalls = useMemo(() => {
    let balls = filteredOvers.flatMap((o) => o.balls);
    if (selectedLengthFilter !== 'all') {
      balls = balls.filter((b) => b.lengthZone === selectedLengthFilter);
    }
    return balls;
  }, [filteredOvers, selectedLengthFilter]);

  // Key Performance Indicators (KPIs)
  const stats = useMemo(() => {
    const totalBalls = filteredOvers.reduce((sum, o) => sum + o.balls.filter((b) => b.isLegal).length, 0);
    const totalRuns = filteredOvers.reduce((sum, o) => sum + o.totalRuns, 0);
    const totalWickets = filteredOvers.reduce((sum, o) => sum + o.totalWickets, 0);
    const totalDots = filteredOvers.reduce((sum, o) => sum + o.balls.filter((b) => b.outcome === 'dot').length, 0);
    const totalMaidens = filteredOvers.filter((o) => o.isMaiden).length;

    const oversDecimal = totalBalls > 0 ? (Math.floor(totalBalls / 6) + (totalBalls % 6) / 10).toFixed(1) : '0.0';
    const economyRate = totalBalls > 0 ? ((totalRuns / (totalBalls / 6))).toFixed(2) : '0.00';
    const bowlingAverage = totalWickets > 0 ? (totalRuns / totalWickets).toFixed(2) : '-';
    const strikeRate = totalWickets > 0 ? (totalBalls / totalWickets).toFixed(1) : '-';
    const dotBallPercentage = totalBalls > 0 ? ((totalDots / totalBalls) * 100).toFixed(1) : '0.0';

    return {
      totalBalls,
      totalRuns,
      totalWickets,
      totalDots,
      totalMaidens,
      oversDecimal,
      economyRate,
      bowlingAverage,
      strikeRate,
      dotBallPercentage,
    };
  }, [filteredOvers]);

  // Length Zone Distribution Statistics
  const lengthZoneBreakdown = useMemo(() => {
    const zones: LengthZone[] = [
      'yorker',
      'over_pitch',
      'full_length',
      'good_length',
      'short_of_good_length',
      'short',
    ];

    const ballsList = filteredOvers.flatMap((o) => o.balls);
    const total = ballsList.length || 1;

    return zones.map((zone) => {
      const cfg = LENGTH_ZONES_CONFIG[zone];
      const matchingBalls = ballsList.filter((b) => b.lengthZone === zone);
      const count = matchingBalls.length;
      const runs = matchingBalls.reduce((s, b) => s + b.runsScored, 0);
      const wkts = matchingBalls.filter((b) => b.isWicket).length;
      const dots = matchingBalls.filter((b) => b.outcome === 'dot').length;
      const percentage = Number(((count / total) * 100).toFixed(1));
      const economy = count > 0 ? Number((runs / (count / 6)).toFixed(2)) : 0;

      return {
        zoneKey: zone,
        name: cfg.shortName,
        fullName: cfg.name,
        range: `${cfg.minDistMeters}-${cfg.maxDistMeters}m`,
        color: cfg.color,
        count,
        percentage,
        runs,
        wkts,
        dots,
        economy,
      };
    });
  }, [filteredOvers]);

  // Trigger PDF Report Download
  const handleExportPDF = () => {
    const bowler = selectedBowlerId !== 'all' ? bowlers.find((b) => b.id === selectedBowlerId) : null;
    let dateLabel = 'All Time Recorded';
    if (dateRangePreset === '7days') dateLabel = 'Last 7 Days';
    else if (dateRangePreset === '30days') dateLabel = 'Last 30 Days';
    else if (dateRangePreset === 'custom') dateLabel = `${startDate || 'Start'} to ${endDate || 'Present'}`;

    exportDetailedAnalyticsPDF({
      title: 'Cricket Bowling Pitch & Performance Analytics',
      bowler,
      overs: filteredOvers,
      dateRangeLabel: dateLabel,
      includePitchMap: true,
    });
  };

  const handleConfirmDeleteOver = async () => {
    if (!overToDelete) return;
    const overId = overToDelete.id;
    setOverToDelete(null);
    await deleteOver(overId);
    onOverDeleted();
  };

  const activeBowlerProfile = bowlers.find((b) => b.id === selectedBowlerId);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header & Filter Controls Bento Card */}
      <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Historical Pitch & Bowling Analytics
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analyze pitching zone lengths, wicket corridors, economy distributions, and detailed ball-by-ball reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToBowlers && (
              <button
                id="analytics-add-bowler-btn"
                type="button"
                onClick={onNavigateToBowlers}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Bowler</span>
              </button>
            )}
            <button
              id="export-pdf-analytics-btn"
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Export PDF Report</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToLive}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              + Log Over
            </button>
          </div>
        </div>

        {/* Filter Bar (Bowler + Date Range) in Bento capsules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          
          {/* Bowler Filter */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter Bowler
            </label>
            <select
              id="analytics-bowler-filter"
              value={selectedBowlerId}
              onChange={(e) => setSelectedBowlerId(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs font-semibold text-white focus:ring-0"
            >
              <option value="all">All Bowlers ({overs.length} Overs Total)</option>
              {bowlers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.team})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Date Range
            </label>
            <select
              id="analytics-date-preset-filter"
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="w-full bg-transparent border-none p-0 text-xs font-semibold text-white focus:ring-0"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateRangePreset === 'custom' && (
            <>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-xs font-mono text-slate-200 focus:ring-0"
                />
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-xs font-mono text-slate-200 focus:ring-0"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Metric Bento Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'OVERS BOWLED', value: stats.oversDecimal, sub: `${stats.totalBalls} Balls`, icon: Target, color: 'text-indigo-400' },
          { label: 'TOTAL RUNS', value: stats.totalRuns, sub: `${stats.economyRate} Eco/Over`, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'WICKETS', value: stats.totalWickets, sub: `Avg ${stats.bowlingAverage}`, icon: Award, color: 'text-rose-400' },
          { label: 'ECONOMY RATE', value: stats.economyRate, sub: 'Runs per over', icon: Shield, color: 'text-emerald-400' },
          { label: 'STRIKE RATE', value: stats.strikeRate, sub: 'Balls per wicket', icon: Flame, color: 'text-purple-400' },
          { label: 'DOT BALL %', value: `${stats.dotBallPercentage}%`, sub: `${stats.totalDots} Dots`, icon: Layers, color: 'text-sky-400' },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                  {card.label}
                </span>
                <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
              <div className="text-2xl font-mono font-bold text-white mt-2">
                {card.value}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analysis Section: 2D Pitch Heatmap on Left + Length Breakdown Charts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: 2D Pitch Map showing All Filtered Deliveries */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>Pitch Landing Coordinates ({allFilteredBalls.length} Balls)</span>
              </h2>
            </div>
          </div>

          <CricketPitch
            interactive={false}
            ballsToDisplay={allFilteredBalls}
            showZoneLabels={true}
            showHeatmap={true}
          />
        </div>

        {/* Right: Length Breakdown Table & Visual Charts */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Pitch Length Zones Breakdown Table */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Pitch Length Zones Distribution
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedLengthFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all ${
                    selectedLengthFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  All Zones
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase text-[10px] tracking-wider">
                    <th className="pb-2.5 font-bold">Zone</th>
                    <th className="pb-2.5 font-bold">Dist</th>
                    <th className="pb-2.5 text-center font-bold">Balls</th>
                    <th className="pb-2.5 text-center font-bold">Share</th>
                    <th className="pb-2.5 text-center font-bold">Runs</th>
                    <th className="pb-2.5 text-center font-bold">Wkts</th>
                    <th className="pb-2.5 text-center font-bold">Eco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {lengthZoneBreakdown.map((row) => {
                    const isSelected = selectedLengthFilter === row.zoneKey;
                    return (
                      <tr
                        key={row.zoneKey}
                        onClick={() => setSelectedLengthFilter(isSelected ? 'all' : row.zoneKey)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/40 text-white' : 'text-slate-300'
                        }`}
                      >
                        <td className="py-2.5 flex items-center gap-2 font-sans font-bold">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="text-white">{row.name}</span>
                        </td>
                        <td className="py-2.5 text-slate-500 text-[11px]">{row.range}</td>
                        <td className="py-2.5 text-center font-bold text-white">{row.count}</td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                              <div className="h-full rounded-full" style={{ width: `${row.percentage}%`, backgroundColor: row.color }} />
                            </div>
                            <span className="text-[11px] text-slate-400">{row.percentage}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-bold text-slate-200">{row.runs}</td>
                        <td className="py-2.5 text-center font-bold text-rose-400">{row.wkts}</td>
                        <td className="py-2.5 text-center font-bold text-emerald-400">{row.economy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual Charts (Pitch Length Breakdown Bar Chart) */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Visual Analytics & Comparisons
              </h3>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl text-xs font-semibold text-slate-400 font-mono">
                Deliveries by Zone
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lengthZoneBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#fff', fontSize: '11px', borderRadius: '12px' }}
                  />
                  <Bar dataKey="count" name="Deliveries" fill="#6366f1" radius={[6, 6, 0, 0]}>
                    {lengthZoneBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Overs Log Table Bento Container */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span>Recorded Overs History ({filteredOvers.length} Total)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Click row to view ball-by-ball details</span>
        </div>

        {filteredOvers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm font-mono">
            No overs found matching the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOvers.map((over) => {
              const isExpanded = expandedOverId === over.id;
              return (
                <div
                  key={over.id}
                  className="border border-slate-800/80 rounded-2xl overflow-hidden transition-all bg-slate-950/60"
                >
                  {/* Over Summary Header */}
                  <div
                    onClick={() => setExpandedOverId(isExpanded ? null : over.id)}
                    className="p-4 hover:bg-slate-900/80 cursor-pointer flex flex-wrap items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono font-bold flex items-center justify-center text-xs">
                        #{over.overNumber}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>{over.bowlerName}</span>
                          <span className="text-[11px] text-slate-500 font-mono font-normal">({over.matchDate || 'N/A'})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {over.matchName} • {over.venue || 'Venue N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Ball Sequence Badge Ribbon */}
                    <div className="flex items-center gap-1.5">
                      {over.balls.map((b, i) => (
                        <span
                          key={i}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                            b.isWicket
                              ? 'bg-rose-600 text-white shadow-xs'
                              : b.outcome === 'dot'
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : b.runsScored >= 4
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-indigo-600 text-white shadow-xs'
                          }`}
                        >
                          {b.isWicket ? 'W' : b.outcome === 'dot' ? '•' : b.outcome === 'wide' ? 'Wd' : b.outcome === 'no_ball' ? 'Nb' : b.runsScored}
                        </span>
                      ))}
                    </div>

                    {/* Figures & Actions */}
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-white font-bold">{over.totalRuns} Runs</span>
                        <span className="mx-1 text-slate-600">•</span>
                        <span className="text-rose-400 font-bold">{over.totalWickets} Wkts</span>
                      </div>

                      <button
                        id={`delete-over-${over.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverToDelete(over);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Over"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Ball Details */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-900/60 border-t border-slate-800">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2.5 font-mono">
                        Deliveries in Over #{over.overNumber}:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {over.balls.map((b, idx) => (
                          <div
                            key={b.id || idx}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-white font-mono">Ball #{b.ballNumberInOver}</span>
                              <span className={b.isWicket ? 'text-rose-400 font-mono' : 'text-indigo-400 font-mono'}>
                                {b.isWicket ? `Wicket (${b.wicketType})` : `${b.runsScored} Runs`}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex justify-between">
                              <span>Length: <strong className="text-slate-200 font-semibold">{LENGTH_ZONES_CONFIG[b.lengthZone].shortName}</strong> ({b.pitchDistanceMeters}m)</span>
                              <span className="font-mono text-slate-500">{b.lineZone}</span>
                            </div>
                            {b.notes && (
                              <div className="text-[10px] text-slate-400 italic">"{b.notes}"</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Over In-App Confirmation Modal */}
      {overToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/50 text-rose-400 border border-rose-800/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Over Record?</h3>
                <p className="text-xs text-slate-400">This will remove this over and recalculate bowler statistics.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-white">
                <span>Over #{overToDelete.overNumber} • {overToDelete.bowlerName}</span>
                <span className="font-mono text-indigo-400">{overToDelete.matchDate || 'Match'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                <span>{overToDelete.balls.length} Deliveries</span>
                <span>{overToDelete.totalRuns} Runs • {overToDelete.totalWickets} Wkts</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="cancel-delete-over-btn"
                type="button"
                onClick={() => setOverToDelete(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-over-btn"
                type="button"
                onClick={handleConfirmDeleteOver}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Over</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
