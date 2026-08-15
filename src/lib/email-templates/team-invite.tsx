import React from 'react'

import { EmailLogo } from './brand-header'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  orgName?: string
  inviterName?: string
  roleLabel?: string
  acceptUrl?: string
  isNewUser?: boolean
}

const Email = ({
  orgName = 'your team',
  inviterName,
  roleLabel = 'Team member',
  acceptUrl = 'https://aislix.com/accept-invite',
  isNewUser = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You're invited to join ${orgName} on Aislix`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>{`Join ${orgName} on Aislix`}</Heading>
        <Text style={text}>
          {inviterName ? `${inviterName} has invited you` : 'You have been invited'} to
          collaborate on retail shelf intelligence for <strong>{orgName}</strong> as{' '}
          <strong>{roleLabel}</strong>.
        </Text>
        <Section style={{ margin: '28px 0' }}>
          <Button href={acceptUrl} style={button}>
            {isNewUser ? 'Set up your account' : 'Accept invitation'}
          </Button>
        </Section>
        <Text style={muted}>
          {isNewUser
            ? 'This link creates your Aislix account and adds you to the workspace.'
            : 'Sign in with this email address to accept the invitation.'}
        </Text>
        <Hr style={hr} />
        <Text style={muted}>
          If the button does not work, copy this link into your browser:
          <br />
          <Link href={acceptUrl} style={{ color: '#0B8F4D' }}>
            {acceptUrl}
          </Link>
        </Text>
        <Text style={muted}>
          Aislix — AI-powered retail shelf intelligence. If you weren&apos;t expecting this
          invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `You're invited to join ${data?.orgName || 'a workspace'} on Aislix`,
  displayName: 'Team invitation',
  previewData: {
    orgName: 'Sharma Supermarkets',
    inviterName: 'Apurv Gupta',
    roleLabel: 'Store manager',
    acceptUrl: 'https://aislix.com/accept-invite',
    isNewUser: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }const heading = { fontSize: '24px', lineHeight: '32px', color: '#09283e', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2937', margin: '0 0 8px' }
const button = {
  backgroundColor: '#09283e',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '13px 24px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0' }
const muted = { fontSize: '13px', lineHeight: '20px', color: '#6b7280', margin: '0 0 10px' }
