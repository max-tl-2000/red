/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx, createACommonSource } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importSources } from '../inventory/sources';
import { getSources, deleteMasterSourcesByNames } from '../../dal/sourcesRepo';
import { getOneWhere } from '../../database/factory';

describe('import/sources', () => {
  beforeEach(async () => (await createACommonSource('source1', 'type1')) && (await createACommonSource('source2', 'type2')));
  afterEach(async () => await deleteMasterSourcesByNames(['source1', 'source2']));

  describe('when importing a new source', () => {
    it('will save the source', async () => {
      const firstSource = {
        name: 'source1',
        displayName: 'sourceDN1',
        description: 'Source description',
        type: 'type1',
      };

      const secondSource = {
        name: 'source2',
        displayName: 'sourceDN2',
        description: 'Source description',
        type: 'type2',
      };

      const sourcesRows = [
        {
          data: firstSource,
          index: 1,
        },
        {
          data: secondSource,
          index: 2,
        },
      ];

      await importSources(ctx, sourcesRows);

      const sources = await getSources(ctx);
      expect(sources.length).to.equal(2);

      const dbFirstSource = await getOneWhere(ctx.tenantId, 'Sources', { name: firstSource.name.toLowerCase() });
      expect(dbFirstSource.name).to.equal(firstSource.name.toLowerCase());
      expect(dbFirstSource.displayName).to.equal(firstSource.displayName);
      expect(dbFirstSource.description).to.equal(firstSource.description);
      expect(dbFirstSource.type).to.equal(firstSource.type);
    });
  });

  describe('when importing a source with an invalid name or type - that do not match a master source', () => {
    it('will not save the source', async () => {
      const firstSource = {
        name: 'invalid-source1',
        displayName: 'sourceDN1',
        description: 'Source description',
        type: 'type1',
      };

      const secondSource = {
        name: 'source2',
        displayName: 'sourceDN2',
        description: 'Source description',
        type: 'invalid-type2',
      };

      const sourcesRows = [
        {
          data: firstSource,
          index: 1,
        },
        {
          data: secondSource,
          index: 2,
        },
      ];

      await importSources(ctx, sourcesRows);

      const sources = await getSources(ctx);
      expect(sources.length).to.equal(0);
    });
  });

  describe('when importing a valid, already imported source', () => {
    it('will update the existing one if the changes are in description or displayName ', async () => {
      const sourceRow = [
        {
          data: {
            name: 'source1',
            displayName: 'sourceDN1',
            description: 'Source description',
            type: 'type1',
          },
          index: 1,
        },
      ];
      await importSources(ctx, sourceRow);

      const updatedSourceRow = [
        {
          data: {
            name: 'source1',
            displayName: 'Updated sourceDN1',
            description: 'Source description updated',
            type: 'type1',
          },
          index: 1,
        },
      ];

      await importSources(ctx, updatedSourceRow);

      const sources = await getSources(ctx);
      expect(sources.length).to.equal(1);
      expect(sources[0].displayName).to.equal('Updated sourceDN1');
      expect(sources[0].description).to.equal('Source description updated');
    });
  });
});
