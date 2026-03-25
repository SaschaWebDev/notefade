import { useHashRoute } from '@/hooks'
import { Layout } from '@/components'
import { Landing, ReadNote, PasswordGate, Docs, Activate, Decode, VerifyReceipt, Encrypt } from '@/pages'

export function App() {
  const route = useHashRoute()

  if (window.location.pathname === '/docs') {
    return (
      <Layout isDocs>
        <Docs />
      </Layout>
    )
  }

  if (window.location.pathname === '/activate') {
    return (
      <Layout>
        <Activate />
      </Layout>
    )
  }

  if (window.location.pathname === '/decode') {
    return (
      <Layout>
        <Decode />
      </Layout>
    )
  }

  if (window.location.pathname === '/verify') {
    return (
      <Layout>
        <VerifyReceipt />
      </Layout>
    )
  }

  if (window.location.pathname === '/encrypt') {
    return (
      <Layout>
        <Encrypt />
      </Layout>
    )
  }

  if (route.mode === 'create') {
    return <Landing />
  }

  if (route.mode === 'protected') {
    return (
      <Layout>
        <PasswordGate protectedData={route.protectedData} byokKey={route.byokKey} />
      </Layout>
    )
  }

  return (
    <Layout>
      <ReadNote
        shardId={route.shardId}
        shardIds={route.shardIds}
        urlPayload={route.urlPayload}
        check={route.check}
        provider={route.provider}
        timeLockAt={route.timeLockAt}
        multiChunks={route.multiChunks}
        byokKey={route.byokKey}
      />
    </Layout>
  )
}
