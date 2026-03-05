import { useState, useEffect, useRef } from 'react'
import type { EndpointDef } from './docs-data'
import { METHOD_COLORS } from './docs-data'
import { DocsCodeBlock } from './DocsCodeBlock'
import { IconChevronDown } from '../ui/icons'
import styles from './ApiEndpoint.module.css'

interface ApiEndpointProps {
  endpoint: EndpointDef
}

export function ApiEndpoint({ endpoint }: ApiEndpointProps) {
  const [open, setOpen] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const measure = () => setHeight(el.scrollHeight)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const methodColor = METHOD_COLORS[endpoint.method] ?? '#888'

  return (
    <div className={styles.card}>
      <button
        className={styles.header}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        type="button"
      >
        <div className={styles.headerLeft}>
          <span
            className={styles.method}
            style={{ background: `${methodColor}18`, color: methodColor }}
          >
            {endpoint.method}
          </span>
          <span className={styles.path}>{endpoint.path}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.summary}>{endpoint.summary}</span>
          <IconChevronDown
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          />
        </div>
      </button>

      <div className={styles.body} style={{ maxHeight: open ? `${height}px` : '0px' }}>
        <div ref={innerRef} className={styles.bodyInner}>
          <p className={styles.description}>{endpoint.description}</p>

          {endpoint.params.length > 0 && (
            <div className={styles.tableSection}>
              <h4 className={styles.tableTitle}>Parameters</h4>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>In</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <code className={styles.paramName}>{p.name}</code>
                        {p.required && <span className={styles.required}>required</span>}
                      </td>
                      <td className={styles.paramLocation}>{p.location}</td>
                      <td className={styles.paramType}>{p.type}</td>
                      <td className={styles.paramDesc}>
                        {p.description}
                        {p.pattern && (
                          <>
                            <br />
                            <code className={styles.pattern}>{p.pattern}</code>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.tableSection}>
            <h4 className={styles.tableTitle}>Responses</h4>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Body</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.responses.map((r) => (
                  <tr key={r.status}>
                    <td>
                      <code className={styles.statusCode}>{r.status}</code>
                    </td>
                    <td>{r.description}</td>
                    <td>
                      {r.body ? (
                        <code className={styles.responseBody}>{r.body}</code>
                      ) : (
                        <span className={styles.noBody}>\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {endpoint.exampleRequest && (
            <div className={styles.tableSection}>
              <h4 className={styles.tableTitle}>Example</h4>
              <DocsCodeBlock code={endpoint.exampleRequest} language="http" />
              {endpoint.exampleResponse && (
                <DocsCodeBlock code={endpoint.exampleResponse} language="http" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
