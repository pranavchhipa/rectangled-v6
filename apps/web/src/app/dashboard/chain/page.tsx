/**
 * Hotfix PRD §7 — Chain rollup merged into Dashboard.
 *
 * The standalone `/dashboard/chain` page is gone. Its useful widgets
 * (locations leaderboard, per-location rating trends, geo distribution)
 * now live in the workspace Dashboard at `/dashboard`, conditionally
 * rendered via `<ByLocationSection>` when the workspace has 2+
 * locations.
 *
 * This stub redirects existing bookmarks so nothing 404s.
 */
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/dashboard')
}
