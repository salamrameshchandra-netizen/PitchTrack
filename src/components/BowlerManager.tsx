import React, { useState } from 'react';
import { BowlerProfile, BowlingStyle, OverRecord } from '../types';
import { saveBowler, deleteBowler, exportDatabaseJSON, importDatabaseJSON } from '../lib/db';
import { exportDetailedAnalyticsPDF } from '../lib/pdfExport';
import {
  UserPlus,
  Users,
  Award,
  Trash2,
  Edit2,
  FileDown,
  Database,
  Upload,
  Download,
  CheckCircle2,
  Shield,
  Zap,
} from 'lucide-react';

interface BowlerManagerProps {
  bowlers: BowlerProfile[];
  overs: OverRecord[];
  onBowlersUpdated: () => void;
  onSelectBowlerForOver: (bowlerId: string) => void;
}

export const BowlerManager: React.FC<BowlerManagerProps> = ({
  bowlers,
  overs,
  onBowlersUpdated,
  onSelectBowlerForOver,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBowler, setEditingBowler] = useState<BowlerProfile | null>(null);
  const [bowlerToDelete, setBowlerToDelete] = useState<BowlerProfile | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle>('Right-arm Fast');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingBowler(null);
    setName('');
    setTeam('');
    setBowlingStyle('Right-arm Fast');
    setJerseyNumber('');
    setNotes('');
    setShowAddModal(true);
  };

  const openEditModal = (bowler: BowlerProfile) => {
    setEditingBowler(bowler);
    setName(bowler.name);
    setTeam(bowler.team || '');
    setBowlingStyle(bowler.bowlingStyle);
    setJerseyNumber(bowler.jerseyNumber ? String(bowler.jerseyNumber) : '');
    setNotes(bowler.notes || '');
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const bowlerData: BowlerProfile = {
      id: editingBowler ? editingBowler.id : `bowler-${Date.now()}`,
      name: name.trim(),
      team: team.trim() || 'Club XI',
      bowlingStyle,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
      notes: notes.trim() || undefined,
      createdAt: editingBowler ? editingBowler.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalOversBowled: editingBowler ? editingBowler.totalOversBowled : 0,
      totalBallsBowled: editingBowler ? editingBowler.totalBallsBowled : 0,
      totalRunsConceded: editingBowler ? editingBowler.totalRunsConceded : 0,
      totalWickets: editingBowler ? editingBowler.totalWickets : 0,
      totalMaidens: editingBowler ? editingBowler.totalMaidens : 0,
      totalDots: editingBowler ? editingBowler.totalDots : 0,
    };

    await saveBowler(bowlerData);
    onBowlersUpdated();
    setShowAddModal(false);
    setStatusMessage(editingBowler ? `Updated ${bowlerData.name}` : `Added new bowler ${bowlerData.name}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleConfirmDelete = async () => {
    if (!bowlerToDelete) return;
    const bId = bowlerToDelete.id;
    const bName = bowlerToDelete.name;
    setBowlerToDelete(null);
    await deleteBowler(bId);
    onBowlersUpdated();
    setStatusMessage(`Deleted profile for ${bName}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportBowlerCareerPDF = (bowler: BowlerProfile) => {
    const bowlerOvers = overs.filter((o) => o.bowlerId === bowler.id);
    exportDetailedAnalyticsPDF({
      title: `Career Pitch & Performance Report - ${bowler.name}`,
      bowler,
      overs: bowlerOvers,
      dateRangeLabel: 'Career History',
      includePitchMap: true,
    });
  };

  const handleExportDatabaseJSON = async () => {
    const json = await exportDatabaseJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PitchTrack_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDatabaseJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importDatabaseJSON(text);
        onBowlersUpdated();
        setStatusMessage(`Successfully imported ${res.bowlersCount} bowlers and ${res.oversCount} overs.`);
        setTimeout(() => setStatusMessage(null), 4000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Import failed: ${msg}`);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Toast Feedback */}
      {statusMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 font-mono text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header Bar Bento Card */}
      <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Bowler Squad & Database
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage bowler profiles, view career trajectory, and backup records to your local database.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            id="add-bowler-main-btn"
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Bowler</span>
          </button>

          <button
            type="button"
            onClick={handleExportDatabaseJSON}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold font-mono transition-colors"
            title="Download Local Database JSON Backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup DB</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold font-mono transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Restore DB</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportDatabaseJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Bowlers Bento Grid */}
      {bowlers.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-12 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Users className="w-8 h-8" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold text-white mb-1">No Bowlers in Squad</h3>
            <p className="text-sm text-slate-400">
              Add your squad bowlers to start logging pitch maps, delivery speed variations, and career metrics.
            </p>
          </div>
          <button
            id="empty-state-add-bowler-btn"
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Bowler</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bowlers.map((bowler) => {
            const bowlerOvers = overs.filter((o) => o.bowlerId === bowler.id);
            const totalRuns = bowlerOvers.reduce((s, o) => s + o.totalRuns, 0);
            const totalWickets = bowlerOvers.reduce((s, o) => s + o.totalWickets, 0);
            const totalBalls = bowlerOvers.reduce((s, o) => s + o.balls.filter((b) => b.isLegal).length, 0);
            const eco = totalBalls > 0 ? (totalRuns / (totalBalls / 6)).toFixed(2) : '0.00';
            const avg = totalWickets > 0 ? (totalRuns / totalWickets).toFixed(2) : '-';

            return (
              <div
                key={bowler.id}
                className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl space-y-4 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-white">
                          {bowler.name}
                        </h3>
                        {bowler.jerseyNumber && (
                          <span className="px-2 py-0.5 bg-slate-950 text-indigo-400 border border-slate-800 rounded-lg text-[10px] font-mono font-bold">
                            #{bowler.jerseyNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-indigo-400 font-semibold mt-1">
                        {bowler.bowlingStyle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Squad: <span className="text-slate-300 font-medium">{bowler.team || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(bowler)}
                        className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-bowler-${bowler.id}`}
                        type="button"
                        onClick={() => setBowlerToDelete(bowler)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bowler Career Mini Stats Bento Pill */}
                  <div className="grid grid-cols-4 gap-2 mt-4 p-3 bg-slate-950 rounded-2xl text-center border border-slate-800/90 font-mono">
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Overs</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {(Math.floor(totalBalls / 6) + (totalBalls % 6) / 10).toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Wkts</div>
                      <div className="text-sm font-bold text-rose-400 mt-0.5">{totalWickets}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Eco</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">{eco}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Avg</div>
                      <div className="text-sm font-bold text-slate-300 mt-0.5">{avg}</div>
                    </div>
                  </div>

                  {bowler.notes && (
                    <p className="text-xs text-slate-400 italic mt-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50">
                      "{bowler.notes}"
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportBowlerCareerPDF(bowler)}
                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-mono font-semibold cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Career PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectBowlerForOver(bowler.id)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    Bowl Over →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation In-App Bento Dialog */}
      {bowlerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/50 text-rose-400 border border-rose-800/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Bowler Profile?</h3>
                <p className="text-xs text-slate-400">This will remove the player profile from the database.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-sm">
              <div className="font-bold text-white flex items-center justify-between">
                <span>{bowlerToDelete.name}</span>
                <span className="text-xs font-mono text-indigo-400">{bowlerToDelete.bowlingStyle}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Squad: {bowlerToDelete.team || 'Club XI'}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="cancel-delete-bowler-btn"
                type="button"
                onClick={() => setBowlerToDelete(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-bowler-btn"
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Bowler</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Bowler Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingBowler ? `Edit ${editingBowler.name}` : 'Add New Bowler Profile'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Bowler Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jasprit Bumrah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Team / Squad
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai / India"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Jersey #
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 93"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Bowling Style *
                </label>
                <select
                  value={bowlingStyle}
                  onChange={(e) => setBowlingStyle(e.target.value as BowlingStyle)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-hidden focus:border-indigo-500"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Bowling Strategy & Characteristics
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Exceptional yorkers at the death, variations in pace"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 transition-all"
                >
                  {editingBowler ? 'Update Profile' : 'Save Bowler'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
