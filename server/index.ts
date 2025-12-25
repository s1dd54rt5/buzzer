import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { gameState } from './game-state';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionSettings,
  serializeSession,
} from '../shared/types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Type-safe socket
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : (dev ? '*' : process.env.ALLOWED_ORIGIN),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // ============================================
  // Socket.IO Connection Handler
  // ============================================

  io.on('connection', (socket: TypedSocket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ----------------------------------------
    // Host: Create Session
    // ----------------------------------------
    socket.on('host:create', (settings: Partial<SessionSettings>) => {
      const session = gameState.createSession(socket.id, settings);
      
      socket.join(`session:${session.id}`);
      socket.join(`host:${session.id}`);
      
      socket.emit('session:created', {
        sessionId: session.id,
        session: serializeSession(session),
      });
    });

    // ----------------------------------------
    // Host: Update Settings
    // ----------------------------------------
    socket.on('host:updateSettings', (settings: Partial<SessionSettings>) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) {
        socket.emit('session:error', { code: 'NOT_HOST', message: 'Not a host' });
        return;
      }

      const updated = gameState.updateSettings(session.id, settings);
      if (updated) {
        io.to(`session:${session.id}`).emit('session:updated', serializeSession(updated));
      }
    });

    // ----------------------------------------
    // Player: Join Session
    // ----------------------------------------
    socket.on('player:join', ({ sessionId, displayName }) => {
      const result = gameState.addPlayer(sessionId, socket.id, displayName);
      
      if ('error' in result) {
        socket.emit('session:error', { 
          code: 'JOIN_FAILED', 
          message: result.error 
        });
        return;
      }

      const { player, session } = result;
      
      socket.join(`session:${sessionId}`);
      socket.join(`player:${player.id}`);

      // Notify the joining player
      socket.emit('session:joined', {
        playerId: player.id,
        session: serializeSession(session),
      });

      // Notify everyone else
      socket.to(`session:${sessionId}`).emit('player:joined', player);
    });

    // ----------------------------------------
    // Player: Rejoin Session (Reconnect)
    // ----------------------------------------
    socket.on('player:rejoin', ({ sessionId, playerId }) => {
      const result = gameState.rejoinPlayer(sessionId, playerId, socket.id);
      
      if ('error' in result) {
        socket.emit('session:error', {
          code: 'REJOIN_FAILED',
          message: result.error,
        });
        return;
      }

      const { player, session } = result;
      
      socket.join(`session:${sessionId}`);
      socket.join(`player:${player.id}`);

      socket.emit('session:rejoined', {
        session: serializeSession(session),
      });

      // Notify others player is back
      socket.to(`session:${sessionId}`).emit('player:updated', player);
    });

    // ----------------------------------------
    // Player: Set Team
    // ----------------------------------------
    socket.on('player:setTeam', (teamId: string) => {
      const playerData = gameState.getPlayerBySocketId(socket.id);
      if (!playerData) return;

      const { player, session } = playerData;
      
      if (gameState.assignPlayerToTeam(session.id, player.id, teamId)) {
        const updatedPlayer = session.players.get(player.id);
        if (updatedPlayer) {
          io.to(`session:${session.id}`).emit('player:updated', updatedPlayer);
        }
      }
    });

    // ----------------------------------------
    // Player: Buzz
    // ----------------------------------------
    socket.on('player:buzz', () => {
      const result = gameState.processBuzz(socket.id);
      
      if (!result) return;
      
      if ('error' in result) {
        // Silently ignore - don't spam errors for rate-limited buzzes
        return;
      }

      const playerData = gameState.getPlayerBySocketId(socket.id);
      if (!playerData) return;

      const { session } = playerData;

      // Broadcast buzz to all in session
      io.to(`session:${session.id}`).emit('round:buzzReceived', result);

      // If this was the first buzz (locked the buzzer), notify
      if (result.position === 1) {
        io.to(`session:${session.id}`).emit('round:locked', {
          activePlayerId: result.playerId,
          queue: session.round.buzzQueue,
        });
      }
    });

    // ----------------------------------------
    // Host: Start Round
    // ----------------------------------------
    socket.on('host:startRound', () => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const round = gameState.startRound(session.id);
      if (round) {
        io.to(`session:${session.id}`).emit('round:started', round);
      }
    });

    // ----------------------------------------
    // Host: Mark Correct
    // ----------------------------------------
    socket.on('host:markCorrect', () => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const result = gameState.markCorrect(session.id);
      if (result) {
        io.to(`session:${session.id}`).emit('round:correct', {
          playerId: result.winnerId!,
          playerName: result.winnerName!,
          teamId: result.teamId,
        });
        
        // Also send updated session with new scores
        const updatedSession = gameState.getSerializedSession(session.id);
        if (updatedSession) {
          io.to(`session:${session.id}`).emit('session:updated', updatedSession);
        }
      }
    });

    // ----------------------------------------
    // Host: Mark Pass
    // ----------------------------------------
    socket.on('host:markPass', () => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const result = gameState.markPass(session.id);
      if (result) {
        io.to(`session:${session.id}`).emit('round:playerPassed', result);
      }
    });

    // ----------------------------------------
    // Host: Skip Player
    // ----------------------------------------
    socket.on('host:skipPlayer', (playerId: string) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      if (gameState.skipPlayer(session.id, playerId)) {
        const updatedSession = gameState.getSerializedSession(session.id);
        if (updatedSession) {
          io.to(`session:${session.id}`).emit('session:updated', updatedSession);
        }
      }
    });

    // ----------------------------------------
    // Host: Reset Round
    // ----------------------------------------
    socket.on('host:resetRound', () => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const round = gameState.resetRound(session.id);
      if (round) {
        io.to(`session:${session.id}`).emit('round:reset', round);
      }
    });

    // ----------------------------------------
    // Host: End Session
    // ----------------------------------------
    socket.on('host:endSession', () => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      io.to(`session:${session.id}`).emit('session:ended');
      gameState.endSession(session.id);
    });

    // ----------------------------------------
    // Host: Add Team
    // ----------------------------------------
    socket.on('host:addTeam', (name: string) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const team = gameState.addTeam(session.id, name);
      if (team) {
        io.to(`session:${session.id}`).emit('team:added', team);
      }
    });

    // ----------------------------------------
    // Host: Remove Team
    // ----------------------------------------
    socket.on('host:removeTeam', (teamId: string) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      if (gameState.removeTeam(session.id, teamId)) {
        io.to(`session:${session.id}`).emit('team:removed', teamId);
        
        // Send full update to refresh player team assignments
        const updatedSession = gameState.getSerializedSession(session.id);
        if (updatedSession) {
          io.to(`session:${session.id}`).emit('session:updated', updatedSession);
        }
      }
    });

    // ----------------------------------------
    // Host: Assign Player to Team
    // ----------------------------------------
    socket.on('host:assignPlayerToTeam', ({ playerId, teamId }) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      if (gameState.assignPlayerToTeam(session.id, playerId, teamId)) {
        const player = session.players.get(playerId);
        if (player) {
          io.to(`session:${session.id}`).emit('player:updated', player);
        }
      }
    });

    // ----------------------------------------
    // Host: Update Team Score
    // ----------------------------------------
    socket.on('host:updateTeamScore', ({ teamId, delta }) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const team = gameState.updateTeamScore(session.id, teamId, delta);
      if (team) {
        io.to(`session:${session.id}`).emit('team:scoreUpdated', {
          teamId: team.id,
          score: team.score,
        });
      }
    });

    // ----------------------------------------
    // Host: Kick Player
    // ----------------------------------------
    socket.on('host:kickPlayer', (playerId: string) => {
      const session = gameState.getSessionByHostSocket(socket.id);
      if (!session) return;

      const player = session.players.get(playerId);
      if (player) {
        // Notify the kicked player
        io.to(`player:${playerId}`).emit('player:kicked');
        
        // Remove from session
        gameState.removePlayer(session.id, playerId);
        
        // Notify others
        io.to(`session:${session.id}`).emit('player:left', playerId);
      }
    });

    // ----------------------------------------
    // Disconnect Handler
    // ----------------------------------------
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);

      // Check if this was a host
      const hostSession = gameState.getSessionByHostSocket(socket.id);
      if (hostSession) {
        // Don't end session immediately - host might reconnect
        // In production, you'd want a timeout here
        console.log(`[Socket] Host disconnected from session ${hostSession.id}`);
      }

      // Handle player disconnect
      const result = gameState.disconnectPlayer(socket.id);
      if (result) {
        io.to(`session:${result.session.id}`).emit('player:updated', result.player);
      }
    });
  });

  // ============================================
  // Periodic Cleanup
  // ============================================
  
  setInterval(() => {
    gameState.cleanupStaleSessions();
  }, 300000); // Every 5 minutes

  // ============================================
  // Start Server
  // ============================================

  httpServer.listen(port, () => {
    console.log(`
🔔 Buzzer Server Ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Local:   http://${hostname}:${port}
   Mode:    ${dev ? 'Development' : 'Production'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
});

