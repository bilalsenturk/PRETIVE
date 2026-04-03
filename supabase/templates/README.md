# Supabase Email Templates

These HTML templates replace Supabase's default email templates for a branded PRETIVE experience.

## How to Apply

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Authentication** > **Email Templates**
3. For each template type, copy the corresponding HTML file content:

| Supabase Template Type | File |
|---|---|
| **Confirm signup** | `confirm-email.html` |
| **Reset password** | `reset-password.html` |
| **Magic link** | `magic-link.html` |

4. Set the **Subject** line for each:
   - Confirm signup: `Verify your email — PRETIVE`
   - Reset password: `Reset your password — PRETIVE`
   - Magic link: `Your sign-in link — PRETIVE`

5. Set the **Sender name** to: `PRETIVE`

## Template Variables

Supabase uses Go template syntax. The key variable is:
- `{{ .ConfirmationURL }}` — The verification/reset/login link

## Redirect URL

Make sure your Supabase project has the correct redirect URL configured:
- Go to **Authentication** > **URL Configuration**
- Add `https://app.pretive.com/auth/callback` to **Redirect URLs**
- For development, also add `http://localhost:3000/auth/callback`
