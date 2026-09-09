import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Aislix"
const SENDER_DOMAIN = "notify.aislix.com"
const ROOT_DOMAIN = "aislix.com"
const FROM_DOMAIN = "aislix.com"
const SITE_URL = `https://${ROOT_DOMAIN}`

// Lazy-init so missing LOVABLE_API_KEY in preview/dev does not crash GET / at import time.
let handler: ReturnType<typeof createAuthEmailHandler> | undefined;

function getAuthEmailHandler() {
  if (handler) return handler;
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  handler = createAuthEmailHandler({
  apiKey,
  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
  senderDomain: SENDER_DOMAIN,
  sendUrl: process.env['LOVABLE_SEND_URL'],
  emails: {
    signup: {
      subject: 'Confirm your email',
      render: (data) =>
        React.createElement(SignupEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipient: data.email,
          confirmationUrl: data.url,
        }),
    },
    invite: {
      subject: "You've been invited",
      render: (data) =>
        React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          confirmationUrl: data.url,
        }),
    },
    magiclink: {
      subject: 'Your login link',
      render: (data) =>
        React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    recovery: {
      subject: 'Reset your password',
      render: (data) =>
        React.createElement(RecoveryEmail, {
          siteName: SITE_NAME,
          confirmationUrl: data.url,
        }),
    },
    email_change: {
      subject: 'Confirm your new email',
      render: (data) =>
        React.createElement(EmailChangeEmail, {
          siteName: SITE_NAME,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl: data.url,
        }),
    },
    reauthentication: {
      subject: 'Your verification code',
      render: (data) =>
        React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
    },
  },
  });
  return handler;
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await getAuthEmailHandler()(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('LOVABLE_API_KEY')) {
            return new Response(JSON.stringify({ error: 'Email service not configured' }), {
              status: 503,
              headers: { 'content-type': 'application/json' },
            });
          }
          throw error;
        }
      },
    },
  },
})
