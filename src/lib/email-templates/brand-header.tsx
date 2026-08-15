import * as React from 'react'

import { Img, Section } from '@react-email/components'

/**
 * Aislix wordmark used at the top of every outgoing email.
 * Absolute URL is required — email clients cannot resolve relative paths.
 */
export const LOGO_URL =
  'https://aislix.com/__l5e/assets-v1/febf1323-af97-45ef-800d-61e1f66dd987/aislix-email-logo.png'

export const EmailLogo = () => (
  <Section style={{ margin: '0 0 24px' }}>
    <Img src={LOGO_URL} alt="Aislix" width="150" height="50" style={logo} />
  </Section>
)

const logo = { display: 'block', border: '0', outline: 'none', textDecoration: 'none' }

export default EmailLogo
