import * as React from 'react'

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import { brand, code, container, heading, hr, main, muted, text } from './auth-styles'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Aislix verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Aislix</Text>
        <Heading style={heading}>Your verification code</Heading>
        <Text style={text}>Enter this code in Aislix to confirm this action.</Text>
        <Text style={code}>{token}</Text>
        <Hr style={hr} />
        <Text style={muted}>
          Didn't request this code? You can safely ignore this email.
        </Text>
        <Text style={muted}>Aislix · AI retail shelf intelligence</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
