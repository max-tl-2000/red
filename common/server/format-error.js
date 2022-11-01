/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const formatError = (error, { isProdEnv, logger }) => {
  const { stack, data, message, token, ...rest } = error;
  if (typeof error !== 'object') {
    return error;
  }

  logger && logger.error({ err: error }, 'Error during request processing');

  // in PROD we only show the token and the message
  error = {
    message: 'Error processing request', // Generic message in case of Prod
    token,
    data,
  };

  if (!isProdEnv) {
    // in other envs we show all the info in the response
    error = {
      ...error,
      ...rest,
      message,
      stack,
    };
  }

  return error;
};
