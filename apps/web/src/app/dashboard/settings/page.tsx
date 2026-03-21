'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutGrid,
  Bot,
  Bell,
  Trash2,
  Loader2,
  AlertTriangle,
  Settings2,
  CreditCard,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WorkspaceSettingsForm } from '@/components/workspace/workspace-settings-form'
import { MembersTable } from '@/components/member/members-table'
import { BillingTab } from '@/components/settings/billing-tab'
import { AdminTab } from '@/components/settings/admin-tab'

// AI Response Settings tab
function AIResponseSettingsTab() {
  const { currentWorkspaceId } = useAuthStore()

  const [tonePreset, setTonePreset] = useState('professional')
  const [autoResponse, setAutoResponse] = useState(false)
  const [dailyLimit, setDailyLimit] = useState('10')
  const [minDelayDays, setMinDelayDays] = useState('1')
  const [maxDelayDays, setMaxDelayDays] = useState('7')
  const [isLoaded, setIsLoaded] = useState(false)

  // Try to fetch AI settings
  const settingsQuery = trpc.aiResponse.getSettings?.useQuery?.(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  ) ?? null

  const updateSettingsMutation = trpc.aiResponse.updateSettings?.useMutation?.({
    onSuccess: () => {
      toast.success('AI response settings saved')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save settings')
    },
  }) ?? null

  useEffect(() => {
    if (settingsQuery?.data && !isLoaded) {
      const s = settingsQuery.data as any
      setTonePreset(s.tonePreset ?? 'professional')
      setAutoResponse(s.autoResponse ?? false)
      setDailyLimit(String(s.dailyLimit ?? 10))
      setMinDelayDays(String(s.minDelayDays ?? 1))
      setMaxDelayDays(String(s.maxDelayDays ?? 7))
      setIsLoaded(true)
    }
  }, [settingsQuery?.data, isLoaded])

  const handleSave = () => {
    if (updateSettingsMutation) {
      updateSettingsMutation.mutate({
        workspaceId: currentWorkspaceId!,
        tonePreset,
        autoResponse,
        dailyLimit: parseInt(dailyLimit) || 10,
        minDelayDays: parseInt(minDelayDays) || 1,
        maxDelayDays: parseInt(maxDelayDays) || 7,
      })
    } else {
      toast.success('Settings saved (locally)')
    }
  }

  const toneDescriptions: Record<string, string> = {
    professional: 'Formal and respectful language, suitable for corporate brands.',
    friendly: 'Warm and casual tone, perfect for local businesses and cafes.',
    empathetic: 'Understanding and caring language, ideal for service businesses.',
    witty: 'Playful and engaging tone, great for trendy brands.',
  }

  return (
    <div className="space-y-6">
      {/* Tone Preset */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="size-4" />
            Response Tone
          </CardTitle>
          <CardDescription>
            Choose how your AI-generated responses should sound.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['professional', 'friendly', 'empathetic', 'witty'].map((tone) => (
              <button
                key={tone}
                onClick={() => setTonePreset(tone)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  tonePreset === tone
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm capitalize">{tone}</span>
                  {tonePreset === tone && (
                    <Badge variant="default" className="text-[10px]">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {toneDescriptions[tone]}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Auto Response */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Response</CardTitle>
          <CardDescription>
            Automatically generate and schedule responses for new reviews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Auto-Response</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will automatically draft responses with human-like timing delays.
              </p>
            </div>
            <Switch
              checked={autoResponse}
              onCheckedChange={setAutoResponse}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Daily Limit per Location</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Max AI responses per location per day.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Min Delay (days)</Label>
              <Input
                type="number"
                min="0"
                max="30"
                value={minDelayDays}
                onChange={(e) => setMinDelayDays(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Minimum days before auto-responding.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Max Delay (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={maxDelayDays}
                onChange={(e) => setMaxDelayDays(e.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">
                Maximum days before auto-responding.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={updateSettingsMutation?.isPending}>
            {updateSettingsMutation?.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save AI Settings'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// Notifications Settings tab
function NotificationsSettingsTab() {
  const [newReviews, setNewReviews] = useState(true)
  const [escalations, setEscalations] = useState(true)
  const [slaBreaches, setSlaBreaches] = useState(true)
  const [coupons, setCoupons] = useState(false)
  const [syncStatus, setSyncStatus] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  const notificationTypes = [
    {
      label: 'New Reviews',
      description: 'Get notified when new reviews are received from any platform.',
      checked: newReviews,
      onChange: setNewReviews,
    },
    {
      label: 'Escalations',
      description: 'Get notified when a review is escalated to your team.',
      checked: escalations,
      onChange: setEscalations,
    },
    {
      label: 'SLA Breaches',
      description: 'Get notified when an escalation SLA is about to breach or has breached.',
      checked: slaBreaches,
      onChange: setSlaBreaches,
    },
    {
      label: 'Coupon Redemptions',
      description: 'Get notified when a customer redeems a coupon.',
      checked: coupons,
      onChange: setCoupons,
    },
    {
      label: 'Sync Status',
      description: 'Get notified when a platform sync fails or completes.',
      checked: syncStatus,
      onChange: setSyncStatus,
    },
    {
      label: 'Weekly Digest',
      description: 'Receive a weekly summary of review activity and metrics.',
      checked: weeklyDigest,
      onChange: setWeeklyDigest,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which notifications you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {notificationTypes.map((n, idx) => (
          <div key={n.label}>
            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-sm font-medium">{n.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n.description}
                </p>
              </div>
              <Switch
                checked={n.checked}
                onCheckedChange={n.onChange}
              />
            </div>
            {idx < notificationTypes.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={() => toast.success('Notification preferences saved')}>
          Save Preferences
        </Button>
      </CardFooter>
    </Card>
  )
}

// Danger Zone tab
function DangerZoneTab() {
  const router = useRouter()
  const { currentWorkspaceId, memberships } = useAuthStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const currentWorkspace = memberships.find(
    (m) => m.workspaceId === currentWorkspaceId
  )
  const workspaceName = currentWorkspace?.workspaceName ?? 'workspace'

  const deleteMutation = trpc.workspace.delete?.useMutation?.({
    onSuccess: () => {
      toast.success('Workspace deleted')
      router.push('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete workspace')
    },
  }) ?? null

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader>
        <CardTitle className="text-base text-red-600 flex items-center gap-2">
          <AlertTriangle className="size-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that affect your entire workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Delete this workspace
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Once deleted, all data including reviews, responses, and settings will be permanently removed.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-4" />
            Delete Workspace
          </Button>
        </div>
      </CardContent>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All reviews, responses,
              settings, team members, and connected platforms will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm">
              Type <span className="font-mono font-bold">{workspaceName}</span> to confirm:
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspaceName}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== workspaceName || deleteMutation?.isPending}
              onClick={() => {
                if (deleteMutation) {
                  deleteMutation.mutate({ id: currentWorkspaceId! })
                } else {
                  toast.error('Delete functionality not available')
                }
              }}
            >
              {deleteMutation?.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'general'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your workspace settings, AI responses, and team members.
          </p>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings2 className="size-3.5 hidden sm:inline" />
            General
          </TabsTrigger>
          <TabsTrigger value="aspects" className="gap-1.5">
            <LayoutGrid className="size-3.5 hidden sm:inline" />
            Aspects
          </TabsTrigger>
          <TabsTrigger value="ai-response" className="gap-1.5">
            <Bot className="size-3.5 hidden sm:inline" />
            AI Response
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="w-4 h-4 mr-1.5" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-1.5">
            <Shield className="w-4 h-4 mr-1.5" />
            Admin
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="size-3.5 hidden sm:inline" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-1.5 text-red-600 data-[state=active]:text-red-600">
            <AlertTriangle className="size-3.5 hidden sm:inline" />
            Danger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <WorkspaceSettingsForm />
          <MembersTable />
        </TabsContent>

        <TabsContent value="aspects" className="mt-6">
          <Card>
            <CardContent className="p-6 text-center">
              <LayoutGrid className="size-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Business Aspects</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage the aspects of your business used for review analysis.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/settings/aspects">
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Manage Aspects
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-response" className="mt-6">
          <AIResponseSettingsTab />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <AdminTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsSettingsTab />
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <DangerZoneTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
