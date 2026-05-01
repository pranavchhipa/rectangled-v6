-- Phase 1 Stage A — lock organization_id NOT NULL on workspaces.
--
-- Runs after the backfill in 0008. Refuses to apply if any workspace
-- still has organization_id = NULL (would be a silent contract break).

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM workspaces WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Refusing to set organization_id NOT NULL: % workspace(s) still NULL. Fix migration 0008 first.', null_count;
  END IF;
END $$;

ALTER TABLE workspaces ALTER COLUMN organization_id SET NOT NULL;
