/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import findFreePort from 'find-free-port';
import http, { Server } from 'http';

import { deferred } from '../../helpers/deferred';
import tryParse from '../../helpers/try-parse';

export const sendJSON = (res, jsonObj = {}, statusCode = 200) => {
  res.statusCode = statusCode;

  return res.end(JSON.stringify(jsonObj));
};

const parseBody = req => {
  const dfd = deferred();

  if (req.method === 'GET') {
    req.body = {};
    dfd.resolve();
    return dfd;
  }

  let body = '';
  req.on('data', data => {
    body += data;
  });

  req.on('end', () => {
    req.body = tryParse(body, {});
    dfd.resolve();
  });

  return dfd;
};

interface IHandleRequestFn {
  (req: any, res: any): Promise<void>;
}

interface ICallFnsFn {
  (...fns: IHandleRequestFn[]): IHandleRequestFn;
}

const callFns: ICallFnsFn = (...fns: IHandleRequestFn[]) => async (req, res) => {
  for (let i = 0; i < fns.length; i++) {
    try {
      const fn = fns[i];
      await fn(req, res);
    } catch (err) {
      const { message, token } = err;
      sendJSON(res, { message, token }, 500);
    }
  }
};

interface ICreateSimpleServerOptions {
  port?: number;
  host?: string;
}

interface IListenCallbackFnArgs {
  port?: number;
  host?: string;
}

interface IListenCallbackFn {
  (opts: IListenCallbackFnArgs): void;
}

type Nullable<T> = T | null;

export const createSimpleServer = async (handleRequest: IHandleRequestFn, { port, host }: ICreateSimpleServerOptions = {}) => {
  port = port || (await findFreePort(5000))[0];
  host = host || '127.0.0.1';

  let server: Nullable<Server> = http.createServer(callFns(parseBody, handleRequest));

  return {
    listen: (cb: IListenCallbackFn) => {
      if (!server) throw new Error('Server is not defined. "createServer" might have failed');
      server.listen({ port, host }, () => {
        cb && cb({ port, host });
      });
    },
    close: (cb: IListenCallbackFn) => {
      if (!server) throw new Error('Server is not defined. "createServer" might have failed');
      server.close(() => {
        cb && cb({ port, host });
        server = null;
      });
    },
  };
};
