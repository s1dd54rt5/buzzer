'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket, TypedSocket } from '@/lib/socket';
import type { SerializedSession, Player, RoundState, BuzzEntry, Team } from '../../shared/types';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseSocketReturn {
  socket: TypedSocket;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  error: string | null;
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };

    const handleReconnecting = () => {
      setConnectionStatus('reconnecting');
    };

    const handleError = (err: { code: string; message: string }) => {
      setError(err.message);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnecting);
    socket.on('session:error', handleError);

    connectSocket();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnecting);
      socket.off('session:error', handleError);
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    socket: socketRef.current || getSocket(),
    isConnected,
    connectionStatus,
    error,
    clearError,
  };
}

// ============================================
// Host-specific Hook
// ============================================

interface UseHostSessionReturn {
  session: SerializedSession | null;
  isLoading: boolean;
  createSession: (settings?: Partial<SerializedSession['settings']>) => void;
  updateSettings: (settings: Partial<SerializedSession['settings']>) => void;
  startRound: () => void;
  markCorrect: () => void;
  markPass: () => void;
  resetRound: () => void;
  skipPlayer: (playerId: string) => void;
  kickPlayer: (playerId: string) => void;
  addTeam: (name: string) => void;
  removeTeam: (teamId: string) => void;
  updateTeamScore: (teamId: string, delta: number) => void;
  assignPlayerToTeam: (playerId: string, teamId: string) => void;
  endSession: () => void;
}

export function useHostSession(): UseHostSessionReturn {
  const { socket, isConnected } = useSocket();
  const [session, setSession] = useState<SerializedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) return;

    const handleSessionCreated = ({ session }: { sessionId: string; session: SerializedSession }) => {
      setSession(session);
      setIsLoading(false);
    };

    const handleSessionUpdated = (updatedSession: SerializedSession) => {
      setSession(updatedSession);
    };

    const handlePlayerJoined = (player: Player) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: [...prev.players.filter(p => p.id !== player.id), player],
        };
      });
    };

    const handlePlayerLeft = (playerId: string) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId),
        };
      });
    };

    const handlePlayerUpdated = (player: Player) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => p.id === player.id ? player : p),
        };
      });
    };

    const handleRoundStarted = (round: RoundState) => {
      setSession(prev => prev ? { ...prev, round } : null);
    };

    const handleBuzzReceived = (entry: BuzzEntry) => {
      setSession(prev => {
        if (!prev) return null;
        // Check if this buzz already exists (avoid duplicates)
        const exists = prev.round.buzzQueue.some(b => b.playerId === entry.playerId);
        if (exists) return prev;
        
        return {
          ...prev,
          round: {
            ...prev.round,
            // First buzz locks the round
            status: prev.round.buzzQueue.length === 0 ? 'locked' : prev.round.status,
            activePlayerId: prev.round.buzzQueue.length === 0 ? entry.playerId : prev.round.activePlayerId,
            buzzQueue: [...prev.round.buzzQueue, entry],
          },
        };
      });
    };

    const handleRoundLocked = ({ activePlayerId, queue }: { activePlayerId: string; queue: BuzzEntry[] }) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          round: {
            ...prev.round,
            status: 'locked',
            activePlayerId,
            buzzQueue: queue,
            lockedAt: Date.now(),
          },
        };
      });
    };

    const handlePlayerPassed = ({ passedPlayerId, newActivePlayerId }: { passedPlayerId: string; newActivePlayerId: string | null }) => {
      setSession(prev => {
        if (!prev) return null;
        // Remove passed player from queue and update active player
        const updatedQueue = prev.round.buzzQueue.filter(b => b.playerId !== passedPlayerId);
        return {
          ...prev,
          round: {
            ...prev.round,
            activePlayerId: newActivePlayerId,
            buzzQueue: updatedQueue,
            // If no one left, go back to waiting
            status: newActivePlayerId ? 'locked' : 'waiting',
          },
        };
      });
    };

    const handleRoundReset = (round: RoundState) => {
      setSession(prev => prev ? { ...prev, round } : null);
    };

    const handleTeamAdded = (team: Team) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: [...prev.teams, team],
        };
      });
    };

    const handleTeamRemoved = (teamId: string) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: prev.teams.filter(t => t.id !== teamId),
        };
      });
    };

    const handleTeamScoreUpdated = ({ teamId, score }: { teamId: string; score: number }) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: prev.teams.map(t => t.id === teamId ? { ...t, score } : t),
        };
      });
    };

    socket.on('session:created', handleSessionCreated);
    socket.on('session:updated', handleSessionUpdated);
    socket.on('player:joined', handlePlayerJoined);
    socket.on('player:left', handlePlayerLeft);
    socket.on('player:updated', handlePlayerUpdated);
    socket.on('round:started', handleRoundStarted);
    socket.on('round:buzzReceived', handleBuzzReceived);
    socket.on('round:locked', handleRoundLocked);
    socket.on('round:playerPassed', handlePlayerPassed);
    socket.on('round:reset', handleRoundReset);
    socket.on('team:added', handleTeamAdded);
    socket.on('team:removed', handleTeamRemoved);
    socket.on('team:scoreUpdated', handleTeamScoreUpdated);

    return () => {
      socket.off('session:created', handleSessionCreated);
      socket.off('session:updated', handleSessionUpdated);
      socket.off('player:joined', handlePlayerJoined);
      socket.off('player:left', handlePlayerLeft);
      socket.off('player:updated', handlePlayerUpdated);
      socket.off('round:started', handleRoundStarted);
      socket.off('round:buzzReceived', handleBuzzReceived);
      socket.off('round:locked', handleRoundLocked);
      socket.off('round:playerPassed', handlePlayerPassed);
      socket.off('round:reset', handleRoundReset);
      socket.off('team:added', handleTeamAdded);
      socket.off('team:removed', handleTeamRemoved);
      socket.off('team:scoreUpdated', handleTeamScoreUpdated);
    };
  }, [socket, isConnected]);

  const createSession = useCallback((settings = {}) => {
    socket.emit('host:create', settings);
  }, [socket]);

  const updateSettings = useCallback((settings: Partial<SerializedSession['settings']>) => {
    socket.emit('host:updateSettings', settings);
  }, [socket]);

  const startRound = useCallback(() => {
    socket.emit('host:startRound');
  }, [socket]);

  const markCorrect = useCallback(() => {
    socket.emit('host:markCorrect');
  }, [socket]);

  const markPass = useCallback(() => {
    socket.emit('host:markPass');
  }, [socket]);

  const resetRound = useCallback(() => {
    socket.emit('host:resetRound');
  }, [socket]);

  const skipPlayer = useCallback((playerId: string) => {
    socket.emit('host:skipPlayer', playerId);
  }, [socket]);

  const kickPlayer = useCallback((playerId: string) => {
    socket.emit('host:kickPlayer', playerId);
  }, [socket]);

  const addTeam = useCallback((name: string) => {
    socket.emit('host:addTeam', name);
  }, [socket]);

  const removeTeam = useCallback((teamId: string) => {
    socket.emit('host:removeTeam', teamId);
  }, [socket]);

  const updateTeamScore = useCallback((teamId: string, delta: number) => {
    socket.emit('host:updateTeamScore', { teamId, delta });
  }, [socket]);

  const assignPlayerToTeam = useCallback((playerId: string, teamId: string) => {
    socket.emit('host:assignPlayerToTeam', { playerId, teamId });
  }, [socket]);

  const endSession = useCallback(() => {
    socket.emit('host:endSession');
  }, [socket]);

  return {
    session,
    isLoading,
    createSession,
    updateSettings,
    startRound,
    markCorrect,
    markPass,
    resetRound,
    skipPlayer,
    kickPlayer,
    addTeam,
    removeTeam,
    updateTeamScore,
    assignPlayerToTeam,
    endSession,
  };
}

