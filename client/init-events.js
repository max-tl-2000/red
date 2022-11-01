/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from './helpers/mediator';

// persistent events are fired even if they were fired before
// a listener was added. To don't have to worry about potential
// race conditions like the one preventing walk-me from loading
mediator.registerPersistentEvent('user:login');
