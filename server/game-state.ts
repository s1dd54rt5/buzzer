import { v4 as uuidv4 } from 'uuid';
import {
  GameSession,
  Player,
  Team,
  BuzzEntry,
  RoundState,
  SessionSettings,
  SerializedSession,
  TEAM_COLORS,
  TeamColor,
  serializeSession,
  RoundResult,
} from '../shared/types';

// ============================================
// Default Settings
// ============================================

const DEFAULT_SETTINGS: SessionSettings = {
  teamModeEnabled: false,
  oneBuzzPerTeam: false,
  allowLateBuzzes: true,
  showQueueToPlayers: true,
  maxPlayersPerSession: 50,
  buzzCooldownMs: 100, // Minimum 100ms between buzz attempts
};

// ============================================
// Game State Manager
// ============================================

export class GameStateManager {
  private sessions: Map<string, GameSession> = new Map();
  private playerToSession: Map<string, string> = new Map(); // playerId -> sessionId
  private socketToPlayer: Map<string, string> = new Map();  // socketId -> playerId
  private playerBuzzTimestamps: Map<string, number> = new Map(); // Rate limiting

  // ----------------------------------------
  // Session Management
  // ----------------------------------------

  createSession(hostSocketId: string, settings: Partial<SessionSettings> = {}): GameSession {
    const sessionId = this.generateSessionId();
    
    const session: GameSession = {
      id: sessionId,
      hostSocketId,
      createdAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS, ...settings },
      teams: [],
      players: new Map(),
      round: this.createInitialRoundState(),
      roundHistory: [],
    };

    this.sessions.set(sessionId, session);
    console.log(`[GameState] Session created: ${sessionId}`);
    
    return session;
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSerializedSession(sessionId: string): SerializedSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? serializeSession(session) : undefined;
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clean up player mappings
    for (const player of session.players.values()) {
      this.playerToSession.delete(player.id);
      this.socketToPlayer.delete(player.socketId);
    }

