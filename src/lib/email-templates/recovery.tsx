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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Reset your ${siteName} password`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password for your {siteName} account. Choose a new
          password using the button below.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={confirmationUrl}>
            Reset password
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
          Didn't request this? You can safely ignore this email — your password will not change.
        </Text>
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
