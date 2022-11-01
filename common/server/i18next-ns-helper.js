/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { expand } from '../../resources/expand';

export const findNamespaces = async namespaceDir => {
  const patterns = [path.join(`${namespaceDir}`, '*.yml')];
  const files = await expand({ patterns });

  return files.map(file => path.basename(file, '.yml')).sort((a, b) => (a < b ? -1 : 1));
};
