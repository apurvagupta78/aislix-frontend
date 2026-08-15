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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Confirm your new ${siteName} email address`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Confirm your new email</Heading>
        <Text style={text}>
          You asked to change the email on your {siteName} account from{' '}
          <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>. Confirm the change below.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={confirmationUrl}>
            Confirm change
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
          Didn't request this change? Ignore this email and your address stays the same.
        </Text>
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
