'use client'

import { Sparkles, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  onGenerateResponses: () => void
  onClearSelection: () => void
  isGenerating: boolean
}

export function BulkActionBar({
  selectedCount,
  onGenerateResponses,
  onClearSelection,
  isGenerating,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} review{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <Button
          onClick={onGenerateResponses}
          disabled={isGenerating}
          size="sm"
          className="bg-[#5E50A0] hover:bg-[#5E50A0]/90 text-white"
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isGenerating ? 'Generating...' : 'Generate AI Responses'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isGenerating}
        >
          <X className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}
