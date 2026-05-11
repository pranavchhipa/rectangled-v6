'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { SurveyEngineRenderer } from '@/components/public/survey-engine-renderer'

/**
 * Path B — /j/[slug] now delegates to the step-walker renderer that
 * drives the actual survey step engine (getInitialState/advance/
 * complete). Replaces the legacy single-screen renderer that flattened
 * multi-step graphs.
 *
 * Preview mode (`?preview=true`) propagates through.
 */
export default function PublicJourneyPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const preview = searchParams?.get('preview') === 'true'
  return <SurveyEngineRenderer slug={slug} preview={preview} />
}
