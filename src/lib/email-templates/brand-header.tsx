import * as React from 'react'

import { Img, Section } from '@react-email/components'

/**
 * Aislix wordmark used at the top of every outgoing email.
 * Absolute URL is required — email clients cannot resolve relative paths.
 */
export const LOGO_URL = 'https://aislix.com/brand/aislix-email-logo.png'

export const EmailLogo = () => (
  <Section style={{ margin: '0 0 24px' }}>
    <Img src={LOGO_URL} alt="Aislix" width="132" height="36" style={logo} />
  </Section>
)

const logo = { display: 'block', border: '0', outline: 'none', textDecoration: 'none' }

export default EmailLogo
