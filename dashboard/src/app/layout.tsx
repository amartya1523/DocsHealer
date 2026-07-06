import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocsHealer — AI Documentation Intelligence Platform',
  description: 'Automatically keeps documentation synchronized with your code using AST parsing, semantic embeddings, and LLM verification.',
  keywords: ['documentation', 'AI', 'GitHub', 'LLM', 'developer tools', 'automation'],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
