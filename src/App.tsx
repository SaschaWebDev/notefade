import { useHashRoute } from '@/hooks'
import { Layout } from '@/components/Layout'
import { Landing } from '@/components/Landing'
import { ReadNote } from '@/components/ReadNote'
import { PasswordGate } from '@/components/PasswordGate'
import { Docs } from '@/components/Docs'
import { Activate } from '@/components/Activate'
import { Decode } from '@/components/Decode'
import { VerifyReceipt } from '@/components/VerifyReceipt'

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
      <ReadNote
        shardId={route.shardId}
        shardIds={route.shardIds}
        urlPayload={route.urlPayload}
        check={route.check}
        provider={route.provider}
        timeLockAt={route.timeLockAt}
      />
    </Layout>
  )
}
