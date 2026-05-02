'use client'

import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { ResponsesList } from '@/components/responses/responses-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

/**
 * Hotfix PRD §6.6 — workspace-level Responses page.
 *
 * All responses across every survey in the current workspace, with an
 * optional survey filter. Same UI as the per-journey Responses tab.
 */
export default function WorkspaceResponsesPage() {
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId)
  const [surveyFilter, setSurveyFilter] = useState<string>('all')

  const surveysQuery = trpc.survey.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId },
  )
  const surveysList = (surveysQuery.data ?? []) as Array<{
    id: string
    name: string
    template: 'quick' | 'deep'
  }>

  if (!currentWorkspaceId) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Pick a workspace to view its responses.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ListChecks className="size-6" />
            Responses
          </h1>
          <p className="text-sm text-muted-foreground">
            Every customer who completed a journey or survey in this workspace.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Filter by journey
          </Label>
          <Select value={surveyFilter} onValueChange={setSurveyFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All journeys</SelectItem>
              {surveysList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{' '}
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {s.template}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ResponsesList
        workspaceId={currentWorkspaceId}
        surveyId={surveyFilter === 'all' ? undefined : surveyFilter}
        showSurveyColumn
      />
    </div>
  )
}