    this.sessions.delete(sessionId);
    console.log(`[GameState] Session ended: ${sessionId}`);
  }

  updateSettings(sessionId: string, settings: Partial<SessionSettings>): GameSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.settings = { ...session.settings, ...settings };
    return session;
  }

  // ----------------------------------------
  // Player Management
  // ----------------------------------------

  addPlayer(
    sessionId: string,
    socketId: string,
    displayName: string
  ): { player: Player; session: GameSession } | { error: string } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { error: 'Session not found' };
    }

    if (session.players.size >= session.settings.maxPlayersPerSession) {
      return { error: 'Session is full' };
    }

    // Check for duplicate names
    const existingPlayer = Array.from(session.players.values()).find(
      p => p.displayName.toLowerCase() === displayName.toLowerCase() && p.isConnected
    );
    
    if (existingPlayer) {
      return { error: 'Name already taken' };
    }

    const playerId = uuidv4();
    const player: Player = {
      id: playerId,
      socketId,
      displayName: displayName.trim().slice(0, 20), // Limit name length
      teamId: null,
      isConnected: true,
      lastSeen: Date.now(),
    };

    session.players.set(playerId, player);
    this.playerToSession.set(playerId, sessionId);
    this.socketToPlayer.set(socketId, playerId);

    console.log(`[GameState] Player joined: ${displayName} (${playerId}) in session ${sessionId}`);
    
    return { player, session };
  }

  rejoinPlayer(
    sessionId: string,
    playerId: string,
    newSocketId: string
  ): { player: Player; session: GameSession } | { error: string } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { error: 'Session not found' };
    }

    const player = session.players.get(playerId);
    
    if (!player) {
      return { error: 'Player not found in session' };
    }

    // Update socket mapping
    this.socketToPlayer.delete(player.socketId);
    this.socketToPlayer.set(newSocketId, playerId);
    
    player.socketId = newSocketId;
    player.isConnected = true;
    player.lastSeen = Date.now();

    console.log(`[GameState] Player rejoined: ${player.displayName} (${playerId})`);
    
    return { player, session };
  }

  disconnectPlayer(socketId: string): { player: Player; session: GameSession } | null {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;

    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const player = session.players.get(playerId);
    if (!player) return null;

    player.isConnected = false;
    player.lastSeen = Date.now();

    console.log(`[GameState] Player disconnected: ${player.displayName}`);
    
    return { player, session };
  }

  removePlayer(sessionId: string, playerId: string): GameSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const player = session.players.get(playerId);
    if (player) {
      this.socketToPlayer.delete(player.socketId);
    }
    
    session.players.delete(playerId);
    this.playerToSession.delete(playerId);

    // Remove from buzz queue if present
    session.round.buzzQueue = session.round.buzzQueue.filter(b => b.playerId !== playerId);
    
    // If active player was removed, advance queue
    if (session.round.activePlayerId === playerId) {
      this.advanceQueue(session);
    }

    return session;
  }

  getPlayerBySocketId(socketId: string): { player: Player; session: GameSession } | null {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;

    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const player = session.players.get(playerId);
    if (!player) return null;

    return { player, session };
  }

  getSessionByHostSocket(socketId: string): GameSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.hostSocketId === socketId) {
        return session;
      }
    }
    return undefined;
  }

  // ----------------------------------------
  // Team Management
  // ----------------------------------------

  addTeam(sessionId: string, name: string): Team | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const colorIndex = session.teams.length % TEAM_COLORS.length;
    
    const team: Team = {
      id: uuidv4(),
      name: name.trim().slice(0, 20),
      color: TEAM_COLORS[colorIndex],
      score: 0,
    };

    session.teams.push(team);
    return team;
  }

  removeTeam(sessionId: string, teamId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.teams.findIndex(t => t.id === teamId);
    if (index === -1) return false;

    session.teams.splice(index, 1);

    // Unassign players from this team
    for (const player of session.players.values()) {
      if (player.teamId === teamId) {
        player.teamId = null;
      }
    }

    return true;
  }

  assignPlayerToTeam(sessionId: string, playerId: string, teamId: string | null): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const player = session.players.get(playerId);
    if (!player) return false;

    if (teamId !== null && !session.teams.find(t => t.id === teamId)) {
      return false;
    }

    player.teamId = teamId;
    return true;
  }

  updateTeamScore(sessionId: string, teamId: string, delta: number): Team | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const team = session.teams.find(t => t.id === teamId);
    if (!team) return undefined;

    team.score += delta;
    return team;
  }

  // ----------------------------------------
  // Round Management
  // ----------------------------------------

  startRound(sessionId: string): RoundState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.round = {
      status: 'open',
      questionNumber: session.round.questionNumber + 1,
      startedAt: Date.now(),
      lockedAt: null,
      activePlayerId: null,
      buzzQueue: [],
    };

    console.log(`[GameState] Round ${session.round.questionNumber} started in session ${sessionId}`);
    
    return session.round;
  }

  resetRound(sessionId: string): RoundState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.round = {
      status: 'waiting',
      questionNumber: session.round.questionNumber,
      startedAt: null,
      lockedAt: null,
      activePlayerId: null,
      buzzQueue: [],
    };

    return session.round;
  }

  // ----------------------------------------
  // Buzzing Logic (Server-Authoritative)
  // ----------------------------------------

  processBuzz(socketId: string): BuzzEntry | { error: string } | null {
    const playerData = this.getPlayerBySocketId(socketId);
    if (!playerData) return { error: 'Player not found' };

    const { player, session } = playerData;

    // Validate round status
    if (session.round.status !== 'open' && session.round.status !== 'locked') {
      return { error: 'Buzzer is not active' };
    }

    // Check if player already buzzed
    const alreadyBuzzed = session.round.buzzQueue.some(b => b.playerId === player.id);
    if (alreadyBuzzed) {
      return { error: 'Already buzzed' };
    }

    // Rate limiting
    const lastBuzz = this.playerBuzzTimestamps.get(player.id);
    const now = Date.now();
    if (lastBuzz && now - lastBuzz < session.settings.buzzCooldownMs) {
      return { error: 'Too fast' };
    }
    this.playerBuzzTimestamps.set(player.id, now);

    // Check team restriction
    if (session.settings.oneBuzzPerTeam && player.teamId) {
      const teamAlreadyBuzzed = session.round.buzzQueue.some(
        b => b.teamId === player.teamId
      );
      if (teamAlreadyBuzzed) {
        return { error: 'Team already buzzed' };
      }
    }

    // Check if late buzzes are allowed
    if (session.round.status === 'locked' && !session.settings.allowLateBuzzes) {
      return { error: 'Buzzer is locked' };
    }

    // Get team info
    const team = player.teamId 
      ? session.teams.find(t => t.id === player.teamId) 
      : null;

    // Create buzz entry with SERVER timestamp
    const buzzEntry: BuzzEntry = {
      playerId: player.id,
      playerName: player.displayName,
      teamId: player.teamId,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      timestamp: now,
      position: session.round.buzzQueue.length + 1,
    };

    session.round.buzzQueue.push(buzzEntry);

    // Lock buzzer on first buzz
    if (session.round.status === 'open') {
      session.round.status = 'locked';
      session.round.lockedAt = now;
      session.round.activePlayerId = player.id;
    }

    console.log(`[GameState] Buzz from ${player.displayName} - Position #${buzzEntry.position}`);

    return buzzEntry;
  }

  markCorrect(sessionId: string): RoundResult | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || !session.round.activePlayerId) return undefined;

    const activePlayer = session.players.get(session.round.activePlayerId);
    
    const result: RoundResult = {
      questionNumber: session.round.questionNumber,
      winnerId: session.round.activePlayerId,
      winnerName: activePlayer?.displayName ?? null,
      teamId: activePlayer?.teamId ?? null,
      buzzCount: session.round.buzzQueue.length,
      duration: session.round.startedAt ? Date.now() - session.round.startedAt : 0,
    };

    // Award point to team
    if (activePlayer?.teamId) {
      this.updateTeamScore(sessionId, activePlayer.teamId, 1);
    }

    session.roundHistory.push(result);
    
    // Reset round state
    session.round = {
      status: 'ended',
      questionNumber: session.round.questionNumber,
      startedAt: null,
      lockedAt: null,
      activePlayerId: null,
      buzzQueue: [],
    };

    console.log(`[GameState] Round ${result.questionNumber} won by ${result.winnerName}`);

    return result;
  }

  markPass(sessionId: string): { passedPlayerId: string; newActivePlayerId: string | null } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || !session.round.activePlayerId) return undefined;

    const passedPlayerId = session.round.activePlayerId;
    
    // Remove passed player from queue
    session.round.buzzQueue = session.round.buzzQueue.filter(
      b => b.playerId !== passedPlayerId
    );

    // Update positions
    session.round.buzzQueue.forEach((b, i) => {
      b.position = i + 1;
    });

    // Advance to next in queue
    const nextEntry = session.round.buzzQueue[0];
    session.round.activePlayerId = nextEntry?.playerId ?? null;

    const result = {
      passedPlayerId,
      newActivePlayerId: session.round.activePlayerId,
    };

    console.log(`[GameState] Passed ${passedPlayerId}, new active: ${result.newActivePlayerId}`);

    return result;
  }

  skipPlayer(sessionId: string, playerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.round.buzzQueue = session.round.buzzQueue.filter(b => b.playerId !== playerId);
    
    // Update positions
    session.round.buzzQueue.forEach((b, i) => {
      b.position = i + 1;
    });

    // If skipped player was active, advance
    if (session.round.activePlayerId === playerId) {
      this.advanceQueue(session);
    }

    return true;
  }

  private advanceQueue(session: GameSession): void {
    const nextEntry = session.round.buzzQueue[0];
    session.round.activePlayerId = nextEntry?.playerId ?? null;
    
    if (!session.round.activePlayerId) {
      // No one left in queue
      session.round.status = 'waiting';
    }
  }

  // ----------------------------------------
  // Utilities
  // ----------------------------------------

  private createInitialRoundState(): RoundState {
    return {
      status: 'waiting',
      questionNumber: 0,
      startedAt: null,
      lockedAt: null,
      activePlayerId: null,
      buzzQueue: [],
    };
  }

  private generateSessionId(): string {
    // Generate 6-character alphanumeric code (easy to type/share)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Cleanup inactive sessions (call periodically)
  cleanupStaleSessions(maxAgeMs: number = 3600000): void { // 1 hour default
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = Math.max(
        session.createdAt,
        ...Array.from(session.players.values()).map(p => p.lastSeen)
      );
      
      if (now - lastActivity > maxAgeMs) {
        this.endSession(sessionId);
        console.log(`[GameState] Cleaned up stale session: ${sessionId}`);
      }
    }
  }
}

// Singleton instance
export const gameState = new GameStateManager();

