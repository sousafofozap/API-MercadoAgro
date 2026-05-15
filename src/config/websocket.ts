import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RawData, WebSocket, WebSocketServer } from 'ws';

import { JwtAccessPayload } from '../common/types/jwt-payload.type';
import { ConversationsService } from '../modules/conversations/conversations.service';

type AuthenticatedSocket = WebSocket & { userId?: string };

export function setupWebSocket(app: NestFastifyApplication) {
  const config = app.get(ConfigService);
  const jwtService = app.get(JwtService, { strict: false });
  const conversationsService = app.get(ConversationsService, {
    strict: false,
  });
  const prefix = config.getOrThrow<string>('API_PREFIX').replace(/^\/+/, '');
  const accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  const server = app.getHttpAdapter().getInstance().server;
  const wss = new WebSocketServer({ noServer: true });
  const clientsByUser = new Map<string, Set<AuthenticatedSocket>>();

  server.on(
    'upgrade',
    async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== `/${prefix}/ws`) return;

      try {
        const token = extractToken(request, url);
        const payload = await jwtService.verifyAsync<JwtAccessPayload>(token, {
          secret: accessSecret,
        });

        if (payload.type !== 'access' || !payload.sub) {
          throw new UnauthorizedException('Token de acesso invalido.');
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          const client = ws as AuthenticatedSocket;
          client.userId = payload.sub;
          addClient(clientsByUser, payload.sub, client);
          wss.emit('connection', client, request);
        });
      } catch {
        rejectUpgrade(socket, 'Unauthorized');
      }
    },
  );

  wss.on('connection', (client: AuthenticatedSocket) => {
    sendJson(client, { tipo: 'conectado' });

    client.on('message', async (data: RawData) => {
      try {
        const payload = JSON.parse(data.toString()) as {
          tipo?: string;
          conversa_id?: string;
          conteudo?: string;
        };

        if (payload.tipo === 'ping') {
          sendJson(client, { tipo: 'pong' });
          return;
        }

        if (!payload.conversa_id || !payload.conteudo) {
          throw new UnauthorizedException(
            'Informe conversa_id e conteudo na mensagem.',
          );
        }

        const message = await conversationsService.createMessage(
          client.userId!,
          payload.conversa_id,
          { conteudo: payload.conteudo },
        );
        const participants = await conversationsService.getParticipantIds(
          payload.conversa_id,
        );

        for (const participantId of participants) {
          broadcast(clientsByUser, participantId, {
            tipo: 'mensagem',
            data: message,
          });
        }
      } catch (error) {
        sendJson(client, toSocketError(error));
      }
    });

    client.on('close', () => {
      if (client.userId) removeClient(clientsByUser, client.userId, client);
    });
  });
}

function extractToken(request: IncomingMessage, url: URL) {
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const authorization = request.headers.authorization ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1];

  throw new UnauthorizedException('Token de acesso ausente.');
}

function addClient(
  clientsByUser: Map<string, Set<AuthenticatedSocket>>,
  userId: string,
  client: AuthenticatedSocket,
) {
  const clients = clientsByUser.get(userId) ?? new Set<AuthenticatedSocket>();
  clients.add(client);
  clientsByUser.set(userId, clients);
}

function removeClient(
  clientsByUser: Map<string, Set<AuthenticatedSocket>>,
  userId: string,
  client: AuthenticatedSocket,
) {
  const clients = clientsByUser.get(userId);
  if (!clients) return;
  clients.delete(client);
  if (clients.size === 0) clientsByUser.delete(userId);
}

function broadcast(
  clientsByUser: Map<string, Set<AuthenticatedSocket>>,
  userId: string,
  payload: unknown,
) {
  const clients = clientsByUser.get(userId);
  if (!clients) return;
  for (const client of clients) sendJson(client, payload);
}

function sendJson(client: WebSocket, payload: unknown) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
}

function toSocketError(error: unknown) {
  const status =
    error instanceof HttpException ? error.getStatus() : 500;
  const response =
    error instanceof HttpException ? error.getResponse() : undefined;
  const rawMessage =
    typeof response === 'object' && response !== null && 'message' in response
      ? (response as { message?: string | string[] }).message
      : typeof response === 'string'
        ? response
        : 'Nao foi possivel processar a mensagem.';

  return {
    tipo: 'erro',
    erro: status === 401 ? 'UNAUTHORIZED' : 'WEBSOCKET_ERROR',
    mensagem: Array.isArray(rawMessage)
      ? (rawMessage[0] ?? 'Erro na mensagem.')
      : rawMessage,
  };
}

function rejectUpgrade(socket: Duplex, message: string) {
  socket.write(
    `HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${message.length}\r\n\r\n${message}`,
  );
  socket.destroy();
}
