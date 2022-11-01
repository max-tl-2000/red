/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveAnalyticsLog } from '../dal/analyticsRepo';
import { COMPONENT_TYPES } from '../../common/enums/activityLogTypes';
import { getOne } from '../database/factory';

const tableNames = {
  [COMPONENT_TYPES.GUEST]: 'Person',
  [COMPONENT_TYPES.APPOINTMENT]: 'Tasks',
  [COMPONENT_TYPES.PARTY]: 'Party',
  [COMPONENT_TYPES.QUOTE]: 'Quote',
  [COMPONENT_TYPES.EMAIL]: 'Communication',
  [COMPONENT_TYPES.SMS]: 'Communication',
  [COMPONENT_TYPES.CALL]: 'Communication',
  [COMPONENT_TYPES.LEASINGTEAM]: 'Teams',
  [COMPONENT_TYPES.TASK]: 'Tasks',
  [COMPONENT_TYPES.CONTACT_EVENT]: 'Communication',
};

export const saveLog = async ({ ctx, type, component, subComponent, entityId, activityDetails, activityContext }) => {
  const tableName = tableNames[component];
  const entity = (entityId && tableName && (await getOne(ctx, tableName, entityId))) || {};

  return saveAnalyticsLog({
    ctx,
    type,
    component,
    subComponent,
    entity,
    activityDetails,
    activityContext,
  });
};
