/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable */

module.exports = {
  rules: {
    'no-driver': require('./rules/no-driver'),
    'no-just-wait': require('./rules/no-just-wait'),
    'no-click': require('./rules/no-click'),
    'no-tc-click': require('./rules/no-tc-click'),
    'no-find-element': require('./rules/no-find-element'),
    'no-lodash': require('./rules/no-lodash'),
    'dal-async': require('./rules/dal-async'),
    'no-moment': require('./rules/no-moment'),
  },
  configs: {
    recommended: {
      rules: {
        'red/no-driver': 2,
        'red/no-just-wait': 2,
        'red/no-click': 2,
        'red/no-tc-click': 2,
        'red/no-find-element': 2,
        'red/no-lodash': 2,
        'red/dal-async': 2,
        'red/no-moment': 2,
      }
    }
  }
};
