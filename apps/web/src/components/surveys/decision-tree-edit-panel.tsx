'use client'

/**
 * Hotfix PRD §3.4 — per-step content editor panel.
 *
 * Renders on the right side of the decision-tree editor when the owner
 * clicks a step box. Each step type gets a tailored set of fields;
 * structural metadata (metric pick, branch op direction, redirect
 * platform on s3_positive) is read-only since those are wizard-locked
 * per PRD §3.5 ("Owner CANNOT add: new metric ask, new branch, new
 * redirect, multiple ends").
 *
 * Vocabulary: STEP_TYPE_LABELS for headers, Positive/Negative
 * everywhere customers/owners would see it.
 *
 * The panel is "draft mode" — it edits a local copy of the step's
 * config and calls onChange when the owner blurs a field. The parent
 * editor accumulates draft changes and persists via survey.update on
 * the global Save button.
 */

import type {
  SurveyStep,
  AskMetricStep,
  AskQuestionStep,
  BranchByScoreStep,
  ShowMessageStep,
  CollectContactStep,
  RedirectStep,
  EndJourneyStep,
} from '@rectangled/shared'
import { getStepTypeLabel } from '@rectangled/shared'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DecisionTreeEditPanelProps {
  step: SurveyStep
  onChange: (next: SurveyStep) => void
  /** Coupon templates available in the workspace (for end_journey.issueCoupon). */
  couponTemplates?: Array<{ id: string; name: string; isActive: boolean }>
  /** When true, show a Delete button. Structural steps aren't deletable. */
  canDelete: boolean
  onDelete: () => void
}

