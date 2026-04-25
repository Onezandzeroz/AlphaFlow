'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── Context to share install state across components ─────────────────────

interface PwaContextValue {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  showInstall: boolean;
  handleInstall: () => Promise<void>;
  dismiss: () => void;
}

const PwaContext = createContext<PwaContextValue>({
  deferredPrompt: null,
  isInstalled: false,
  showInstall: false,
  handleInstall: async () => {},
  dismiss: () => {},
});

export function usePwaInstall() {
  return useContext(PwaContext);
}

// ─── Provider: registers SW & listens for install prompt ──────────────────

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          // Service worker registered successfully
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    }

    // If already installed, skip event listeners
    if (isInstalled) return;

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setDismissed(true);
  };

  const showInstall =
    !isInstalled && !!deferredPrompt && !dismissed;

  return (
    <PwaContext.Provider
      value={{ deferredPrompt, isInstalled, showInstall, handleInstall, dismiss }}
    >
      {children}
    </PwaContext.Provider>
  );
}

// ─── Banner shown at top of login page ────────────────────────────────────

export function PwaInstallBanner() {
  const { showInstall, handleInstall, dismiss } = usePwaInstall();

  if (!showInstall) return null;

  return (
    <div className="relative w-full mb-4 rounded-xl bg-gradient-to-r from-[#0d9488]/10 to-[#2dd4bf]/10 border border-[#0d9488]/20 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
      <div className="h-9 w-9 rounded-lg bg-[#0d9488]/15 flex items-center justify-center shrink-0">
        <Smartphone className="h-4.5 w-4.5 text-[#0d9488]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          Installer AlphaAi som app
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Få hurtig adgang direkte fra din hjemmeskærm
        </p>
      </div>
      <Button
        onClick={handleInstall}
        size="sm"
        className="shrink-0 bg-[#0d9488] hover:bg-[#0f766e] text-white gap-1.5 text-xs font-medium h-8"
      >
        <Download className="h-3.5 w-3.5" />
        Installer
      </Button>
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Luk"
      >
        <X className="h-3.5 w-3.5 text-gray-400" />
      </button>
    </div>
  );
}
