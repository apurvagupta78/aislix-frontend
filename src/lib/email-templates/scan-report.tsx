import React from 'react'

import { EmailLogo } from './brand-header'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  sharerName?: string
  storeName?: string | null
  location?: string | null
  category?: string | null
  scanDate?: string | null
  healthScore?: number | null
  productsDetected?: number | null
  compliancePercent?: number | null
  message?: string | null
  shareUrl?: string
  pdfUrl?: string
  annotatedUrl?: string
  csvUrl?: string
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toUTCString().replace(' GMT', ' UTC')
}

const percent = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—'

const Email = ({
  sharerName = 'A teammate',
  storeName,
  location,
  category,
  scanDate,
  healthScore,
  productsDetected,
  compliancePercent,
  message,
  shareUrl = 'https://aislix.com',
  pdfUrl,
  annotatedUrl,
  csvUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Shelf audit report${storeName ? ` — ${storeName}` : ''} shared with you`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>Shelf audit report</Heading>
        <Text style={text}>
          <strong>{sharerName}</strong> shared an AI shelf audit with you
          {storeName ? ` for ${storeName}` : ''}.
        </Text>

        {message ? <Text style={quote}>{message}</Text> : null}

        <Section style={card}>
          <Row>
            <Column style={cell}>
              <Text style={cellLabel}>Store</Text>
              <Text style={cellValue}>{storeName || '—'}</Text>
            </Column>
            <Column style={cell}>
              <Text style={cellLabel}>Location</Text>
              <Text style={cellValue}>{location || '—'}</Text>
            </Column>
          </Row>
          <Row>
            <Column style={cell}>
              <Text style={cellLabel}>Category</Text>
              <Text style={cellValue}>{category || '—'}</Text>
            </Column>
            <Column style={cell}>
              <Text style={cellLabel}>Scanned</Text>
              <Text style={cellValue}>{formatDate(scanDate) || '—'}</Text>
            </Column>
          </Row>
          <Row>
            <Column style={cell}>
              <Text style={cellLabel}>Shelf health</Text>
              <Text style={cellValue}>{percent(healthScore)}</Text>
            </Column>
            <Column style={cell}>
              <Text style={cellLabel}>Planogram compliance</Text>
              <Text style={cellValue}>{percent(compliancePercent)}</Text>
            </Column>
          </Row>
          <Row>
            <Column style={cell}>
              <Text style={cellLabel}>Products detected</Text>
              <Text style={cellValue}>
                {typeof productsDetected === 'number' ? String(productsDetected) : '—'}
              </Text>
            </Column>
            <Column style={cell} />
          </Row>
        </Section>

        <Section style={{ margin: '28px 0 8px' }}>
          <Button href={shareUrl} style={button}>
            View full report
          </Button>
        </Section>

        {pdfUrl ? (
          <Text style={muted}>
            PDF report:{' '}
            <Link href={pdfUrl} style={link}>
              download
            </Link>
          </Text>
        ) : null}
        {annotatedUrl ? (
          <Text style={muted}>
            Annotated shelf image:{' '}
            <Link href={annotatedUrl} style={link}>
              download
            </Link>
          </Text>
        ) : null}
        {csvUrl ? (
          <Text style={muted}>
            CSV report:{' '}
            <Link href={csvUrl} style={link}>
              download
            </Link>
          </Text>
        ) : null}

        <Hr style={hr} />
        <Text style={muted}>
          If the button does not work, copy this link into your browser:
          <br />
          <Link href={shareUrl} style={link}>
            {shareUrl}
          </Link>
        </Text>
        <Text style={muted}>
          Aislix — AI-powered retail shelf intelligence. This report link expires after 7 days.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Shelf audit report${data?.storeName ? ` — ${data.storeName}` : ''}`,
  displayName: 'Shared scan report',
  previewData: {
    sharerName: 'Apurv Gupta',
    storeName: 'Sharma Supermarkets — Andheri',
    location: 'Aisle 4 · Beverages bay',
    category: 'Beverages · Soft drinks',
    scanDate: new Date().toISOString(),
    healthScore: 87,
    productsDetected: 42,
    compliancePercent: 91,
    message: 'Please review the out-of-stock facings before the weekend restock.',
    shareUrl: 'https://aislix.com/share/demo-token',
    pdfUrl: 'https://aislix.com/report.pdf',
    annotatedUrl: 'https://aislix.com/annotated.jpg',
    csvUrl: 'https://aislix.com/report.csv',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const heading = { fontSize: '24px', lineHeight: '32px', color: '#09283e', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2937', margin: '0 0 8px' }
const quote = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#1f2937',
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #0B8F4D',
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '16px 0 0',
}
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '8px 14px',
  margin: '24px 0 0',
}
const cell = { padding: '10px 6px', verticalAlign: 'top' as const, width: '50%' }
const cellLabel = {
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: '#6b7280',
  margin: '0 0 3px',
}
const cellValue = { fontSize: '14px', fontWeight: 600, color: '#09283e', margin: 0 }
const button = {
  backgroundColor: '#09283e',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  padding: '13px 24px',
  textDecoration: 'none',
}
const link = { color: '#0B8F4D' }
const hr = { borderColor: '#e5e7eb', margin: '28px 0' }
const muted = { fontSize: '13px', lineHeight: '20px', color: '#6b7280', margin: '0 0 10px' }
