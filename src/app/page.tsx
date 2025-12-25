'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const handleHost = () => {
    router.push('/host');
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length >= 4) {
      router.push(`/play/${joinCode.toUpperCase().trim()}`);
    }
  };

  return (
    <main className="min-h-screen bg-buzz-darker bg-grid bg-radial flex flex-col items-center justify-center p-6">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-buzz-red/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-buzz-orange/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-xl w-full"
      >
        {/* Logo / Title */}
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8"
        >
          <h1 className="text-6xl sm:text-7xl font-display font-extrabold text-gradient mb-4">
            BUZZER
          </h1>
          <p className="text-xl text-white/60 font-body">
            Real-time quiz buzzer for house parties
          </p>
        </motion.div>

        {/* Bell Icon Animation */}
        <motion.div
          className="text-8xl mb-12"
          animate={{ 
            rotate: [0, -10, 10, -10, 10, 0],
          }}
          transition={{ 
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        >
          🔔
        </motion.div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleHost}
            className="w-full py-5 px-8 bg-gradient-to-r from-buzz-red to-buzz-orange text-white font-display font-bold text-xl rounded-2xl shadow-buzz transition-all hover:shadow-buzz-active"
          >
            HOST A GAME
          </motion.button>

          {!showJoinForm ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowJoinForm(true)}
              className="w-full py-5 px-8 bg-buzz-card border border-buzz-border text-white font-display font-bold text-xl rounded-2xl transition-all hover:border-white/30"
            >
              JOIN A GAME
            </motion.button>
          ) : (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleJoin}
              className="space-y-3"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter game code"
                maxLength={6}
                autoFocus
                className="w-full py-5 px-6 bg-buzz-card border border-buzz-border text-white text-center font-mono text-2xl tracking-widest rounded-2xl placeholder:text-white/30 focus:border-buzz-red transition-colors"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinForm(false)}
                  className="flex-1 py-4 px-6 bg-buzz-card border border-buzz-border text-white/60 font-display font-semibold rounded-xl hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinCode.length < 4}
                  className="flex-1 py-4 px-6 bg-buzz-green text-white font-display font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  Join
                </button>
              </div>
            </motion.form>
          )}
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16 grid grid-cols-3 gap-4 text-center"
        >
          <div className="p-4">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm text-white/40 font-body">Real-time</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm text-white/40 font-body">50 players</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">📱</div>
            <div className="text-sm text-white/40 font-body">Mobile ready</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-white/30 text-sm font-body">
        No app download needed • Works in any browser
      </footer>
    </main>
  );
}

