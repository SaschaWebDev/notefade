import { useHashRoute } from '@/hooks'
import { Layout } from '@/components/Layout'
import { Landing } from '@/components/Landing'
import { ReadNote } from '@/components/ReadNote'
import { PasswordGate } from '@/components/PasswordGate'
import { Docs } from '@/components/Docs'

export function App() {
  const route = useHashRoute()

  if (window.location.pathname === '/docs') {
    return (
      <Layout isDocs>
        <Docs />
      </Layout>
    )
  }

  if (route.mode === 'create') {
    return <Landing />
  }

  if (route.mode === 'protected') {
    return (
      <Layout>
        <PasswordGate protectedData={route.protectedData} />
      </Layout>
    )
  }

  return (
    <Layout>
      <ReadNote shardId={route.shardId} urlPayload={route.urlPayload} check={route.check} provider={route.provider} />
    </Layout>
  )
}
