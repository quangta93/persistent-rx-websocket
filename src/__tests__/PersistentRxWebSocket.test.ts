import WebSocket from 'ws'
import { ConnectionStatus, PersistentRxWebSocket } from '../PersistentRxWebSocket'
import { createWebSocketServer } from './mock-server'
import { combineLatest } from 'rxjs/operators'

describe.only(`Given a WebSocket server at port 9000`, () => {
  const port: number = 9000
  let server: WebSocket.Server | undefined
  let close: () => void | undefined

  beforeAll((): void => {
    ([server, close] = createWebSocketServer(port))
  })

  afterAll((): void => {
    close?.()
  })

  test(
    `When connect, "init", "connected", and "disconnected" are emitted respectively`,
    (done) => {
      expect.assertions(1)

      const client = new PersistentRxWebSocket<any>(`ws://localhost:${port}`)
      const statusBuffer: ConnectionStatus[] = []

      client.subscribeToStatus((status: ConnectionStatus) => {
        statusBuffer.push(status)

        if (statusBuffer.length === 3) {
          expect(statusBuffer).toEqual(['init', 'connected', 'disconnected'])
          done()
        }
      })

      client.init()
    }
  )
})

describe(`Given a WebSocket server at port 9001`, () => {
  const port: number = 9001
  let server: WebSocket.Server | undefined
  let close: () => void | undefined

  beforeAll((): void => {
    ([server, close] = createWebSocketServer(port))
  })

  afterAll((): void => {
    close?.()
  })

  test(`When 2 clients connect to the same source, a single connection is created`, (done) => {
    expect.assertions(1)

    const source = `ws://localhost:${port}`
    const first = new PersistentRxWebSocket<any>(source)
    const second = new PersistentRxWebSocket<any>(source)

    first.statusObservable.pipe(combineLatest(second.statusObservable)).subscribe(
      (combined: ConnectionStatus[]) => {
        if (combined[0] === 'connected' && combined[1] === 'connected') {
          expect(server?.clients.size).toEqual(1)
          done()
        }
      }
    )

    first.init()
    second.init()
  })
})
