'use client';

import { useState, useCallback } from 'react';
import { useLanguageStore } from '@/lib/language-store';
import { useTranslation } from '@/lib/use-translation';
import { TransactionsPage } from '@/components/transactions/transactions-page';
import { RecurringEntriesPage } from '@/components/recurring-entries/recurring-entries-page';
import { PageHeader } from '@/components/shared/page-header';
import { AddTransactionForm } from '@/components/transaction/add-transaction-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Receipt, RefreshCw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosteringerPageProps {
  user: any; // User type from auth-store
  defaultTab?: 'transactions' | 'recurring';
}

export function PosteringerPage({ user, defaultTab = 'transactions' }: PosteringerPageProps) {
  const { language } = useLanguageStore();
  const { t } = useTranslation();
  const isDa = language === 'da';
  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring'>(defaultTab);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [recurringTrigger, setRecurringTrigger] = useState(0);

  const handleAddTransaction = useCallback(() => {
    setIsTransactionDialogOpen(false);
  }, []);

  const handleOpenRecurringDialog = useCallback(() => {
    setRecurringTrigger((prev) => prev + 1);
  }, []);

  const tabs = [
    {
      id: 'transactions' as const,
      labelDa: 'Alle posteringer',
      labelEn: 'All Transactions',
      icon: Receipt,
    },
    {
      id: 'recurring' as const,
      labelDa: 'Gentagende posteringer',
      labelEn: 'Recurring Entries',
      icon: RefreshCw,
    },
  ];

  return (
    <div className="space-y-0">
      {/* Unified PageHeader with stacked action buttons */}
      <div className="p-4 lg:p-8 pb-0 lg:pb-0">
        <PageHeader
          title={isDa ? 'Posteringer' : 'Transactions'}
          description={isDa
            ? 'Håndter og spore alle dine posteringer'
            : 'Manage and track all your transactions'}
          action={
            <div className="flex flex-col items-end gap-1.5">
              <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                <Button
                  onClick={() => setIsTransactionDialogOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm gap-2 font-medium transition-all"
                >
                  <Plus className="h-4 w-4" />
                  {isDa ? 'Tilføj postering' : 'Add Transaction'}
                </Button>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1a1f1e]">
                  <DialogHeader>
                    <DialogTitle className="dark:text-white flex items-center gap-2">
                      <Plus className="h-5 w-5 text-[#2dd4bf]" />
                      {t('addTransaction')}
                    </DialogTitle>
                    <DialogDescription className="dark:text-gray-400">{t('recordNewTransaction')}</DialogDescription>
                  </DialogHeader>
                  <AddTransactionForm onSuccess={handleAddTransaction} />
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenRecurringDialog}
                className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 text-xs font-medium transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isDa ? 'Tilføj gentagende' : 'Add Recurring'}
              </Button>
            </div>
          }
        />
      </div>

      {/* Tab bar */}
      <div className="px-4 lg:px-8">
        <div className="flex items-center gap-1 border-b border-[#e2e8e6] dark:border-[#2a3330]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 -mb-px',
                  isActive
                    ? 'border-[#0d9488] text-[#0d9488] dark:border-[#2dd4bf] dark:text-[#2dd4bf]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="h-4 w-4" />
                {isDa ? tab.labelDa : tab.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — hideHeader since PosteringerPage owns the header */}
      <div className="mt-4">
        {activeTab === 'transactions' ? (
          <TransactionsPage user={user} hideHeader />
        ) : (
          <RecurringEntriesPage user={user} hideHeader triggerCreate={recurringTrigger} />
        )}
      </div>
    </div>
  );
}
