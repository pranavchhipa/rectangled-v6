'use client'

import { useState, useCallback, useEffect } from 'react'
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

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RaisPage() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <h1 className="text-2xl font-bold tracking-tight">AI Studio</h1>
          <Badge variant="outline" className="ml-2 text-purple-600 border-purple-200">
            rAIS
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Create engaging social content with AI
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="posts">My Posts</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="brand-voice">Brand Voice</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <GenerateTab />
        </TabsContent>
        <TabsContent value="posts" className="mt-6">
          <PostsTab />
        </TabsContent>
        <TabsContent value="calendar" className="mt-6">
          <CalendarTab />
        </TabsContent>
        <TabsContent value="brand-voice" className="mt-6">
          <BrandVoiceTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generate Tab
// ---------------------------------------------------------------------------

function GenerateTab() {
  const { currentWorkspaceId } = useAuthStore()
  const [platform, setPlatform] = useState('instagram')
  const [contentType, setContentType] = useState('post')
  const [topic, setTopic] = useState('')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([])
  const [ideas, setIdeas] = useState<any[]>([])
  const [industry, setIndustry] = useState('')

  const generateCaption = trpc.rais.generateCaption.useMutation({
    onSuccess: (data) => {
      setGeneratedCaption(data.caption)
      setGeneratedHashtags(data.hashtags)
      toast.success('Caption generated!')
    },
    onError: (err) => toast.error(err.message),
  })

  const generateIdeas = trpc.rais.generateContentIdeas.useMutation({
    onSuccess: (data) => {
      setIdeas(data.ideas)
      toast.success(`${data.ideas.length} ideas generated!`)
    },
    onError: (err) => toast.error(err.message),
  })

  const createPost = trpc.rais.createPost.useMutation({
    onSuccess: () => toast.success('Post saved as draft!'),
    onError: (err) => toast.error(err.message),
  })

  const handleGenerate = () => {
    if (!currentWorkspaceId || !topic.trim()) {
      toast.error('Please enter a topic')
      return
    }
    generateCaption.mutate({
      workspaceId: currentWorkspaceId,
      platform: platform as any,
      contentType: contentType as any,
      topic,
    })
  }

  const handleGetIdeas = () => {
    if (!currentWorkspaceId || !industry.trim()) {
      toast.error('Please enter your industry')
      return
    }
    generateIdeas.mutate({
      workspaceId: currentWorkspaceId,
      industry,
      platform: platform as any,
    })
  }

  const handleCopy = () => {
    const text = generatedCaption + '\n\n' + generatedHashtags.map((h) => `#${h}`).join(' ')
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handleSaveDraft = () => {
    if (!currentWorkspaceId) return
    createPost.mutate({
      workspaceId: currentWorkspaceId,
      platform: platform as any,
      contentType: contentType as any,
      caption: generatedCaption,
      hashtags: generatedHashtags,
    })
  }

  const removeHashtag = (index: number) => {
    setGeneratedHashtags((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Input */}
      <div className="space-y-6">
        {/* Platform selector */}
        <Card className="p-4">
          <Label className="mb-3 block text-sm font-medium">Platform</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon
              const isActive = platform === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
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
        </Card>

        {/* Content type */}
        <Card className="p-4">
          <Label className="mb-3 block text-sm font-medium">Content Type</Label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                  contentType === ct.value
                    ? 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-300'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Topic */}
        <Card className="p-4">
          <Label className="mb-3 block text-sm font-medium">Topic / Description</Label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe what your post should be about..."
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
          />
          <Button
            className="mt-3 w-full bg-purple-600 hover:bg-purple-700"
            onClick={handleGenerate}
            disabled={generateCaption.isPending}
          >
            {generateCaption.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate
          </Button>
        </Card>

        {/* Content Ideas */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <Label className="text-sm font-medium">Content Ideas</Label>
          </div>
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Your industry (e.g., Restaurant, Spa, Dental)"
          />
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={handleGetIdeas}
            disabled={generateIdeas.isPending}
          >
            {generateIdeas.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4 mr-2" />
            )}
            Get Ideas
          </Button>
          {ideas.length > 0 && (
            <div className="mt-4 space-y-2">
              {ideas.map((idea, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    setTopic(idea.description || idea.title)
                    if (idea.contentType) setContentType(idea.contentType)
                    toast.success('Idea loaded into generator')
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{idea.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {idea.contentType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
                  {idea.bestTime && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{idea.bestTime}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right: Generated content */}
      <div className="space-y-6">
        {generatedCaption ? (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Generated Caption</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generateCaption.isPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${generateCaption.isPending ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <textarea
              value={generatedCaption}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none resize-none"
            />

            {/* Hashtags */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm font-medium">Hashtags</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {generatedHashtags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/10 group"
                    onClick={() => removeHashtag(i)}
                  >
                    #{tag}
                    <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={handleSaveDraft}
                disabled={createPost.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-12 flex flex-col items-center justify-center text-center">
            <Sparkles className="h-12 w-12 text-purple-200 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              Ready to create
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Choose a platform, content type, and describe your topic. Then hit Generate to create AI-powered content.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posts Tab
// ---------------------------------------------------------------------------

function PostsTab() {
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
            Generate your first post in the Generate tab.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {postsQuery.data?.posts.map((post) => {
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
                {post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.hashtags.slice(0, 4).map((tag, i) => (
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
// Calendar Tab
// ---------------------------------------------------------------------------

function CalendarTab() {
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
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
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
      {/* Month navigation */}
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Empty cells for days before first of month */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] rounded-lg" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayPosts = calendarQuery.data?.days?.[dateKey] || []
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
// Brand Voice Tab
// ---------------------------------------------------------------------------

function BrandVoiceTab() {
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
      const data = brandVoiceQuery.data
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
