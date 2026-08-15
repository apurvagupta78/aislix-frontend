import * as React from 'react'

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
import { button, container, heading, hr, link, main, muted, text } from './auth-styles'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You've been invited to ${siteName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>You've been invited</Heading>
        <Text style={text}>
          You have been invited to join{' '}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          . Accept the invitation below to set up your account.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={confirmationUrl}>
            Accept invitation
          </Button>
        </Section>
        <Text style={muted}>
          If the button does not work, copy this link into your browser:
          <br />
          <Link href={confirmationUrl} style={link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
