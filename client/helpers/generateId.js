/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const counters = {};

export default function generateId(instance) {
  const name = instance.name || instance.displayName || instance.constructor.name || 'unnamed';

  const counterForName = (counters[name] = counters[name] || 0);
  counters[name]++;

  return `${name}_${counterForName}`;
}
