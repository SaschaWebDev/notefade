import { useHashRoute } from '@/hooks'
import { Layout } from '@/components/Layout'
import { CreateNote } from '@/components/CreateNote'
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

  return (
    <Layout>
      {route.mode === 'create' ? (
        <CreateNote />
      ) : (
        <ReadNote shardId={route.shardId} urlPayload={route.urlPayload} />
      )}
    </Layout>
  )
}
