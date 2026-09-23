/**
 * Cricket Ball Pitching & Bowling Analytics Types
 */

export type LengthZone =
  | 'short'
  | 'short_of_good_length'
  | 'good_length'
  | 'full_length'
  | 'over_pitch'
  | 'yorker';

export type LineZone =
  | 'wide_off'
  | 'outside_off'
  | 'stumps'
  | 'pads'
  | 'down_leg';

export type BallOutcome =
  | 'dot'
  | '1_run'
  | '2_runs'
  | '3_runs'
  | '4_runs'
  | '6_runs'
  | 'wicket'
  | 'wide'
  | 'no_ball'
  | 'bye'
  | 'leg_bye';

export type WicketType =
  | 'bowled'
  | 'lbw'
  | 'caught'
  | 'caught_behind'
  | 'caught_and_bowled'
  | 'stumped'
  | 'run_out'
  | 'hit_wicket';

export type DeliveryVariation =
  | 'Standard'
  | 'Outswinger'
  | 'Inswinger'
  | 'Reverse Swing'
  | 'Off-Cutter'
  | 'Leg-Cutter'
  | 'Slower Ball'
  | 'Knuckle Ball'
  | 'Bouncer'
  | 'Yorker'
  | 'Flipper'
  | 'Googly'
  | 'Doosra'
  | 'Arm Ball'
  | 'Carrom Ball'
  | 'Top-Spinner';

export type BowlingStyle =
  | 'Right-arm Fast'
  | 'Right-arm Fast-Medium'
  | 'Right-arm Medium'
  | 'Right-arm Off-Break'
  | 'Right-arm Leg-Break'
  | 'Left-arm Fast'
  | 'Left-arm Fast-Medium'
  | 'Left-arm Orthodox'
  | 'Left-arm Chinaman';

export type BowlingSide = 'over_the_wicket' | 'around_the_wicket';

export const BOWLING_SIDE_CONFIG: Record<
  BowlingSide,
  {
    id: BowlingSide;
    name: string;
    shortName: string;
    code: string;
    description: string;
  }
> = {
  over_the_wicket: {
    id: 'over_the_wicket',
    name: 'Over the Wicket',
    shortName: 'Over Wkt',
    code: 'OTW',
    description: 'Delivered running past non-striker stumps with bowling arm closest to the wicket.',
  },
  around_the_wicket: {
    id: 'around_the_wicket',
    name: 'Around the Wicket',
    shortName: 'Around Wkt',
    code: 'ATW',
    description: 'Delivered from the opposite side of the non-striker stumps, creating an acute angle into or across the batter.',
  },
};

export interface BallDelivery {
  id: string;
  matchId?: string;
  bowlerId: string;
  bowlerName: string;
  overId: string;
  overNumber: number;
  ballNumberInOver: number; // 1 to 6 (or 7+ if extras)
  legalBallNumber: number; // 1 to 6
  isLegal: boolean;
  
  // Coordinate on the pitch (x: -1.5m to 1.5m relative to center, y: 0 to 12m from batting stumps)
  // Normalized for UI: xPercent (0-100% from off to leg), yPercent (0-100% from bowler end to batsman end)
  xPercent: number; 
  yPercent: number;
  pitchDistanceMeters: number; // Distance from batting stumps (0m - 12m)
  pitchLineOffsetMeters: number; // Offset from center stump in meters (-1.5m to +1.5m)
  
  lengthZone: LengthZone;
  lineZone: LineZone;
  
  outcome: BallOutcome;
  runsScored: number;
  isWicket: boolean;
  wicketType?: WicketType;
  extraType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye';
  extraRuns?: number;
  
  speedKmph?: number;
  variation?: DeliveryVariation;
  batterHand: 'RHB' | 'LHB';
  bowlingSide?: BowlingSide;
  notes?: string;
  timestamp: string; // ISO string
}

export interface OverRecord {
  id: string;
  matchId: string;
  matchName: string;
  matchDate: string; // YYYY-MM-DD
  venue?: string;
  bowlerId: string;
  bowlerName: string;
  bowlingStyle?: BowlingStyle;
  overNumber: number;
  balls: BallDelivery[];
  totalRuns: number;
  totalWickets: number;
  totalExtras: number;
  legalBallsCount: number;
  isMaiden: boolean;
  isComplete: boolean;
  completedAt?: string;
  notes?: string;
}

