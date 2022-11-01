/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// Rely on the x-forwarded-proto header because this service is behind a load balancer and is not public
// When running locally this header would not be set, also if it had been public, it could have been spoofed.

export const setSecureMiddleware = ({ logger, app }) => {
  // Allows to retrieve the protocol from the X- headers when behind a proxy or load balancer. Safe to do in our case because our server is private.
  app.enable('trust proxy');

  const ensureSecure = (req, res, next) => {
    const forwarded = req.get('X-Forwarded-Proto');
    if (forwarded === undefined || forwarded === 'https') {
      next();
      return;
    }

    // Only redirect GET methods
    if (req.method === 'GET' || req.method === 'HEAD') {
      const host = req.get('Host');
      logger.debug(`Redirecting to https://${host}${req.originalUrl}`);
      res.redirect(301, `https://${host}${req.originalUrl}`);
    } else {
      res.status(403).send('Please use HTTPS when submitting data to this server.');
    }
  };

  // Redirect any traffic that is not secure (https)
  app.use(ensureSecure);
};
