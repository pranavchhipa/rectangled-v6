'use client'

/**
 * Hotfix PRD §6 — reusable Responses list.
 *
 * Used by:
 *   - /dashboard/surveys/[id]  (Responses tab — surveyId scoped)
 *   - /dashboard/responses     (workspace-wide page — workspaceId scoped)
 *
 * Renders a search/filter toolbar + a card grid of responses + a row-click
 * detail sheet. Pulls from trpc.survey.listResponses + getResponseById.
 */

import { useState } from 'react'
import {
  Search,
  Star,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  ExternalLink,
  Loader2,
  User as UserIcon,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type Filter = 'all' | 'happy' | 'unhappy' | 'neutral'

interface ResponseRow {
  id: string
  surveyId: string
  surveyName: string | null
  surveyTemplate: 'quick' | 'deep' | null
  customerId: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  locationId: string | null
  locationName: string | null
  metricShown: string | null
  metricScore: number | null
  isPositive: boolean | null
  score: number | null
  responseData: Record<string, unknown> | null
  answers: Record<string, unknown> | null
  sessionId: string
  completedAt: string | Date | null
  createdAt: string | Date
}

export function ResponsesList({
  workspaceId,
  surveyId,
  showSurveyColumn = false,
}: {
  workspaceId?: string
  surveyId?: string
  /** Surface the parent survey name on each row (workspace-wide view). */
  showSurveyColumn?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  // Hotfix-5 — per-page location filter, same pattern as journeys
  // list. 'all' = no narrowing; specific id narrows to responses
  // attributed to that location at submit time.
  const [locFilter, setLocFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const limit = 25

  // Workspace locations to populate the filter dropdown. Only fetched
  // for workspace-wide views (per-survey views inherit the survey's
  // location implicitly).
  const locationsQuery = trpc.location.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId },
  )
  const workspaceLocations = (locationsQuery.data ?? []) as Array<{
    id: string
    name: string
    isActive: boolean
  }>
  const activeLocations = workspaceLocations.filter((l) => l.isActive)

  const listQuery = trpc.survey.listResponses.useQuery(
    {
      workspaceId,
      surveyId,
      locationId: locFilter === 'all' ? undefined : locFilter,
      filter,
      search: submittedSearch || undefined,
      page,
      limit,
    },
    { enabled: !!(workspaceId || surveyId) },
  )

  const data = listQuery.data as
    | { responses: ResponseRow[]; total: number; page: number; limit: number }
    | undefined
  const total = data?.total ?? 0
  const responses = data?.responses ?? []
  const totalPages = Math.max(1, Math.ceil(total / limit))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSubmittedSearch(search.trim())
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'happy', label: 'Positive' },
              { value: 'unhappy', label: 'Negative' },
              { value: 'neutral', label: 'Other' },
            ] as Array<{ value: Filter; label: string }>
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setFilter(f.value)
                setPage(1)
              }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Hotfix-5 — location filter, workspace-wide views only.
            Backend filters via survey_responses.location_id.
            Threshold relaxed in hotfix-6 from `> 1` to `>= 1` for
            visibility on single-location workspaces. */}
        {workspaceId && activeLocations.length >= 1 && (
          <Select
            value={locFilter}
            onValueChange={(v) => {
              setLocFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {activeLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  📍 {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <form onSubmit={submitSearch} className="relative ml-auto w-full max-w-xs">
          <Label htmlFor="resp-search" className="sr-only">
            Search
          </Label>
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="resp-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone…"
            className="pl-7"
          />
        </form>
      </div>

      {/* Result count */}
      <div className="text-xs text-muted-foreground">
        {listQuery.isLoading ? 'Loading…' : `Showing ${responses.length} of ${total} responses`}
      </div>

      {/* List */}
      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : responses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No responses match these filters yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => (
            <ResponseRowCard
              key={r.id}
              row={r}
              showSurveyColumn={showSurveyColumn}
              onOpen={() => setOpenId(r.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <ResponseDetailSheet
        responseId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}

function sentimentBadge(isPositive: boolean | null) {
  if (isPositive === true)
    return (
      <Badge className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        <Smile className="size-3" /> Positive
      </Badge>
    )
  if (isPositive === false)
    return (
      <Badge className="gap-1 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-50">
        <Frown className="size-3" /> Negative
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1">
      <Meh className="size-3" /> —
    </Badge>
  )
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ResponseRowCard({
  row,
  showSurveyColumn,
  onOpen,
}: {
  row: ResponseRow
  showSurveyColumn: boolean
  onOpen: () => void
}) {
  const hasContact = !!(row.customerName || row.customerEmail || row.customerPhone)
  const contactLabel = hasContact
    ? row.customerName || row.customerEmail || row.customerPhone
    : 'Anonymous · No contact'
  const contactSub = hasContact
    ? [row.customerPhone, row.customerEmail].filter(Boolean).join(' · ')
    : ''

  // Aspects/feedback live on responseData under common keys.
  const aspectTags =
    (row.responseData?.aspectTags as string[] | undefined) ??
    (row.responseData?.tags as string[] | undefined) ??
    null
  const feedback =
    (row.responseData?.feedback as string | undefined) ??
    (row.responseData?.q2 as string | undefined) ??
    null

  return (
    <Card
      onClick={onOpen}
      className="cursor-pointer transition-shadow hover:shadow-md"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {sentimentBadge(row.isPositive)}
              <span className="truncate text-sm font-medium">
                {contactLabel}
              </span>
            </div>
            {contactSub && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {contactSub}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {row.metricShown && (
                <Badge variant="outline" className="gap-1 uppercase">
                  <Star className="size-3" />
                  {row.metricShown}{' '}
                  {row.metricScore != null
                    ? `${row.metricScore}`
                    : row.score != null
                      ? `${row.score}`
                      : ''}
                </Badge>
              )}
              {row.locationName && <span>· {row.locationName}</span>}
              {showSurveyColumn && row.surveyName && (
                <span>· {row.surveyName}</span>
              )}
              <span>· {fmtDate(row.createdAt)}</span>
            </div>

            {aspectTags && aspectTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {aspectTags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                {aspectTags.length > 4 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{aspectTags.length - 4}
                  </Badge>
                )}
              </div>
            )}
            {feedback && (
              <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">
                &ldquo;{feedback}&rdquo;
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {row.responseData?.acceptedReviewPrompt === true && (
              <Badge variant="outline" className="text-[10px]">
                <ExternalLink className="size-2.5" />
                Review opened
              </Badge>
            )}
            {!hasContact && row.isPositive === false && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-700 border-amber-300 bg-amber-50"
              >
                <AlertTriangle className="size-2.5" />
                Negative · no contact
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ResponseDetailSheet({
  responseId,
  onClose,
}: {
  responseId: string | null
  onClose: () => void
}) {
  const detailQuery = trpc.survey.getResponseById.useQuery(
    { id: responseId ?? '' },
    { enabled: !!responseId },
  )
  const detail = detailQuery.data as
    | {
        response: ResponseRow & { workspaceId: string }
        survey: { name: string; template: string; slug: string } | null
        customer: {
          id: string
          name: string | null
          email: string | null
          phone: string | null
        } | null
        location: { id: string; name: string } | null
      }
    | undefined

  return (
    <Sheet open={!!responseId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Response detail</SheetTitle>
          <SheetDescription>
            {detail?.response?.id && (
              <code className="rounded bg-muted px-1 text-xs">
                {detail.response.id}
              </code>
            )}
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-2 px-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !detail ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline-block size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-5 px-4 py-4 text-sm">
            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Customer
              </h3>
              {detail.customer ? (
                <div className="mt-1.5 space-y-0.5">
                  <p className="font-medium">
                    {detail.customer.name ?? '(name not provided)'}
                  </p>
                  {detail.customer.phone && (
                    <p className="text-xs text-muted-foreground">
                      {detail.customer.phone}
                    </p>
                  )}
                  {detail.customer.email && (
                    <p className="text-xs text-muted-foreground">
                      {detail.customer.email}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserIcon className="size-3.5" />
                  Anonymous — customer skipped contact step
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Sentiment
              </h3>
              <div className="mt-1.5 flex items-center gap-2">
                {sentimentBadge(detail.response.isPositive)}
                {detail.response.metricShown && (
                  <span className="text-sm">
                    <code className="rounded bg-muted px-1 text-xs uppercase">
                      {detail.response.metricShown}
                    </code>{' '}
                    score{' '}
                    <strong>
                      {detail.response.metricScore ?? detail.response.score ?? '—'}
                    </strong>
                  </span>
                )}
              </div>
            </section>

            {(detail.response.responseData?.aspectTags ||
              detail.response.responseData?.tags) && (
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Aspect tags
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(
                    (detail.response.responseData?.aspectTags as string[]) ??
                    (detail.response.responseData?.tags as string[]) ??
                    []
                  ).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {(() => {
              const fb =
                (detail.response.responseData?.feedback as string | undefined) ??
                (detail.response.responseData?.q2 as string | undefined)
              if (!fb) return null
              return (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Free-text feedback
                  </h3>
                  <p className="mt-1.5 italic">&ldquo;{fb}&rdquo;</p>
                </section>
              )
            })()}

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Outcome
              </h3>
              <ul className="mt-1.5 space-y-1 text-xs">
                {detail.response.responseData?.acceptedReviewPrompt === true && (
                  <li>✓ Customer accepted review prompt</li>
                )}
                {detail.response.responseData?.acceptedReviewPrompt ===
                  false && <li>✗ Customer declined review prompt</li>}
                {detail.response.responseData?.redirectedTo && (
                  <li>
                    Redirected to:{' '}
                    <code className="rounded bg-muted px-1">
                      {String(detail.response.responseData.redirectedTo)}
                    </code>
                  </li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Context
              </h3>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {detail.survey && (
                  <li>
                    Journey: <strong>{detail.survey.name}</strong>{' '}
                    <code className="rounded bg-muted px-1 text-[10px]">
                      {detail.survey.template}
                    </code>
                  </li>
                )}
                {detail.location && <li>Location: {detail.location.name}</li>}
                <li>Submitted: {fmtDate(detail.response.createdAt)}</li>
                <li>
                  Session:{' '}
                  <code className="rounded bg-muted px-1 text-[10px]">
                    {detail.response.sessionId}
                  </code>
                </li>
              </ul>
            </section>

            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Raw response_data
              </summary>
              <pre className="mt-2 max-h-[200px] overflow-auto rounded-md bg-muted p-3 text-[10px]">
                {JSON.stringify(detail.response.responseData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
