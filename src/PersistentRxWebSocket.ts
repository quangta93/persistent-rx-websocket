import { BehaviorSubject, race, Subject, Subscription, timer, Observable } from "rxjs"
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

  // TODO More elegant solution than Subjectf or data & status? Values only flow uni-directionaly.
  private data: Subject<D>
  private status: BehaviorSubject<ConnectionStatus>
  private waitInterval: number

  constructor(urlConfigOrSource: string | WebSocketSubjectConfig<D> & { waitInterval?: number }) {
    this.data = new Subject<D>()
    this.status = new BehaviorSubject<ConnectionStatus>('init')

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
  }

  public init(): void {
    this.socket.subscribe(
      (value: D): void => this.data.next(value),
      (): void => {
        // Retry after waitInterval
        timer(this.waitInterval).pipe(take(1)).subscribe(this.init.bind(this))
      }
    )
  }

  public send(value: D): void {
    this.socket.next(value)
  }

  public get statusObservable(): Observable<ConnectionStatus> {
    return this.status.asObservable()
  }

  public subscribeToStatus(
    next?: (value: ConnectionStatus) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this.statusObservable.subscribe(next, error, complete)
  }

  public get dataObservable(): Observable<D> {
    return this.data.asObservable()
  }

  public subscribeToData(
    next?: (value: D) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this.dataObservable.subscribe(next, error, complete)
  }
}
