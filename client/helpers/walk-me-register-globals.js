/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from './mediator';
import { registerUserInGlobal, loadWalkMe } from '../../common/client/walk-me';

let clearUserInGlobal;

export const registerWalkMeGlobals = scriptURL => {
  mediator.on('user:login', (e, args) => {
    const { user } = args;
    clearUserInGlobal = registerUserInGlobal(user);
    if (user?.metadata?.isAdmin) return;
    loadWalkMe(scriptURL);
  });

  mediator.on('user:logout', () => {
    clearUserInGlobal && clearUserInGlobal();
    /* When the user logs-out, a page refresh occurs, this means we dont need to remove the script and html from the document.
     * Removing the html could produce bugs because we are depending on an external service implementation(walkme).
     */
  });
};
