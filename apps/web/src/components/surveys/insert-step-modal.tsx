'use client'

/**
 * Hotfix PRD §3.5 — Insert step modal.
 *
 * Opens from a "+Insert step here" button on the decision-tree editor.
 * Three options per the PRD: Open Question, Info Screen, Contact Form.
 * Owner CANNOT insert: new metric ask, new branch, new redirect, or
 * multiple ends — that structure is locked by the wizard.
 *
 * Uses STEP_TYPE_LABELS for all owner-facing copy.
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { STEP_TYPE_LABELS } from '@rectangled/shared'
import type { SurveyStepType } from '@rectangled/shared'
import { cn } from '@/lib/utils'

const INSERTABLE_TYPES: SurveyStepType[] = [
  'ask_question',
  'show_message',
  'collect_contact',
]

interface InsertStepModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: SurveyStepType) => void
}

export function InsertStepModal({ open, onOpenChange, onPick }: InsertStepModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert a step here</DialogTitle>
          <DialogDescription>
            Pick the kind of step to add. The structure of the journey
            (rating, branching, review redirect, terminal) stays locked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {INSERTABLE_TYPES.map((type) => {
            const meta = STEP_TYPE_LABELS[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onPick(type)
                  onOpenChange(false)
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border p-3 text-left',
                  'cursor-pointer transition hover:border-primary hover:bg-primary/5',
                )}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
