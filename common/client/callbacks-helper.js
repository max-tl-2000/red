/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * combine callback functions in a way that the next callback is only exectued if the
 * next callback is called from within the callbacks being combined.
 *
 * The `next` fn is passed as the last parameter to each callback function
 *
 * The main idea is to follow the middleware patttern from express that executes the next
 * middleware only if the previous one called next.
 *
 * This is useful for example in the main router, where we might want to perform first a check to
 * see if the route needs the user to be logged in, if we need the user to be logged out
 * for example in the /resetPassword route we can dispatch logout from within the first callback
 * and not call `next` so any other checks are just ignored to force the user to be logout.
 */
export const combineCallbacks = (cbs = []) => {
  const len = cbs.length;
  let index = 0;

  // if no callbacks do not create any combine function
  if (len === 0) {
    return undefined;
  }

  // inner function to peform the iteration over the callbacks
  const execute = (...args) => {
    // get the callback by current index
    const cb = cbs[index];

    // create a next callback function to pass as the last argument
    const next = () => {
      index++;
      // if we're done, just return
      if (index === len) {
        return;
      }
      // execute the cb function
      execute(...args);
    };

    cb(...[...args, next]);
  };

  return function combine(...args) {
    execute(...args);
  };
};
