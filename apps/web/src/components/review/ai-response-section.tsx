'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sparkles,
  Check,
  X,
  Pencil,
  RefreshCw,
  Send,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface ReviewResponse {
  id: string
  content: string
  status: string
  generatedBy: string
  aiModel: string | null
  postedAt: string | null
  createdAt: string
}

interface AIResponseSectionProps {
  reviewId: string
  responses: ReviewResponse[]
}

export function AIResponseSection({
  reviewId,
  responses,
}: AIResponseSectionProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const latestResponse = responses[0] ?? null

  const invalidateReview = () => {
    queryClient.invalidateQueries({ queryKey: [['review']] })
  }

  const generateMutation = trpc.review.generateResponse.useMutation({
    onSuccess: () => {
      toast.success('AI response generated')
      invalidateReview()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate response')
    },
  })

  const approveMutation = trpc.review.approveResponse.useMutation({
    onSuccess: () => {
      toast.success('Response approved')
      invalidateReview()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve')
    },
  })

  const rejectMutation = trpc.review.rejectResponse.useMutation({
    onSuccess: () => {
      toast.success('Response rejected')
      invalidateReview()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject')
    },
  })

  const editMutation = trpc.review.editResponse.useMutation({
    onSuccess: () => {
      toast.success('Response updated')
      setIsEditing(false)
      invalidateReview()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update')
    },
  })

  const postMutation = trpc.review.postResponse.useMutation({
    onSuccess: () => {
      toast.success('Response posted to platform')
      invalidateReview()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to post response')
    },
  })

  // No response yet
  if (!latestResponse) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Response</h3>
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <Sparkles className="mx-auto size-8 text-primary/60" />
          <p className="mt-2 text-sm text-muted-foreground">
            Generate an AI-powered response for this review
          </p>
          <Button
            className="mt-4"
            onClick={() => generateMutation.mutate({ reviewId })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate AI Response
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Generating (mutation in progress, no content yet)
  if (generateMutation.isPending) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Response</h3>
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            AI is writing a response...
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  const status = latestResponse.status

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Response</h3>
        <div className="flex items-center gap-2">
          {latestResponse.generatedBy === 'ai' && latestResponse.aiModel && (
            <span className="text-xs text-muted-foreground">
              {latestResponse.aiModel}
            </span>
          )}
          <Badge
            className={
              status === 'draft'
                ? 'bg-amber-100 text-amber-700'
                : status === 'approved'
                  ? 'bg-blue-100 text-blue-700'
                  : status === 'posted'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
            }
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Response content */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded-lg border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={5}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {editContent.length}/2000
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  editMutation.mutate({
                    responseId: latestResponse.id,
                    content: editContent,
                  })
                }
                disabled={
                  editMutation.isPending || editContent.trim().length === 0
                }
              >
                {editMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {latestResponse.content}
          </p>
        </div>
      )}

      {/* Action buttons based on status */}
      {status === 'draft' && !isEditing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() =>
              approveMutation.mutate({ responseId: latestResponse.id })
            }
            disabled={approveMutation.isPending}
          >
            <Check className="size-4 mr-1" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditContent(latestResponse.content)
              setIsEditing(true)
            }}
          >
            <Pencil className="size-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              rejectMutation.mutate({ responseId: latestResponse.id })
            }
            disabled={rejectMutation.isPending}
          >
            <X className="size-4 mr-1" />
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate({ reviewId })}
            disabled={generateMutation.isPending}
          >
            <RefreshCw className="size-4 mr-1" />
            Regenerate
          </Button>
        </div>
      )}

      {status === 'approved' && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              postMutation.mutate({ responseId: latestResponse.id })
            }
            disabled={postMutation.isPending}
          >
            {postMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Posting...
              </>
            ) : (
              <>
                <Send className="size-4 mr-1" />
                Post to Platform
              </>
            )}
          </Button>
        </div>
      )}

      {status === 'posted' && latestResponse.postedAt && (
        <p className="text-xs text-muted-foreground">
          Posted on{' '}
          {new Date(latestResponse.postedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      {status === 'rejected' && (
        <Button
          size="sm"
          onClick={() => generateMutation.mutate({ reviewId })}
          disabled={generateMutation.isPending}
        >
          <Sparkles className="size-4 mr-1" />
          Generate New Response
        </Button>
      )}
    </div>
  )
}