export function DecisionTreeEditPanel({
  step,
  onChange,
  couponTemplates,
  canDelete,
  onDelete,
}: DecisionTreeEditPanelProps) {
  const label = getStepTypeLabel(step.type)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span aria-hidden>{label.icon}</span>
          <span>Step</span>
        </div>
        <h3 className="mt-1 text-base font-semibold">{label.label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{label.description}</p>
        <code className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]">
          {step.id}
        </code>
      </div>

      {/* Body — type-specific fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step.type === 'ask_metric' && (
          <AskMetricEditor step={step} onChange={onChange} />
        )}
        {step.type === 'ask_question' && (
          <AskQuestionEditor step={step} onChange={onChange} />
        )}
        {step.type === 'branch_by_score' && (
          <BranchByScoreEditor step={step} onChange={onChange} />
        )}
        {step.type === 'show_message' && (
          <ShowMessageEditor step={step} onChange={onChange} />
        )}
        {step.type === 'collect_contact' && (
          <CollectContactEditor step={step} onChange={onChange} />
        )}
        {step.type === 'redirect' && (
          <RedirectEditor step={step} onChange={onChange} />
        )}
        {step.type === 'end_journey' && (
          <EndJourneyEditor
            step={step}
            onChange={onChange}
            couponTemplates={couponTemplates}
          />
        )}
      </div>

      {/* Footer — delete (only for non-structural steps) */}
      {canDelete && (
        <div className="border-t p-4">
          <Button variant="outline" className="w-full" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete this step
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Per-type editors ───────────────────────────────────────────────────

function AskMetricEditor({
  step,
  onChange,
}: {
  step: AskMetricStep
  onChange: (next: AskMetricStep) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Question text</Label>
        <Textarea
          rows={2}
          value={step.config.question}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, question: e.target.value },
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Metric</Label>
        <Input
          value={
            step.config.metric === 'random'
              ? 'Random (per visit)'
              : step.config.metric.toUpperCase()
          }
          disabled
        />
        <p className="text-[11px] text-muted-foreground">
          Set by the wizard. To change the metric, create a new journey.
        </p>
      </div>
    </>
  )
}

function AskQuestionEditor({
  step,
  onChange,
}: {
  step: AskQuestionStep
  onChange: (next: AskQuestionStep) => void
}) {
  const isMultiSelect = step.config.fieldType === 'multi_select' || step.config.fieldType === 'select'
  return (
    <>
      <div className="space-y-1.5">
        <Label>Question text</Label>
        <Textarea
          rows={2}
          value={step.config.question}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, question: e.target.value },
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Field type</Label>
        <Input value={step.config.fieldType} disabled />
      </div>
      {isMultiSelect && (
        <div className="space-y-1.5">
          <Label>Options (comma-separated)</Label>
          <Input
            value={(step.config.options ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...step,
                config: {
                  ...step.config,
                  options: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="Service, Quality, Wait time"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={step.config.required ?? false}
          onCheckedChange={(v) =>
            onChange({
              ...step,
              config: { ...step.config, required: !!v },
            })
          }
        />
        <Label className="text-xs">Customer must answer</Label>
      </div>
    </>
  )
}

function BranchByScoreEditor({
  step,
  onChange,
}: {
  step: BranchByScoreStep
  onChange: (next: BranchByScoreStep) => void
}) {
  // Wizard-generated branches have exactly one entry (the positive
  // condition) plus a default fallback. Owner edits the threshold
  // value; op direction is wizard-locked (gte/lte chosen at wizard
  // time based on inverted-metric semantics).
  const firstBranch = step.config.branches[0]
  const op = firstBranch?.condition.op ?? 'gte'
  const value = firstBranch?.condition.value
  const numericValue = typeof value === 'number' ? value : 0

  return (
    <>
      <div className="space-y-1.5">
        <Label>Threshold for positive</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Score {op === 'gte' ? '≥' : op === 'lte' ? '≤' : op}
          </span>
          <Input
            type="number"
            className="w-24"
            value={numericValue}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n) || !firstBranch) return
              onChange({
                ...step,
                config: {
                  ...step.config,
                  branches: [
                    {
                      ...firstBranch,
                      condition: { ...firstBranch.condition, value: n },
                    },
                    ...step.config.branches.slice(1),
                  ],
                },
              })
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {op === 'lte'
            ? 'CES is inverted — a score at or below the threshold counts as positive.'
            : 'A score at or above the threshold counts as positive.'}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        Branching structure is wizard-locked. To change, create a new journey.
      </div>
    </>
  )
}

function ShowMessageEditor({
  step,
  onChange,
}: {
  step: ShowMessageStep
  onChange: (next: ShowMessageStep) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Title (optional)</Label>
        <Input
          value={step.config.title ?? ''}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, title: e.target.value || undefined },
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Body</Label>
        <Textarea
          rows={4}
          value={step.config.body}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, body: e.target.value },
            })
          }
        />
      </div>
    </>
  )
}

function CollectContactEditor({
  step,
  onChange,
}: {
  step: CollectContactStep
  onChange: (next: CollectContactStep) => void
}) {
  function setFieldRequired(key: 'name' | 'phone' | 'email', required: boolean) {
    const exists = step.config.fields.some((f) => f.key === key)
    const fields = exists
      ? step.config.fields.map((f) => (f.key === key ? { ...f, required } : f))
      : [...step.config.fields, { key, required }]
    onChange({ ...step, config: { ...step.config, fields } })
  }
  function setFieldEnabled(key: 'name' | 'phone' | 'email', enabled: boolean) {
    const fields = enabled
      ? step.config.fields.some((f) => f.key === key)
        ? step.config.fields
        : [...step.config.fields, { key, required: false }]
      : step.config.fields.filter((f) => f.key !== key)
    onChange({ ...step, config: { ...step.config, fields } })
  }
  const get = (key: 'name' | 'phone' | 'email') =>
    step.config.fields.find((f) => f.key === key)

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Pick which fields the customer sees. Each can be marked required.
      </p>
      {(['name', 'phone', 'email'] as const).map((key) => {
        const f = get(key)
        const enabled = !!f
        return (
          <div key={key} className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={enabled}
                onCheckedChange={(v) => setFieldEnabled(key, !!v)}
              />
              <Label className="text-sm capitalize">{key}</Label>
            </div>
            {enabled && (
              <div className="ml-7 mt-2 flex items-center gap-2">
                <Checkbox
                  checked={f?.required ?? false}
                  onCheckedChange={(v) => setFieldRequired(key, !!v)}
                />
                <Label className="text-xs">Required</Label>
              </div>
            )}
          </div>
        )
      })}
      <div className="space-y-1.5">
        <Label>Privacy note (optional)</Label>
        <Textarea
          rows={2}
          value={step.config.privacyNote ?? ''}
          onChange={(e) =>
            onChange({
              ...step,
              config: {
                ...step.config,
                privacyNote: e.target.value || undefined,
              },
            })
          }
        />
      </div>
    </>
  )
}

