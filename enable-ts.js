/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// make nodejs able to understand the ts extension in prod
// =======================================================
//
// This is important since ts modules are compiled but extension preserved
// transitive requires will just fail.
require.extensions['.ts'] = require.extensions['.js'];
