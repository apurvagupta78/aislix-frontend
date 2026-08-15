import * as React from 'react'

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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Confirm your email to activate your ${siteName} workspace`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Confirm your email</Heading>
        <Text style={text}>
          Welcome to{' '}
          <Link href={siteUrl} style={link}>
            {siteName}
          </Link>
          . Confirm <strong>{recipient}</strong> to activate your workspace and start running AI
          shelf audits.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={confirmationUrl}>
            Verify email
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
          Didn't create an account? You can safely ignore this email.
        </Text>
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
