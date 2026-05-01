import postgres from 'postgres'
import 'dotenv/config'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

try {
  const [{ workspaces, orgs, members, orgMembers, nullLinks }] = await sql`
    SELECT
      (SELECT COUNT(*) FROM workspaces)::int                                AS workspaces,
      (SELECT COUNT(*) FROM organizations)::int                             AS orgs,
      (SELECT COUNT(*) FROM members WHERE accepted_at IS NOT NULL)::int    AS members,
      (SELECT COUNT(*) FROM organization_members)::int                     AS "orgMembers",
      (SELECT COUNT(*) FROM workspaces WHERE organization_id IS NULL)::int AS "nullLinks"
  `

  console.log(`workspaces:            ${workspaces}`)
  console.log(`organizations:         ${orgs}`)
  console.log(`accepted ws members:   ${members}`)
  console.log(`org_members rows:      ${orgMembers}`)
  console.log(`workspaces w/ NULL link: ${nullLinks}`)

  const sample = await sql`
    SELECT
      o.id            AS org_id,
      o.name          AS org_name,
      o.slug          AS org_slug,
      o.type,
      o.owner_user_id,
      w.id            AS ws_id,
      w.name          AS ws_name,
      w.slug          AS ws_slug,
      (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id)::int AS org_member_count,
      (SELECT COUNT(*) FROM members m WHERE m.workspace_id = w.id AND m.accepted_at IS NOT NULL)::int AS ws_member_count
    FROM organizations o
    JOIN workspaces w ON w.organization_id = o.id
    ORDER BY o.created_at DESC
    LIMIT 5
  `
  console.log('\nSample (most-recent 5):')
  for (const r of sample) {
    console.log(`  org ${r.org_slug} (type=${r.type}) → ws ${r.ws_slug} | org_members=${r.org_member_count} ws_members=${r.ws_member_count}`)
  }

  // Sanity: every accepted member should have an org_member row
  const [{ orphanMembers }] = await sql`
    SELECT COUNT(*)::int AS "orphanMembers"
    FROM members m
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN organization_members om ON om.organization_id = w.organization_id AND om.user_id = m.user_id
    WHERE m.accepted_at IS NOT NULL AND om.id IS NULL
  `
  console.log(`\norphan accepted ws members (no org_member row): ${orphanMembers}`)
} finally {
  await sql.end()
}
