/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { resolveWebSocketURL } from '../resolve-helper';

describe('resolveWebSocketURL', () => {
  it('when localhost it should produce ws protocol and port', async () => {
    const res = resolveWebSocketURL('red.localhost.com:3000', '', 3040);
    expect(res).to.equal('ws://ws.localhost.com:3040');
  });

  it('when secure host it should produce wss protocol', async () => {
    const res = resolveWebSocketURL('red.local.env.reva.tech', 'https');
    expect(res).to.equal('wss://ws.local.env.reva.tech');
  });
});
