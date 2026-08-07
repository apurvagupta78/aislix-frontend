ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_manager_profile_fkey
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.shelf_scans
  ADD CONSTRAINT shelf_scans_created_by_profile_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;