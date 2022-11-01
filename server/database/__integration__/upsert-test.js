/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';

import { knex, runInTransaction, insertInto, insertOrUpdate, upsert, bulkUpsert } from '../factory';
import { testCtx as ctx, createAnAddress } from '../../testUtils/repoHelper';
import * as random from '../../testUtils/random';
import '../../testUtils/setupTestGlobalContext';
import logger from '../../../common/helpers/logger';

describe('factory/upsert', () => {
  const count = async tablename => +(await knex.withSchema(ctx.tenantId).from(tablename).count('*'))[0].count;

  const upsertInTransaction = (...args) => runInTransaction(async t => await upsert(...args, t));

  // TODO: create tables instead of using the existing ones
  const fixtures = [
    {
      description: '"upsert" in tables with one unique constraint',
      tablename: 'PropertyGroup',
      getRow: async () => ({
        id: getUUID(),
        name: random.name(),
        displayName: random.name(),
        description: '',
      }),
    },
    {
      description: '"upsert" in tables with composite unique constraint',
      tablename: 'BusinessEntity',
      getRow: async () => {
        const address = await createAnAddress({});
        return {
          id: getUUID(),
          name: random.name(),
          type: random.name(),
          addressId: address.id,
          description: '',
        };
      },
    },
    {
      description: '"upsert" in tables with multiple unique constraints',
      tablename: 'Property',
      getRow: async () => {
        const address = await createAnAddress({});
        const entity = await insertInto(ctx.tenantId, 'BusinessEntity', {
          name: random.name(),
          type: random.name(),
          addressId: address.id,
          description: '',
        });
        return {
          id: getUUID(),
          name: random.name(),
          displayName: random.name(),
          propertyLegalName: random.name(),
          addressId: address.id,
          description: '',
          owner: entity.id,
        };
      },
    },
  ];

  fixtures.forEach(fixture => {
    const { tablename, getRow } = fixture;

    describe(fixture.description, () => {
      it('should behave as a simple insert', async () => {
        const row = await getRow();
        const result = await upsertInTransaction(ctx.tenantId, tablename, row);
        expect(result).not.to.be.null;
        expect(result.rows.length).to.equal(1);
      });

      it('should update the existing record', async () => {
        const row = await getRow();
        await upsertInTransaction(ctx.tenantId, tablename, row);
        const expectedDescription = random.string(100);
        const result = await upsertInTransaction(ctx.tenantId, tablename, {
          ...row,
          description: expectedDescription,
        });
        expect(result).not.to.be.null;
        expect(result.rows.length).to.equal(1);
        expect(result.rows[0].description).to.equal(expectedDescription);
      });

      it('should handle strings containing single quotes w/ no problem', async () => {
        const basicRow = await getRow();
        const row = {
          ...basicRow,
          description: "They're not people, they're hippies!", // eslint-disable-line
        };
        const result = await upsertInTransaction(ctx.tenantId, tablename, row);
        expect(result).not.to.be.null;
        expect(result.rows.length).to.equal(1);
        expect(result.rows[0].description).to.equal(row.description);
      });

      it('should handle strings containing wheres w/ no problem', async () => {
        const basicRow = await getRow();
        const row = {
          ...basicRow,
          description: 'The description containing where string',
        };
        const result = await upsertInTransaction(ctx.tenantId, tablename, row);
        expect(result).not.to.be.null;
        expect(result.rows.length).to.equal(1);
        expect(result.rows[0].description).to.equal(row.description);
      });

      it('should rollback correctly', async () => {
        const row = await getRow();

        // insert runs in its own transaction
        await insertInto(ctx.tenantId, tablename, row);
        expect(await count(tablename)).to.equal(1);

        try {
          await runInTransaction(async transaction => {
            const result = await upsert(
              ctx.tenantId,
              tablename,
              {
                ...row,
                description: random.string(20),
              },
              transaction,
            );

            expect(result.rows.length).to.equal(1);
            expect(result.rows[0].description).not.equal(row.description);
            throw new Error('NOLOG: This is an expected test error to force a rollback');
          });
        } catch (e) {
          logger.trace(`Caught expected error: ${e.message}`);
        }

        const record = await knex.withSchema(ctx.tenantId).from(tablename).select('*').where({ id: row.id }).first();

        expect(record.description).to.equal('');

        expect(record.updated_at.getTime()).to.equal(record.created_at.getTime());
      });
    });
  });

  describe('upsert with multiple rows', () => {
    const tablename = 'PropertyGroup';
    const getRow = () => ({
      id: getUUID(),
      name: random.name(),
      displayName: random.name(),
      description: '',
    });
    it('should behave as a simple insert', async () => {
      const data = [getRow(), getRow()];
      const result = await bulkUpsert(ctx, tablename, data);
      expect(result).not.to.be.null;
      expect(result.rows.length).to.equal(2);
    });
  });

  describe('"insertInto" with updateOnConflict option', () => {
    const { tablename, getRow } = fixtures[0];

    context('updateOnConflict = false (default)', () => {
      it('should behave as a simple insert and fail on unique constraint condition', async () => {
        const row = await getRow();
        await insertInto(ctx.tenantId, tablename, row);
        expect(await count(tablename)).to.equal(1);

        try {
          await insertInto(ctx.tenantId, tablename, row);
          throw new Error('THIS IS NOT THE ERROR');
        } catch (e) {
          expect(e.message).to.match(/unique constraint/);
        }
      });
    });

    context('updateOnConflict = true', () => {
      it('should update on unique constraint failure and change updated_at', async () => {
        const row = await getRow();
        const inserted = await insertOrUpdate(ctx.tenantId, tablename, row);
        expect(await count(tablename)).to.equal(1);

        const updatedRow = { ...row, description: 'updated description' };
        const updated = await insertOrUpdate(ctx.tenantId, tablename, updatedRow);
        expect(await count(tablename)).to.equal(1);

        expect(inserted.created_at.getTime()).to.equal(updated.created_at.getTime());

        expect(updated.updated_at.getTime()).to.be.above(inserted.updated_at.getTime());
      });
    });
  });
});
