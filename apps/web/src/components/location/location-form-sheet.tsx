'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface LocationData {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  phone: string | null
  email: string | null
  isActive: boolean
  ownerName?: string | null
  // Hotfix §4 follow-up — per-location branding overrides for public
  // QR pages. All optional; empty/null means "fall back to workspace
  // defaults" (resolved server-side in branding.helper.ts).
  displayName?: string | null
  logoUrl?: string | null
  brandColor?: string | null
}

interface LocationFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location?: LocationData
}

interface FormState {
  name: string
  ownerName: string
  address: string
  city: string
  state: string
  country: string
  timezone: string
  phone: string
  email: string
  // Branding (Hotfix §4 follow-up)
  displayName: string
  logoUrl: string
  brandColor: string
}

/**
 * Phase 2 Stage G — service-level targets per location.
 *
 * Strings (not numbers) so the inputs can hold "" to mean "clear the target".
 * `setSlaTarget` interprets null as "clear", so empty string → null on save.
 */
interface SlaTargetState {
  reviewResponseSlaMinutes: string
  escalationResolveSlaMinutes: string
  journeyResponseTargetPerWeek: string
  npsTargetScore: string
  csatTargetPercent: string
}

const defaultFormState: FormState = {
  name: '',
  ownerName: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  timezone: 'Asia/Kolkata',
  phone: '',
  email: '',
  displayName: '',
  logoUrl: '',
  brandColor: '',
}

const DEFAULT_BRAND_COLOR_PLACEHOLDER = '#2D5BFF'

const defaultSlaState: SlaTargetState = {
  reviewResponseSlaMinutes: '',
  escalationResolveSlaMinutes: '',
  journeyResponseTargetPerWeek: '',
  npsTargetScore: '',
  csatTargetPercent: '',
}

/**
 * Convert the form's string value to the API shape:
 *   "" → null (clears the target)
 *   "42" → 42
 * Negative numbers and non-integers are caught by the server-side Zod
 * schema (`z.number().int().min(0)`).
 */
function parseSlaInput(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return undefined
  return Math.floor(n)
}

