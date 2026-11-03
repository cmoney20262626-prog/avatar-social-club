
-- ASC: Add moderation hierarchy roles
ALTER TYPE public.app_role
ADD VALUE IF NOT EXISTS 'owner_admin';

ALTER TYPE public.app_role
ADD VALUE IF NOT EXISTS 'moderator';
