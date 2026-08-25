/**
 * Local Database Management for Cricket Bowling & Pitching Analytics
 * Persists Bowler Profiles, Overs, Balls, and Match sessions in IndexedDB with LocalStorage fallback.
 */

import { BowlerProfile, OverRecord, BallDelivery, LengthZone, LineZone } from '../types';

const DB_NAME = 'PitchTrackCricketDB';
const DB_VERSION = 1;

const STORES = {
  BOWLERS: 'bowlers',
  OVERS: 'overs',
};

// Open or initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.BOWLERS)) {
        const bowlerStore = db.createObjectStore(STORES.BOWLERS, { keyPath: 'id' });
        bowlerStore.createIndex('name', 'name', { unique: false });
        bowlerStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.OVERS)) {
        const overStore = db.createObjectStore(STORES.OVERS, { keyPath: 'id' });
        overStore.createIndex('bowlerId', 'bowlerId', { unique: false });
        overStore.createIndex('matchDate', 'matchDate', { unique: false });
        overStore.createIndex('isComplete', 'isComplete', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallback localStorage keys
const LS_BOWLERS_KEY = 'pitchtrack_bowlers_v1';
const LS_OVERS_KEY = 'pitchtrack_overs_v1';
const LS_INIT_KEY = 'pitchtrack_initialized_v2';

export async function getAllBowlers(): Promise<BowlerProfile[]> {
  const isInitialized = typeof window !== 'undefined' && localStorage.getItem(LS_INIT_KEY) === 'true';

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.BOWLERS, 'readonly');
      const store = tx.objectStore(STORES.BOWLERS);
      const req = store.getAll();
      req.onsuccess = () => {
        const bowlers = req.result as BowlerProfile[];
        if (bowlers && bowlers.length > 0) {
          resolve(bowlers);
        } else if (!isInitialized) {
          // First time opening app: seed default bowlers
          const seed = getInitialSeedBowlers();
          if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
          saveInitialSeed(seed).then(() => resolve(seed));
        } else {
          // Already initialized by user; return current (even if empty)
          const lsData = getBowlersFromLS();
          resolve(lsData);
        }
      };
      req.onerror = () => {
        const lsData = getBowlersFromLS();
        if (!isInitialized && lsData.length === 0) {
          const seed = getInitialSeedBowlers();
          if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
          saveBowlersToLS(seed);
          resolve(seed);
        } else {
          resolve(lsData);
        }
      };
    });
  } catch {
    const lsData = getBowlersFromLS();
    if (!isInitialized && lsData.length === 0) {
      const seed = getInitialSeedBowlers();
      if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
      saveBowlersToLS(seed);
      return seed;
    }
    return lsData;
  }
}

export async function saveBowler(bowler: BowlerProfile): Promise<BowlerProfile> {
  if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
  const updatedBowler = {
    ...bowler,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.BOWLERS, 'readwrite');
      const store = tx.objectStore(STORES.BOWLERS);
      const req = store.put(updatedBowler);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Saving to IndexedDB failed, using fallback localStorage', err);
  }

  // Also sync to localStorage for redundancy
  const current = getBowlersFromLS();
  const idx = current.findIndex((b) => b.id === bowler.id);
  if (idx >= 0) {
    current[idx] = updatedBowler;
  } else {
    current.push(updatedBowler);
  }
  saveBowlersToLS(current);

  return updatedBowler;
}

export async function deleteBowler(id: string): Promise<void> {
  if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.BOWLERS, 'readwrite');
      const store = tx.objectStore(STORES.BOWLERS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(e);
  }

  const current = getBowlersFromLS().filter((b) => b.id !== id);
  saveBowlersToLS(current);
}

