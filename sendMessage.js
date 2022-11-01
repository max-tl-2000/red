/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sendMessage, stopQueueConnection } from './server/services/pubsub';
import { APP_EXCHANGE } from './server/helpers/message-constants';

// Utility script to send custom messages to RabbitMQ
// Usage:
// node_modules/.bin/babel-node sendMessage.js
async function main() {
  const msg = { sleep: 2000 };

  for (let i = 0; i < 100; i++) {
    console.log(`Going to send message: ${msg}`);
    const res = await sendMessage({
      exchange: APP_EXCHANGE,
      key: 'load_testing',
      message: msg,
    });
    console.log(`Sent message: ${res}`);
  }
}

if (require.main === module) {
  main()
    .then(stopQueueConnection)
    .catch(e => {
      console.log(e.stack);
      stopQueueConnection();
    });
}
