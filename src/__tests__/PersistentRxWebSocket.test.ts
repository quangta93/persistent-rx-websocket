import WebSocket from 'ws'
import { ConnectionStatus, PersistentRxWebSocket } from '../PersistentRxWebSocket'
import { createWebSocketServer } from './mock-server'

describe(`Given a WebSocket server`, () => {
  const port: number = 9000
  let server: WebSocket.Server | undefined
  let close: () => void | undefined

  beforeAll((): void => {
    ([server, close] = createWebSocketServer(port))
  })

  afterAll((): void => {
    close?.()
  })

  test(`When connect, "init", "connected", and "disconnected" are emitted respectively`, (done) => {
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

    client.start()
  })
})
