import type { ProviderType, ProviderField } from './provider-types'

export interface ProviderEntry {
  type: ProviderType
  label: string
  fields: ProviderField[]
  showCredentialWarning: boolean
}

export const PROVIDERS: ProviderEntry[] = [
  {
    type: 'self',
    label: 'Self-Hosted API',
    fields: [
      {
        key: 'u',
        label: 'api url',
        placeholder: 'https://your-worker.example.com',
        secret: false,
      },
    ],
    showCredentialWarning: false,
  },
  {
    type: 'cf-kv',
    label: 'Cloudflare KV',
    fields: [
      {
        key: 'a',
        label: 'account id',
        placeholder: '023e105f4ecef8ad...',
        secret: false,
      },
      {
        key: 'n',
        label: 'namespace id',
        placeholder: '0f2ac74b498b4802...',
        secret: false,
      },
      {
        key: 'k',
        label: 'api token',
        placeholder: 'Bearer token from Cloudflare dashboard',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
  {
    type: 'cf-d1',
    label: 'Cloudflare D1',
    fields: [
      {
        key: 'a',
        label: 'account id',
        placeholder: '023e105f4ecef8ad...',
        secret: false,
      },
      {
        key: 'd',
        label: 'database id',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        secret: false,
      },
      {
        key: 'k',
        label: 'api token',
        placeholder: 'Bearer token from Cloudflare dashboard',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
  {
    type: 'upstash',
    label: 'Upstash Redis',
    fields: [
      {
        key: 'u',
        label: 'rest url',
        placeholder: 'https://xxx.upstash.io',
        secret: false,
      },
      {
        key: 'k',
        label: 'rest token',
        placeholder: 'AXxx...',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
  {
    type: 'vercel',
    label: 'Vercel KV',
    fields: [
      {
        key: 'u',
        label: 'rest url',
        placeholder: 'https://xxx.kv.vercel-storage.com',
        secret: false,
      },
      {
        key: 'k',
        label: 'rest token',
        placeholder: 'AXxx...',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
  {
    type: 'supabase',
    label: 'Supabase',
    fields: [
      {
        key: 'u',
        label: 'project url',
        placeholder: 'https://xxx.supabase.co',
        secret: false,
      },
      {
        key: 'k',
        label: 'anon key',
        placeholder: 'eyJhbGciOi...',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
  {
    type: 'dynamodb',
    label: 'AWS DynamoDB',
    fields: [
      {
        key: 'u',
        label: 'api gateway url',
        placeholder: 'https://xxx.execute-api.region.amazonaws.com/prod',
        secret: false,
      },
      {
        key: 'k',
        label: 'api key',
        placeholder: 'Your API Gateway key',
        secret: true,
      },
    ],
    showCredentialWarning: true,
  },
]

export function getProviderEntry(type: ProviderType): ProviderEntry | undefined {
  return PROVIDERS.find((p) => p.type === type)
}

export function getProviderLabel(type: ProviderType): string {
  return getProviderEntry(type)?.label ?? type
}
