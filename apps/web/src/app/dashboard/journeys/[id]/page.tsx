'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  ExternalLink,
  Save,
  GripVertical,
  Eye,
  QrCode,
  Star,
  MessageSquare,
  ThumbsUp,
  Phone,
  Heart,
  CheckCircle2,
  Gauge,
  SmilePlus,
  BarChart3,
  Download,
  Zap,
  Power,
  Clock,
  ChevronRight,
  Settings2,
  X,
  GitBranch,
  Workflow,
  Diamond,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlatformIconBadge } from '@/components/ui/platform-icons'

// ─── Constants ───────────────────────────────────────────────────────────────

const SCREEN_TYPES = [
  { value: 'rating', label: 'Rating', icon: Star },
  { value: 'aspects', label: 'Aspects', icon: BarChart3 },
  { value: 'review_redirect', label: 'Review Redirect', icon: ExternalLink },
  { value: 'feedback', label: 'Feedback', icon: MessageSquare },
  { value: 'contact_collection', label: 'Contact Collection', icon: Phone },
  { value: 'thank_you', label: 'Thank You', icon: Heart },
  { value: 'nps', label: 'NPS', icon: Gauge },
  { value: 'csat', label: 'CSAT', icon: SmilePlus },
  { value: 'ces', label: 'CES', icon: ThumbsUp },
] as const

type ScreenType = (typeof SCREEN_TYPES)[number]['value']

interface ScreenDraft {
  id?: string
  order: number
  screenType: ScreenType
  title: string
  subtitle: string
  config: Record<string, any>
  branchConditions: Record<string, any> | null
}

const SCREEN_TYPE_COLORS: Record<string, string> = {
  rating: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  aspects: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  review_redirect: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  feedback: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  contact_collection: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  thank_you: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  nps: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  csat: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  ces: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
}

function getDefaultConfig(screenType: ScreenType): Record<string, any> {
  switch (screenType) {
    case 'rating':
      return { maxRating: 5, positiveThreshold: 4, iconStyle: 'stars' }
    case 'aspects':
      return { aspects: ['Food', 'Service', 'Ambience', 'Value'] }
    case 'review_redirect':
      return { message: "We're glad you had a great experience!", links: [] }
    case 'feedback':
      return { placeholder: 'Tell us more about your experience...' }
    case 'contact_collection':
      return { fields: ['name', 'email', 'phone'] }
    case 'thank_you':
      return { message: 'Thank you for your feedback!', showCoupon: false }
    case 'nps':
      return { question: 'How likely are you to recommend us?', lowLabel: 'Not at all likely', highLabel: 'Extremely likely' }
    case 'csat':
      return { question: 'How satisfied are you with our service?', scaleType: 'stars' }
    case 'ces':
      return { question: 'How easy was it to get what you needed?', lowLabel: 'Very Difficult', midLabel: 'Normal', highLabel: 'Very Easy' }
    default:
      return {}
  }
}

function getDefaultTitle(screenType: ScreenType): string {
  switch (screenType) {
    case 'rating': return 'How was your experience?'
    case 'aspects': return 'What could we improve?'
    case 'review_redirect': return 'Share your experience'
    case 'feedback': return 'Tell us more'
    case 'contact_collection': return 'Stay in touch'
    case 'thank_you': return 'Thank you!'
    case 'nps': return 'How likely are you to recommend us?'
    case 'csat': return 'How satisfied are you?'
    case 'ces': return 'How easy was it?'
    default: return ''
  }
}

function getScreenIcon(screenType: string) {
  const type = SCREEN_TYPES.find((t) => t.value === screenType)
  return type?.icon ?? Star
}

// ─── Builder Skeleton ────────────────────────────────────────────────────────

function BuilderSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-[667px] w-full rounded-[40px]" />
        </div>
      </div>
    </div>
  )
}

// ─── Phone Preview Component ─────────────────────────────────────────────────

