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
import { button, container, heading, hr, link, main, muted, text } from './auth-styles'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  signupUrl?: string
}

const Email = ({ name, signupUrl = 'https://aislix.com/signup' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Aislix free workspace — complete signup</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Your free workspace is one step away</Heading>
        <Text style={text}>{name ? `Hi ${name},` : 'Hi,'}</Text>
        <Text style={text}>
          Thanks for trying Aislix shelf intelligence. You&apos;re one step away from your free
          workspace with free shelf scans.
        </Text>
        <Section style={{ margin: '0 0 28px' }}>
          <Button style={button} href={signupUrl}>
            Create your free Aislix account →
          </Button>
        </Section>
        <Text style={muted}>
          If the button does not work, copy this link into your browser:
          <br />
          <Link href={signupUrl} style={link}>
            {signupUrl}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: Email,
  subject: 'Your Aislix free workspace — complete signup',
  displayName: 'Landing onboarding',
  previewData: { name: 'Apūrva', signupUrl: 'https://aislix.com/signup?email=demo%40example.com' },
}

export default Email
