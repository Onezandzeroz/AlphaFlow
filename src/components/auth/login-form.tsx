'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRight, Shield, Lock, Zap } from 'lucide-react';
import { User } from '@/lib/auth-store';
import { useTranslation } from '@/lib/use-translation';

interface LoginFormProps {
  onSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || t('loginFailed'));
          return;
        }

        onSuccess(data.user);
      } catch {
        setError(t('anErrorOccurred'));
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, onSuccess, t]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50/80 rounded-xl border border-red-200/60">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-700 dark:text-gray-200 text-sm font-medium">
          {t('email')}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="pl-10 login-input-teal h-11 bg-white/60 transition-all duration-200"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700 dark:text-gray-200 text-sm font-medium">
          {t('password')}
        </Label>
        <div className="relative">
          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="pl-10 login-input-teal h-11 bg-white/60 transition-all duration-200"
          />
        </div>
      </div>

      {/* Remember me checkbox */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            className="h-4 w-4 rounded-[4px] data-[state=checked]:bg-[#0d9488] data-[state=checked]:border-[#0d9488] shrink-0"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors select-none">
            {'Husk mig'}
          </span>
        </label>
        <button
          type="button"
          className="text-sm text-[#0d9488] hover:text-[#0f766e] font-medium transition-colors"
        >
          {'Glemt adgangskode?'}
        </button>
      </div>

      <Button
        type="submit"
        className="w-full h-11 btn-primary text-white font-medium text-sm"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('signingIn')}
          </>
        ) : (
          <>
            {t('signIn')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50/60 dark:bg-white/5 px-2.5 py-1 rounded-full border border-gray-200/40 dark:border-gray-700">
          <Shield className="h-3 w-3 text-[#0d9488]" />
          <span>GDPR-kompatibel</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50/60 dark:bg-white/5 px-2.5 py-1 rounded-full border border-gray-200/40 dark:border-gray-700">
          <Lock className="h-3 w-3 text-[#0d9488]" />
          <span>SSL-krypteret</span>
        </div>
      </div>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200/60"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="px-2 text-gray-400 dark:text-gray-500 bg-transparent">
            {t('or')}
          </span>
        </div>
      </div>
      <p className="text-sm text-center text-gray-600 dark:text-gray-300">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-[#0d9488] hover:text-[#0f766e] font-medium transition-colors"
        >
          {t('createOne')}
        </button>
      </p>
    </form>
  );
}
