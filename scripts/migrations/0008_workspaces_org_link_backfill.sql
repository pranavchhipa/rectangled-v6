-- Phase 1 Stage A — backfill organization_id for every existing workspace.
--
-- For each workspace without an org link:
--   1. Pick its primary owner (first accepted owner-role member).
--   2. Create a direct-mode organization owned by that user, slug =
--      workspace.slug || '-org' truncated to 100 chars.
--   3. Update workspace.organization_id.
--   4. Copy all accepted workspace members into organization_members:
--        owner role  → org_owner with workspace_ids=NULL (full access)
--        non-owner   → org_member with workspace_ids=[that workspace]
--
-- If a workspace has no accepted owner (theoretically possible with bad
-- data), we skip it loudly. 0009 will fail to set NOT NULL until those
-- are fixed.

DO $$
DECLARE
  ws RECORD;
  owner_id UUID;
  new_org_id UUID;
  new_org_slug VARCHAR(100);
BEGIN
  FOR ws IN
    SELECT id, name, slug FROM workspaces WHERE organization_id IS NULL
  LOOP
    -- Pick the primary owner (first accepted owner-role member by created_at).
    SELECT m.user_id INTO owner_id
    FROM members m
    WHERE m.workspace_id = ws.id
      AND m.role = 'owner'
      AND m.accepted_at IS NOT NULL
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF owner_id IS NULL THEN
      RAISE WARNING 'Workspace % (%) has no accepted owner — skipping backfill', ws.id, ws.name;
      CONTINUE;
    END IF;

    -- Create the direct org. Slug truncated to 100 chars.
    new_org_slug := LEFT(ws.slug || '-org', 100);

    INSERT INTO organizations (name, slug, type, owner_user_id, settings, white_label, status)
    VALUES (ws.name, new_org_slug, 'direct', owner_id, '{}'::jsonb, '{}'::jsonb, 'active')
    RETURNING id INTO new_org_id;

    -- Link the workspace.
    UPDATE workspaces SET organization_id = new_org_id WHERE id = ws.id;

    -- Backfill organization_members from accepted workspace members.
    -- Owners → org_owner with NULL workspace_ids (full access).
    -- Non-owners → org_member with workspace_ids = [ws.id].
    INSERT INTO organization_members (organization_id, user_id, role, workspace_ids, accepted_at, created_at)
    SELECT
      new_org_id,
      m.user_id,
      CASE
        WHEN m.role = 'owner' THEN 'org_owner'::organization_role
        WHEN m.role = 'manager' THEN 'org_manager'::organization_role
        ELSE 'org_member'::organization_role
      END,
      CASE
        WHEN m.role = 'owner' THEN NULL
        ELSE ARRAY[ws.id]::uuid[]
      END,
      m.accepted_at,
      m.created_at
    FROM members m
    WHERE m.workspace_id = ws.id
      AND m.accepted_at IS NOT NULL
    -- Same user can be a member of multiple orgs (we create one org per
    -- workspace, so this is fine), but per-org we can only have one row.
    -- If for some reason the same user had two memberships in this workspace
    -- (shouldn't happen, but just in case), the unique constraint would block.
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- Sanity: how many workspaces still have NULL organization_id?
-- This is a NOTICE only — 0009 will refuse to run if any remain, but we
-- want to surface the count first.
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM workspaces WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    RAISE NOTICE 'Backfill leaves % workspace(s) with NULL organization_id (no accepted owner). Fix manually before 0009.', null_count;
  ELSE
    RAISE NOTICE 'Backfill complete: every workspace has an organization_id.';
  END IF;
END $$;
