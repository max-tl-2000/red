/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { resolveSubdomainURL } from '../helpers/resolve-url';

export const resolveWebSocketURL = (host, protocol, wsPort) => {
  const hostParts = host.split(':');
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  let url = resolveSubdomainURL(`${wsProtocol}://${hostParts[0]}`, 'ws');

  if (hostParts[1]) {
    url += `:${wsPort}`;
  }

  return url;
};
