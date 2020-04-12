import { BehaviorSubject, race, Subject, Subscription, timer } from "rxjs"
import { WebSocketMessage } from "rxjs/internal/observable/dom/WebSocketSubject"
import { filter, take } from 'rxjs/operators'
import { webSocket, WebSocketSubject, WebSocketSubjectConfig } from "rxjs/webSocket"

export type ConnectionStatus = 'init' | 'connected' | 'disconnected'

type Command = 'stop' | 'start'

/**
 * WebSocket client that reconnects indefinitely.
 * Values are passed through as is.
 */
export class PersistentRxWebSocket<D extends WebSocketMessage> extends Subject<D> {
  public static DEFAULT_WAIT_INTERVAL = 10000

  private socket: WebSocketSubject<D>
  private socketToken: Subscription | undefined

  private data: Subject<D>
  private status: BehaviorSubject<ConnectionStatus>
  private command: Subject<Command>
  private waitInterval: number

  constructor(urlConfigOrSource: string | WebSocketSubjectConfig<D> & { waitInterval?: number }) {
    super()

    this.data = new Subject<D>()
    this.status = new BehaviorSubject<ConnectionStatus>('init')
    this.command = new Subject<Command>()

    this.waitInterval = typeof(urlConfigOrSource) === 'string'
      ? PersistentRxWebSocket.DEFAULT_WAIT_INTERVAL
      : urlConfigOrSource?.waitInterval ?? PersistentRxWebSocket.DEFAULT_WAIT_INTERVAL

    this.socket = webSocket({
      url: typeof(urlConfigOrSource) === 'string' ? urlConfigOrSource : urlConfigOrSource.url,
      serializer: (value: D): WebSocketMessage => value,
      deserializer: (e: MessageEvent): D => e.data,
      openObserver: {
        next: (): void => this.status.next('connected')
      },
      closeObserver: {
        next: (): void => this.status.next('disconnected')
      }
    })

    // Setup retry logic
    this.command.subscribe((cmd: Command): void => {
      if (cmd === 'start') {
        if (!this.socketToken) {
          this.socketToken = this.socket.subscribe({
            next: (value: D): void => this.data.next(value),
            error: (): void => {
              this.socketToken = undefined

              // Retry after waitInterval
              // If "stop" command is issued, stop retry attempt.
              race(
                timer(this.waitInterval).pipe(take(1)),
                this.command.asObservable().pipe(filter(cmd => cmd === 'stop'))
              ).subscribe((): void => this.start())
            }
          })
        }
      } else if (cmd === 'stop') {
        if (this.socketToken) {
          this.socketToken.unsubscribe()
          this.socketToken = undefined
        }
      }
    })
  }

  start(): void {
    this.command.next('start')
  }

  stop(): void {
    this.command.next('stop')
  }

  send(value: D): void {
    if (this.socketToken) {
      this.socket.next(value)
    }
  }
}