// ============================================
// Player-specific Hook
// ============================================

interface UsePlayerSessionReturn {
  session: SerializedSession | null;
  playerId: string | null;
  isLoading: boolean;
  isKicked: boolean;
  sessionEnded: boolean;
  joinSession: (sessionId: string, displayName: string) => void;
  rejoinSession: (sessionId: string, playerId: string) => void;
  buzz: () => void;
  setTeam: (teamId: string) => void;
}

export function usePlayerSession(): UsePlayerSessionReturn {
  const { socket, isConnected } = useSocket();
  const [session, setSession] = useState<SerializedSession | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isKicked, setIsKicked] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (!isConnected) return;

    const handleSessionJoined = ({ playerId: pid, session: s }: { playerId: string; session: SerializedSession }) => {
      setPlayerId(pid);
      setSession(s);
      setIsLoading(false);
      // Save to localStorage for reconnection
      localStorage.setItem('buzzer_playerId', pid);
      localStorage.setItem('buzzer_sessionId', s.id);
    };

    const handleSessionRejoined = ({ session: s }: { session: SerializedSession }) => {
      setSession(s);
      setIsLoading(false);
    };

    const handleSessionUpdated = (updatedSession: SerializedSession) => {
      setSession(updatedSession);
    };

    const handlePlayerJoined = (player: Player) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: [...prev.players.filter(p => p.id !== player.id), player],
        };
      });
    };

    const handlePlayerLeft = (pid: string) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== pid),
        };
      });
    };

    const handlePlayerUpdated = (player: Player) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => p.id === player.id ? player : p),
        };
      });
    };

    const handleRoundStarted = (round: RoundState) => {
      setSession(prev => prev ? { ...prev, round } : null);
    };

    const handleBuzzReceived = (entry: BuzzEntry) => {
      setSession(prev => {
        if (!prev) return null;
        // Check if this buzz already exists (avoid duplicates)
        const exists = prev.round.buzzQueue.some(b => b.playerId === entry.playerId);
        if (exists) return prev;
        
        return {
          ...prev,
          round: {
            ...prev.round,
            // First buzz locks the round
            status: prev.round.buzzQueue.length === 0 ? 'locked' : prev.round.status,
            activePlayerId: prev.round.buzzQueue.length === 0 ? entry.playerId : prev.round.activePlayerId,
            buzzQueue: [...prev.round.buzzQueue, entry],
          },
        };
      });
    };

    const handleRoundLocked = ({ activePlayerId, queue }: { activePlayerId: string; queue: BuzzEntry[] }) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          round: {
            ...prev.round,
            status: 'locked',
            activePlayerId,
            buzzQueue: queue,
            lockedAt: Date.now(),
          },
        };
      });
    };

    const handlePlayerPassed = ({ passedPlayerId, newActivePlayerId }: { passedPlayerId: string; newActivePlayerId: string | null }) => {
      setSession(prev => {
        if (!prev) return null;
        // Remove passed player from queue and update active player
        const updatedQueue = prev.round.buzzQueue.filter(b => b.playerId !== passedPlayerId);
        return {
          ...prev,
          round: {
            ...prev.round,
            activePlayerId: newActivePlayerId,
            buzzQueue: updatedQueue,
            // If no one left, reset status
            status: newActivePlayerId ? 'locked' : 'waiting',
          },
        };
      });
    };

    const handleRoundCorrect = () => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          round: {
            ...prev.round,
            status: 'ended',
            activePlayerId: null,
            buzzQueue: [],
          },
        };
      });
    };

    const handleRoundReset = (round: RoundState) => {
      setSession(prev => prev ? { ...prev, round } : null);
    };

    const handleTeamAdded = (team: Team) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: [...prev.teams, team],
        };
      });
    };

    const handleTeamRemoved = (teamId: string) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: prev.teams.filter(t => t.id !== teamId),
        };
      });
    };

    const handleTeamScoreUpdated = ({ teamId, score }: { teamId: string; score: number }) => {
      setSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          teams: prev.teams.map(t => t.id === teamId ? { ...t, score } : t),
        };
      });
    };

    const handlePlayerKicked = () => {
      setIsKicked(true);
      setSession(null);
      localStorage.removeItem('buzzer_playerId');
      localStorage.removeItem('buzzer_sessionId');
    };

    const handleSessionEnded = () => {
      setSessionEnded(true);
      setSession(null);
      localStorage.removeItem('buzzer_playerId');
      localStorage.removeItem('buzzer_sessionId');
    };

    socket.on('session:joined', handleSessionJoined);
    socket.on('session:rejoined', handleSessionRejoined);
    socket.on('session:updated', handleSessionUpdated);
    socket.on('player:joined', handlePlayerJoined);
    socket.on('player:left', handlePlayerLeft);
    socket.on('player:updated', handlePlayerUpdated);
    socket.on('round:started', handleRoundStarted);
    socket.on('round:buzzReceived', handleBuzzReceived);
    socket.on('round:locked', handleRoundLocked);
    socket.on('round:playerPassed', handlePlayerPassed);
    socket.on('round:correct', handleRoundCorrect);
    socket.on('round:reset', handleRoundReset);
    socket.on('team:added', handleTeamAdded);
    socket.on('team:removed', handleTeamRemoved);
    socket.on('team:scoreUpdated', handleTeamScoreUpdated);
    socket.on('player:kicked', handlePlayerKicked);
    socket.on('session:ended', handleSessionEnded);

    return () => {
      socket.off('session:joined', handleSessionJoined);
      socket.off('session:rejoined', handleSessionRejoined);
      socket.off('session:updated', handleSessionUpdated);
      socket.off('player:joined', handlePlayerJoined);
      socket.off('player:left', handlePlayerLeft);
      socket.off('player:updated', handlePlayerUpdated);
      socket.off('round:started', handleRoundStarted);
      socket.off('round:buzzReceived', handleBuzzReceived);
      socket.off('round:locked', handleRoundLocked);
      socket.off('round:playerPassed', handlePlayerPassed);
      socket.off('round:correct', handleRoundCorrect);
      socket.off('round:reset', handleRoundReset);
      socket.off('team:added', handleTeamAdded);
      socket.off('team:removed', handleTeamRemoved);
      socket.off('team:scoreUpdated', handleTeamScoreUpdated);
      socket.off('player:kicked', handlePlayerKicked);
      socket.off('session:ended', handleSessionEnded);
    };
  }, [socket, isConnected]);

  const joinSession = useCallback((sessionId: string, displayName: string) => {
    socket.emit('player:join', { sessionId, displayName });
  }, [socket]);

  const rejoinSession = useCallback((sessionId: string, pid: string) => {
    socket.emit('player:rejoin', { sessionId, playerId: pid });
  }, [socket]);

  const buzz = useCallback(() => {
    socket.emit('player:buzz');
  }, [socket]);

  const setTeam = useCallback((teamId: string) => {
    socket.emit('player:setTeam', teamId);
  }, [socket]);

  return {
    session,
    playerId,
    isLoading,
    isKicked,
    sessionEnded,
    joinSession,
    rejoinSession,
    buzz,
    setTeam,
  };
}

