/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const getHookWrapper = (logger, defaultTimeout) =>
  // strangely enough, not all the hooks deal properly
  // with the returned promise. For example the `BeforeFeatures`
  // does not handle correctly promises returned from it, if the promise
  // is never resolved the timeout will never be reached and the process
  // just hangs in there. Even worse if the promise is rejected it just
  // produces and `unhandledRejection` but never continues, hanging.
  //
  // but, `BeforeFeatures` does handle correctly the callbacks signature
  // so this wrapper allows us to use the callback signature under the hood
  // TODO: check if this issue also happens with the steps
  // if that happens we might need to monkey patch the cucumber steps as well
  (name, fn) => (args, done) => {
    const timeoutId = setTimeout(() => done({ reason: `${name}: timeout reached` }), defaultTimeout);
    try {
      const p = Promise.resolve(fn(args, done)); // eslint-disable-line
      p.then(
        () => {
          clearTimeout(timeoutId);
          logger.trace(`hookWrapper: ${name}, done!`);
          done();
        },
        error => {
          clearTimeout(timeoutId);
          logger.error({ error }, `hookWrapper: Rejection found during ${name} execution`);
          done(error);
        },
      );
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error({ error }, `hookWrapper: Exception found during ${name} execution`);
      done(error);
    }
  };