export async function getAllOvers(): Promise<OverRecord[]> {
  const isInitialized = typeof window !== 'undefined' && localStorage.getItem(LS_INIT_KEY) === 'true';

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.OVERS, 'readonly');
      const store = tx.objectStore(STORES.OVERS);
      const req = store.getAll();
      req.onsuccess = () => {
        const overs = req.result as OverRecord[];
        if (overs && overs.length > 0) {
          resolve(overs.sort((a, b) => new Date(b.completedAt || b.matchDate).getTime() - new Date(a.completedAt || a.matchDate).getTime()));
        } else if (!isInitialized) {
          const seedOvers = getInitialSeedOvers();
          if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
          saveInitialOvers(seedOvers).then(() => resolve(seedOvers));
        } else {
          resolve(getOversFromLS());
        }
      };
      req.onerror = () => resolve(getOversFromLS());
    });
  } catch {
    const lsOvers = getOversFromLS();
    if (!isInitialized && lsOvers.length === 0) {
      const seedOvers = getInitialSeedOvers();
      if (typeof window !== 'undefined') localStorage.setItem(LS_INIT_KEY, 'true');
      saveOversToLS(seedOvers);
      return seedOvers;
    }
    return lsOvers;
  }
}

export async function saveOver(over: OverRecord): Promise<OverRecord> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.OVERS, 'readwrite');
      const store = tx.objectStore(STORES.OVERS);
      const req = store.put(over);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Saving over to IndexedDB failed', e);
  }

  const current = getOversFromLS();
  const idx = current.findIndex((o) => o.id === over.id);
  if (idx >= 0) {
    current[idx] = over;
  } else {
    current.push(over);
  }
  saveOversToLS(current);

  // Automatically recalculate bowler career totals
  await recalculateBowlerStats(over.bowlerId);

  return over;
}

export async function deleteOver(id: string): Promise<void> {
  let bowlerIdToRecalc = '';
  const current = getOversFromLS();
  const found = current.find((o) => o.id === id);
  if (found) bowlerIdToRecalc = found.bowlerId;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.OVERS, 'readwrite');
      const store = tx.objectStore(STORES.OVERS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(e);
  }

  const updated = current.filter((o) => o.id !== id);
  saveOversToLS(updated);

  if (bowlerIdToRecalc) {
    await recalculateBowlerStats(bowlerIdToRecalc);
  }
}

export async function recalculateBowlerStats(bowlerId: string): Promise<void> {
  const overs = await getAllOvers();
  const bowlerOvers = overs.filter((o) => o.bowlerId === bowlerId && o.isComplete);
  const bowlers = await getAllBowlers();
  const bowler = bowlers.find((b) => b.id === bowlerId);

  if (!bowler) return;

  let totalBalls = 0;
  let totalRuns = 0;
  let totalWickets = 0;
  let totalMaidens = 0;
  let totalDots = 0;

  bowlerOvers.forEach((over) => {
    totalRuns += over.totalRuns;
    totalWickets += over.totalWickets;
    if (over.isMaiden) totalMaidens++;
    over.balls.forEach((ball) => {
      if (ball.isLegal) totalBalls++;
      if (ball.outcome === 'dot') totalDots++;
    });
  });

  const oversDecimal = Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;

  bowler.totalOversBowled = Number(oversDecimal.toFixed(1));
  bowler.totalBallsBowled = totalBalls;
  bowler.totalRunsConceded = totalRuns;
  bowler.totalWickets = totalWickets;
  bowler.totalMaidens = totalMaidens;
  bowler.totalDots = totalDots;

  await saveBowler(bowler);
}