function PhonePreview({ screen, brandColor = '#6366f1' }: { screen: ScreenDraft | null; brandColor?: string }) {
  if (!screen) {
    return (
      <div className="flex h-full items-center justify-center text-center p-6">
        <div className="space-y-2">
          <Eye className="size-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Click a screen to preview it
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 p-6 overflow-y-auto">
      {/* Brand accent */}
      <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: brandColor }} />

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {screen.title || 'Screen Title'}
      </h2>
      {screen.subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{screen.subtitle}</p>
      )}

      {/* Type-specific preview */}
      <div className="flex-1 mt-4">
        {screen.screenType === 'rating' && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {Array.from({ length: screen.config.maxRating ?? 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  {screen.config.iconStyle === 'emojis' ? (
                    <span className="text-2xl">
                      {i < 2 ? '\u{1F61E}' : i < 4 ? '\u{1F610}' : '\u{1F60A}'}
                    </span>
                  ) : (
                    <Star
                      className={`size-8 ${
                        i < (screen.config.positiveThreshold ?? 4)
                          ? 'text-gray-300 dark:text-gray-600'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen.screenType === 'aspects' && (
          <div className="flex flex-wrap gap-2">
            {(screen.config.aspects ?? ['Food', 'Service', 'Ambience']).map((aspect: string, i: number) => (
              <button
                key={i}
                className="rounded-full border px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:border-gray-400"
              >
                {aspect}
              </button>
            ))}
          </div>
        )}

        {screen.screenType === 'review_redirect' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{screen.config.message}</p>
            {(screen.config.links ?? []).length > 0 ? (
              <div className="flex flex-wrap justify-center gap-6 pt-2">
                {(screen.config.links ?? []).map((link: any, i: number) => (
                  <a
                    key={i}
                    href={link.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm transition-all hover:shadow-md hover:scale-105 min-w-[90px]"
                  >
                    <PlatformIconBadge platform={link.platform} size={48} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Review us on
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {link.platform || 'Platform'}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-gray-500">
                <ExternalLink className="size-6 text-muted-foreground/40" />
                <p className="text-sm">No review platforms configured</p>
                <p className="text-xs text-muted-foreground">Add platforms in the screen settings</p>
              </div>
            )}
          </div>
        )}

        {screen.screenType === 'feedback' && (
          <div className="space-y-3">
            <div className="min-h-[120px] rounded-lg border bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-400">
              {screen.config.placeholder || 'Tell us more...'}
            </div>
          </div>
        )}

        {screen.screenType === 'contact_collection' && (
          <div className="space-y-3">
            {(screen.config.fields ?? ['name', 'email', 'phone']).includes('name') && (
              <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-400">Your name</div>
            )}
            {(screen.config.fields ?? ['name', 'email', 'phone']).includes('email') && (
              <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-400">Email address</div>
            )}
            {(screen.config.fields ?? ['name', 'email', 'phone']).includes('phone') && (
              <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-400">Phone number</div>
            )}
          </div>
        )}

        {screen.screenType === 'thank_you' && (
          <div className="flex flex-col items-center text-center space-y-4 mt-8">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {screen.config.message || 'Thank you for your feedback!'}
            </p>
            {screen.config.showCoupon && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-6 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Your Coupon</p>
                <p className="text-lg font-bold" style={{ color: brandColor }}>THANKS10</p>
              </div>
            )}
          </div>
        )}

        {screen.screenType === 'nps' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex size-8 items-center justify-center rounded-lg border text-xs font-medium ${
                    i <= 6
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                      : i <= 8
                        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400'
                        : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{screen.config.lowLabel || 'Not at all likely'}</span>
              <span>{screen.config.highLabel || 'Extremely likely'}</span>
            </div>
          </div>
        )}

        {screen.screenType === 'csat' && (
          <div className="space-y-4">
            {screen.config.scaleType === 'emojis' ? (
              <div className="flex justify-center gap-4">
                {['\u{1F620}', '\u{1F61E}', '\u{1F610}', '\u{1F60A}', '\u{1F60D}'].map((emoji, i) => (
                  <span key={i} className="text-3xl cursor-pointer hover:scale-110 transition-transform">{emoji}</span>
                ))}
              </div>
            ) : screen.config.scaleType === 'numbers' ? (
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex size-10 items-center justify-center rounded-lg border text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
                    {n}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-8 text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:fill-amber-400 cursor-pointer transition-colors" />
                ))}
              </div>
            )}
          </div>
        )}

        {screen.screenType === 'ces' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex size-10 items-center justify-center rounded-lg border text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{screen.config.lowLabel || 'Very Difficult'}</span>
              <span>{screen.config.midLabel || 'Normal'}</span>
              <span>{screen.config.highLabel || 'Very Easy'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom button */}
      {screen.screenType !== 'thank_you' && (
        <button
          className="mt-6 w-full rounded-lg py-3 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: brandColor }}
        >
          {screen.screenType === 'review_redirect' ? 'Skip' : 'Continue'}
        </button>
      )}
    </div>
  )
}

// ─── QR Code Dialog ──────────────────────────────────────────────────────────

function QrCodeDialog({
  open,
  onOpenChange,
  journeySlug,
  journeyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  journeySlug: string
  journeyId: string
}) {
  const [qrSize, setQrSize] = useState('256')
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/j/${journeySlug}`
    : `/j/${journeySlug}`

  const qrQuery = trpc.qr.generateJourneyQr.useQuery(
    { journeyId, size: parseInt(qrSize) },
    { enabled: open && !!journeyId }
  )

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copied to clipboard')
  }

  function downloadQr() {
    if (!qrQuery.data?.qrDataUrl) return
    const link = document.createElement('a')
    link.download = `journey-${journeySlug}-qr.png`
    link.href = qrQuery.data.qrDataUrl
    link.click()
    toast.success('QR code downloaded')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Share this QR code so customers can start their feedback journey.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrQuery.isLoading ? (
            <Skeleton className="size-64 rounded-lg" />
          ) : qrQuery.data?.qrDataUrl ? (
            <img
              src={qrQuery.data.qrDataUrl}
              alt="QR Code"
              className="rounded-lg border"
              style={{ width: parseInt(qrSize), height: parseInt(qrSize) }}
            />
          ) : (
            <div className="flex size-64 items-center justify-center rounded-lg border bg-muted">
              <QrCode className="size-16 text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Size:</Label>
            <Select value={qrSize} onValueChange={setQrSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">128px</SelectItem>
                <SelectItem value="256">256px</SelectItem>
                <SelectItem value="512">512px</SelectItem>
                <SelectItem value="1024">1024px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center gap-2">
            <Input value={publicUrl} readOnly className="flex-1 text-xs" />
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button variant="outline" onClick={copyLink}>
            <Copy className="size-4" />
            Copy Link
          </Button>
          <Button onClick={downloadQr} disabled={!qrQuery.data?.qrDataUrl}>
            <Download className="size-4" />
            Download QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Screen Dialog ───────────────────────────────────────────────────────

function AddScreenDialog({
  open,
  onOpenChange,
  onAdd,
  insertIndex,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (type: ScreenType, insertIndex?: number) => void
  insertIndex?: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Screen</DialogTitle>
          <DialogDescription>
            Choose a screen type to add to your journey.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-4 sm:grid-cols-3">
          {SCREEN_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.value}
                onClick={() => {
                  onAdd(type.value, insertIndex)
                  onOpenChange(false)
                }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-accent hover:border-accent-foreground/20"
              >
                <div className={`flex size-10 items-center justify-center rounded-lg ${SCREEN_TYPE_COLORS[type.value]}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Automation Tab ──────────────────────────────────────────────────────────

function AutomationTab({ journeyId }: { journeyId: string }) {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()
  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [newRule, setNewRule] = useState({
    triggerEvent: 'response_submitted',
    delayMinutes: 0,
    actionType: 'send_email',
    config: {} as Record<string, any>,
  })

  const rulesQuery = trpc.automation.listByJourney.useQuery(
    { journeyId },
    { enabled: !!journeyId }
  )

  const createRuleMutation = trpc.automation.create.useMutation({
    onSuccess: () => {
      toast.success('Automation rule created')
      setAddRuleOpen(false)
      setNewRule({ triggerEvent: 'response_submitted', delayMinutes: 0, actionType: 'send_email', config: {} })
      utils.automation.listByJourney.invalidate({ journeyId })
    },
    onError: (error) => toast.error(error.message || 'Failed to create rule'),
  })

  const toggleRuleMutation = trpc.automation.update.useMutation({
    onSuccess: () => {
      utils.automation.listByJourney.invalidate({ journeyId })
    },
    onError: (error) => toast.error(error.message || 'Failed to update rule'),
  })

  const deleteRuleMutation = trpc.automation.delete.useMutation({
    onSuccess: () => {
      toast.success('Rule deleted')
      utils.automation.listByJourney.invalidate({ journeyId })
    },
    onError: (error) => toast.error(error.message || 'Failed to delete rule'),
  })

  const rules = rulesQuery.data ?? []

  const triggerEvents = [
    { value: 'response_submitted', label: 'Response Submitted' },
    { value: 'low_rating', label: 'Low Rating Received' },
    { value: 'high_rating', label: 'High Rating Received' },
    { value: 'nps_detractor', label: 'NPS Detractor' },
    { value: 'nps_promoter', label: 'NPS Promoter' },
    { value: 'contact_collected', label: 'Contact Info Collected' },
  ]

  const actionTypes = [
    { value: 'send_email', label: 'Send Email' },
    { value: 'send_sms', label: 'Send SMS' },
    { value: 'webhook', label: 'Webhook' },
    { value: 'create_task', label: 'Create Task' },
    { value: 'tag_customer', label: 'Tag Customer' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automation Rules</h2>
          <p className="text-sm text-muted-foreground">
            Set up automated actions triggered by journey responses.
          </p>
        </div>
        <Button onClick={() => setAddRuleOpen(true)}>
          <Plus className="size-4" />
          Add Rule
        </Button>
      </div>

      {rulesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Zap className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No automation rules yet. Create one to trigger actions based on responses.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setAddRuleOpen(true)}>
            <Plus className="size-4" />
            Add Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {triggerEvents.find((t) => t.value === rule.triggerEvent)?.label ?? rule.triggerEvent}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    {rule.delayMinutes > 0 && (
                      <>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {rule.delayMinutes}m delay
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </>
                    )}
                    <span className="text-sm font-medium">
                      {actionTypes.find((a) => a.value === rule.actionType)?.label ?? rule.actionType}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {new Date(rule.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={rule.isActive ?? true}
                    onCheckedChange={(checked) =>
                      toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Rule Dialog */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Automation Rule</DialogTitle>
            <DialogDescription>
              Define a trigger event and the action to take.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trigger Event</Label>
              <Select value={newRule.triggerEvent} onValueChange={(v) => setNewRule((r) => ({ ...r, triggerEvent: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerEvents.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Delay (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={newRule.delayMinutes}
                onChange={(e) => setNewRule((r) => ({ ...r, delayMinutes: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={newRule.actionType} onValueChange={(v) => setNewRule((r) => ({ ...r, actionType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newRule.actionType === 'send_email' && (
              <div className="space-y-2">
                <Label>Email Template</Label>
                <Input
                  placeholder="e.g. follow_up_template"
                  value={newRule.config.template ?? ''}
                  onChange={(e) => setNewRule((r) => ({ ...r, config: { ...r.config, template: e.target.value } }))}
                />
              </div>
            )}
            {newRule.actionType === 'webhook' && (
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://..."
                  value={newRule.config.url ?? ''}
                  onChange={(e) => setNewRule((r) => ({ ...r, config: { ...r.config, url: e.target.value } }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                createRuleMutation.mutate({
                  journeyId,
                  triggerEvent: newRule.triggerEvent,
                  delayMinutes: newRule.delayMinutes,
                  actionType: newRule.actionType,
                  config: newRule.config,
                })
              }
              disabled={createRuleMutation.isPending}
            >
              {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Flow View Component ─────────────────────────────────────────────────────

function FlowView({
  screens,
  selectedIndex,
  onSelectScreen,
  onEditScreen,
  onAddScreen,
}: {
  screens: ScreenDraft[]
  selectedIndex: number | null
  onSelectScreen: (index: number) => void
  onEditScreen: (index: number) => void
  onAddScreen: (insertIndex?: number) => void
}) {
  const NODE_WIDTH = 260
  const NODE_HEIGHT = 72
  const NODE_GAP = 24
  const DIAMOND_SIZE = 40
  const BRANCH_GAP = 16
  const CENTER_X = 300

  // Determine which screens have branches and their targets
  function getFlowData() {
    const nodes: {
      type: 'screen' | 'branch'
      screenIndex: number
      y: number
      label?: string
      branchTargetIndex?: number
    }[] = []

    let currentY = 20

    screens.forEach((screen, index) => {
      // Screen node
      nodes.push({
        type: 'screen',
        screenIndex: index,
        y: currentY,
      })
      currentY += NODE_HEIGHT

      // If this screen has branch conditions, add a decision diamond
      if (screen.branchConditions && Object.keys(screen.branchConditions).length > 0) {
        currentY += BRANCH_GAP
        nodes.push({
          type: 'branch',
          screenIndex: index,
          y: currentY,
          label: `Rating >= ${screen.branchConditions.minRating ?? 4}?`,
          branchTargetIndex: screen.branchConditions.skipToScreen ?? index + 1,
        })
        currentY += DIAMOND_SIZE + BRANCH_GAP
      } else {
        currentY += NODE_GAP
      }
    })

    return { nodes, totalHeight: currentY + 80 }
  }

  const { nodes, totalHeight } = getFlowData()

  // Determine which screen types lead where for visual path coloring
  function getScreenPathColor(screen: ScreenDraft): string {
    if (screen.screenType === 'review_redirect') {
      return 'border-green-500 shadow-green-100 dark:shadow-green-900/20'
    }
    if (screen.screenType === 'feedback') {
      return 'border-orange-500 shadow-orange-100 dark:shadow-orange-900/20'
    }
    return ''
  }

  // Check if a rating screen leads to a review_redirect (positive) or feedback (negative)
  function getNextScreenType(index: number): string | null {
    if (index + 1 < screens.length) {
      return screens[index + 1].screenType
    }
    return null
  }

  return (
    <div className="relative overflow-auto rounded-xl border bg-muted/20" style={{ minHeight: '500px', maxHeight: '70vh' }}>
      <div className="relative mx-auto" style={{ width: CENTER_X * 2, minHeight: totalHeight }}>
        {/* SVG connections layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height={totalHeight}
          style={{ zIndex: 0 }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                className="fill-muted-foreground/40"
              />
            </marker>
            <marker
              id="arrowhead-green"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" className="fill-green-500" />
            </marker>
            <marker
              id="arrowhead-orange"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" className="fill-orange-500" />
            </marker>
          </defs>

          {nodes.map((node, i) => {
            const nextNode = nodes[i + 1]
            if (!nextNode) return null

            if (node.type === 'screen' && nextNode.type === 'screen') {
              // Direct connection between screens
              const startY = node.y + NODE_HEIGHT
              const endY = nextNode.y
              return (
                <line
                  key={`conn-${i}`}
                  x1={CENTER_X}
                  y1={startY}
                  x2={CENTER_X}
                  y2={endY}
                  className="stroke-muted-foreground/30"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
              )
            }

            if (node.type === 'screen' && nextNode.type === 'branch') {
              // Screen to branch diamond
              const startY = node.y + NODE_HEIGHT
              const endY = nextNode.y
              return (
                <line
                  key={`conn-${i}`}
                  x1={CENTER_X}
                  y1={startY}
                  x2={CENTER_X}
                  y2={endY}
                  className="stroke-muted-foreground/30"
                  strokeWidth={2}
                />
              )
            }

            if (node.type === 'branch') {
              const branchTarget = node.branchTargetIndex ?? node.screenIndex + 1
              const nextScreenNode = nodes[i + 1]
              const elements: React.ReactNode[] = []

              // "No" path (continue down) - orange for negative/feedback path
              if (nextScreenNode) {
                const startY = node.y + DIAMOND_SIZE
                const endY = nextScreenNode.y
                elements.push(
                  <g key={`branch-no-${i}`}>
                    <line
                      x1={CENTER_X}
                      y1={startY}
                      x2={CENTER_X}
                      y2={endY}
                      className="stroke-orange-500/60"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      markerEnd="url(#arrowhead-orange)"
                    />
                    <text
                      x={CENTER_X + 14}
                      y={startY + 14}
                      className="fill-orange-600 dark:fill-orange-400"
                      fontSize={10}
                      fontWeight={600}
                    >
                      No
                    </text>
                  </g>,
                )
              }

              // "Yes" path (skip to target) - green for positive/review redirect path
              const targetNode = nodes.find(
                (n) => n.type === 'screen' && n.screenIndex === branchTarget,
              )
              if (targetNode && targetNode !== nextScreenNode) {
                const startY = node.y + DIAMOND_SIZE / 2
                const endY = targetNode.y + NODE_HEIGHT / 2
                const curveX = CENTER_X + NODE_WIDTH / 2 + 60

                elements.push(
                  <g key={`branch-yes-${i}`}>
                    <path
                      d={`M ${CENTER_X + DIAMOND_SIZE / 2} ${startY}
                          C ${curveX} ${startY}, ${curveX} ${endY}, ${CENTER_X + NODE_WIDTH / 2} ${endY}`}
                      fill="none"
                      className="stroke-green-500/60"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      markerEnd="url(#arrowhead-green)"
                    />
                    <text
                      x={CENTER_X + DIAMOND_SIZE / 2 + 8}
                      y={startY - 6}
                      className="fill-green-600 dark:fill-green-400"
                      fontSize={10}
                      fontWeight={600}
                    >
                      Yes
                    </text>
                  </g>,
                )
              }

              return <g key={`branch-group-${i}`}>{elements}</g>
            }

            return null
          })}
        </svg>

        {/* Nodes layer */}
        <div className="relative" style={{ zIndex: 1, minHeight: totalHeight }}>
          {nodes.map((node, i) => {
            if (node.type === 'screen') {
              const screen = screens[node.screenIndex]
              const Icon = getScreenIcon(screen.screenType)
              const isSelected = selectedIndex === node.screenIndex
              const pathColor = getScreenPathColor(screen)

              return (
                <div
                  key={`node-${i}`}
                  className="absolute"
                  style={{
                    left: CENTER_X - NODE_WIDTH / 2,
                    top: node.y,
                    width: NODE_WIDTH,
                  }}
                >
                  <div
                    onClick={() => onSelectScreen(node.screenIndex)}
                    onDoubleClick={() => onEditScreen(node.screenIndex)}
                    className={`group flex items-center gap-3 rounded-xl border-2 bg-background p-3 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-primary shadow-md ring-2 ring-primary/20'
                        : pathColor || 'border-border hover:border-muted-foreground/40'
                    }`}
                  >
                    {/* Order badge */}
                    <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {node.screenIndex + 1}
                    </div>

                    {/* Icon */}
                    <div
                      className={`flex size-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        SCREEN_TYPE_COLORS[screen.screenType] ?? 'bg-muted'
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>

                    {/* Title + type */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {screen.title ||
                          SCREEN_TYPES.find((t) => t.value === screen.screenType)?.label}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 h-4 mt-0.5 ${
                          SCREEN_TYPE_COLORS[screen.screenType] ?? ''
                        }`}
                      >
                        {SCREEN_TYPES.find((t) => t.value === screen.screenType)?.label}
                      </Badge>
                    </div>

                    {/* Edit button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditScreen(node.screenIndex)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex size-7 items-center justify-center rounded-md hover:bg-muted"
                    >
                      <Settings2 className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            }

            if (node.type === 'branch') {
              return (
                <div
                  key={`node-${i}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: CENTER_X - DIAMOND_SIZE / 2,
                    top: node.y,
                    width: DIAMOND_SIZE,
                    height: DIAMOND_SIZE,
                  }}
                >
                  <div
                    className="flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-600 shadow-sm"
                    style={{
                      width: DIAMOND_SIZE,
                      height: DIAMOND_SIZE,
                      transform: 'rotate(45deg)',
                      borderRadius: 6,
                    }}
                  >
                    <GitBranch
                      className="size-4 text-amber-700 dark:text-amber-400"
                      style={{ transform: 'rotate(-45deg)' }}
                    />
                  </div>
                  {/* Label */}
                  <div className="absolute left-full ml-3 whitespace-nowrap">
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-0.5">
                      {node.label}
                    </span>
                  </div>
                </div>
              )
            }

            return null
          })}

          {/* Add screen button at bottom */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: CENTER_X - 60,
              top: totalHeight - 60,
              width: 120,
            }}
          >
            {screens.length > 0 && (
              <div className="h-6 w-px bg-border mb-2" />
            )}
            <button
              onClick={() => onAddScreen(undefined)}
              className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-muted-foreground/30 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40 transition-all"
            >
              <Plus className="size-3.5" />
              Add Screen
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="sticky bottom-0 flex items-center gap-4 bg-background/80 backdrop-blur-sm border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span className="font-medium">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm border-2 border-green-500" />
          Positive path (review)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-sm border-2 border-orange-500" />
          Negative path (feedback)
        </span>
        <span className="flex items-center gap-1">
          <Diamond className="size-3 text-amber-500" />
          Branch condition
        </span>
        <span className="ml-auto text-muted-foreground/60">Double-click to edit</span>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function JourneyBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const journeyId = params.id as string
  const utils = trpc.useUtils()

  const [screens, setScreens] = useState<ScreenDraft[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [addScreenOpen, setAddScreenOpen] = useState(false)
  const [insertAtIndex, setInsertAtIndex] = useState<number | undefined>(undefined)
  const [journeyName, setJourneyName] = useState('')
  const [editingName, setEditingName] = useState(false)

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const journeyQuery = trpc.journey.getById.useQuery(
    { id: journeyId },
    { enabled: !!journeyId }
  )

  const updateScreensMutation = trpc.journey.updateScreens.useMutation({
    onSuccess: () => {
      toast.success('Screens saved successfully')
      setHasChanges(false)
      utils.journey.getById.invalidate({ id: journeyId })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save screens')
    },
  })

  const updateJourneyMutation = trpc.journey.update.useMutation({
    onSuccess: () => {
      toast.success('Journey updated')
      setEditingName(false)
      utils.journey.getById.invalidate({ id: journeyId })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update journey')
    },
  })

  // Load screens from query data
  useEffect(() => {
    if (journeyQuery.data?.screens) {
      const sorted = [...journeyQuery.data.screens].sort(
        (a: any, b: any) => a.order - b.order
      )
      setScreens(
        sorted.map((s: any) => ({
          id: s.id,
          order: s.order,
          screenType: s.screenType as ScreenType,
          title: s.title ?? '',
          subtitle: s.subtitle ?? '',
          config: s.config ?? {},
          branchConditions: s.branchConditions ?? null,
        }))
      )
      setHasChanges(false)
    }
  }, [journeyQuery.data])

  useEffect(() => {
    if (journeyQuery.data) {
      setJourneyName(journeyQuery.data.name ?? '')
    }
  }, [journeyQuery.data])

  const journey = journeyQuery.data

  function addScreen(screenType: ScreenType, insertIndex?: number) {
    setScreens((prev) => {
      const newScreen: ScreenDraft = {
        order: insertIndex ?? prev.length,
        screenType,
        title: getDefaultTitle(screenType),
        subtitle: '',
        config: getDefaultConfig(screenType),
        branchConditions: null,
      }
      if (insertIndex !== undefined) {
        const next = [...prev]
        next.splice(insertIndex, 0, newScreen)
        return next.map((s, i) => ({ ...s, order: i }))
      }
      return [...prev, newScreen]
    })
    setHasChanges(true)
  }

  function removeScreen(index: number) {
    setScreens((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((s, i) => ({ ...s, order: i }))
    })
    setHasChanges(true)
    if (editingIndex === index) setEditingIndex(null)
    if (selectedPreviewIndex === index) setSelectedPreviewIndex(null)
  }

  function moveScreen(index: number, direction: 'up' | 'down') {
    setScreens((prev) => {
      const next = [...prev]
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      if (swapIndex < 0 || swapIndex >= next.length) return prev
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next.map((s, i) => ({ ...s, order: i }))
    })
    setHasChanges(true)
  }

  function updateScreen(index: number, updates: Partial<ScreenDraft>) {
    setScreens((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
    setHasChanges(true)
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      handleDragEnd()
      return
    }
    setScreens((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      return next.map((s, i) => ({ ...s, order: i }))
    })
    setHasChanges(true)
    handleDragEnd()
  }

  function handleSave() {
    updateScreensMutation.mutate({
      journeyId,
      screens: screens.map((s) => ({
        order: s.order,
        screenType: s.screenType,
        title: s.title || undefined,
        subtitle: s.subtitle || undefined,
        config: s.config,
        branchConditions: s.branchConditions || undefined,
      })),
    })
  }

  function handleSaveName() {
    if (!journeyName.trim()) return
    updateJourneyMutation.mutate({ id: journeyId, name: journeyName.trim() })
  }

  function copyPublicLink() {
    if (!journey?.slug) return
    const url = `${window.location.origin}/j/${journey.slug}`
    navigator.clipboard.writeText(url)
    toast.success('Public link copied to clipboard')
  }

  const editingScreen = editingIndex !== null ? screens[editingIndex] : null
  const previewScreen = selectedPreviewIndex !== null ? screens[selectedPreviewIndex] : screens[0] ?? null

  if (journeyQuery.isLoading) {
    return <BuilderSkeleton />
  }

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h3 className="text-lg font-semibold">Journey not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/dashboard/journeys')}
        >
          Back to Journeys
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/journeys')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={journeyName}
                  onChange={(e) => setJourneyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  className="h-8 text-lg font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName} disabled={updateJourneyMutation.isPending}>
                  <CheckCircle2 className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold truncate cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => setEditingName(true)}
                title="Click to edit name"
              >
                {journey.name}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                /j/{journey.slug}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={copyPublicLink}
              >
                <Copy className="size-3" />
              </Button>
              <Badge variant={journey.isActive ? 'default' : 'secondary'}>
                {journey.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.open(`/j/${journey.slug}`, '_blank')}>
            <Eye className="size-4" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" />
            QR Code
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateScreensMutation.isPending}
          >
            <Save className="size-4" />
            {updateScreensMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="flow">
            <Workflow className="size-3.5" />
            Flow View
          </TabsTrigger>
          <TabsTrigger value="automation">
            <Zap className="size-3.5" />
            Automation
          </TabsTrigger>
        </TabsList>

        {/* Builder Tab */}
        <TabsContent value="builder">
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Screen List - Left Side */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Screens ({screens.length})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInsertAtIndex(undefined)
                    setAddScreenOpen(true)
                  }}
                >
                  <Plus className="size-4" />
                  Add Screen
                </Button>
              </div>

              {screens.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Plus className="size-6 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    No screens yet. Add your first screen to build the journey.
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => {
                      setInsertAtIndex(undefined)
                      setAddScreenOpen(true)
                    }}
                  >
                    <Plus className="size-4" />
                    Add Screen
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {screens.map((screen, index) => {
                    const Icon = getScreenIcon(screen.screenType)
                    const isSelected = selectedPreviewIndex === index
                    const isDragging = dragIndex === index
                    const isDragOver = dragOverIndex === index

                    return (
                      <div key={index}>
                        {/* Screen Card */}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, index)}
                          onClick={() => setSelectedPreviewIndex(index)}
                          className={`group relative flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                            isDragging
                              ? 'opacity-50 border-dashed'
                              : isDragOver
                                ? 'border-primary bg-primary/5'
                                : isSelected
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'hover:bg-accent/50 hover:border-accent-foreground/20'
                          }`}
                        >
                          {/* Drag handle */}
                          <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                            <GripVertical className="size-4" />
                          </div>

                          {/* Order number */}
                          <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {index + 1}
                          </div>

                          {/* Icon + Info */}
                          <div className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg ${SCREEN_TYPE_COLORS[screen.screenType] ?? 'bg-muted'}`}>
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {screen.title || SCREEN_TYPES.find((t) => t.value === screen.screenType)?.label}
                              </span>
                            </div>
                            {screen.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">
                                {screen.subtitle}
                              </p>
                            )}
                          </div>

                          {/* Branch indicator */}
                          {screen.branchConditions && Object.keys(screen.branchConditions).length > 0 && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Branch
                            </Badge>
                          )}

                          {/* Actions */}
                          <div
                            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => setEditingIndex(index)}
                            >
                              <Settings2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={index === 0}
                              onClick={() => moveScreen(index, 'up')}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={index === screens.length - 1}
                              onClick={() => moveScreen(index, 'down')}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => removeScreen(index)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Connector + Insert button */}
                        {index < screens.length - 1 && (
                          <div className="flex items-center justify-center py-1">
                            <div className="flex flex-col items-center">
                              <div className="h-3 w-px bg-border" />
                              <button
                                onClick={() => {
                                  setInsertAtIndex(index + 1)
                                  setAddScreenOpen(true)
                                }}
                                className="flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                              >
                                <Plus className="size-3" />
                              </button>
                              <div className="h-3 w-px bg-border" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add at bottom */}
                  <div className="flex justify-center pt-2">
                    <div className="flex flex-col items-center">
                      <div className="h-4 w-px bg-border" />
                      <button
                        onClick={() => {
                          setInsertAtIndex(undefined)
                          setAddScreenOpen(true)
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-dashed px-4 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20 transition-colors"
                      >
                        <Plus className="size-3" />
                        Add Screen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Preview - Right Side */}
            <div className="lg:col-span-2">
              <div className="sticky top-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  Mobile Preview
                </h2>
                <div className="mx-auto w-[375px] h-[667px] border-2 border-gray-300 dark:border-gray-700 rounded-[40px] overflow-hidden shadow-xl bg-white dark:bg-gray-950 relative">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-gray-300 dark:bg-gray-700 rounded-b-2xl z-10" />
                  {/* Content */}
                  <div className="h-full pt-8">
                    <PhonePreview screen={previewScreen} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Flow View Tab */}
        <TabsContent value="flow">
          <FlowView
            screens={screens}
            selectedIndex={selectedPreviewIndex}
            onSelectScreen={(index) => setSelectedPreviewIndex(index)}
            onEditScreen={(index) => setEditingIndex(index)}
            onAddScreen={(insertIndex) => {
              setInsertAtIndex(insertIndex)
              setAddScreenOpen(true)
            }}
          />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <AutomationTab journeyId={journeyId} />
        </TabsContent>
      </Tabs>

      {/* Edit Screen Sheet */}
      <Sheet
        open={editingIndex !== null}
        onOpenChange={(open) => {
          if (!open) setEditingIndex(null)
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {editingScreen && editingIndex !== null && (
            <>
              <SheetHeader>
                <SheetTitle>Edit Screen</SheetTitle>
                <SheetDescription>
                  Configure the{' '}
                  {SCREEN_TYPES.find((t) => t.value === editingScreen.screenType)?.label}{' '}
                  screen.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-6">
                {/* Screen Type */}
                <div className="space-y-2">
                  <Label>Screen Type</Label>
                  <Select
                    value={editingScreen.screenType}
                    onValueChange={(value) =>
                      updateScreen(editingIndex, {
                        screenType: value as ScreenType,
                        title: getDefaultTitle(value as ScreenType),
                        config: getDefaultConfig(value as ScreenType),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCREEN_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editingScreen.title}
                    onChange={(e) =>
                      updateScreen(editingIndex, { title: e.target.value })
                    }
                    placeholder="Screen title"
                  />
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    value={editingScreen.subtitle}
                    onChange={(e) =>
                      updateScreen(editingIndex, { subtitle: e.target.value })
                    }
                    placeholder="Optional subtitle"
                  />
                </div>

                <Separator />

                {/* ─── Rating Config ─── */}
                {editingScreen.screenType === 'rating' && (
                  <>
                    <div className="space-y-2">
                      <Label>Max Rating</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editingScreen.config.maxRating ?? 5}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: {
                              ...editingScreen.config,
                              maxRating: parseInt(e.target.value) || 5,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Positive Threshold</Label>
                      <Input
                        type="number"
                        min={1}
                        max={editingScreen.config.maxRating ?? 5}
                        value={editingScreen.config.positiveThreshold ?? 4}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: {
                              ...editingScreen.config,
                              positiveThreshold: parseInt(e.target.value) || 4,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Ratings at or above this value route to review redirect.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Icon Style</Label>
                      <Select
                        value={editingScreen.config.iconStyle ?? 'stars'}
                        onValueChange={(v) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, iconStyle: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stars">Stars</SelectItem>
                          <SelectItem value="emojis">Emojis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* ─── Aspects Config ─── */}
                {editingScreen.screenType === 'aspects' && (
                  <div className="space-y-2">
                    <Label>Aspects (comma-separated)</Label>
                    <Input
                      value={(editingScreen.config.aspects ?? []).join(', ')}
                      onChange={(e) =>
                        updateScreen(editingIndex, {
                          config: {
                            ...editingScreen.config,
                            aspects: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      placeholder="Food, Service, Ambience, Value"
                    />
                    <p className="text-xs text-muted-foreground">
                      These are the aspects customers can select for improvement feedback.
                    </p>
                  </div>
                )}

                {/* ─── Review Redirect Config ─── */}
                {editingScreen.screenType === 'review_redirect' && (
                  <>
                    <div className="space-y-2">
                      <Label>Instructions Message</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={editingScreen.config.message ?? ''}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, message: e.target.value },
                          })
                        }
                        placeholder="We're glad you had a great experience!"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Review Platforms</Label>
                      <p className="text-xs text-muted-foreground">Add the platforms where you want customers to leave reviews. This is the final step of the journey.</p>
                      {[
                        { id: 'Google', placeholder: 'https://g.page/your-business/review', color: 'border-blue-300 bg-blue-50' },
                        { id: 'Zomato', placeholder: 'https://www.zomato.com/your-restaurant/reviews', color: 'border-red-300 bg-red-50' },
                        { id: 'Facebook', placeholder: 'https://facebook.com/your-page/reviews', color: 'border-indigo-300 bg-indigo-50' },
                      ].map((platform) => {
                        const links = editingScreen.config.links ?? []
                        const existing = links.find((l: any) => l.platform === platform.id)
                        return (
                          <div key={platform.id} className={`rounded-lg border p-3 ${platform.color}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <PlatformIconBadge platform={platform.id} size={20} />
                                <span className="text-sm font-medium">{platform.id}</span>
                              </div>
                              <Checkbox
                                checked={!!existing}
                                onCheckedChange={(checked) => {
                                  const updated = checked
                                    ? [...links, { platform: platform.id, url: '' }]
                                    : links.filter((l: any) => l.platform !== platform.id)
                                  updateScreen(editingIndex, {
                                    config: { ...editingScreen.config, links: updated },
                                  })
                                }}
                              />
                            </div>
                            {existing && (
                              <Input
                                placeholder={platform.placeholder}
                                value={existing.url}
                                onChange={(e) => {
                                  const updated = links.map((l: any) =>
                                    l.platform === platform.id ? { ...l, url: e.target.value } : l
                                  )
                                  updateScreen(editingIndex, {
                                    config: { ...editingScreen.config, links: updated },
                                  })
                                }}
                                className="text-sm bg-white dark:bg-background"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* ─── Feedback Config ─── */}
                {editingScreen.screenType === 'feedback' && (
                  <div className="space-y-2">
                    <Label>Placeholder Text</Label>
                    <Input
                      value={editingScreen.config.placeholder ?? ''}
                      onChange={(e) =>
                        updateScreen(editingIndex, {
                          config: { ...editingScreen.config, placeholder: e.target.value },
                        })
                      }
                      placeholder="Tell us more about your experience..."
                    />
                  </div>
                )}

                {/* ─── Contact Collection Config ─── */}
                {editingScreen.screenType === 'contact_collection' && (
                  <div className="space-y-3">
                    <Label>Collect Fields</Label>
                    {['name', 'email', 'phone'].map((field) => (
                      <div key={field} className="flex items-center gap-2">
                        <Checkbox
                          checked={(editingScreen.config.fields ?? []).includes(field)}
                          onCheckedChange={(checked) => {
                            const fields = editingScreen.config.fields ?? []
                            const next = checked
                              ? [...fields, field]
                              : fields.filter((f: string) => f !== field)
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, fields: next },
                            })
                          }}
                        />
                        <Label className="capitalize">{field}</Label>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── Thank You Config ─── */}
                {editingScreen.screenType === 'thank_you' && (
                  <>
                    <div className="space-y-2">
                      <Label>Thank You Message</Label>
                      <Input
                        value={editingScreen.config.message ?? ''}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, message: e.target.value },
                          })
                        }
                        placeholder="Thank you for your feedback!"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingScreen.config.showCoupon ?? false}
                        onCheckedChange={(checked) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, showCoupon: checked },
                          })
                        }
                      />
                      <Label>Show Coupon</Label>
                    </div>
                  </>
                )}

                {/* ─── NPS Config ─── */}
                {editingScreen.screenType === 'nps' && (
                  <>
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={editingScreen.config.question ?? ''}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, question: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Low Label (0)</Label>
                        <Input
                          value={editingScreen.config.lowLabel ?? ''}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, lowLabel: e.target.value },
                            })
                          }
                          placeholder="Not at all likely"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>High Label (10)</Label>
                        <Input
                          value={editingScreen.config.highLabel ?? ''}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, highLabel: e.target.value },
                            })
                          }
                          placeholder="Extremely likely"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ─── CSAT Config ─── */}
                {editingScreen.screenType === 'csat' && (
                  <>
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={editingScreen.config.question ?? ''}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, question: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scale Type</Label>
                      <Select
                        value={editingScreen.config.scaleType ?? 'stars'}
                        onValueChange={(v) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, scaleType: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stars">Stars</SelectItem>
                          <SelectItem value="emojis">Emojis</SelectItem>
                          <SelectItem value="numbers">Numbers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* ─── CES Config ─── */}
                {editingScreen.screenType === 'ces' && (
                  <>
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={editingScreen.config.question ?? ''}
                        onChange={(e) =>
                          updateScreen(editingIndex, {
                            config: { ...editingScreen.config, question: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Easy Label</Label>
                        <Input
                          value={editingScreen.config.highLabel ?? ''}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, highLabel: e.target.value },
                            })
                          }
                          placeholder="Very Easy"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Normal Label</Label>
                        <Input
                          value={editingScreen.config.midLabel ?? ''}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, midLabel: e.target.value },
                            })
                          }
                          placeholder="Normal"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Difficult Label</Label>
                        <Input
                          value={editingScreen.config.lowLabel ?? ''}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              config: { ...editingScreen.config, lowLabel: e.target.value },
                            })
                          }
                          placeholder="Very Difficult"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Branch Conditions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Branch Conditions (optional)</Label>
                    <Switch
                      checked={!!editingScreen.branchConditions && Object.keys(editingScreen.branchConditions).length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateScreen(editingIndex, {
                            branchConditions: { minRating: 4, skipToScreen: screens.length - 1 },
                          })
                        } else {
                          updateScreen(editingIndex, { branchConditions: null })
                        }
                      }}
                    />
                  </div>
                  {editingScreen.branchConditions && Object.keys(editingScreen.branchConditions).length > 0 && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <div className="space-y-2">
                        <Label className="text-xs">If rating is at least</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={editingScreen.branchConditions.minRating ?? 4}
                          onChange={(e) =>
                            updateScreen(editingIndex, {
                              branchConditions: {
                                ...editingScreen.branchConditions,
                                minRating: parseInt(e.target.value) || 4,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Skip to screen number</Label>
                        <Select
                          value={String(editingScreen.branchConditions.skipToScreen ?? 0)}
                          onValueChange={(v) =>
                            updateScreen(editingIndex, {
                              branchConditions: {
                                ...editingScreen.branchConditions,
                                skipToScreen: parseInt(v),
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {screens.map((s, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {i + 1}. {s.title || SCREEN_TYPES.find((t) => t.value === s.screenType)?.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Delete */}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    removeScreen(editingIndex)
                    setEditingIndex(null)
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete Screen
                </Button>
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => setEditingIndex(null)}>
                  Done
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* QR Code Dialog */}
      {journey.slug && (
        <QrCodeDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          journeySlug={journey.slug}
          journeyId={journeyId}
        />
      )}

      {/* Add Screen Dialog */}
      <AddScreenDialog
        open={addScreenOpen}
        onOpenChange={setAddScreenOpen}
        onAdd={addScreen}
        insertIndex={insertAtIndex}
      />
    </div>
  )
}
