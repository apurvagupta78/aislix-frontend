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
import { brand, button, container, heading, hr, link, main, muted, text } from './auth-styles'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your ${siteName} login link`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Your login link</Heading>
        <Text style={text}>
          Use the button below to sign in to {siteName}. This link expires shortly and can only be
          used once.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={confirmationUrl}>
            Sign in
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
        <Text style={muted}>
          Didn't request this link? You can safely ignore this email.
        </Text>
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