function RedirectEditor({
  step,
  onChange,
}: {
  step: RedirectStep
  onChange: (next: RedirectStep) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Platform</Label>
        <Select
          value={step.config.platform}
          onValueChange={(v) =>
            onChange({
              ...step,
              config: {
                ...step.config,
                platform: v as RedirectStep['config']['platform'],
              },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="zomato">Zomato</SelectItem>
            <SelectItem value="swiggy">Swiggy</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Review URL</Label>
        <Input
          value={step.config.url}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, url: e.target.value },
            })
          }
          placeholder="https://g.page/r/…"
        />
        {!step.config.url.trim() && (
          <p className="text-[11px] text-amber-700">
            URL is empty — customers tapping Yes will see nothing open.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Review template (auto-copied to clipboard)</Label>
        <Textarea
          rows={2}
          value={step.config.reviewTemplate}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, reviewTemplate: e.target.value },
            })
          }
        />
        <p className="text-[11px] text-muted-foreground">
          Use{' '}
          <code className="rounded bg-muted px-1">{'{businessName}'}</code> for
          the location/workspace name.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>"Yes" label</Label>
          <Input
            value={step.config.yesLabel}
            onChange={(e) =>
              onChange({
                ...step,
                config: { ...step.config, yesLabel: e.target.value },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>"No" label</Label>
          <Input
            value={step.config.noLabel}
            onChange={(e) =>
              onChange({
                ...step,
                config: { ...step.config, noLabel: e.target.value },
              })
            }
          />
        </div>
      </div>
    </>
  )
}

function EndJourneyEditor({
  step,
  onChange,
  couponTemplates,
}: {
  step: EndJourneyStep
  onChange: (next: EndJourneyStep) => void
  couponTemplates?: Array<{ id: string; name: string; isActive: boolean }>
}) {
  const activeTemplates = (couponTemplates ?? []).filter((t) => t.isActive)
  const couponEnabled = !!step.config.issueCoupon
  const couponTemplateId = step.config.issueCoupon?.templateId

  function setCouponEnabled(enabled: boolean) {
    if (enabled && activeTemplates.length === 0) return
    if (!enabled) {
      const { issueCoupon: _drop, ...rest } = step.config
      onChange({ ...step, config: rest })
      return
    }
    onChange({
      ...step,
      config: {
        ...step.config,
        issueCoupon: { templateId: activeTemplates[0]?.id ?? '' },
      },
    })
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>Thank-you message</Label>
        <Textarea
          rows={3}
          value={step.config.message}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, message: e.target.value },
            })
          }
        />
      </div>

      {/* Coupon controls only on the negative-terminal step. The positive
          terminals (s_end_positive_*) hide this UI by virtue of having
          no issueCoupon to begin with — but we still allow toggling
          here in case the owner wants a coupon on a non-default end. */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={couponEnabled}
            disabled={activeTemplates.length === 0}
            onCheckedChange={(v) => setCouponEnabled(!!v)}
          />
          <Label className="text-sm">Issue a recovery coupon</Label>
        </div>
        {activeTemplates.length === 0 && (
          <p className="ml-7 text-[11px] text-amber-700">
            Create a coupon template first (Settings → Coupons).
          </p>
        )}
        {couponEnabled && activeTemplates.length > 0 && (
          <div className="ml-7 space-y-1.5">
            <Label>Coupon template</Label>
            <Select
              value={couponTemplateId}
              onValueChange={(v) =>
                onChange({
                  ...step,
                  config: { ...step.config, issueCoupon: { templateId: v } },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick…" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </>
  )
}
