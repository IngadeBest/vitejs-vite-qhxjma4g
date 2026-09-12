-- Security: enable RLS on exposed public tables that were left unprotected.
-- Wachtlijst is managed through /api/wachtlijst with a service-role server client.
-- Direct browser access is limited to authenticated admins from public.admins.

BEGIN;

ALTER TABLE IF EXISTS public.proeven_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proeven_items_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inschrijvingen_move_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wachtlijst ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.proeven_backup FROM anon, authenticated;
REVOKE ALL ON TABLE public.proeven_items_backup FROM anon, authenticated;
REVOKE ALL ON TABLE public.inschrijvingen_move_backup FROM anon, authenticated;
REVOKE ALL ON TABLE public.wachtlijst FROM anon, authenticated;
REVOKE ALL ON TABLE public.admins FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wachtlijst TO authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;

DROP POLICY IF EXISTS "admins_self_read" ON public.admins;

CREATE POLICY "admins_self_read"
ON public.admins
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
);

DROP POLICY IF EXISTS "wachtlijst_admin_select" ON public.wachtlijst;
DROP POLICY IF EXISTS "wachtlijst_admin_insert" ON public.wachtlijst;
DROP POLICY IF EXISTS "wachtlijst_admin_update" ON public.wachtlijst;
DROP POLICY IF EXISTS "wachtlijst_admin_delete" ON public.wachtlijst;

CREATE POLICY "wachtlijst_admin_select"
ON public.wachtlijst
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IN (SELECT admins.user_id FROM public.admins)
);

CREATE POLICY "wachtlijst_admin_insert"
ON public.wachtlijst
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IN (SELECT admins.user_id FROM public.admins)
);

CREATE POLICY "wachtlijst_admin_update"
ON public.wachtlijst
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) IN (SELECT admins.user_id FROM public.admins)
)
WITH CHECK (
  (SELECT auth.uid()) IN (SELECT admins.user_id FROM public.admins)
);

CREATE POLICY "wachtlijst_admin_delete"
ON public.wachtlijst
FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) IN (SELECT admins.user_id FROM public.admins)
);

COMMIT;
