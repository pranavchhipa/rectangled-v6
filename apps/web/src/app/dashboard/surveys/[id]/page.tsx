/**
 * Hotfix PRD §5 — backwards-compat redirect for the editor route.
 * See sibling page.tsx for the rationale; same redirect, just per-id.
 */
import { redirect } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/journeys/${id}`)
}
