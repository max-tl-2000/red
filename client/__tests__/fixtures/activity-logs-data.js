/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';

const NEW_QUOTE_ACTIVITY_LOGS = [
  [
    {
      id: v4(),
      type: ACTIVITY_TYPES.NEW,
      component: COMPONENT_TYPES.QUOTE,
      details: {
        seqDisplayNo: 1,
        id: v4(),
        inventoryId: v4(),
        leaseStartDate: '2017-03-25',
      },
      context: {
        parties: [v4()],
        users: [v4()],
      },
    },
  ],
];

const ACTIVITY_LOG_FORMATTED_DETAILS = 'formattedDetails';

export { NEW_QUOTE_ACTIVITY_LOGS, ACTIVITY_LOG_FORMATTED_DETAILS };
