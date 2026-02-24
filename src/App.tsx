import { useHashRoute } from '@/hooks'
import { Layout } from '@/components/Layout'
import { Landing } from '@/components/Landing'
import { ReadNote } from '@/components/ReadNote'
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

  return (
    <Layout>
      <ReadNote shardId={route.shardId} urlPayload={route.urlPayload} check={route.check} provider={route.provider} />
    </Layout>
  )
}
