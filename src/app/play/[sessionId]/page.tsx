'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerSession, useSocket } from '@/hooks/useSocket';
import { getPlayerStatus, type PlayerStatus } from '../../../../shared/types';

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const { isConnected, connectionStatus, error, clearError } = useSocket();
  const {
    session,
    playerId,
    isLoading,
    isKicked,
    sessionEnded,
    joinSession,
    rejoinSession,
    buzz,
    setTeam,
  } = usePlayerSession();

  const [displayName, setDisplayName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [buzzing, setBuzzing] = useState(false);
  const buzzTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing session in localStorage (reconnection)
  useEffect(() => {
    if (!isConnected) return;
    
    const savedPlayerId = localStorage.getItem('buzzer_playerId');
    const savedSessionId = localStorage.getItem('buzzer_sessionId');
    
    if (savedPlayerId && savedSessionId === sessionId) {
      rejoinSession(sessionId, savedPlayerId);
      setHasJoined(true);
    }
  }, [isConnected, sessionId, rejoinSession]);

  // Handle join form
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length >= 1) {
      joinSession(sessionId, displayName.trim());
      setHasJoined(true);
    }
  };

  // Handle buzz with haptic feedback
  const handleBuzz = useCallback(() => {
    if (!session || !playerId) return;
    
    const status = getPlayerStatus(playerId, session.round);
    if (status !== 'ready') return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Visual feedback
    setBuzzing(true);
    if (buzzTimeoutRef.current) {
      clearTimeout(buzzTimeoutRef.current);
    }
    buzzTimeoutRef.current = setTimeout(() => setBuzzing(false), 300);

    buzz();
  }, [session, playerId, buzz]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (buzzTimeoutRef.current) {
        clearTimeout(buzzTimeoutRef.current);
      }
    };
  }, []);

  // Handle kicked/ended states
  if (isKicked) {
    return (
      <main className="min-h-screen bg-buzz-darker flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">👋</div>
          <h1 className="font-display font-bold text-2xl text-white mb-4">
            You&apos;ve been removed
          </h1>
          <p className="text-white/60 mb-8">
            The host has removed you from this game.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-buzz-card border border-buzz-border text-white font-semibold rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  if (sessionEnded) {
    return (
      <main className="min-h-screen bg-buzz-darker flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="font-display font-bold text-2xl text-white mb-4">
            Game Over!
          </h1>
          <p className="text-white/60 mb-8">
            The host has ended this game session.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-buzz-card border border-buzz-border text-white font-semibold rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Connection status overlay
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-buzz-darker flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔔</div>
          <p className="text-white/60">
            {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </p>
        </div>
      </main>
    );
  }

  // Join form
  if (!hasJoined || (!session && !isLoading)) {
    return (
      <main className="min-h-screen bg-buzz-darker bg-radial flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔔</div>
            <h1 className="font-display font-bold text-2xl text-white mb-2">
              Join Game
            </h1>
            <p className="text-white/40 font-mono text-lg">{sessionId}</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              autoFocus
              className="w-full py-5 px-6 bg-buzz-card border border-buzz-border text-white text-center font-display text-xl rounded-2xl placeholder:text-white/30 focus:border-buzz-red transition-colors"
            />
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={displayName.trim().length < 1}
              className="w-full py-5 bg-gradient-to-r from-buzz-red to-buzz-orange text-white font-display font-bold text-xl rounded-2xl shadow-buzz disabled:opacity-50 disabled:shadow-none"
            >
              JOIN
            </motion.button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-center"
              >
                <p className="text-red-400">{error}</p>
                <button
                  onClick={clearError}
                  className="mt-2 text-sm text-white/40 hover:text-white"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    );
  }

  // Loading state
  if (isLoading || !session || !playerId) {
    return (
      <main className="min-h-screen bg-buzz-darker flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔔</div>
          <p className="text-white/60">Joining game...</p>
        </div>
      </main>
    );
  }

  // Get current player status
  const playerStatus = getPlayerStatus(playerId, session.round);
  const currentPlayer = session.players.find(p => p.id === playerId);
  const currentTeam = currentPlayer?.teamId 
    ? session.teams.find(t => t.id === currentPlayer.teamId) 
    : null;
  
  const queuePosition = session.round.buzzQueue.findIndex(b => b.playerId === playerId);
  const isActive = session.round.activePlayerId === playerId;

  return (
    <main className="min-h-screen bg-buzz-darker flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-buzz-border bg-buzz-card/50">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <p className="font-display font-bold text-white">{currentPlayer?.displayName}</p>
            {currentTeam && (
              <p 
                className="text-xs"
                style={{ color: currentTeam.color }}
              >
                {currentTeam.name}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Round</p>
          <p className="font-mono font-bold text-white">
            {session.round.questionNumber || '—'}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* Waiting state */}
          {playerStatus === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="text-6xl mb-6 waiting-pulse">⏳</div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                Waiting for Host
              </h2>
              <p className="text-white/40">
                The next round will start soon...
              </p>
            </motion.div>
          )}

          {/* Ready to buzz */}
          {playerStatus === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center w-full"
            >
              <BuzzButton 
                onBuzz={handleBuzz} 
                buzzing={buzzing}
                color={currentTeam?.color}
              />
            </motion.div>
          )}

          {/* Active (being evaluated) */}
          {playerStatus === 'active' || isActive && (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-48 h-48 mx-auto mb-8 rounded-full flex items-center justify-center glow-green"
                style={{
                  background: `linear-gradient(135deg, ${currentTeam?.color || '#34C759'}, ${currentTeam?.color || '#34C759'}80)`,
                }}
              >
                <span className="text-6xl">🎯</span>
              </motion.div>
              <h2 className="font-display font-extrabold text-3xl text-white mb-2">
                YOUR TURN!
              </h2>
              <p className="text-white/60">
                Waiting for host to evaluate...
              </p>
            </motion.div>
          )}

          {/* Queued */}
          {playerStatus === 'queued' && queuePosition > 0 && (
            <motion.div
              key="queued"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div 
                className="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center font-display font-extrabold text-5xl text-white"
                style={{
                  backgroundColor: currentTeam?.color || '#FF9500',
                }}
              >
                #{queuePosition + 1}
              </div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                You&apos;re in Queue
              </h2>
              <p className="text-white/60">
                {queuePosition === 0 
                  ? "You're next!" 
                  : `${queuePosition} player${queuePosition > 1 ? 's' : ''} ahead of you`
                }
              </p>
            </motion.div>
          )}

          {/* Already buzzed (first in queue) */}
          {playerStatus === 'queued' && queuePosition === 0 && (
            <motion.div
              key="first"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-48 h-48 mx-auto mb-8 rounded-full flex items-center justify-center glow-green"
                style={{
                  background: `linear-gradient(135deg, ${currentTeam?.color || '#34C759'}, ${currentTeam?.color || '#34C759'}80)`,
                }}
              >
                <span className="text-6xl">🥇</span>
              </motion.div>
              <h2 className="font-display font-extrabold text-3xl text-white mb-2">
                FIRST!
              </h2>
              <p className="text-white/60">
                Waiting for host...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Team Selector (if teams enabled and player has no team) */}
      {session.settings.teamModeEnabled && session.teams.length > 0 && !currentPlayer?.teamId && (
        <div className="p-4 border-t border-buzz-border bg-buzz-card/50">
          <p className="text-sm text-white/40 text-center mb-3">Select your team</p>
          <div className="grid grid-cols-2 gap-2">
            {session.teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setTeam(team.id)}
                className="py-3 px-4 rounded-xl font-display font-semibold text-white transition-transform active:scale-95"
                style={{
                  backgroundColor: `${team.color}20`,
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: team.color,
                }}
              >
                {team.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Queue display (optional) */}
      {session.settings.showQueueToPlayers && session.round.buzzQueue.length > 0 && (
        <div className="p-4 border-t border-buzz-border bg-buzz-card/30">
          <p className="text-xs text-white/40 text-center mb-2">
            Queue ({session.round.buzzQueue.length})
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {session.round.buzzQueue.slice(0, 5).map((entry, index) => (
              <span
                key={entry.playerId}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  entry.playerId === playerId 
                    ? 'bg-white/20 text-white' 
                    : 'bg-buzz-card text-white/60'
                }`}
              >
                {index + 1}. {entry.playerName}
              </span>
            ))}
            {session.round.buzzQueue.length > 5 && (
              <span className="px-3 py-1 text-white/40 text-sm">
                +{session.round.buzzQueue.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================
// Buzz Button Component
// ============================================

function BuzzButton({ 
  onBuzz, 
  buzzing,
  color = '#FF2D55',
}: { 
  onBuzz: () => void;
  buzzing: boolean;
  color?: string;
}) {
  return (
    <div className="relative">
      {/* Pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute w-64 h-64 rounded-full"
          style={{ backgroundColor: `${color}30` }}
        />
        <motion.div
          animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          className="absolute w-64 h-64 rounded-full"
          style={{ backgroundColor: `${color}20` }}
        />
      </div>

      {/* Main button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        animate={buzzing ? { scale: [1, 0.95, 1] } : {}}
        onTouchStart={onBuzz}
        onClick={onBuzz}
        className="relative w-64 h-64 rounded-full font-display font-extrabold text-4xl text-white shadow-buzz-active buzz-button"
        style={{
          background: `linear-gradient(145deg, ${color}, ${color}CC)`,
          boxShadow: buzzing 
            ? `0 0 100px ${color}80, 0 0 200px ${color}40` 
            : `0 0 60px ${color}40, 0 0 120px ${color}20`,
        }}
      >
        <span className="relative z-10">BUZZ!</span>
        
        {/* Inner glow */}
        <div 
          className="absolute inset-4 rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle at 30% 30%, white, transparent 60%)`,
          }}
        />
      </motion.button>

      <p className="mt-8 text-white/40 text-center">Tap to buzz!</p>
    </div>
  );
}

