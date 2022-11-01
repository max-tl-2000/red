/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { reaction } from 'mobx';
import { registerUserInGlobal, loadWalkMe } from '../../../common/client/walk-me';

let clearUserInGlobal;

const storeInfo = (userInfo, walkMeURL) => {
  const { personId, applicantEmail, impersonatorUserId, impersonatorEmail } = userInfo;
  if (!(personId || impersonatorUserId) || !(applicantEmail || impersonatorEmail)) {
    clearUserInGlobal && clearUserInGlobal();
    return;
  }
  clearUserInGlobal = registerUserInGlobal(
    { id: personId, email: applicantEmail, impersonatorId: impersonatorUserId, impersonatorEmail },
    { idKey: 'personId', emailKey: 'personEmail', impersonatorIdKey: 'userId', impersonatorEmailKey: 'userEmail' },
  );
  loadWalkMe(walkMeURL);
};

export const registerWalkMeGlobals = (application, auth, walkMeURL, agentInfo) => {
  // if we have the agentInfo it means we're on one of the pages that can be embedded in leasing
  // so in this case we register the walkMe globals as if the agent was the user
  // this will have the effect to have in the global scope the variable __reva_walkMeEmail pointing to
  // the agent email
  if (agentInfo) {
    const { id, email } = agentInfo;
    registerUserInGlobal({ id, email });
    loadWalkMe(walkMeURL);
    return;
  }

  reaction(
    () => {
      const { personId, applicantEmail } = application;
      const { impersonatorUserId, impersonatorEmail } = auth;
      return { personId, applicantEmail, impersonatorUserId, impersonatorEmail };
    },
    args => storeInfo(args, walkMeURL),
  );

  storeInfo(application, walkMeURL);
};
