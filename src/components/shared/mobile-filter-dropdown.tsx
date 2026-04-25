'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SlidersHorizontal, X } from 'lucide-react';

interface MobileFilterDropdownProps {
  children: React.ReactNode;
  activeFilterCount: number;
  language?: string;
  onClearFilters?: () => void;
  clearLabel?: string;
}

export function MobileFilterDropdown({
  children,
  activeFilterCount,
  language = 'da',
  onClearFilters,
  clearLabel,
}: MobileFilterDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: render children directly in a flex row */}
      <div className="hidden lg:flex lg:items-center lg:gap-2 lg:flex-1 lg:flex-wrap">
        {children}
      </div>

      {/* Mobile: compact filter button that opens a popover */}
      <div className="flex items-center gap-2 lg:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 h-9 border-gray-200 dark:border-gray-700 shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/30 dark:bg-[#0d9488]/20 dark:text-[#2dd4bf] dark:border-[#0d9488]/30'
                  : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {language === 'da' ? 'Filtre' : 'Filters'}
              {activeFilterCount > 0 && (
                <Badge className="h-5 min-w-[20px] px-1.5 bg-[#0d9488] text-white text-[11px] rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[280px] p-4 bg-white dark:bg-[#1a1f1e] border-gray-200 dark:border-gray-700 rounded-xl"
            align="start"
          >
            <div className="space-y-3">
              {children}
              {onClearFilters && activeFilterCount > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClearFilters();
                      setOpen(false);
                    }}
                    className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 gap-2"
                  >
                    <X className="h-4 w-4" />
                    {clearLabel || (language === 'da' ? 'Ryd alle filtre' : 'Clear all filters')}
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
