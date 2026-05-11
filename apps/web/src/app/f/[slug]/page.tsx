'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { SurveyEngineRenderer } from '@/components/public/survey-engine-renderer'

/**
 * Path B — /f/[slug] now delegates to the step-walker renderer that
 * drives the actual survey step engine (getInitialState/advance/
 * complete). Replaces the legacy single-screen renderer that flattened
 * multi-step graphs.
 *
 * deep-template surveys (formerly truforms) walk the same engine path
 * as journey surveys — the route distinction is preserved only for
 * historical URLs that customers may have bookmarked or QR'd.
 */
export default function PublicTruformPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const preview = searchParams?.get('preview') === 'true'
  return <SurveyEngineRenderer slug={slug} preview={preview} />
}
