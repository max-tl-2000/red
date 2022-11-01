/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// this variable is set to development
// during a production build in order to be
// able to use unminimized code in production
//
// check CPM-137
global.__RED_PROD_MODE__ = 'development';
