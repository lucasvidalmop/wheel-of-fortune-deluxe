ALTER TABLE public.imported_contacts ADD COLUMN group_name text NOT NULL DEFAULT '';

-- Drop the old unique constraint and create a new one that includes group_name
ALTER TABLE public.imported_contacts DROP CONSTRAINT imported_contacts_owner_id_numero_key;
ALTER TABLE public.imported_contacts ADD CONSTRAINT imported_contacts_owner_id_numero_group_key UNIQUE (owner_id, numero, group_name);