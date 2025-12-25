import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buzzer - House Party Quiz Game',
  description: 'Real-time multiplayer buzzer for house parties, quizzes, and casual games. Create a game, share the link, and buzz in!',
  keywords: ['buzzer', 'quiz', 'party game', 'trivia', 'multiplayer'],
  authors: [{ name: 'Buzzer' }],
  openGraph: {
    title: 'Buzzer - House Party Quiz Game',
    description: 'Real-time multiplayer buzzer for parties and quizzes',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="noise-overlay">
        {children}
      </body>
    </html>
  );
}

