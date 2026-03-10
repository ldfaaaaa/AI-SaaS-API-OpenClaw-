import type { FastifyInstance } from 'fastify';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

interface NotifyPayload {
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

class NotificationGateway {
  private wss: WebSocketServer | null = null;
  private readonly userConnections = new Map<string, Set<WebSocket>>();
  private initialized = false;

  init(app: FastifyInstance): void {
    if (this.initialized) {
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    app.server.on('upgrade', (request, socket, head) => {
      if (!request.url?.startsWith('/ws/notifications')) {
        return;
      }

      const userId = this.extractUserId(app, request.url, request.headers.host);
      if (!userId) {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
        return;
      }

      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.bindClient(userId, ws);
      });
    });

    this.initialized = true;
  }

  async notifyUser(userId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const sockets = this.userConnections.get(userId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const message: NotifyPayload = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message);

    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    });
  }

  async close(): Promise<void> {
    this.userConnections.forEach((connections) => {
      connections.forEach((socket) => {
        socket.close();
      });
    });

    this.userConnections.clear();

    if (!this.wss) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.wss?.close(() => resolve());
    });

    this.wss = null;
    this.initialized = false;
  }

  private bindClient(userId: string, ws: WebSocket): void {
    const sockets = this.userConnections.get(userId) ?? new Set<WebSocket>();
    sockets.add(ws);
    this.userConnections.set(userId, sockets);

    ws.send(
      JSON.stringify({
        event: 'connection.ready',
        payload: { userId },
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('close', () => {
      this.removeConnection(userId, ws);
    });

    ws.on('error', () => {
      this.removeConnection(userId, ws);
    });

    ws.on('message', (raw) => {
      const message = raw.toString();
      if (message === 'ping' && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            event: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          })
        );
      }
    });
  }

  private removeConnection(userId: string, ws: WebSocket): void {
    const sockets = this.userConnections.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(ws);
    if (sockets.size === 0) {
      this.userConnections.delete(userId);
    }
  }

  private extractUserId(
    app: FastifyInstance,
    requestUrl: string,
    hostHeader: string | undefined
  ): string | null {
    const url = new URL(requestUrl, `http://${hostHeader || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token) {
      return null;
    }

    try {
      const payload = app.jwt.verify<{ id: string }>(token);
      return payload.id;
    } catch {
      return null;
    }
  }
}

export const notificationGateway = new NotificationGateway();
