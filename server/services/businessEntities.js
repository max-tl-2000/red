/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export function getBusinessEntityIdByName(entityName, bussinessEntities) {
  const businessEntity = bussinessEntities.find(element => element.name === entityName);
  return businessEntity ? businessEntity.id : null;
}
