/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Express from 'express';
import socketIo from 'socket.io';
import { authorize } from 'socketio-jwt';
import http from 'http';
import flatMap from 'lodash/flatMap';
import uniq from 'lodash/uniq';

import { commonConfig } from '../../common/server-config';
import loggerInstance from '../../common/helpers/logger';
import { ChannelNames } from '../../common/enums/ws';
import { setLogMiddleware } from '../../common/server/logger-middleware';
import { decrypt } from '../../common/server/crypto-helper';
import eventTypes from '../../common/enums/eventTypes';
import { publish, RESIDENTS } from '../../common/server/notificationClient';
import { getTenant } from '../services/tenantService';

import PGPubsub from '../common/pgPubsub';
import { setRequestMiddleware } from '../../common/server/request-middleware';
import { sanitizeData } from '../../common/helpers/socket';
import { setServerTimeout } from '../../common/server/server-timeout';

const logger = loggerInstance.child({ subType: 'ws' });

const notifyIfUserHasConnection = async (tenantId, event, data, connections) => {
  const ctx = { tenantId };
  logger.trace({ tenantId, event, userId: data.userId }, 'received user has socket connection query');

  const tcs = connections[tenantId];
  if (tcs && tcs[data.userId] && tcs[data.userId].size) {
    logger.trace({ tenantId, ...data }, 'notifying that user has socket connection on this server');
    await publish(ctx, data.replyChannel, true);
    return;
  }
  logger.trace({ tenantId, event, userId: data.userId }, 'user does not have socket connection on this server');
};

