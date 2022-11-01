/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { findNamespaces } from '../i18next-ns-helper';

describe('i18next-ns-helper', () => {
  describe('findNamespaces', () => {
    it('should find all the yml files inside a given path and use their names as namespaces', async () => {
      const ns = await findNamespaces(path.join(__dirname, './fixtures/'));

      expect(ns).toEqual(['bar', 'foo', 'zap']);
      expect(ns).not.toContain('other');
    });
  });
});
