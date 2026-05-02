/**
 * Hotfix PRD §5 — backwards-compat redirect.
 *
 * The unified surveys list lives at `/dashboard/journeys` now (per the
 * surveys → Customer Journeys rename). Old bookmarks, sidebar links
 * cached in browsers, and any in-app references that haven't been
 * updated yet land here and bounce to the new URL.
 *
 * Backend table `surveys` and tRPC procedures (`survey.list`, etc.)
 * stay as-is per PRD §5.2 — this is a frontend-only rename.
 */
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/dashboard/journeys')
}