export function runServer() {
  const app = new Express();
  let numConnections = 0;
  let numActiveConnections = 0;

  const connections = new Map();

  setRequestMiddleware({ app });
  setLogMiddleware({ app, logger });

  // this endpoint is used by the health check and is added to all the services
  app.get('/ping', async (req, res) => res.send('ok'));

  const server = new http.Server(app);

  setServerTimeout(server);

  // Both client and server have to set the transports to websocket, otherwise the connection does not happen as it tries to work around polling
  const io = socketIo(server, { transports: ['websocket'], pingTimeout: 30000 });

  const pgClient = new PGPubsub();

  // To debug the websocket server side, add "export DEBUG=socket.io:server" in your env, or at the top of the bashrc, and uncomment the line below
  // io.set('log level', 3);

  const subscribeToChannel = async tenantId => {
    await pgClient.connect();
    await pgClient.listen(tenantId, async channelPayload => {
      const { event, data, routing = {} } = channelPayload;
      const { reqId } = data || {};

      if (event === eventTypes.USER_HAS_WS_CONNECTION_QUERY) {
        await notifyIfUserHasConnection(tenantId, event, data, connections);
        return;
      }

      const tenantConnections = connections[tenantId];

      const { users = [], teams = [], shouldFallbackToBroadcast = true } = routing;
      if (!users.length && !teams.length && shouldFallbackToBroadcast) {
        logger.trace(
          { tenantId, reqId, event, data: sanitizeData(data) },
          `No users or teams routing specified - sending WS notifications to tenant ${tenantId} connections`,
        );
        io.to(tenantId).emit(event, data);
        return;
      }

      const getSocketsFor = (entityIds, entitiesName) => {
        if (!entityIds.length) return [];
        const socketIds = uniq(flatMap(entityIds, id => [...(tenantConnections[id] || [])]));

        const logData = { tenantId, reqId, event, [entitiesName]: entityIds, [`${event} data`]: data };

        if (!socketIds.length) {
          logger.trace(logData, `There are no connected clients for these ${entitiesName}`);
          return [];
        }

        logger.trace(logData, `Sending WS notifications to tenant ${tenantId} ${entitiesName} ${entityIds.join(', ')}`);
        return socketIds;
      };

      uniq([...getSocketsFor(users, 'users'), ...getSocketsFor(teams, 'teams')]).forEach(sid => io.to(sid).emit(event, data));

      // send to connections (if any) with no teams
      shouldFallbackToBroadcast && (tenantConnections.otherConnections || []).forEach(sid => io.to(sid).emit(event, data));
    });
  };

  const addConnectedClient = (tenantId, userId, teamIds, socketId) => {
    connections[tenantId] = connections[tenantId] || {};
    const tenantConnections = connections[tenantId];

    if (!teamIds) {
      // if no teams are specified (e.g. Cucumber tests)
      tenantConnections.otherConnections = tenantConnections.otherConnections || new Set();
      tenantConnections.otherConnections.add(socketId);
    } else {
      teamIds.forEach(teamId => {
        tenantConnections[teamId] = tenantConnections[teamId] || new Set();
        tenantConnections[teamId].add(socketId);
      });
    }

    if (userId) {
      tenantConnections[userId] = tenantConnections[userId] || new Set();
      tenantConnections[userId].add(socketId);
    }
  };

  const handleClientDisconnected = async ({ tenantId, userId, teamIds, socketId }) => {
    if (!tenantId || !socketId) return;

    const tenantConnections = connections[tenantId] || {};

    tenantConnections.otherConnections && tenantConnections.otherConnections.delete(socketId);

    if (teamIds) teamIds.forEach(teamId => tenantConnections[teamId] && tenantConnections[teamId].delete(socketId));

    if (userId && tenantConnections[userId]) {
      tenantConnections[userId].delete(socketId);
      await publish({ tenantId }, tenantId, { event: eventTypes.USER_SOCKET_DISCONNECTED, routing: { users: [userId] } });
    }
  };

  // In our flow, this is called immediately following connect
  // and does NOT imply that the client is act
  const onAuthenticated = async socket => {
    const { id: socketId } = socket;
    const { body, ...rest } = socket?.decoded_token || {};
    const headers = socket.handshake?.headers || {};
    const originIp = headers['x-forwarded-for'] || socket.conn?.remoteAddress;

    if (!body) {
      logger.error({ socketId }, 'Missing encrypted body received from WS client');
      socket.emit('unauthorized', { msg: 'FORCE LOGOUT' }); // FORCE LOGOUT
      return;
    }

    const connectionIdx = numConnections++;
    numActiveConnections++;
    logger.trace({ socketId, originIp, connectionIdx, numActiveConnections }, 'WS client onAuthenticated');
    let tenantId;
    let userId;
    let teamIds;

    socket.on('disconnect', async reason => {
      numActiveConnections--;
      logger.trace({ tenantId, userId, teamIds, socketId, reason, connectionIdx, numActiveConnections }, 'Web client disconnected');
      await handleClientDisconnected({ tenantId, userId, teamIds, socketId });
    });

    await pgClient.connect();
    await pgClient.listen(ChannelNames.ALL, channelPayload => {
      const { event, data } = channelPayload;
      logger.trace({ [`${event} data`]: data }, 'Sending WS notification to ALL');
      io.emit(event, data);
    });

    const decrypted = JSON.parse(decrypt(body));
    socket.decoded_token = { ...rest, ...decrypted };
    if (!socket.decoded_token.tenantId && !socket.decoded_token.commonUserId) return;

    userId = socket.decoded_token.id;
    const { id: _userId, ...token } = socket.decoded_token;

    const residentsChannel = decrypted.commonUserId && RESIDENTS;
    tenantId = token.tenantId || residentsChannel;

    if (tenantId && tenantId !== 'admin' && tenantId !== RESIDENTS) {
      const tenant = await getTenant({ tenantId });
      if (!tenant) {
        logger.error('Invalid tenant received from WS client');
        socket.emit('unauthorized', { msg: 'FORCE LOGOUT' });
        return;
      }
      tenantId = tenant.id;
    }
    teamIds = token.teamIds;

    socket.join(tenantId);

    addConnectedClient(tenantId, userId, teamIds, socketId);
    await subscribeToChannel(tenantId);
    socket.emit('wsClientAuthenticated');
    logger.trace({ tenantId, socketId, userId, connectionIdx }, 'Web client authenticated');
  };

  const authorizer = authorize({
    secret: commonConfig.auth.secret,
    timeout: 30000,
    handshake: true,
  });

  io.on('connect', socket => {
    // we use a two-pass model in which the creds are not passed as part of the handshake
    socket.on('authenticate', authData => {
      socket.handshake = { query: authData };
      authorizer(socket, async error => {
        const { type, code } = error?.data || {};
        if (type === 'UnauthorizedError') {
          logger.info({ socketId: socket.id, type, code }, 'Unable to authorize from token');
          socket.emit('unauthorized', { msg: 'FORCE LOGOUT', reason: code });
          return;
        }
        if (type) {
          logger.info({ socketId: socket.id, type, code }, 'Unexpected error during authorization');
          socket.emit('unauthorized', { msg: 'FORCE LOGOUT', reason: code });
          return;
        }

        try {
          await onAuthenticated(socket);
        } catch (handlerError) {
          logger.error({ error: handlerError }, 'onAuthenticated threw error!');
          // TODO: what to do?
        }
      });
    });

    socket.on('authenticated', onAuthenticated);
  });

  server.listen(commonConfig.wsPort, err => {
    if (err) logger.error(err);
    else {
      logger.info(`==> 📡   Socket server running on port ${commonConfig.wsPort}`);
    }
  });

  return {
    close: async () => {
      logger.trace('Closing WS server');
      await pgClient.close();
      await server.close();
    },
  };
}

export const getSocketServerHost = (localOnly = false) => {
  if (localOnly) {
    return `ws://${commonConfig.wsHost}:${commonConfig.wsPort}`;
  }
  return commonConfig.domain !== 'localhost' ? `wss://ws.${commonConfig.domain}` : `ws://${commonConfig.domain}:${commonConfig.wsPort}`;
};
