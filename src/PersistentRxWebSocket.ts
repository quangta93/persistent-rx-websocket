import { BehaviorSubject, race, Subject, Subscription, timer } from "rxjs"
import { take } from 'rxjs/operators'
import { webSocket, WebSocketSubject, WebSocketSubjectConfig } from "rxjs/webSocket"
import WebSocket from 'ws'

export type ConnectionStatus = 'init' | 'connected' | 'disconnected'

type Command = 'stop' | 'start'
type RxWebSocketMessage = Exclude<WebSocket.Data | ArrayBufferView, Buffer[]>

/**
 * WebSocket client that reconnects indefinitely.
 * Values are passed through as is.
 */
export class PersistentRxWebSocket<D extends RxWebSocketMessage> {
  public static DEFAULT_WAIT_INTERVAL = 10000

  private socket: WebSocketSubject<D>
  private socketSubscription: Subscription | undefined

  private data: Subject<D>
  private status: BehaviorSubject<ConnectionStatus>
  private command: Subject<Command>
  private waitInterval: number

  constructor(urlConfigOrSource: string | WebSocketSubjectConfig<D> & { waitInterval?: number }) {
    this.data = new Subject<D>()
    this.status = new BehaviorSubject<ConnectionStatus>('init')
    this.command = new Subject<Command>()

    this.waitInterval = typeof(urlConfigOrSource) === 'string'
      ? PersistentRxWebSocket.DEFAULT_WAIT_INTERVAL
      : urlConfigOrSource?.waitInterval ?? PersistentRxWebSocket.DEFAULT_WAIT_INTERVAL

    this.socket = webSocket({
      url: typeof(urlConfigOrSource) === 'string' ? urlConfigOrSource : urlConfigOrSource.url,
      serializer: (value: D): RxWebSocketMessage => value,
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
      // console.log("PersistentRxWebSocket -> cmd", cmd)
      switch (cmd) {
        case 'start': {
          if (!this.socketSubscription) {
            this.socketSubscription = this.socket.subscribe({
              next: (value: D): void => this.data.next(value),
              error: (): void => {
                this.socketSubscription = undefined

                // Retry after waitInterval
                // If "stop" command is issued, stop retry attempt.
                // If "start" command is issued, execute immediately
                race(timer(this.waitInterval).pipe(take(1)), this.command).subscribe(
                  this.start.bind(this)
                )
              }
            })
          } // else, do not start aka subscribe again if already started.

          break
        }

        case 'stop': {
          if (this.socketSubscription) {
            this.socketSubscription.unsubscribe()
            this.socketSubscription = undefined
          } // else, do not close again.

          break
        }
      }
    })
  }

  public start(): void {
    this.command.next('start')
  }

  public stop(): void {
    this.command.next('stop')
  }

  public send(value: D): void {
    if (this.socketSubscription) {
      this.socket.next(value)
    }
  }

  public subscribeToStatus(
    next?: (value: ConnectionStatus) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this.status.asObservable().subscribe(next, error, complete)
  }

  public subscribeToData(
    next?: (value: D) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this.data.asObservable().subscribe(next, error, complete)
  }
}
