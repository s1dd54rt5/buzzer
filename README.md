# 🔔 Buzzer - Real-Time Party Quiz Game

A production-grade, real-time multiplayer buzzer web application for house parties, quizzes, and casual games.

## Features

- **Real-time buzzing** with server-authoritative ordering
- **Mobile-first player experience** with large, responsive buzz button
- **Host dashboard** for controlling rounds, viewing queue, and managing players
- **Team support** with scoring and color-coded players
- **QR code join** for easy mobile access
- **Reconnection handling** for dropped connections
- **Rate limiting** and abuse prevention

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Socket.IO (WebSockets)
- **State Management**: Server-side authoritative state

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
├─────────────────┬───────────────────────────────────────────┤
│   Host Browser  │           Player Browsers (Mobile)         │
│   (Desktop/TV)  │                                           │
└────────┬────────┴─────────────────┬─────────────────────────┘
         │                          │
         │      WebSocket           │
         │      (Socket.IO)         │
         ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     NODE.JS SERVER                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Next.js SSR    │    │     Socket.IO Server            │ │
│  │  (Pages/API)    │    │     (Real-time Events)          │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Game State Manager                          ││
│  │  - Session management                                    ││
│  │  - Player tracking                                       ││
│  │  - Buzz ordering (server timestamps)                     ││
│  │  - Round lifecycle                                       ││
│  │  - Team & score management                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Event Flow

### Join Flow
1. Host creates session → receives session ID
2. Players scan QR or enter code
3. Players enter display name
4. Server validates and adds to session
5. All clients receive player update

### Buzz Flow
1. Host starts round → buzzer opens
2. Player taps BUZZ button
3. Server receives buzz with server-side timestamp
4. First buzz locks the buzzer
5. All clients receive buzz notification
6. Host evaluates: Correct (end round) or Pass (next in queue)

## API Reference

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `host:create` | `{ settings }` | Create new game session |
| `player:join` | `{ sessionId, displayName }` | Join existing session |
| `player:rejoin` | `{ sessionId, playerId }` | Reconnect to session |
| `player:buzz` | - | Send buzz (rate-limited) |
| `host:startRound` | - | Open buzzer for new round |
| `host:markCorrect` | - | End round, award point |
| `host:markPass` | - | Advance to next in queue |
| `host:resetRound` | - | Clear queue, close buzzer |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `{ sessionId, session }` | Session created successfully |
| `session:joined` | `{ playerId, session }` | Player joined successfully |
| `round:started` | `{ round }` | Round opened |
| `round:buzzReceived` | `{ entry }` | New buzz in queue |
| `round:locked` | `{ activePlayerId, queue }` | First buzz received |
| `round:correct` | `{ playerId, teamId }` | Correct answer, round ended |
| `round:playerPassed` | `{ passedId, newActiveId }` | Active player passed |

## Deployment

### Environment Variables

```env
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=https://yourdomain.com
```

### Deploy to Vercel

> ⚠️ Note: Standard Vercel deployment won't work because Socket.IO requires a persistent server. Use one of these options:

1. **Vercel + separate WebSocket server** (Railway, Render, Fly.io)
2. **Full Node.js hosting** (Railway, Render, DigitalOcean App Platform)

### Deploy to Railway

```bash
# Railway auto-detects Node.js and runs the start script
railway up
```

### Deploy to Render

1. Create new Web Service
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Enable WebSocket support in settings

## Configuration

### Session Settings

```typescript
{
  teamModeEnabled: boolean,     // Enable team features
  oneBuzzPerTeam: boolean,      // Only one player per team can buzz
  allowLateBuzzes: boolean,     // Queue buzzes after lock
  showQueueToPlayers: boolean,  // Show queue on player screens
  maxPlayersPerSession: number, // Player limit (default: 50)
  buzzCooldownMs: number,       // Rate limit (default: 100ms)
}
```

## Browser Support

- Chrome 80+
- Safari 14+
- Firefox 75+
- Edge 80+
- iOS Safari 14+
- Android Chrome 80+

## Security Considerations

- All buzz ordering is server-authoritative
- Rate limiting prevents spam
- Session IDs are short-lived
- Host actions require socket ownership verification
- No sensitive data stored client-side

## Adding Custom Sounds

Replace `public/buzz.mp3` with your preferred buzz sound effect. Recommended: short (< 0.5s), punchy sound.

## License

MIT