export function LocationFormSheet({
  open,
  onOpenChange,
  location,
}: LocationFormSheetProps) {
  const queryClient = useQueryClient()
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)

  const isEditMode = !!location

  const [form, setForm] = useState<FormState>(defaultFormState)
  const [sla, setSla] = useState<SlaTargetState>(defaultSlaState)

  // Phase 2 Stage G — fetch existing SLA targets for this location.
  // Only enabled in edit mode (requires a locationId).
  const slaQuery = trpc.location.getSlaTarget.useQuery(
    { locationId: location?.id ?? '' },
    { enabled: open && isEditMode && !!location?.id },
  )

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (open) {
      if (location) {
        setForm({
          name: location.name,
          ownerName: location.ownerName ?? '',
          address: location.address ?? '',
          city: location.city ?? '',
          state: location.state ?? '',
          country: location.country,
          timezone: location.timezone,
          phone: location.phone ?? '',
          email: location.email ?? '',
          displayName: location.displayName ?? '',
          logoUrl: location.logoUrl ?? '',
          brandColor: location.brandColor ?? '',
        })
      } else {
        setForm(defaultFormState)
        setSla(defaultSlaState)
      }
    }
  }, [open, location])

  // Populate SLA inputs once the query resolves. Server returns null for
  // never-set targets, which we render as empty strings.
  useEffect(() => {
    if (open && isEditMode && slaQuery.data) {
      const t = slaQuery.data as {
        reviewResponseSlaMinutes: number | null
        escalationResolveSlaMinutes: number | null
        journeyResponseTargetPerWeek: number | null
        npsTargetScore: number | null
        csatTargetPercent: number | null
      } | null
      setSla({
        reviewResponseSlaMinutes:
          t?.reviewResponseSlaMinutes != null ? String(t.reviewResponseSlaMinutes) : '',
        escalationResolveSlaMinutes:
          t?.escalationResolveSlaMinutes != null ? String(t.escalationResolveSlaMinutes) : '',
        journeyResponseTargetPerWeek:
          t?.journeyResponseTargetPerWeek != null ? String(t.journeyResponseTargetPerWeek) : '',
        npsTargetScore: t?.npsTargetScore != null ? String(t.npsTargetScore) : '',
        csatTargetPercent: t?.csatTargetPercent != null ? String(t.csatTargetPercent) : '',
      })
    }
    if (open && !isEditMode) {
      setSla(defaultSlaState)
    }
  }, [open, isEditMode, slaQuery.data])

  const createMutation = trpc.location.create.useMutation({
    onSuccess: () => {
      toast.success('Location created successfully')
      queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create location')
    },
  })

  const updateMutation = trpc.location.update.useMutation({
    // Toast + close are deferred to the combined save handler in edit mode
    // because we also need to wait for setSlaTarget to finish.
    onError: (error) => {
      toast.error(error.message || 'Failed to update location')
    },
  })

  const setSlaTargetMutation = trpc.location.setSlaTarget.useMutation({
    onError: (error) => {
      toast.error(error.message || 'Failed to save SLA targets')
    },
  })

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    setSlaTargetMutation.isPending

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateSlaField(field: keyof SlaTargetState, value: string) {
    // Allow only digits + empty string. Reject anything else silently —
    // these are integer minute / percent / count fields.
    if (value !== '' && !/^\d+$/.test(value)) return
    setSla((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Location name is required')
      return
    }

    if (isEditMode && location) {
      // Build the SLA payload only with fields the user actually touched
      // (anything left as undefined from parseSlaInput → drop).
      const slaPayload: Record<string, number | null> = {}
      const slaKeys = [
        'reviewResponseSlaMinutes',
        'escalationResolveSlaMinutes',
        'journeyResponseTargetPerWeek',
        'npsTargetScore',
        'csatTargetPercent',
      ] as const
      for (const k of slaKeys) {
        const parsed = parseSlaInput(sla[k])
        if (parsed !== undefined) slaPayload[k] = parsed
      }

      // Client-side bounds for the percent fields — server enforces too,
      // but a clean toast beats a 400 from Zod.
      if (
        slaPayload.npsTargetScore != null &&
        (slaPayload.npsTargetScore < 0 || slaPayload.npsTargetScore > 100)
      ) {
        toast.error('NPS target must be between 0 and 100')
        return
      }
      if (
        slaPayload.csatTargetPercent != null &&
        (slaPayload.csatTargetPercent < 0 || slaPayload.csatTargetPercent > 100)
      ) {
        toast.error('CSAT target must be between 0 and 100')
        return
      }

      try {
        await Promise.all([
          updateMutation.mutateAsync({
            id: location.id,
            name: form.name.trim(),
            ownerName: form.ownerName || undefined,
            address: form.address || undefined,
            city: form.city || undefined,
            state: form.state || undefined,
            country: form.country || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            timezone: form.timezone || undefined,
            // Hotfix §4 follow-up — pass branding fields. Empty string
            // is meaningful here (it clears the override server-side).
            displayName: form.displayName,
            logoUrl: form.logoUrl,
            brandColor: form.brandColor,
          }),
          setSlaTargetMutation.mutateAsync({
            locationId: location.id,
            ...slaPayload,
          }),
        ])
        toast.success('Location updated successfully')
        queryClient.invalidateQueries({ queryKey: [['location', 'list']] })
        queryClient.invalidateQueries({
          queryKey: [['location', 'getSlaTarget']],
        })
        onOpenChange(false)
      } catch {
        // Errors already toasted by individual mutation onError handlers.
      }
    } else {
      if (!currentWorkspaceId) {
        toast.error('No workspace selected')
        return
      }

      createMutation.mutate({
        workspaceId: currentWorkspaceId,
        name: form.name.trim(),
        ownerName: form.ownerName || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        timezone: form.timezone || undefined,
        // Hotfix §4 follow-up — branding overrides at create time.
        // Empty/whitespace → server stores null, renderer falls back to
        // workspace defaults.
        displayName: form.displayName || undefined,
        logoUrl: form.logoUrl || undefined,
        brandColor: form.brandColor || undefined,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Location' : 'Add Location'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the details of this location.'
              : 'Add a new location to your workspace.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4">
          {/* Name — required */}
          <div className="space-y-2">
            <Label htmlFor="location-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location-name"
              placeholder="e.g. Mumbai HQ"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Store Owner Name */}
          <div className="space-y-2">
            <Label htmlFor="location-owner">Store Owner Name</Label>
            <Input
              id="location-owner"
              placeholder="e.g. Rajesh Kumar"
              value={form.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="location-address">Address</Label>
            <Input
              id="location-address"
              placeholder="123 Business Park, Andheri East"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>

          {/* City — required */}
          <div className="space-y-2">
            <Label htmlFor="location-city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="location-city"
              placeholder="e.g. Mumbai"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              required
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="location-state">State</Label>
            <Input
              id="location-state"
              placeholder="e.g. Maharashtra"
              value={form.state}
              onChange={(e) => updateField('state', e.target.value)}
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="location-country">Country</Label>
            <Input
              id="location-country"
              placeholder="e.g. India"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="location-timezone">Timezone</Label>
            <Input
              id="location-timezone"
              placeholder="e.g. Asia/Kolkata"
              value={form.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="location-phone">Phone</Label>
            <Input
              id="location-phone"
              type="tel"
              placeholder="e.g. +91 22 1234 5678"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="location-email">Email</Label>
            <Input
              id="location-email"
              type="email"
              placeholder="e.g. mumbai@company.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>

          {/*
            Hotfix §4 follow-up — branding for the public QR pages.
            All three fields are optional; the server-side resolver
            falls back to workspace defaults (logo_url, brand_colors.
            primary) and then system defaults when these are blank.
            See branding.helper.ts for the full cascade.
          */}
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div>
              <h3 className="text-sm font-semibold">
                Branding (shown to customers)
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional. Leave blank to inherit your workspace logo,
                color, and name on the QR feedback page.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-display-name" className="text-xs font-normal">
                Display name
              </Label>
              <Input
                id="location-display-name"
                placeholder="e.g. Cafe Madras — Bandra"
                value={form.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown at the top of the public QR page. Defaults to{' '}
                <code className="rounded bg-background px-1">
                  Workspace — {form.name || 'Location'}
                </code>{' '}
                when blank.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-logo-url" className="text-xs font-normal">
                Logo URL
              </Label>
              <Input
                id="location-logo-url"
                type="url"
                inputMode="url"
                placeholder="https://cdn.example.com/logo.png"
                value={form.logoUrl}
                onChange={(e) => updateField('logoUrl', e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Public image URL (https). Square images render best.
                File upload coming soon — for now, host via your own
                CDN or any public link.
              </p>
              {form.logoUrl && /^https?:\/\//.test(form.logoUrl) && (
                <div className="mt-1 flex items-center gap-2">
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="size-12 rounded-md border bg-white object-contain p-0.5"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.opacity = '0.3'
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Preview
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-brand-color" className="text-xs font-normal">
                Brand color
              </Label>
              <div className="flex items-center gap-2">
                {/* Native color picker — paired with the hex text input
                    so power users can paste exact values from a brand
                    guide without fighting the picker. */}
                <input
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded border bg-background"
                  aria-label="Brand color picker"
                  value={
                    form.brandColor && /^#[0-9a-fA-F]{6}$/.test(form.brandColor)
                      ? form.brandColor
                      : DEFAULT_BRAND_COLOR_PLACEHOLDER
                  }
                  onChange={(e) => updateField('brandColor', e.target.value)}
                />
                <Input
                  id="location-brand-color"
                  placeholder={DEFAULT_BRAND_COLOR_PLACEHOLDER}
                  value={form.brandColor}
                  onChange={(e) => updateField('brandColor', e.target.value)}
                  className="flex-1 font-mono uppercase"
                  maxLength={7}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                6-digit hex (e.g. <code className="rounded bg-background px-1">#2D5BFF</code>).
                Used as the QR page header background.
              </p>
            </div>
          </div>

          {/*
            Phase 2 Stage G — service-level targets.
            Edit-mode only (needs an existing location id). Empty inputs
            mean "no target set" — the server clears them via null.
          */}
          {isEditMode && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Service-level targets
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Optional targets used by the chain dashboard to flag
                  underperforming locations. Leave blank to clear.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="sla-review-response"
                    className="text-xs font-normal"
                  >
                    Review response SLA
                    <span className="ml-1 text-muted-foreground">(min)</span>
                  </Label>
                  <Input
                    id="sla-review-response"
                    inputMode="numeric"
                    placeholder="e.g. 60"
                    value={sla.reviewResponseSlaMinutes}
                    onChange={(e) =>
                      updateSlaField('reviewResponseSlaMinutes', e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="sla-escalation-resolve"
                    className="text-xs font-normal"
                  >
                    Escalation resolve SLA
                    <span className="ml-1 text-muted-foreground">(min)</span>
                  </Label>
                  <Input
                    id="sla-escalation-resolve"
                    inputMode="numeric"
                    placeholder="e.g. 240"
                    value={sla.escalationResolveSlaMinutes}
                    onChange={(e) =>
                      updateSlaField(
                        'escalationResolveSlaMinutes',
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="sla-journey-target"
                    className="text-xs font-normal"
                  >
                    Survey responses
                    <span className="ml-1 text-muted-foreground">(/week)</span>
                  </Label>
                  <Input
                    id="sla-journey-target"
                    inputMode="numeric"
                    placeholder="e.g. 30"
                    value={sla.journeyResponseTargetPerWeek}
                    onChange={(e) =>
                      updateSlaField(
                        'journeyResponseTargetPerWeek',
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sla-nps" className="text-xs font-normal">
                    NPS target
                    <span className="ml-1 text-muted-foreground">(0–100)</span>
                  </Label>
                  <Input
                    id="sla-nps"
                    inputMode="numeric"
                    placeholder="e.g. 50"
                    value={sla.npsTargetScore}
                    onChange={(e) =>
                      updateSlaField('npsTargetScore', e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sla-csat" className="text-xs font-normal">
                    CSAT target
                    <span className="ml-1 text-muted-foreground">(%)</span>
                  </Label>
                  <Input
                    id="sla-csat"
                    inputMode="numeric"
                    placeholder="e.g. 85"
                    value={sla.csatTargetPercent}
                    onChange={(e) =>
                      updateSlaField('csatTargetPercent', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="px-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? 'Saving...'
                  : 'Creating...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Location'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
