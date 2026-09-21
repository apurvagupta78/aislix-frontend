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
  assignerName?: string
  assigneeName?: string
  storeName?: string | null
  location?: string | null
  category?: string | null
  subCategory?: string | null
  auditName?: string | null
  auditDescription?: string | null
  auditMode?: string | null
  dueAt?: string | null
  myWorkUrl?: string
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toUTCString().replace(' GMT', 'UTC')
}

const Email = ({
  assignerName = 'Your manager',
  assigneeName = 'you',
  storeName,
  location,
  category,
  subCategory,
  auditName,
  auditDescription,
  auditMode,
  dueAt,
  myWorkUrl = 'https://aislix.com/my-scans',
}: Props) => {
  const storeLabel = storeName?.trim() || 'a store'
  const modeLabel = auditMode === 'digital' ? 'Digital' : 'AI'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`New ${modeLabel} audit assigned at ${storeLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailLogo />
          <Heading style={heading}>Audit assigned — {storeLabel}</Heading>
          <Text style={text}>
            <strong>{assignerName}</strong> has assigned a {modeLabel.toLowerCase()} audit to{' '}
            <strong>{assigneeName}</strong>. Open My Work to start.
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
                <Text style={cellLabel}>Audit type</Text>
                <Text style={cellValue}>{modeLabel}</Text>
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
                <Text style={cellLabel}>Due</Text>
                <Text style={cellValue}>{formatDate(dueAt) || 'No due date'}</Text>
              </Column>
              <Column style={cell}>
                <Text style={cellLabel}>Description</Text>
                <Text style={cellValue}>{auditDescription || '—'}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ margin: '28px 0 8px' }}>
            <Button href={myWorkUrl} style={button}>
              Open My Work
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={muted}>
            If the button does not work, copy this link into your browser:
            <br />
            <Link href={myWorkUrl} style={link}>
              {myWorkUrl}
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
    if (store && name) return `Audit assigned — ${store} · ${name}`
    if (store) return `Audit assigned — ${store}`
    return 'Audit assigned'
  },
  displayName: 'Audit assigned (assignee)',
  previewData: {
    assignerName: 'Apaar Gupta',
    assigneeName: 'Apurv Gupta',
    storeName: 'Sharma Supermarkets — Andheri',
    location: 'Aisle 4 · Beverages bay',
    category: 'Beverages',
    subCategory: 'Soft drinks',
    auditName: 'Weekend beverage bay check',
    auditDescription: 'Verify planogram compliance before weekend restock.',
    auditMode: 'ai',
    dueAt: new Date().toISOString(),
    myWorkUrl: 'https://aislix.com/my-scans',
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
