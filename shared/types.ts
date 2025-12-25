// ============================================
// SHARED TYPES - Used by both Server & Client
// ============================================

// Team colors for visual distinction
export const TEAM_COLORS = [
  '#FF2D55', // Red
  '#007AFF', // Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FFCC00', // Yellow
  '#00C7BE', // Teal
  '#FF375F', // Pink
] as const;

export type TeamColor = typeof TEAM_COLORS[number];

// ============================================
// Core Entities
// ============================================

export interface Team {
  id: string;
  name: string;
  color: TeamColor;
  score: number;
}

export interface Player {
  id: string;
  socketId: string;
  displayName: string;
  teamId: string | null;
  isConnected: boolean;
  lastSeen: number;
}

export interface BuzzEntry {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: TeamColor | null;
  timestamp: number; // Server-side timestamp
  position: number;  // 1-indexed position in queue
}

// ============================================
// Round & Session State
// ============================================

export type RoundStatus = 
  | 'waiting'      // Round not started, buzzer disabled
  | 'open'         // Buzzer is active, accepting buzzes
  | 'locked'       // First buzz received, queue building
  | 'evaluating'   // Host is evaluating the active player
  | 'ended';       // Round completed

export interface RoundState {
  status: RoundStatus;
  questionNumber: number;
  startedAt: number | null;
  lockedAt: number | null;
  activePlayerId: string | null;
  buzzQueue: BuzzEntry[];
}

export interface SessionSettings {
  teamModeEnabled: boolean;
  oneBuzzPerTeam: boolean;
  allowLateBuzzes: boolean;    // Queue buzzes after lock
  showQueueToPlayers: boolean;
  maxPlayersPerSession: number;
  buzzCooldownMs: number;      // Rate limiting
}

export interface GameSession {
  id: string;
  hostSocketId: string;
  createdAt: number;
  settings: SessionSettings;
  teams: Team[];
  players: Map<string, Player>;
  round: RoundState;
  roundHistory: RoundResult[];
}

export interface RoundResult {
  questionNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  teamId: string | null;
  buzzCount: number;
  duration: number;
}

// ============================================
// Socket Events - Client to Server
// ============================================

export interface ClientToServerEvents {
  // Session management
  'host:create': (settings: Partial<SessionSettings>) => void;
  'host:updateSettings': (settings: Partial<SessionSettings>) => void;
  
  // Player joining
  'player:join': (data: { sessionId: string; displayName: string }) => void;
  'player:setTeam': (teamId: string) => void;
  'player:rejoin': (data: { sessionId: string; playerId: string }) => void;
  
  // Buzzing
  'player:buzz': () => void;
  
  // Host controls
  'host:startRound': () => void;
  'host:markCorrect': () => void;
  'host:markPass': () => void;
  'host:skipPlayer': (playerId: string) => void;
  'host:resetRound': () => void;
  'host:endSession': () => void;
  
  // Team management
  'host:addTeam': (name: string) => void;
  'host:removeTeam': (teamId: string) => void;
  'host:assignPlayerToTeam': (data: { playerId: string; teamId: string }) => void;
  'host:updateTeamScore': (data: { teamId: string; delta: number }) => void;
  
  // Player management
  'host:kickPlayer': (playerId: string) => void;
}

// ============================================
// Socket Events - Server to Client
// ============================================

export interface ServerToClientEvents {
  // Session state
  'session:created': (data: { sessionId: string; session: SerializedSession }) => void;
  'session:joined': (data: { playerId: string; session: SerializedSession }) => void;
  'session:rejoined': (data: { session: SerializedSession }) => void;
  'session:updated': (session: SerializedSession) => void;
  'session:ended': () => void;
  'session:error': (error: { code: string; message: string }) => void;
  
  // Player updates
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:updated': (player: Player) => void;
  'player:kicked': () => void;
  
  // Round updates
  'round:started': (round: RoundState) => void;
  'round:buzzReceived': (entry: BuzzEntry) => void;
  'round:locked': (data: { activePlayerId: string; queue: BuzzEntry[] }) => void;
  'round:playerPassed': (data: { passedPlayerId: string; newActivePlayerId: string | null }) => void;
  'round:correct': (data: { playerId: string; playerName: string; teamId: string | null }) => void;
  'round:reset': (round: RoundState) => void;
  
  // Team updates
  'team:added': (team: Team) => void;
  'team:removed': (teamId: string) => void;
  'team:scoreUpdated': (data: { teamId: string; score: number }) => void;
  
  // Connection status
  'connection:status': (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

// ============================================
// Serialized Session (for network transport)
// ============================================

export interface SerializedSession {
  id: string;
  hostSocketId: string;
  createdAt: number;
  settings: SessionSettings;
  teams: Team[];
  players: Player[];
  round: RoundState;
  roundHistory: RoundResult[];
}

// ============================================
// Utility Types
// ============================================

export interface JoinResult {
  success: boolean;
  playerId?: string;
  session?: SerializedSession;
  error?: { code: string; message: string };
}

export type PlayerStatus = 
  | 'waiting'     // Waiting for round to start
  | 'ready'       // Round is open, can buzz
  | 'buzzed'      // Already buzzed this round
  | 'active'      // Currently being evaluated
  | 'passed'      // Was passed by host
  | 'queued';     // In queue behind active player

export function getPlayerStatus(
  playerId: string,
  round: RoundState
): PlayerStatus {
  if (round.status === 'waiting' || round.status === 'ended') {
    return 'waiting';
  }
  
  if (round.activePlayerId === playerId) {
    return 'active';
  }
  
  const inQueue = round.buzzQueue.find(b => b.playerId === playerId);
  
  if (inQueue) {
    return 'queued';
  }
  
  if (round.status === 'open') {
    return 'ready';
  }
  
  return 'waiting';
}

export function serializeSession(session: GameSession): SerializedSession {
  return {
    id: session.id,
    hostSocketId: session.hostSocketId,
    createdAt: session.createdAt,
    settings: session.settings,
    teams: session.teams,
    players: Array.from(session.players.values()),
    round: session.round,
    roundHistory: session.roundHistory,
  };
}