// LocalStorage helpers
function getBowlersFromLS(): BowlerProfile[] {
  try {
    const raw = localStorage.getItem(LS_BOWLERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBowlersToLS(bowlers: BowlerProfile[]): void {
  try {
    localStorage.setItem(LS_BOWLERS_KEY, JSON.stringify(bowlers));
  } catch (e) {
    console.warn('LocalStorage full or disabled', e);
  }
}

function getOversFromLS(): OverRecord[] {
  try {
    const raw = localStorage.getItem(LS_OVERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOversToLS(overs: OverRecord[]): void {
  try {
    localStorage.setItem(LS_OVERS_KEY, JSON.stringify(overs));
  } catch (e) {
    console.warn('LocalStorage error', e);
  }
}

async function saveInitialSeed(bowlers: BowlerProfile[]) {
  saveBowlersToLS(bowlers);
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.BOWLERS, 'readwrite');
    const store = tx.objectStore(STORES.BOWLERS);
    for (const b of bowlers) {
      store.put(b);
    }
  } catch (e) {
    console.warn(e);
  }
}

async function saveInitialOvers(overs: OverRecord[]) {
  saveOversToLS(overs);
  try {
    const db = await openDB();
    const tx = db.transaction(STORES.OVERS, 'readwrite');
    const store = tx.objectStore(STORES.OVERS);
    for (const o of overs) {
      store.put(o);
    }
  } catch (e) {
    console.warn(e);
  }
}

// Seed realistic data for instant usability
function getInitialSeedBowlers(): BowlerProfile[] {
  return [
    {
      id: 'bowler-1',
      name: 'Mitchell Starc',
      team: 'Australia',
      jerseyNumber: 56,
      bowlingStyle: 'Left-arm Fast',
      notes: 'Lethal swinging yorkers and toe-crushers with new and old ball.',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-25T08:00:00Z',
      totalOversBowled: 4.0,
      totalBallsBowled: 24,
      totalRunsConceded: 22,
      totalWickets: 3,
      totalMaidens: 1,
      totalDots: 14,
      bestBowlingFigures: '3/22',
    },
    {
      id: 'bowler-2',
      name: 'Jasprit Bumrah',
      team: 'India',
      jerseyNumber: 93,
      bowlingStyle: 'Right-arm Fast',
      notes: 'Unorthodox release, deadly yorkers, impeccable seam and hard back-of-a-length.',
      createdAt: '2026-08-12T10:00:00Z',
      updatedAt: '2026-08-25T08:00:00Z',
      totalOversBowled: 4.0,
      totalBallsBowled: 24,
      totalRunsConceded: 16,
      totalWickets: 4,
      totalMaidens: 2,
      totalDots: 17,
      bestBowlingFigures: '4/16',
    },
    {
      id: 'bowler-3',
      name: 'Rashid Khan',
      team: 'Afghanistan',
      jerseyNumber: 19,
      bowlingStyle: 'Right-arm Leg-Break',
      notes: 'High-arm quick leg spin and deceptive wrong-un in the good length corridor.',
      createdAt: '2026-08-15T10:00:00Z',
      updatedAt: '2026-08-25T08:00:00Z',
      totalOversBowled: 4.0,
      totalBallsBowled: 24,
      totalRunsConceded: 20,
      totalWickets: 2,
      totalMaidens: 0,
      totalDots: 13,
      bestBowlingFigures: '2/20',
    },
  ];
}

function getInitialSeedOvers(): OverRecord[] {
  // Generate realistic sample balls for Jasprit Bumrah (Spell 1)
  const bumrahBalls: BallDelivery[] = [
    {
      id: 'ball-b1',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 1,
      legalBallNumber: 1,
      isLegal: true,
      xPercent: 52,
      yPercent: 55,
      pitchDistanceMeters: 6.2,
      pitchLineOffsetMeters: 0.15,
      lengthZone: 'good_length',
      lineZone: 'outside_off',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 142.5,
      variation: 'Outswinger',
      batterHand: 'RHB',
      notes: 'Beat the outside edge with late shape.',
      timestamp: '2026-08-20T14:30:10Z',
    },
    {
      id: 'ball-b2',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 2,
      legalBallNumber: 2,
      isLegal: true,
      xPercent: 49,
      yPercent: 72,
      pitchDistanceMeters: 7.8,
      pitchLineOffsetMeters: -0.05,
      lengthZone: 'short_of_good_length',
      lineZone: 'stumps',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 144.1,
      variation: 'Standard',
      batterHand: 'RHB',
      notes: 'Hurried into a cramped defensive push.',
      timestamp: '2026-08-20T14:30:50Z',
    },
    {
      id: 'ball-b3',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 3,
      legalBallNumber: 3,
      isLegal: true,
      xPercent: 48,
      yPercent: 12,
      pitchDistanceMeters: 0.8,
      pitchLineOffsetMeters: -0.1,
      lengthZone: 'yorker',
      lineZone: 'stumps',
      outcome: 'wicket',
      runsScored: 0,
      isWicket: true,
      wicketType: 'bowled',
      speedKmph: 146.8,
      variation: 'Yorker',
      batterHand: 'RHB',
      notes: 'Smashes off-stump with an inswinging toe-crusher!',
      timestamp: '2026-08-20T14:31:35Z',
    },
    {
      id: 'ball-b4',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 4,
      legalBallNumber: 4,
      isLegal: true,
      xPercent: 54,
      yPercent: 58,
      pitchDistanceMeters: 6.0,
      pitchLineOffsetMeters: 0.3,
      lengthZone: 'good_length',
      lineZone: 'outside_off',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 141.0,
      variation: 'Standard',
      batterHand: 'RHB',
      notes: 'New batter leaves carefully outside off.',
      timestamp: '2026-08-20T14:32:40Z',
    },
    {
      id: 'ball-b5',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 5,
      legalBallNumber: 5,
      isLegal: true,
      xPercent: 44,
      yPercent: 38,
      pitchDistanceMeters: 4.2,
      pitchLineOffsetMeters: -0.4,
      lengthZone: 'full_length',
      lineZone: 'pads',
      outcome: '1_run',
      runsScored: 1,
      isWicket: false,
      speedKmph: 139.6,
      variation: 'Inswinger',
      batterHand: 'RHB',
      notes: 'Flicked towards deep backward square leg.',
      timestamp: '2026-08-20T14:33:20Z',
    },
    {
      id: 'ball-b6',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      overId: 'over-b1',
      overNumber: 1,
      ballNumberInOver: 6,
      legalBallNumber: 6,
      isLegal: true,
      xPercent: 53,
      yPercent: 90,
      pitchDistanceMeters: 10.2,
      pitchLineOffsetMeters: 0.25,
      lengthZone: 'short',
      lineZone: 'outside_off',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 145.2,
      variation: 'Bouncer',
      batterHand: 'LHB',
      notes: 'Well directed bouncer past the helmet.',
      timestamp: '2026-08-20T14:34:05Z',
    },
  ];

  // Mitchell Starc Over
  const starcBalls: BallDelivery[] = [
    {
      id: 'ball-s1',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 1,
      legalBallNumber: 1,
      isLegal: true,
      xPercent: 46,
      yPercent: 10,
      pitchDistanceMeters: 0.9,
      pitchLineOffsetMeters: -0.2,
      lengthZone: 'yorker',
      lineZone: 'stumps',
      outcome: 'wicket',
      runsScored: 0,
      isWicket: true,
      wicketType: 'bowled',
      speedKmph: 149.3,
      variation: 'Inswinger',
      batterHand: 'RHB',
      notes: 'Booming inswinging yorker crashes into leg stump!',
      timestamp: '2026-08-22T10:05:00Z',
    },
    {
      id: 'ball-s2',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 2,
      legalBallNumber: 2,
      isLegal: true,
      xPercent: 56,
      yPercent: 52,
      pitchDistanceMeters: 5.6,
      pitchLineOffsetMeters: 0.45,
      lengthZone: 'good_length',
      lineZone: 'outside_off',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 147.0,
      variation: 'Outswinger',
      batterHand: 'RHB',
      notes: 'Beaten on the drive outside off.',
      timestamp: '2026-08-22T10:06:00Z',
    },
    {
      id: 'ball-s3',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 3,
      legalBallNumber: 3,
      isLegal: true,
      xPercent: 42,
      yPercent: 24,
      pitchDistanceMeters: 2.2,
      pitchLineOffsetMeters: -0.6,
      lengthZone: 'over_pitch',
      lineZone: 'pads',
      outcome: '4_runs',
      runsScored: 4,
      isWicket: false,
      speedKmph: 144.5,
      variation: 'Standard',
      batterHand: 'RHB',
      notes: 'Overpitched on the pads and clipped through midwicket.',
      timestamp: '2026-08-22T10:07:00Z',
    },
    {
      id: 'ball-s4',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 4,
      legalBallNumber: 4,
      isLegal: true,
      xPercent: 51,
      yPercent: 78,
      pitchDistanceMeters: 8.2,
      pitchLineOffsetMeters: 0.1,
      lengthZone: 'short_of_good_length',
      lineZone: 'outside_off',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 146.2,
      variation: 'Standard',
      batterHand: 'RHB',
      notes: 'Defended solidly back down the pitch.',
      timestamp: '2026-08-22T10:08:00Z',
    },
    {
      id: 'ball-s5',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 5,
      legalBallNumber: 5,
      isLegal: true,
      xPercent: 53,
      yPercent: 35,
      pitchDistanceMeters: 3.8,
      pitchLineOffsetMeters: 0.25,
      lengthZone: 'full_length',
      lineZone: 'outside_off',
      outcome: 'wicket',
      runsScored: 0,
      isWicket: true,
      wicketType: 'caught_behind',
      speedKmph: 148.0,
      variation: 'Outswinger',
      batterHand: 'RHB',
      notes: 'Full, seaming away, thick edge carried to keeper!',
      timestamp: '2026-08-22T10:09:00Z',
    },
    {
      id: 'ball-s6',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      overId: 'over-s1',
      overNumber: 1,
      ballNumberInOver: 6,
      legalBallNumber: 6,
      isLegal: true,
      xPercent: 50,
      yPercent: 62,
      pitchDistanceMeters: 6.6,
      pitchLineOffsetMeters: 0.05,
      lengthZone: 'good_length',
      lineZone: 'stumps',
      outcome: 'dot',
      runsScored: 0,
      isWicket: false,
      speedKmph: 147.4,
      variation: 'Standard',
      batterHand: 'LHB',
      notes: 'Struck the pads outside the line of off stump.',
      timestamp: '2026-08-22T10:10:00Z',
    },
  ];

  return [
    {
      id: 'over-b1',
      matchId: 'match-101',
      matchName: 'Final - League Championship',
      matchDate: '2026-08-20',
      venue: 'Lord’s Cricket Ground',
      bowlerId: 'bowler-2',
      bowlerName: 'Jasprit Bumrah',
      bowlingStyle: 'Right-arm Fast',
      overNumber: 1,
      balls: bumrahBalls,
      totalRuns: 1,
      totalWickets: 1,
      totalExtras: 0,
      legalBallsCount: 6,
      isMaiden: false,
      isComplete: true,
      completedAt: '2026-08-20T14:34:05Z',
      notes: 'Exceptional opening over with early breakthrough on the yorker.',
    },
    {
      id: 'over-s1',
      matchId: 'match-102',
      matchName: 'Semi-Final vs Knights',
      matchDate: '2026-08-22',
      venue: 'Melbourne Cricket Ground',
      bowlerId: 'bowler-1',
      bowlerName: 'Mitchell Starc',
      bowlingStyle: 'Left-arm Fast',
      overNumber: 1,
      balls: starcBalls,
      totalRuns: 4,
      totalWickets: 2,
      totalExtras: 0,
      legalBallsCount: 6,
      isMaiden: false,
      isComplete: true,
      completedAt: '2026-08-22T10:10:00Z',
      notes: 'Two wickets in one over: clean bowled and caught behind.',
    },
  ];
}

// Export and Import functions for user backups
export async function exportDatabaseJSON(): Promise<string> {
  const bowlers = await getAllBowlers();
  const overs = await getAllOvers();
  const exportPayload = {
    appName: 'PitchTrack Cricket Database',
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    data: {
      bowlers,
      overs,
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}

export async function importDatabaseJSON(jsonString: string): Promise<{ success: boolean; bowlersCount: number; oversCount: number }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !Array.isArray(parsed.data.bowlers) || !Array.isArray(parsed.data.overs)) {
      throw new Error('Invalid JSON format for PitchTrack database');
    }

    const bowlers: BowlerProfile[] = parsed.data.bowlers;
    const overs: OverRecord[] = parsed.data.overs;

    // Save to IndexedDB
    try {
      const db = await openDB();
      const txB = db.transaction(STORES.BOWLERS, 'readwrite');
      const sB = txB.objectStore(STORES.BOWLERS);
      for (const b of bowlers) sB.put(b);

      const txO = db.transaction(STORES.OVERS, 'readwrite');
      const sO = txO.objectStore(STORES.OVERS);
      for (const o of overs) sO.put(o);
    } catch (e) {
      console.warn('IDB write during import', e);
    }

    saveBowlersToLS(bowlers);
    saveOversToLS(overs);

    return {
      success: true,
      bowlersCount: bowlers.length,
      oversCount: overs.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to import database: ${msg}`);
  }
}
