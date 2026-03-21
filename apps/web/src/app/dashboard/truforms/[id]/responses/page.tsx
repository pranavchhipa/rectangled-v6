'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function ResponsesSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-40 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export default function TruFormResponsesPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params.id as string
  const [page, setPage] = useState(1)

  const formQuery = trpc.truform.getById.useQuery(
    { id: formId },
    { enabled: !!formId }
  )

  const responsesQuery = trpc.truform.listResponses.useQuery(
    { truformId: formId, page, limit: 20 },
    { enabled: !!formId }
  )

  const form = formQuery.data
  const responses = responsesQuery.data?.data ?? []
  const totalPages = responsesQuery.data?.totalPages ?? 0
  const total = responsesQuery.data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/truforms/${formId}`)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {formQuery.isLoading ? (
              <Skeleton className="h-7 w-48 inline-block" />
            ) : (
              <>Responses &mdash; {form?.name ?? 'Form'}</>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} total response{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      {responsesQuery.isLoading ? (
        <ResponsesSkeletons />
      ) : responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No responses yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Share your form to start collecting responses from customers.
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Score</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response: any) => (
                    <tr key={response.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">
                        {response.createdAt
                          ? new Date(response.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-mono">
                          {response.score ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {response.customerName || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {response.customerEmail || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                        {response.answers
                          ? typeof response.answers === 'string'
                            ? response.answers
                            : JSON.stringify(response.answers)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}&ndash;
                {Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
