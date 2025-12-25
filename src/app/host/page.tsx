'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useHostSession, useSocket } from '@/hooks/useSocket';
import type { Player, BuzzEntry, Team } from '../../../shared/types';

export default function HostPage() {
  const router = useRouter();
  const { isConnected, connectionStatus } = useSocket();
  const {
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
  } = useHostSession();

  const [showSettings, setShowSettings] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [showQR, setShowQR] = useState(true);

  // Create session on mount
  useEffect(() => {
    if (isConnected && !session) {
      createSession({ teamModeEnabled: false });
    }
  }, [isConnected, session, createSession]);

  // Generate join URL
  const joinUrl = typeof window !== 'undefined' && session
    ? `${window.location.origin}/play/${session.id}`
    : '';

  // Get active player details
  const activePlayer = session?.round.activePlayerId
    ? session.players.find(p => p.id === session.round.activePlayerId)
    : null;

  const activePlayerTeam = activePlayer?.teamId
    ? session?.teams.find(t => t.id === activePlayer.teamId)
    : null;

  // Sound effect for buzz
  useEffect(() => {
    if (session?.round.buzzQueue.length === 1 && session.round.status === 'locked') {
      // Play buzz sound on first buzz
      try {
        const audio = new Audio('/buzz.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [session?.round.buzzQueue.length, session?.round.status]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-buzz-darker flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔔</div>
          <p className="text-white/60">
            {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-buzz-darker flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔔</div>
          <p className="text-white/60">Creating game...</p>
        </div>
      </div>
    );
  }

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      addTeam(newTeamName.trim());
      setNewTeamName('');
    }
  };

  const handleEndSession = () => {
    if (confirm('End this game session? All players will be disconnected.')) {
      endSession();
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen bg-buzz-darker bg-grid">
      {/* Header */}
      <header className="border-b border-buzz-border bg-buzz-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🔔</span>
            <div>
              <h1 className="font-display font-bold text-xl text-white">BUZZER</h1>
              <p className="text-sm text-white/40 font-mono">Game: {session.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-buzz-green/20 text-buzz-green">
              {session.players.filter(p => p.isConnected).length} connected
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid lg:grid-cols-3 gap-6">
        {/* Left Column - Controls & Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Round Status & Controls */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-bold text-2xl text-white">
                  Round {session.round.questionNumber || '—'}
                </h2>
                <p className="text-white/40 capitalize">{session.round.status}</p>
              </div>
              <div className="flex gap-3">
                {session.round.status === 'waiting' || session.round.status === 'ended' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startRound}
                    className="px-8 py-4 bg-gradient-to-r from-buzz-green to-emerald-400 text-white font-display font-bold text-lg rounded-xl shadow-lg"
                  >
                    🚀 START ROUND
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resetRound}
                    className="px-6 py-4 bg-buzz-card border border-buzz-border text-white font-display font-bold rounded-xl hover:border-white/30"
                  >
                    🔄 RESET
                  </motion.button>
                )}
              </div>
            </div>

            {/* Active Buzzer Display */}
            <AnimatePresence mode="wait">
              {session.round.status === 'open' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative bg-gradient-to-br from-buzz-green/20 to-emerald-500/10 border-2 border-buzz-green/50 rounded-2xl p-12 text-center"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 bg-buzz-green/20 rounded-full pulse-ring" />
                  </div>
                  <div className="relative">
                    <p className="text-buzz-green font-display font-bold text-3xl mb-2">
                      BUZZER OPEN
                    </p>
                    <p className="text-white/60">Waiting for players to buzz...</p>
                  </div>
                </motion.div>
              )}

              {(session.round.status === 'locked' || session.round.status === 'evaluating') && activePlayer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-6"
                >
                  {/* Active Player */}
                  <div 
                    className="relative rounded-2xl p-8 text-center glow-red"
                    style={{
                      background: `linear-gradient(135deg, ${activePlayerTeam?.color || '#FF2D55'}20, ${activePlayerTeam?.color || '#FF2D55'}05)`,
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: `${activePlayerTeam?.color || '#FF2D55'}80`,
                    }}
                  >
                    <p className="text-white/60 text-sm uppercase tracking-wider mb-2">First Buzz</p>
                    <h3 
                      className="font-display font-extrabold text-5xl mb-2"
                      style={{ color: activePlayerTeam?.color || '#FF2D55' }}
                    >
                      {activePlayer.displayName}
                    </h3>
                    {activePlayerTeam && (
                      <p className="text-white/60">{activePlayerTeam.name}</p>
                    )}
                  </div>

                  {/* Correct / Pass Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={markCorrect}
                      className="py-6 bg-gradient-to-r from-buzz-green to-emerald-400 text-white font-display font-bold text-xl rounded-xl shadow-lg"
                    >
                      ✓ CORRECT
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={markPass}
                      className="py-6 bg-gradient-to-r from-buzz-orange to-amber-400 text-white font-display font-bold text-xl rounded-xl shadow-lg"
                    >
                      → PASS
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buzz Queue */}
            {session.round.buzzQueue.length > 0 && (
              <div className="mt-6">
                <h3 className="font-display font-semibold text-white/60 mb-3">
                  Queue ({session.round.buzzQueue.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {session.round.buzzQueue.map((entry, index) => (
                      <motion.div
                        key={entry.playerId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-xl ${
                          index === 0 ? 'bg-white/10 border border-white/20' : 'bg-buzz-card'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span 
                            className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm"
                            style={{ 
                              backgroundColor: entry.teamColor || '#FF2D55',
                              color: 'white'
                            }}
                          >
                            {entry.position}
                          </span>
                          <div>
                            <p className="font-display font-semibold text-white">
                              {entry.playerName}
                            </p>
                            {entry.teamName && (
                              <p className="text-sm text-white/40">{entry.teamName}</p>
                            )}
                          </div>
                        </div>
                        {index > 0 && (
                          <button
                            onClick={() => skipPlayer(entry.playerId)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </section>

          {/* Teams Section */}
          {session.settings.teamModeEnabled && (
            <section className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-xl text-white">Teams</h2>
                <form onSubmit={handleAddTeam} className="flex gap-2">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Team name"
                    className="px-4 py-2 bg-buzz-darker border border-buzz-border rounded-lg text-white placeholder:text-white/30 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!newTeamName.trim()}
                    className="px-4 py-2 bg-buzz-blue text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {session.teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    players={session.players.filter(p => p.teamId === team.id)}
                    onUpdateScore={updateTeamScore}
                    onRemove={() => removeTeam(team.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Players & QR */}
        <div className="space-y-6">
          {/* QR Code & Join Link */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-xl text-white">Join Game</h2>
              <button
                onClick={() => setShowQR(!showQR)}
                className="text-sm text-white/40 hover:text-white"
              >
                {showQR ? 'Hide QR' : 'Show QR'}
              </button>
            </div>
            
            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="bg-white p-4 rounded-2xl mb-4">
                    <QRCodeSVG
                      value={joinUrl}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center">
              <p className="text-sm text-white/40 mb-2">Game Code</p>
              <p className="font-mono font-bold text-4xl text-white tracking-widest">
                {session.id}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(joinUrl)}
                className="mt-4 text-sm text-buzz-blue hover:underline"
              >
                Copy Link
              </button>
            </div>
          </section>

          {/* Players List */}
          <section className="card p-6">
            <h2 className="font-display font-bold text-xl text-white mb-4">
              Players ({session.players.length})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {session.players.length === 0 ? (
                <p className="text-white/40 text-center py-8">
                  Waiting for players...
                </p>
              ) : (
                session.players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    team={session.teams.find(t => t.id === player.teamId)}
                    teams={session.teams}
                    onAssignTeam={(teamId) => assignPlayerToTeam(player.id, teamId)}
                    onKick={() => kickPlayer(player.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="card p-6"
              >
                <h2 className="font-display font-bold text-xl text-white mb-4">Settings</h2>
                <div className="space-y-4">
                  <ToggleSetting
                    label="Team Mode"
                    description="Enable teams for group play"
                    checked={session.settings.teamModeEnabled}
                    onChange={(checked) => updateSettings({ teamModeEnabled: checked })}
                  />
                  <ToggleSetting
                    label="One buzz per team"
                    description="Only one player from each team can buzz"
                    checked={session.settings.oneBuzzPerTeam}
                    onChange={(checked) => updateSettings({ oneBuzzPerTeam: checked })}
                    disabled={!session.settings.teamModeEnabled}
                  />
                  <ToggleSetting
                    label="Allow late buzzes"
                    description="Queue buzzes after first buzz locks"
                    checked={session.settings.allowLateBuzzes}
                    onChange={(checked) => updateSettings({ allowLateBuzzes: checked })}
                  />
                  <ToggleSetting
                    label="Show queue to players"
                    description="Players can see their position"
                    checked={session.settings.showQueueToPlayers}
                    onChange={(checked) => updateSettings({ showQueueToPlayers: checked })}
                  />
                </div>
                <div className="border-t border-buzz-border mt-6 pt-6">
                  <button
                    onClick={handleEndSession}
                    className="w-full py-3 bg-red-500/20 text-red-400 font-semibold rounded-xl hover:bg-red-500/30 transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

// ============================================
// Sub-components
// ============================================

function TeamCard({
  team,
  players,
  onUpdateScore,
  onRemove,
}: {
  team: Team;
  players: Player[];
  onUpdateScore: (teamId: string, delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        backgroundColor: `${team.color}10`,
        borderColor: `${team.color}40`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <span className="font-display font-semibold text-white">{team.name}</span>
        </div>
        <button
          onClick={onRemove}
          className="text-white/30 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateScore(team.id, -1)}
            className="w-8 h-8 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            -
          </button>
          <span className="font-mono font-bold text-2xl text-white w-12 text-center">
            {team.score}
          </span>
          <button
            onClick={() => onUpdateScore(team.id, 1)}
            className="w-8 h-8 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-sm text-white/40">
          {players.length} player{players.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  team,
  teams,
  onAssignTeam,
  onKick,
}: {
  player: Player;
  team?: Team;
  teams: Team[];
  onAssignTeam: (teamId: string) => void;
  onKick: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-buzz-darker rounded-xl group">
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{
            backgroundColor: player.isConnected ? '#34C759' : '#FF9500',
          }}
        />
        <span className="font-display text-white">{player.displayName}</span>
        {team && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${team.color}30`,
              color: team.color,
            }}
          >
            {team.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {teams.length > 0 && (
          <select
            value={player.teamId || ''}
            onChange={(e) => onAssignTeam(e.target.value)}
            className="px-2 py-1 bg-buzz-card border border-buzz-border rounded text-sm text-white"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={onKick}
          className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <span className="text-white/90 font-medium">{label}</span>
        {description && (
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-buzz-red focus-visible:ring-offset-2 focus-visible:ring-offset-buzz-darker ${
          checked ? 'bg-buzz-green' : 'bg-buzz-border'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

