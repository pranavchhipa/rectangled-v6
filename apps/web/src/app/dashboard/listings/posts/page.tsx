'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Plus,
  FileText,
  Calendar,
  ArrowLeft,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

export default function PostsPage() {
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [open, setOpen] = useState(false)
  const [postType, setPostType] = useState<string>('update')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [ctaType, setCtaType] = useState<string>('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [locationId, setLocationId] = useState<string>('')

  const postsQuery = trpc.listing.listPosts.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const createPostMutation = trpc.listing.createPost.useMutation({
    onSuccess: () => {
      toast.success('Post created successfully')
      utils.listing.listPosts.invalidate()
      resetForm()
      setOpen(false)
    },
    onError: () => {
      toast.error('Failed to create post')
    },
  })

  const publishMutation = trpc.listing?.publishGbpPost?.useMutation?.({
    onSuccess: () => {
      toast.success('Post published to Google!')
      utils.listing.listPosts.invalidate()
    },
    onError: () => {
      toast.error('Failed to publish post')
    },
  })

  const deletePostMutation = trpc.listing?.deletePost?.useMutation?.({
    onSuccess: () => {
      toast.success('Post deleted')
      utils.listing.listPosts.invalidate()
    },
    onError: () => {
      toast.error('Failed to delete post')
    },
  })

  const resetForm = () => {
    setPostType('update')
    setTitle('')
    setContent('')
    setImageUrl('')
    setCtaType('')
    setCtaUrl('')
    setLocationId('')
  }

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }
    createPostMutation.mutate({
      workspaceId: currentWorkspaceId!,
      locationId,
      type: postType,
      title: title.trim(),
      content: content.trim(),
      imageUrl: imageUrl.trim() || undefined,
      ctaType: ctaType || undefined,
      ctaUrl: ctaUrl.trim() || undefined,
    })
  }

  const posts = postsQuery.data ?? []

  const statusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/listings">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Posts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage your business posts
            </p>
          </div>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              Create Post
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Post</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Post Type</Label>
                <Select value={postType} onValueChange={setPostType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                />
              </div>

              <div className="space-y-2">
                <Label>Content</Label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your post content..."
                />
              </div>

              <div className="space-y-2">
                <Label>Image URL (optional)</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label>CTA Type (optional)</Label>
                <Select value={ctaType} onValueChange={setCtaType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select CTA type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="learn_more">Learn More</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="order">Order Online</SelectItem>
                    <SelectItem value="shop">Shop</SelectItem>
                    <SelectItem value="sign_up">Sign Up</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ctaType && (
                <div className="space-y-2">
                  <Label>CTA URL</Label>
                  <Input
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(locationsQuery.data ?? []).map((loc: any) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createPostMutation.isPending}
              >
                {createPostMutation.isPending ? 'Creating...' : 'Create Post'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Loading skeletons */}
      {postsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!postsQuery.isLoading && posts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first post to engage with your audience.
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Post
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Posts list */}
      {!postsQuery.isLoading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post: any) => (
            <Card key={post.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm truncate">{post.title}</h3>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {post.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.content}
                  </p>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={statusColor(post.status ?? 'draft')}>
                    {post.status ?? 'draft'}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {(post.status === 'draft' || !post.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          publishMutation?.mutate?.({
                            workspaceId: currentWorkspaceId!,
                            locationId: post.locationId,
                            type: post.type,
                            content: post.content,
                            title: post.title,
                          })
                        }}
                        disabled={publishMutation?.isPending}
                      >
                        {publishMutation?.isPending ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : (
                          <Send className="size-3 mr-1" />
                        )}
                        Publish to GBP
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        deletePostMutation?.mutate?.({
                          postId: post.id,
                          workspaceId: currentWorkspaceId!,
                        })
                      }}
                      disabled={deletePostMutation?.isPending}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
