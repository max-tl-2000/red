/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { AppLinkIdUrls } from '../enums/messageTypes';
import { windowOpen } from '../../client/helpers/win-open';

// TODO: this is not really correct, each client can have its own logic to show the links content
// so having a common method to redirect to a given link where the links are hardcoded is not a good idea
export const redirectToWithLinkId = linkId => windowOpen(AppLinkIdUrls[linkId], '_blank');
