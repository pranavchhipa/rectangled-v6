'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Sparkles,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  MapPin,
  Copy,
  RefreshCw,
  Save,
  Calendar,
  Loader2,
  Trash2,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Clock,
  Hash,
  Image as ImageIcon,
  Upload,
  Download,
  Link,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Globe,
  TrendingUp,
  Coins,
  BarChart3,
  Zap,
  Target,
  Eye,
  ExternalLink,
  CalendarDays,
  FileText,
  Mic2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { value: 'google', label: 'Google', icon: MapPin, color: '#4285F4' },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter, color: '#000000' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
] as const

const CONTENT_TYPES = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'reel_caption', label: 'Reel Caption' },
  { value: 'event', label: 'Event' },
  { value: 'offer', label: 'Offer' },
] as const

const TONES = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'playful', label: 'Playful', emoji: '🎉' },
  { value: 'luxurious', label: 'Luxurious', emoji: '✨' },
] as const

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const PERIOD_OPTIONS = [
  { value: 1, label: '1 Month' },
  { value: 2, label: '2 Months' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
] as const

const DOWNLOAD_SIZES = [
  { label: 'Instagram Post', size: '1080 x 1080', width: 1080, height: 1080 },
  { label: 'Instagram Story', size: '1080 x 1920', width: 1080, height: 1920 },
  { label: 'Facebook Post', size: '1200 x 630', width: 1200, height: 630 },
  { label: 'Twitter Post', size: '1200 x 675', width: 1200, height: 675 },
  { label: 'LinkedIn Post', size: '1200 x 627', width: 1200, height: 627 },
] as const

const STEPPER_STEPS = [
  { number: 1, label: 'Analysis' },
  { number: 2, label: 'Ideas' },
  { number: 3, label: 'Create' },
  { number: 4, label: 'Schedule' },
  { number: 5, label: 'Publish' },
]

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RaisPage() {
  const { currentWorkspaceId } = useAuthStore()
  const [activeTab, setActiveTab] = useState('create-from-reviews')

  const creditsQuery = trpc.rais.getCredits.useQuery(
    { workspaceId: currentWorkspaceId || '' },
    { enabled: !!currentWorkspaceId }
  )

  const creditLogQuery = trpc.rais.getCreditLog.useQuery(
    { workspaceId: currentWorkspaceId || '', limit: 20 },
    { enabled: !!currentWorkspaceId }
  )

  const credits = creditsQuery.data as any

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            <h1 className="text-2xl font-bold tracking-tight">AI Studio</h1>
            <Badge variant="outline" className="ml-2 text-purple-600 border-purple-200">
              rAIS
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Create engaging social content powered by AI
          </p>
        </div>

        {/* Credit Display */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`gap-2 ${
                credits && credits.remaining < 10
                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  : ''
              }`}
            >
              <Coins className="h-4 w-4" />
              {creditsQuery.isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : credits ? (
                <span>
                  {credits.remaining} / {credits.total} credits
                </span>
              ) : (
                <span>-- credits</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Credit Balance</h4>
                {credits && credits.remaining < 10 && (
                  <Badge variant="destructive" className="text-xs">Low</Badge>
                )}
              </div>
              {credits && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{credits.remaining} remaining</span>
                    <span className="text-muted-foreground">{credits.total} total</span>
                  </div>
                  <Progress value={(credits.remaining / credits.total) * 100} className="h-2" />
                </div>
              )}
              <Separator />
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Recent Transactions</h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(creditLogQuery.data as any)?.log?.map((entry: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1 mr-2">{entry.description}</span>
                      <span className={entry.amount < 0 ? 'text-red-500' : 'text-green-500'}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                    </div>
                  )) || (
                    <span className="text-xs text-muted-foreground">No transactions yet</span>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create-from-reviews" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Create from Reviews
          </TabsTrigger>
          <TabsTrigger value="make-your-own" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            Make Your Own Post
          </TabsTrigger>
          <TabsTrigger value="my-posts" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            My Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create-from-reviews" className="mt-6">
          <CreateFromReviewsTab />
        </TabsContent>
        <TabsContent value="make-your-own" className="mt-6">
          <MakeYourOwnTab />
        </TabsContent>
        <TabsContent value="my-posts" className="mt-6">
          <MyPostsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper Component
// ---------------------------------------------------------------------------

function StepperProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPPER_STEPS.map((step, i) => {
          const isActive = currentStep === step.number
          const isCompleted = currentStep > step.number
          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                    isCompleted
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : isActive
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'border-muted-foreground/25 text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium ${
                    isActive || isCompleted
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPPER_STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded transition-all ${
                    isCompleted ? 'bg-purple-500' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1: Create from Reviews (5-step stepper)
// ---------------------------------------------------------------------------

function CreateFromReviewsTab() {
  const { currentWorkspaceId } = useAuthStore()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [locationId, setLocationId] = useState<string>('')
  const [periodMonths, setPeriodMonths] = useState<1 | 2 | 3 | 6>(3)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisId, setAnalysisId] = useState<string>('')

  // Step 2 state
  const [ideas, setIdeas] = useState<any[]>([])
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null)

  // Step 3 state
  const [generatedPosts, setGeneratedPosts] = useState<any[]>([])
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null)
  const [editedPosts, setEditedPosts] = useState<any[]>([])

  // Step 4 state
  const [scheduledDate, setScheduledDate] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('instagram')
  const [trendsCountry, setTrendsCountry] = useState('India')
  const [trendsResult, setTrendsResult] = useState<any>(null)
  const [industryInput, setIndustryInput] = useState('')
  const [industryResult, setIndustryResult] = useState<any>(null)

  // Locations query
  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  // Mutations
  const analyzeReviews = trpc.rais.analyzeReviews.useMutation({
    onSuccess: (data: any) => {
      setAnalysisResult(data)
      setAnalysisId(data.analysisId || data.id)
      toast.success('Reviews analyzed successfully!')
    },
    onError: (err) => toast.error(err.message),
  })

  const generatePostIdeas = trpc.rais.generatePostIdeas.useMutation({
    onSuccess: (data: any) => {
      setIdeas(data.ideas || data)
      toast.success('Post ideas generated!')
    },
    onError: (err) => toast.error(err.message),
  })

  const generatePost = trpc.rais.generatePost.useMutation({
    onSuccess: (data: any) => {
      const posts = Array.isArray(data) ? data : data.options || data.posts || [data]
      setGeneratedPosts(posts)
      setEditedPosts(posts.map((p: any) => ({ ...p })))
      if (posts.length > 0 && posts[0]?.title) {
        setSelectedPostIndex(0)
      }
      toast.success('Posts created!')
    },
    onError: (err) => toast.error(err.message),
  })

  const regenerateElement = trpc.rais.regenerateElement.useMutation({
    onError: (err) => toast.error(err.message),
  })

  const schedulePost = trpc.rais.schedulePost.useMutation({
    onSuccess: () => toast.success('Post scheduled!'),
    onError: (err) => toast.error(err.message),
  })

  const createPost = trpc.rais.createPost.useMutation({
    onSuccess: () => toast.success('Post saved as draft!'),
    onError: (err) => toast.error(err.message),
  })

  const getRecentTrends = trpc.rais.getRecentTrends.useMutation({
    onSuccess: (data: any) => {
      setTrendsResult(data)
      toast.success('Trends loaded!')
    },
    onError: (err) => toast.error(err.message),
  })

  const getIndustryOpportunities = trpc.rais.getIndustryOpportunities.useMutation({
    onSuccess: (data: any) => {
      setIndustryResult(data)
      toast.success('Industry insights loaded!')
    },
    onError: (err) => toast.error(err.message),
  })

  // Handlers
  const handleAnalyze = () => {
    if (!currentWorkspaceId) return
    analyzeReviews.mutate({
      workspaceId: currentWorkspaceId,
      locationId: locationId && locationId !== 'all' ? locationId : undefined,
      periodMonths,
    })
  }

  const handleGenerateIdeas = () => {
    if (!currentWorkspaceId || !analysisId) return
    generatePostIdeas.mutate({
      workspaceId: currentWorkspaceId,
      analysisId,
    })
  }

  const handleGeneratePost = () => {
    if (!currentWorkspaceId || selectedIdeaIndex === null || !analysisId) return
    generatePost.mutate({
      workspaceId: currentWorkspaceId,
      ideaIndex: selectedIdeaIndex,
      analysisId,
    })
  }

  const handleRegenerate = async (postId: string, element: 'title' | 'description' | 'hashtags' | 'image') => {
    if (!currentWorkspaceId) return
    const result = await regenerateElement.mutateAsync({
      workspaceId: currentWorkspaceId,
      postId,
      element,
    })
    // Update the edited post with new data
    if (selectedPostIndex !== null && result) {
      setEditedPosts((prev) => {
        const updated = [...prev]
        const r = result as any
        if (element === 'title' && r.title) updated[selectedPostIndex] = { ...updated[selectedPostIndex], title: r.title }
        if (element === 'description' && r.description) updated[selectedPostIndex] = { ...updated[selectedPostIndex], description: r.description }
        if (element === 'hashtags' && r.hashtags) updated[selectedPostIndex] = { ...updated[selectedPostIndex], hashtags: r.hashtags }
        if (element === 'image' && r.imagePrompt) updated[selectedPostIndex] = { ...updated[selectedPostIndex], imagePrompt: r.imagePrompt }
        return updated
      })
      toast.success(`${element} regenerated!`)
    }
  }

  const handleSchedule = () => {
    if (!currentWorkspaceId || selectedPostIndex === null) return
    const post = editedPosts[selectedPostIndex]
    if (!post?.id) {
      toast.error('No post selected')
      return
    }
    schedulePost.mutate({
      workspaceId: currentWorkspaceId,
      postId: post.id,
      scheduledFor: new Date(scheduledDate).toISOString(),
      platform: selectedPlatform,
    })
  }

  const handleSaveDraft = () => {
    if (!currentWorkspaceId || selectedPostIndex === null) return
    const post = editedPosts[selectedPostIndex]
    createPost.mutate({
      workspaceId: currentWorkspaceId,
      platform: selectedPlatform as any,
      contentType: 'post',
      caption: `${post.title || ''}\n\n${post.description || ''}`,
      hashtags: post.hashtags || [],
      imageUrl: post.imageUrl || undefined,
    })
  }

  const handleDownload = (imageUrl: string, label: string) => {
    if (!imageUrl) {
      toast.error('No image available to download')
      return
    }
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `${label.replace(/\s+/g, '-').toLowerCase()}.png`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const selectedPost = selectedPostIndex !== null ? editedPosts[selectedPostIndex] : null

  return (
    <div>
      <StepperProgress currentStep={step} />

      {/* ================================================================= */}
      {/* Step 1: Analysis */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Analyze Your Reviews</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We'll analyze your recent reviews to find the best content angles
            </p>
          </div>

          <Card className="p-6 space-y-5">
            {/* Location Selector */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Location (optional)</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {(locationsQuery.data as any)?.map?.((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name || loc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Selector */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Time Period</Label>
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={periodMonths === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriodMonths(opt.value as any)}
                    className={periodMonths === opt.value ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Estimated credit cost: ~{Math.ceil(periodMonths * 5 * 0.05)} credits
              </p>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleAnalyze}
                disabled={analyzeReviews.isPending}
              >
                {analyzeReviews.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-2" />
                )}
                Analyze Reviews
              </Button>
            </div>
          </Card>

          {/* Loading State */}
          {analyzeReviews.isPending && (
            <Card className="p-6 space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          )}

          {/* Analysis Result */}
          {analysisResult && !analyzeReviews.isPending && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Analysis Complete</h3>
              </div>

              {analysisResult.aiSummary && (
                <div>
                  <Label className="text-xs text-muted-foreground">AI Summary</Label>
                  <p className="text-sm mt-1">{analysisResult.aiSummary}</p>
                </div>
              )}

              {analysisResult.overallSentiment != null && (
                <div>
                  <Label className="text-xs text-muted-foreground">Overall Sentiment</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={
                        analysisResult.overallSentiment > 0.3
                          ? 'bg-green-100 text-green-700'
                          : analysisResult.overallSentiment < -0.3
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }
                    >
                      {analysisResult.overallSentiment > 0.3 ? 'Positive' : analysisResult.overallSentiment < -0.3 ? 'Negative' : 'Neutral'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({(analysisResult.overallSentiment * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              )}

              {analysisResult.positiveAspects?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Positive Aspects</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {analysisResult.positiveAspects.map((a: any, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        {typeof a === 'string' ? a : a.aspect || JSON.stringify(a)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.topThemes?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Top Themes</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {analysisResult.topThemes.map((t: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {typeof t === 'string' ? t : t.theme || JSON.stringify(t)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    handleGenerateIdeas()
                    setStep(2)
                  }}
                >
                  Next: Generate Ideas
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 2: Generate Post Ideas */}
      {/* ================================================================= */}
      {step === 2 && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Choose a Post Idea</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select the idea that resonates best with your brand
            </p>
          </div>

          {generatePostIdeas.isPending ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-3" />
                  <Skeleton className="h-16 w-full mb-3" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-18" />
                  </div>
                </Card>
              ))}
            </div>
          ) : ideas.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ideas.map((idea: any, i: number) => {
                  const isSelected = selectedIdeaIndex === i
                  return (
                    <Card
                      key={i}
                      className={`p-5 cursor-pointer transition-all hover:shadow-md overflow-hidden ${
                        isSelected
                          ? 'ring-2 ring-purple-500 border-purple-300 shadow-md'
                          : 'hover:border-purple-200'
                      }`}
                      onClick={() => setSelectedIdeaIndex(i)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm line-clamp-2 break-words">{idea.title}</h3>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-purple-500 shrink-0 ml-2" />
                        )}
                      </div>
                      {idea.subtitle && (
                        <p className="text-xs text-muted-foreground mb-2">{idea.subtitle}</p>
                      )}
                      {idea.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                          {idea.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {idea.hashtags?.slice(0, 4).map((tag: string, j: number) => (
                          <span key={j} className="text-xs text-purple-500">#{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2 min-w-0">
                        {idea.viralityAngle && (
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {idea.viralityAngle}
                            </span>
                          </div>
                        )}
                        {idea.targetPlatform && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {idea.targetPlatform}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={selectedIdeaIndex === null}
                  onClick={() => {
                    handleGeneratePost()
                    setStep(3)
                  }}
                >
                  Generate Posts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <Lightbulb className="h-12 w-12 text-amber-200 mx-auto mb-4" />
              <p className="text-muted-foreground">Generating ideas from your review analysis...</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleGenerateIdeas}
                disabled={generatePostIdeas.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 3: Create Posts */}
      {/* ================================================================= */}
      {step === 3 && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Your Generated Posts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select your preferred option and customize it
            </p>
          </div>

          {generatePost.isPending ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="p-5 space-y-4">
                  <Skeleton className="h-48 w-full rounded-lg" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                </Card>
              ))}
            </div>
          ) : editedPosts.length > 0 ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {editedPosts.map((post: any, i: number) => {
                  const isSelected = selectedPostIndex === i
                  return (
                    <Card
                      key={i}
                      className={`p-5 transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-purple-500 border-purple-300 shadow-lg'
                          : 'hover:shadow-md hover:border-purple-200'
                      }`}
                      onClick={() => setSelectedPostIndex(i)}
                    >
                      {/* Image */}
                      <div className="relative bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950 dark:to-indigo-950 rounded-lg aspect-square flex items-center justify-center mb-4 overflow-hidden">
                        {post.imageUrl ? (
                          <img
                            src={post.imageUrl}
                            alt="Generated"
                            className="w-full h-full object-cover rounded-lg"
                            loading="lazy"
                            onError={(e) => {
                              // Retry with a slightly different seed on error
                              const target = e.target as HTMLImageElement
                              if (!target.dataset.retried) {
                                target.dataset.retried = 'true'
                                target.src = post.imageUrl + '&retry=1'
                              }
                            }}
                          />
                        ) : (
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 text-purple-300 mx-auto mb-2 animate-spin" />
                            <p className="text-xs text-purple-400">Generating image...</p>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="h-6 w-6 text-purple-500 bg-white rounded-full" />
                          </div>
                        )}
                      </div>

                      {/* Image Regenerate Button */}
                      <div className="flex justify-end mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={regenerateElement.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (post.id) handleRegenerate(post.id, 'image')
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          New Image
                        </Button>
                      </div>

                      {/* Title */}
                      <div className="flex items-start gap-2 mb-3">
                        <Input
                          value={post.title || ''}
                          onChange={(e) => {
                            setEditedPosts((prev) => {
                              const updated = [...prev]
                              updated[i] = { ...updated[i], title: e.target.value }
                              return updated
                            })
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold"
                          placeholder="Post title..."
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          disabled={regenerateElement.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (post.id) handleRegenerate(post.id, 'title')
                          }}
                        >
                          {regenerateElement.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {/* Description */}
                      <div className="flex items-start gap-2 mb-3">
                        <textarea
                          value={post.description || ''}
                          onChange={(e) => {
                            setEditedPosts((prev) => {
                              const updated = [...prev]
                              updated[i] = { ...updated[i], description: e.target.value }
                              return updated
                            })
                          }}
                          onClick={(e) => e.stopPropagation()}
                          rows={4}
                          className="flex-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
                          placeholder="Post description..."
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          disabled={regenerateElement.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (post.id) handleRegenerate(post.id, 'description')
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Hashtags */}
                      <div className="flex items-start gap-2">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {(post.hashtags || []).map((tag: string, j: number) => (
                            <Badge key={j} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                          {(!post.hashtags || post.hashtags.length === 0) && (
                            <span className="text-xs text-muted-foreground">No hashtags</span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          disabled={regenerateElement.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (post.id) handleRegenerate(post.id, 'hashtags')
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={selectedPostIndex === null}
                  onClick={() => setStep(4)}
                >
                  Schedule
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <Sparkles className="h-12 w-12 text-purple-200 mx-auto mb-4" />
              <p className="text-muted-foreground">Creating your posts...</p>
            </Card>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 4: Schedule */}
      {/* ================================================================= */}
      {step === 4 && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Schedule Your Post</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose when and where to publish
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Scheduling Controls */}
            <div className="space-y-4">
              <Card className="p-5 space-y-4">
                <div>
                  <Label className="mb-2 block text-sm font-medium">Schedule Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                  {selectedPost?.bestPostingTime && (
                    <p className="text-xs text-purple-600 mt-1.5 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      AI recommends: {selectedPost.bestPostingTime}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="mb-2 block text-sm font-medium">Platform</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const Icon = p.icon
                      const isActive = selectedPlatform === p.value
                      return (
                        <button
                          key={p.value}
                          onClick={() => setSelectedPlatform(p.value)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                            isActive
                              ? 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-300'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          <Icon className="h-4 w-4" style={{ color: isActive ? p.color : undefined }} />
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleSaveDraft}
                    disabled={createPost.isPending}
                  >
                    {createPost.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save as Draft
                  </Button>
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={handleSchedule}
                    disabled={!scheduledDate || schedulePost.isPending}
                  >
                    {schedulePost.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CalendarDays className="h-4 w-4 mr-2" />
                    )}
                    Schedule Post
                  </Button>
                </div>
              </Card>
            </div>

            {/* Right: AI-Driven Insights */}
            <div className="space-y-4">
              {/* Recent Trends */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <h3 className="font-semibold text-sm">Recent Trends</h3>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={trendsCountry}
                    onChange={(e) => setTrendsCountry(e.target.value)}
                    placeholder="Country..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!currentWorkspaceId) return
                      getRecentTrends.mutate({
                        workspaceId: currentWorkspaceId,
                        country: trendsCountry,
                      })
                    }}
                    disabled={getRecentTrends.isPending}
                  >
                    {getRecentTrends.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                {getRecentTrends.isPending && (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                )}
                {trendsResult && (
                  <div className="space-y-2 text-sm">
                    {trendsResult.campaigns?.map((c: any, i: number) => (
                      <div key={i} className="p-2 rounded bg-muted">
                        <p className="font-medium text-xs">{c.title || c.name}</p>
                        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                    ))}
                    {trendsResult.holidays?.map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        <span>{h.name || h}</span>
                        {h.date && <span className="text-muted-foreground">({h.date})</span>}
                      </div>
                    ))}
                    {typeof trendsResult === 'string' && (
                      <p className="text-xs">{trendsResult}</p>
                    )}
                  </div>
                )}
              </Card>

              {/* Posting Tips */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Posting Tips</h3>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Best times to post in India:</p>
                  <div className="space-y-1">
                    <p><strong>Instagram:</strong> 11 AM - 1 PM, 7 PM - 9 PM</p>
                    <p><strong>Facebook:</strong> 1 PM - 4 PM</p>
                    <p><strong>Twitter/X:</strong> 9 AM - 11 AM</p>
                    <p><strong>LinkedIn:</strong> 8 AM - 10 AM (weekdays)</p>
                  </div>
                  <p className="pt-1">Post consistently 3-5 times per week for best engagement.</p>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => setStep(5)}
            >
              Next: Publish
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 5: Publish */}
      {/* ================================================================= */}
      {step === 5 && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Publish Your Post</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how you want to share your content
            </p>
          </div>

          {/* Post Preview */}
          {selectedPost && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Post Preview</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-[300px_1fr]">
                <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950 dark:to-indigo-950 rounded-lg aspect-square flex items-center justify-center">
                  {selectedPost.imageUrl ? (
                    <img
                      src={selectedPost.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-purple-300" />
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">{selectedPost.title}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedPost.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedPost.hashtags || []).map((tag: string, i: number) => (
                      <span key={i} className="text-xs text-purple-500">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Publishing Options */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Path A: Direct Publishing */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ExternalLink className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">Direct Publishing</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Connect your social accounts to publish directly
              </p>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => window.open('/dashboard/connectors', '_blank')}
                >
                  <Instagram className="h-4 w-4" style={{ color: '#E4405F' }} />
                  Connect Instagram
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => window.open('/dashboard/connectors', '_blank')}
                >
                  <Facebook className="h-4 w-4" style={{ color: '#1877F2' }} />
                  Connect Facebook
                </Button>
                <Separator className="my-2" />
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Publish Now
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Connect a social account first
                </p>
              </div>
            </Card>

            {/* Path B: Download */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Download className="h-4 w-4 text-indigo-500" />
                <h3 className="font-semibold text-sm">Download</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Download optimized images for each platform
              </p>
              <div className="space-y-2">
                {DOWNLOAD_SIZES.map((ds) => (
                  <Button
                    key={ds.label}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => handleDownload(selectedPost?.imageUrl || '', ds.label)}
                  >
                    <span className="text-sm">{ds.label}</span>
                    <span className="text-xs text-muted-foreground">{ds.size}</span>
                  </Button>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep(1)
                setAnalysisResult(null)
                setAnalysisId('')
                setIdeas([])
                setSelectedIdeaIndex(null)
                setGeneratedPosts([])
                setEditedPosts([])
                setSelectedPostIndex(null)
                setScheduledDate('')
                setTrendsResult(null)
                setIndustryResult(null)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Post
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Make Your Own Post
// ---------------------------------------------------------------------------

function MakeYourOwnTab() {
  const { currentWorkspaceId } = useAuthStore()
  const [imageUrl, setImageUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [editedResult, setEditedResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const makeYourOwnPost = trpc.rais.makeYourOwnPost.useMutation({
    onSuccess: (data: any) => {
      setResult(data)
      setEditedResult({ ...data })
      toast.success('Post generated!')
    },
    onError: (err) => toast.error(err.message),
  })

  const regenerateElement = trpc.rais.regenerateElement.useMutation({
    onError: (err) => toast.error(err.message),
  })

  const createPost = trpc.rais.createPost.useMutation({
    onSuccess: () => toast.success('Post saved as draft!'),
    onError: (err) => toast.error(err.message),
  })

  const handleFileSelect = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreviewImage(dataUrl)
      setImageUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  const handleGenerate = () => {
    if (!currentWorkspaceId || !imageUrl.trim()) {
      toast.error('Please provide an image')
      return
    }
    makeYourOwnPost.mutate({
      workspaceId: currentWorkspaceId,
      imageUrl,
      websiteUrl: websiteUrl.trim() || undefined,
    })
  }

  const handleRegenerate = async (element: 'title' | 'description' | 'hashtags') => {
    if (!currentWorkspaceId || !result?.id) return
    const res = await regenerateElement.mutateAsync({
      workspaceId: currentWorkspaceId,
      postId: result.id,
      element,
    })
    if (res) {
      const r = res as any
      setEditedResult((prev: any) => ({
        ...prev,
        ...(element === 'title' && r.title ? { title: r.title } : {}),
        ...(element === 'description' && r.description ? { description: r.description } : {}),
        ...(element === 'hashtags' && r.hashtags ? { hashtags: r.hashtags } : {}),
      }))
      toast.success(`${element} regenerated!`)
    }
  }

  const handleSaveDraft = () => {
    if (!currentWorkspaceId || !editedResult) return
    createPost.mutate({
      workspaceId: currentWorkspaceId,
      platform: 'instagram',
      contentType: 'post',
      caption: `${editedResult.title || ''}\n\n${editedResult.description || ''}`,
      hashtags: editedResult.hashtags || [],
      imageUrl: editedResult.imageUrl || previewImage || undefined,
    })
  }

  const handleDownload = (label: string) => {
    const url = editedResult?.imageUrl || previewImage
    if (!url) {
      toast.error('No image available')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = `${label.replace(/\s+/g, '-').toLowerCase()}.png`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!result ? (
        <>
          {/* Upload Section */}
          <Card className="p-6 space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold">Make Your Own Post</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload an image or paste a URL and we'll create engaging content
              </p>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/20'
                  : 'border-muted-foreground/25 hover:border-purple-300 hover:bg-muted/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
              {previewImage ? (
                <div className="space-y-3">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-xs text-muted-foreground">Click or drag to replace</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                  <div>
                    <p className="font-medium text-sm">Drop your image here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            {/* Image URL */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Paste Image URL</Label>
              <Input
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setPreviewImage(null)
                }}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Website URL */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Website URL (optional)</Label>
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://your-business.com"
                  className="flex-1"
                />
              </div>
            </div>

            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
              onClick={handleGenerate}
              disabled={makeYourOwnPost.isPending || !imageUrl.trim()}
            >
              {makeYourOwnPost.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Post
            </Button>
          </Card>
        </>
      ) : editedResult ? (
        <>
          {/* Result Section */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Your Generated Post</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResult(null)
                  setEditedResult(null)
                  setPreviewImage(null)
                  setImageUrl('')
                  setWebsiteUrl('')
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Post
              </Button>
            </div>

            {/* Hero Preview */}
            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950 dark:to-indigo-950 rounded-xl overflow-hidden">
              {(editedResult.imageUrl || previewImage) ? (
                <img
                  src={editedResult.imageUrl || previewImage}
                  alt="Generated"
                  className="w-full max-h-96 object-contain"
                />
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-purple-300" />
                </div>
              )}
            </div>

            {/* Title */}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
                <Input
                  value={editedResult.title || ''}
                  onChange={(e) => setEditedResult((prev: any) => ({ ...prev, title: e.target.value }))}
                  className="font-semibold text-lg"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="mt-5"
                disabled={regenerateElement.isPending}
                onClick={() => handleRegenerate('title')}
              >
                {regenerateElement.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Description */}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                <textarea
                  value={editedResult.description || ''}
                  onChange={(e) => setEditedResult((prev: any) => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="mt-5"
                disabled={regenerateElement.isPending}
                onClick={() => handleRegenerate('description')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Hashtags */}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Hashtags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(editedResult.hashtags || []).map((tag: string, i: number) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/10 group"
                      onClick={() =>
                        setEditedResult((prev: any) => ({
                          ...prev,
                          hashtags: prev.hashtags.filter((_: string, idx: number) => idx !== i),
                        }))
                      }
                    >
                      #{tag}
                      <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="mt-5"
                disabled={regenerateElement.isPending}
                onClick={() => handleRegenerate('hashtags')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Separator />

            {/* Download Buttons */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Download for Platform</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DOWNLOAD_SIZES.map((ds) => (
                  <Button
                    key={ds.label}
                    variant="outline"
                    className="justify-between"
                    onClick={() => handleDownload(ds.label)}
                  >
                    <span className="text-sm">{ds.label}</span>
                    <span className="text-xs text-muted-foreground">{ds.size}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleSaveDraft}
              disabled={createPost.isPending}
            >
              {createPost.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save as Draft
            </Button>
          </Card>
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3: My Posts (with sub-tabs for Posts, Calendar, Brand Voice)
// ---------------------------------------------------------------------------

function MyPostsTab() {
  const [subTab, setSubTab] = useState('posts')

  return (
    <div>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="posts" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="brand-voice" className="gap-1.5">
            <Mic2 className="h-3.5 w-3.5" />
            Brand Voice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <PostsList />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>
        <TabsContent value="brand-voice">
          <BrandVoiceSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posts List Sub-tab
// ---------------------------------------------------------------------------

function PostsList() {
  const { currentWorkspaceId } = useAuthStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [editingPost, setEditingPost] = useState<any>(null)
  const [editCaption, setEditCaption] = useState('')

  const postsQuery = trpc.rais.listPosts.useQuery(
    {
      workspaceId: currentWorkspaceId || '',
      status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
      platform: platformFilter !== 'all' ? (platformFilter as any) : undefined,
      limit: 50,
    },
    { enabled: !!currentWorkspaceId }
  )

  const updatePost = trpc.rais.updatePost.useMutation({
    onSuccess: () => {
      toast.success('Post updated')
      setEditingPost(null)
      postsQuery.refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const deletePost = trpc.rais.deletePost.useMutation({
    onSuccess: () => {
      toast.success('Post deleted')
      postsQuery.refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find((pl) => pl.value === platform)
    if (!p) return MapPin
    return p.icon
  }

  const getPlatformColor = (platform: string) => {
    const p = PLATFORMS.find((pl) => pl.value === platform)
    return p?.color || '#666'
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posts Grid */}
      {postsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : postsQuery.data?.posts.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <Save className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No posts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generate your first post in the "Create from Reviews" tab
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {postsQuery.data?.posts.map((post: any) => {
            const PlatformIcon = getPlatformIcon(post.platform)
            return (
              <Card
                key={post.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setEditingPost(post)
                  setEditCaption(post.caption)
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PlatformIcon
                      className="h-4 w-4"
                      style={{ color: getPlatformColor(post.platform) }}
                    />
                    <span className="text-xs font-medium capitalize">{post.platform}</span>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[post.status] || ''}`} variant="secondary">
                    {post.status}
                  </Badge>
                </div>
                <p className="text-sm line-clamp-3">{post.caption}</p>
                {post.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.hashtags.slice(0, 4).map((tag: string, i: number) => (
                      <span key={i} className="text-xs text-purple-500">
                        #{tag}
                      </span>
                    ))}
                    {post.hashtags.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{post.hashtags.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {post.scheduledFor && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.scheduledFor).toLocaleDateString()}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPost} onOpenChange={() => setEditingPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          {editingPost && (
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-sm">Caption</Label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (!currentWorkspaceId) return
                    deletePost.mutate({ id: editingPost.id, workspaceId: currentWorkspaceId })
                    setEditingPost(null)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!currentWorkspaceId) return
                    updatePost.mutate({
                      id: editingPost.id,
                      workspaceId: currentWorkspaceId,
                      caption: editCaption,
                    })
                  }}
                  disabled={updatePost.isPending}
                >
                  {updatePost.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar View Sub-tab
// ---------------------------------------------------------------------------

function CalendarView() {
  const { currentWorkspaceId } = useAuthStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const calendarQuery = trpc.rais.getCalendar.useQuery(
    { workspaceId: currentWorkspaceId || '', month, year },
    { enabled: !!currentWorkspaceId }
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' })

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find((pl) => pl.value === platform)
    if (!p) return MapPin
    return p.icon
  }

  const getPlatformColor = (platform: string) => {
    const p = PLATFORMS.find((pl) => pl.value === platform)
    return p?.color || '#666'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {monthName} {year}
        </h3>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] rounded-lg" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayPosts = (calendarQuery.data as any)?.days?.[dateKey] || []
          const isToday =
            day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear()

          return (
            <div
              key={day}
              className={`min-h-[80px] rounded-lg border p-1.5 ${
                isToday ? 'border-purple-300 bg-purple-50/50 dark:bg-purple-950/20' : 'border-border'
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday ? 'text-purple-600' : 'text-muted-foreground'
                }`}
              >
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayPosts.slice(0, 3).map((post: any, j: number) => {
                  const Icon = getPlatformIcon(post.platform)
                  return (
                    <div
                      key={j}
                      className="flex items-center gap-1 rounded bg-muted px-1 py-0.5"
                    >
                      <Icon
                        className="h-2.5 w-2.5 shrink-0"
                        style={{ color: getPlatformColor(post.platform) }}
                      />
                      <span className="text-[10px] truncate">{post.caption}</span>
                    </div>
                  )
                })}
                {dayPosts.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayPosts.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Brand Voice Settings Sub-tab
// ---------------------------------------------------------------------------

function BrandVoiceSettings() {
  const { currentWorkspaceId } = useAuthStore()
  const [tone, setTone] = useState('professional')
  const [keywords, setKeywords] = useState<string[]>([])
  const [avoidWords, setAvoidWords] = useState<string[]>([])
  const [samplePosts, setSamplePosts] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [avoidInput, setAvoidInput] = useState('')
  const [loaded, setLoaded] = useState(false)

  const brandVoiceQuery = trpc.rais.getBrandVoice.useQuery(
    { workspaceId: currentWorkspaceId || '' },
    { enabled: !!currentWorkspaceId }
  )

  useEffect(() => {
    if (!loaded && brandVoiceQuery.data) {
      const data = brandVoiceQuery.data as any
      setTone(data.tone || 'professional')
      setKeywords(data.keywords || [])
      setAvoidWords(data.avoidWords || [])
      setSamplePosts((data.samplePosts || []).join('\n'))
      setLoaded(true)
    }
  }, [brandVoiceQuery.data, loaded])

  const updateBrandVoice = trpc.rais.updateBrandVoice.useMutation({
    onSuccess: () => toast.success('Brand voice saved!'),
    onError: (err) => toast.error(err.message),
  })

  const handleAddKeyword = () => {
    const val = keywordInput.trim()
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val])
      setKeywordInput('')
    }
  }

  const handleAddAvoid = () => {
    const val = avoidInput.trim()
    if (val && !avoidWords.includes(val)) {
      setAvoidWords([...avoidWords, val])
      setAvoidInput('')
    }
  }

  const handleSave = () => {
    if (!currentWorkspaceId) return
    updateBrandVoice.mutate({
      workspaceId: currentWorkspaceId,
      tone,
      keywords,
      avoidWords,
      samplePosts: samplePosts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Tone selector */}
      <Card className="p-4">
        <Label className="mb-3 block text-sm font-medium">Brand Tone</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                tone === t.value
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <span className="text-2xl">{t.emoji}</span>
              <p className="mt-1 text-sm font-medium">{t.label}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Keywords */}
      <Card className="p-4">
        <Label className="mb-3 block text-sm font-medium">Keywords to Include</Label>
        <div className="flex gap-2">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Add a keyword..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
          />
          <Button variant="outline" size="sm" onClick={handleAddKeyword}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {keywords.map((kw, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10 group"
              onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))}
            >
              {kw}
              <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
            </Badge>
          ))}
          {keywords.length === 0 && (
            <span className="text-xs text-muted-foreground">No keywords added</span>
          )}
        </div>
      </Card>

      {/* Avoid Words */}
      <Card className="p-4">
        <Label className="mb-3 block text-sm font-medium">Words to Avoid</Label>
        <div className="flex gap-2">
          <Input
            value={avoidInput}
            onChange={(e) => setAvoidInput(e.target.value)}
            placeholder="Add a word to avoid..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAvoid())}
          />
          <Button variant="outline" size="sm" onClick={handleAddAvoid}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {avoidWords.map((w, i) => (
            <Badge
              key={i}
              variant="destructive"
              className="cursor-pointer group"
              onClick={() => setAvoidWords(avoidWords.filter((_, idx) => idx !== i))}
            >
              {w}
              <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
            </Badge>
          ))}
          {avoidWords.length === 0 && (
            <span className="text-xs text-muted-foreground">No words added</span>
          )}
        </div>
      </Card>

      {/* Sample Posts */}
      <Card className="p-4">
        <Label className="mb-3 block text-sm font-medium">
          Sample Posts (one per line)
        </Label>
        <textarea
          value={samplePosts}
          onChange={(e) => setSamplePosts(e.target.value)}
          placeholder="Paste sample posts that represent your brand voice, one per line..."
          rows={6}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
        />
      </Card>

      <Button
        className="w-full bg-purple-600 hover:bg-purple-700"
        onClick={handleSave}
        disabled={updateBrandVoice.isPending}
      >
        {updateBrandVoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Brand Voice
      </Button>
    </div>
  )
}
