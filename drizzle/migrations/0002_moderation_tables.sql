CREATE TABLE IF NOT EXISTS public.moderation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (
        content_type IN ('post', 'comment', 'profile', 'message')
    ),
    content_id UUID,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'reviewing', 'dismissed', 'actioned', 'appealed')
    ),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    report_id UUID REFERENCES public.moderation_reports(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (
        action_type IN ('warning', 'content_removed', 'suspension', 'ban', 'unban')
    ),
    reason TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_reports_status_idx
ON public.moderation_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_reports_reported_user_idx
ON public.moderation_reports(reported_user_id);

CREATE INDEX IF NOT EXISTS moderation_actions_target_user_idx
ON public.moderation_actions(target_user_id, created_at DESC);
