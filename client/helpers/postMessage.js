/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { parseQueryString } from 'helpers/url';
import { location, window } from '../../common/helpers/globals';

const { pOrigin, frameId } = parseQueryString(location.search);

const parent = window.opener || window.parent;

export const sendToParent = content => {
  const args = { content, senderId: frameId };

  parent.postMessage(JSON.stringify(args), pOrigin);
};
