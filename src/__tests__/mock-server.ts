import WebSocket from "ws";

// Create a local mock server that disconnects after socket is opened.
export const createWebSocketServer = (
  port: number,
  openInterval: number = 200
): [WebSocket.Server, () => void] => {
  const server = new WebSocket.Server({ host: "localhost", port })

  server.on("connection", (socket: WebSocket): void => {
    setTimeout((): void => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }, openInterval)
  })

  server.on("listening", (): void =>
    console.log(`[WebSocket Server] WS server listening at ws://localhost:${port}`)
  )

  const close = (): void => {
    server.clients.forEach((socket: WebSocket): void => socket.close())
    server.close()
  }

  return [server, close];
};
