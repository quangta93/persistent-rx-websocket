import WebSocket from "ws";

// Create a local mock server that disconnects after socket is opened.
export const createWebSocketServer = (
  port: number,
  openInterval: number = 200
): WebSocket.Server => {
  const server = new WebSocket.Server({ host: "localhost", port });

  server.on("connection", (socket: WebSocket): void => {
    socket.on("open", (): void => {
      setTimeout((): void => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }, openInterval);
    });
  });

  return server;
};
