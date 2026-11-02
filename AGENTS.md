<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Coin, purchase, ban and admin actions run as SECURITY DEFINER Postgres RPCs; clients never write coins/banned/roles directly (column-level grants block it).
- Roles live in `user_roles` checked via `has_role`; the first account to sign up is auto-made admin by the signup trigger.
- 3D avatar GLBs live in the private `avatar-models` bucket and are shown via signed URLs + `@google/model-viewer` loaded client-side only.
