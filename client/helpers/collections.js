/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export function getObjectsFromMapByIds(map, ids) {
  if (!map || !ids) return [];
  return ids.filter(id => map.has(id)).map(id => map.get(id));
}