export interface BowlerProfile {
  id: string;
  name: string;
  team: string;
  jerseyNumber?: number;
  bowlingStyle: BowlingStyle;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Computed career caches
  totalOversBowled: number;
  totalBallsBowled: number;
  totalRunsConceded: number;
  totalWickets: number;
  totalMaidens: number;
  totalDots: number;
  bestBowlingFigures?: string;
}

export interface ZoneConfig {
  id: LengthZone;
  name: string;
  shortName: string;
  minDistMeters: number;
  maxDistMeters: number;
  color: string;
  bgTailwind: string;
  borderTailwind: string;
  badgeTailwind: string;
  description: string;
}

export const LENGTH_ZONES_CONFIG: Record<LengthZone, ZoneConfig> = {
  yorker: {
    id: 'yorker',
    name: 'Yorker / Full Toss',
    shortName: 'Yorker',
    minDistMeters: 0,
    maxDistMeters: 1.5,
    color: '#ef4444', // Red
    bgTailwind: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    borderTailwind: 'border-red-500',
    badgeTailwind: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    description: '0m - 1.5m: Directed right at the batsman’s toes or popping crease. High-risk, high-reward wicket delivery.',
  },
  over_pitch: {
    id: 'over_pitch',
    name: 'Overpitch (Half-Volley)',
    shortName: 'Overpitch',
    minDistMeters: 1.5,
    maxDistMeters: 3.0,
    color: '#f97316', // Orange
    bgTailwind: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
    borderTailwind: 'border-orange-500',
    badgeTailwind: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    description: '1.5m - 3.0m: Pitches right in the driving zone. Easy for batters to drive on the up.',
  },
  full_length: {
    id: 'full_length',
    name: 'Full Length',
    shortName: 'Full Length',
    minDistMeters: 3.0,
    maxDistMeters: 5.0,
    color: '#10b981', // Emerald
    bgTailwind: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    borderTailwind: 'border-emerald-500',
    badgeTailwind: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    description: '3.0m - 5.0m: Drawing the batter forward to defend or drive with movement available.',
  },
  good_length: {
    id: 'good_length',
    name: 'Good Length',
    shortName: 'Good Length',
    minDistMeters: 5.0,
    maxDistMeters: 7.0,
    color: '#3b82f6', // Blue (the sweet spot)
    bgTailwind: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    borderTailwind: 'border-blue-500',
    badgeTailwind: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    description: '5.0m - 7.0m: The corridor of uncertainty. Batsman is caught between playing forward or back.',
  },
  short_of_good_length: {
    id: 'short_of_good_length',
    name: 'Short of Good Length',
    shortName: 'Short of Good Length',
    minDistMeters: 7.0,
    maxDistMeters: 9.0,
    color: '#8b5cf6', // Violet
    bgTailwind: 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30',
    borderTailwind: 'border-violet-500',
    badgeTailwind: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    description: '7.0m - 9.0m: Back of a length. Bounces to waist/chest height, prompting back-foot punch/pull.',
  },
  short: {
    id: 'short',
    name: 'Short Pitch (Bouncer)',
    shortName: 'Short Pitch',
    minDistMeters: 9.0,
    maxDistMeters: 12.0,
    color: '#ec4899', // Pink / Magenta
    bgTailwind: 'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
    borderTailwind: 'border-pink-500',
    badgeTailwind: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800',
    description: '9.0m - 12.0m+: Pitched halfway down the pitch. Rises sharply towards shoulder/helmet level.',
  },
};

export const LINE_ZONES_CONFIG: Record<LineZone, { name: string; shortName: string; description: string }> = {
  wide_off: { name: 'Wide Outside Off', shortName: 'Wide Off', description: 'Beyond the wide guideline on off side' },
  outside_off: { name: 'Outside Off (4th-5th Stump)', shortName: 'Outside Off', description: 'Channel of uncertainty outside off stump' },
  stumps: { name: 'On the Stumps (Off/Middle/Leg)', shortName: 'Stumps', description: 'Targeting the 3 stumps directly' },
  pads: { name: 'On the Pads / Hip', shortName: 'Pads / Leg Line', description: 'Cramping the batter on the body or leg stump' },
  down_leg: { name: 'Down Leg Side', shortName: 'Down Leg', description: 'Drifting down the leg side' },
};
