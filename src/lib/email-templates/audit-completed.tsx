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
  assigneeName?: string
  storeName?: string | null
  location?: string | null
  category?: string | null
  subCategory?: string | null
  auditName?: string | null
  auditDescription?: string | null
  scanDate?: string | null
  healthScore?: number | null
  productsDetected?: number | null
  compliancePercent?: number | null
  reportUrl?: string
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toUTCString().replace(' GMT', 'UTC')
}

const percent = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—'

const Email = ({
  assigneeName = 'A team member',
  storeName,
  location,
  category,
  subCategory,
  auditName,
  auditDescription,
  scanDate,
  healthScore,
  productsDetected,
  compliancePercent,
  reportUrl = 'https://aislix.com',
}: Props) => {
  const storeLabel = storeName?.trim() || 'this store'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${assigneeName} completed the shelf audit at ${storeLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailLogo />
          <Heading style={heading}>Audit completed — {storeLabel}</Heading>
          <Text style={text}>
            Audit has been completed by <strong>{assigneeName}</strong> and you can view the report
            using the link below.
          </Text>

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
                <Text style={cellLabel}>Audit name</Text>
                <Text style={cellValue}>{auditName || '—'}</Text>
              </Column>
              <Column style={cell}>
                <Text style={cellLabel}>Audit description</Text>
                <Text style={cellValue}>{auditDescription || '—'}</Text>
              </Column>
            </Row>
            <Row>
              <Column style={cell}>
                <Text style={cellLabel}>Category</Text>
                <Text style={cellValue}>{category || '—'}</Text>
              </Column>
              <Column style={cell}>
                <Text style={cellLabel}>Subcategory</Text>
                <Text style={cellValue}>{subCategory || '—'}</Text>
              </Column>
            </Row>
            <Row>
              <Column style={cell}>
                <Text style={cellLabel}>Completed by</Text>
                <Text style={cellValue}>{assigneeName}</Text>
              </Column>
              <Column style={cell}>
                <Text style={cellLabel}>Audited</Text>
                <Text style={cellValue}>{formatDate(scanDate) || '—'}</Text>
              </Column>
            </Row>
            <Row>
              <Column style={cell}>
                <Text style={cellLabel}>Shelf health</Text>
                <Text style={cellValue}>{percent(healthScore)}</Text>
              </Column>
              <Column style={cell}>
                <Text style={cellLabel}>Products detected</Text>
                <Text style={cellValue}>
                  {typeof productsDetected === 'number' ? String(productsDetected) : '—'}
                </Text>
              </Column>
            </Row>
            <Row>
              <Column style={cell}>
                <Text style={cellLabel}>Planogram compliance</Text>
                <Text style={cellValue}>{percent(compliancePercent)}</Text>
              </Column>
              <Column style={cell} />
            </Row>
          </Section>

          <Section style={{ margin: '28px 0 8px' }}>
            <Button href={reportUrl} style={button}>
              View full report
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={muted}>
            If the button does not work, copy this link into your browser:
            <br />
            <Link href={reportUrl} style={link}>
              {reportUrl}
            </Link>
          </Text>
          <Text style={muted}>Aislix — AI-powered retail shelf intelligence.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const store = data?.storeName ? String(data.storeName) : null
    const name = data?.auditName ? String(data.auditName) : null
    if (store && name) return `Audit completed — ${store} · ${name}`
    if (store) return `Audit completed — ${store}`
    return 'Audit completed'
  },
  displayName: 'Audit completed (assignor)',
  previewData: {
    assigneeName: 'Apurv Gupta',
    storeName: 'Sharma Supermarkets — Andheri',
    location: 'Aisle 4 · Beverages bay',
    category: 'Beverages',
    subCategory: 'Soft drinks',
    auditName: 'Weekend beverage bay check',
    auditDescription: 'Verify planogram compliance before weekend restock.',
    scanDate: new Date().toISOString(),
    healthScore: 87,
    productsDetected: 42,
    compliancePercent: 91,
    reportUrl: 'https://aislix.com/results?scan=demo-scan-id',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const heading = { fontSize: '24px', lineHeight: '32px', color: '#09283e', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2937', margin: '0 0 8px' }
const card = {
  marginTop: '20px',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '8px 4px',
}
const cell = { padding: '10px 12px', verticalAlign: 'top' as const }
const cellLabel = { fontSize: '11px', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' as const }
const cellValue = { fontSize: '14px', color: '#0f172a', margin: 0, fontWeight: 600 as const }
const button = {
  backgroundColor: '#09283e',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 600 as const,
  textDecoration: 'none',
}
const muted = { fontSize: '12px', lineHeight: '18px', color: '#64748b', margin: '8px 0 0' }
const link = { color: '#0f766e', textDecoration: 'underline' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
