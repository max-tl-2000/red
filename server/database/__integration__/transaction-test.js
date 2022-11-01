/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';

import { knex, runInTransaction, initQuery, rawStatement } from '../factory.js';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { testCtx as ctx, createAUser } from '../../testUtils/repoHelper';

describe('DAL/transaction', () => {
  const rawKnownUser = {
    id: getUUID(),
    fullName: 'Foo',
    password: '123',
    preferredName: 'Bar',
    email: 'foo@some.com',
    loginAttempts: 1,
  };

  function getUserWithEmail(email) {
    return { ...rawKnownUser, email, id: getUUID(), externalUniqueId: getUUID() };
  }

  describe('runInTransaction', () => {
    it('commits multiple valid inserts to the database', async () => {
      const methodUnderTest = async transaction => {
        await knex.withSchema(tenant.id).insert(getUserWithEmail('1')).into('Users').transacting(transaction);
        await knex.withSchema(tenant.id).insert(getUserWithEmail('2')).into('Users').transacting(transaction);
        return knex.withSchema(tenant.id).insert(getUserWithEmail('3')).into('Users').transacting(transaction);
      };

      await runInTransaction(methodUnderTest);
      const [res] = await knex.withSchema(tenant.id).from('Users').count('id');
      expect(res.count).to.equal('4');
    });

    it('rolls back any changes if error is thrown mid transaction', done => {
      const methodUnderTest = async transaction => {
        await knex.withSchema(tenant.id).insert(getUserWithEmail('1')).into('Users').transacting(transaction);
        await knex.withSchema(tenant.id).insert(getUserWithEmail('2')).into('Users').transacting(transaction);
        await knex.withSchema(tenant.id).insert(getUserWithEmail('3')).into('Users').transacting(transaction);

        throw new Error('some error');
      };

      runInTransaction(methodUnderTest).catch(() =>
        knex
          .withSchema(tenant.id)
          .from('Users')
          .count('id') // eslint-disable-line
          .then(([res]) => expect(res.count).to.equal('1'))
          .then(() => done()),
      );
    });

    it('rolls back any changes if DB constraint is violated', done => {
      const methodUnderTest = async transaction => {
        await knex.withSchema(tenant.id).insert(getUserWithEmail('1')).into('Users').transacting(transaction);
        await knex.withSchema(tenant.id).insert(getUserWithEmail('1')).into('Users').transacting(transaction);
        return knex.withSchema(tenant.id).insert(getUserWithEmail('1')).into('Users').transacting(transaction);
      };

      runInTransaction(methodUnderTest).catch(() =>
        knex
          .withSchema(tenant.id) // eslint-disable-line
          .from('Users')
          .count('id')
          .then(([res]) => expect(res.count).to.equal('1'))
          .then(() => done()),
      );
    });

    it('rolls back if function under test does not throw an exception but commit result is ROLLBACK', async () => {
      try {
        await runInTransaction(async trx => {
          try {
            await initQuery({ ...ctx, trx })
              .insert(getUserWithEmail('1'))
              .into('Users');
            await initQuery({ ...ctx, trx })
              .insert(getUserWithEmail('1'))
              .into('Users');
          } catch (e) {
            // swallowed exception
          }
        });
      } catch (e) {
        return;
      }

      expect.fail();
    });
  });

  describe('rawStatement', () => {
    beforeEach(async () => await createAUser({ name: 'John' }));
    describe('when context has a transaction', () => {
      it('should not update the user if the transaction is rolled back', async () => {
        try {
          await runInTransaction(async trx => {
            await rawStatement({ ...ctx, trx }, 'UPDATE db_namespace."Users" SET "fullName" = :name', [{ name: 'Jack' }]);
            throw new Error('error that should cause rollback');
          });
        } catch (e) {
          // nothing to do here
        }

        const {
          rows: [user],
        } = await rawStatement(ctx, 'SELECT * FROM db_namespace."Users" WHERE "fullName" = :name', [{ name: 'John' }]);
        expect(user, 'user should not be updated when the transaction is rolled back').to.be.ok;
      });

      it('should update the user if the transaction is committed', async () => {
        await runInTransaction(async trx => {
          await rawStatement({ ...ctx, trx }, 'UPDATE db_namespace."Users" SET "fullName" = :name', [{ name: 'Jack' }]);
        });

        const {
          rows: [user],
        } = await rawStatement(ctx, 'SELECT * FROM db_namespace."Users" WHERE "fullName" = :name', [{ name: 'Jack' }]);
        expect(user, 'user should be updated when the transaction is committed').to.be.ok;
      });
    });

    describe('when context does not have a transaction', () => {
      it('should update the user', async () => {
        await rawStatement(ctx, 'UPDATE db_namespace."Users" SET "fullName" = :name', [{ name: 'Jack' }]);

        const {
          rows: [user],
        } = await rawStatement(ctx, 'SELECT * FROM db_namespace."Users" WHERE "fullName" = :name', [{ name: 'Jack' }]);
        expect(user, 'user should be updated').to.be.ok;
      });
    });
  });
});
