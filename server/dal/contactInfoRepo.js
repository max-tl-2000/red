/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Promise } from 'bluebird'; // eslint-disable-line red/no-lodash
import newId from 'uuid/v4';
import differenceBy from 'lodash/differenceBy';
import intersectionBy from 'lodash/intersectionBy';
import { DALTypes } from '../../common/enums/DALTypes';
import { knex, runInTransaction, initQuery, rawStatement, saveMetadata } from '../database/factory';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'dal/contactInfoRepo' });

// please make sure knex methods are always called inside functions
// or getters, if they are called directly inside the body of the imported module
// it will open a connection to the db even when is not needed yet
// as this was used inside other methods in a more complex query
// eslint-disable-next-line
export const contactInfoAggregation = () =>
  // this one is only used as query builder
  knex.raw(`
           json_agg(
             json_build_object(
               'id', "ContactInfo".id,
               'type', "ContactInfo".type,
               'value', "ContactInfo".value,
               'metadata', "ContactInfo".metadata,
               'personId', "ContactInfo"."personId",
               'isSpam', "ContactInfo"."isSpam",
               'isPrimary', "ContactInfo"."isPrimary"
             )
           ) filter (where "ContactInfo".id is not null) as "contactInfo"`);

const valueToLowerCase = infoItems =>
  infoItems.map(item => ({
    ...item,
    value: item.value && item.value.toLowerCase(),
  }));

export const saveContactInfo = async (ctx, infoItems, personId, imported = false) => {
  const rows = valueToLowerCase(infoItems).map(item => ({ ...item, id: item.id || newId() }));
  const rowsWithPersonId = rows.map(row => ({
    ...row,
    personId,
    imported,
  }));

  const wrapped = async innerCtx => await initQuery(innerCtx).insert(rowsWithPersonId).into('ContactInfo').returning('*');

  return await runInTransaction(async trx => await wrapped({ trx, ...ctx }), ctx);
};

export const unmarkAsPrimaryContactInfo = async (ctx, personId, type) => {
  const wrapped = async innerCtx => await initQuery(innerCtx).from('ContactInfo').where({ personId, type }).update({ isPrimary: false }).returning('*');

  return await runInTransaction(async trx => await wrapped({ trx, ...ctx }), ctx);
};

export const markAsPrimaryContactInfo = async (ctx, personId, type, value) => {
  const query = `
    UPDATE db_namespace."ContactInfo" contactInfo
    SET "isPrimary" = :isPrimary
    WHERE contactInfo."personId" = :personId
    AND contactInfo."type" = :type
    AND contactInfo."value" = :value
    RETURNING *;
  `;

  const { rows } = await rawStatement(ctx, query, [{ personId, type, value, isPrimary: true }]);

  return rows;
};

export const updateContactInfo = async (ctx, infoItems) => {
  logger.trace({ ctx, infoItems }, 'updateContactInfo - params');
  const wrapped = async innerCtx => {
    const nonPrimaryFirst = infoItems.sort(email => (email.isPrimary ? 1 : -1));
    for (const item of nonPrimaryFirst) {
      const { metadata, ...rest } = item;
      delete rest.isAnonymous;

      if (metadata) {
        await saveMetadata(innerCtx, 'ContactInfo', item.id, metadata);
      }

      await initQuery(innerCtx).from('ContactInfo').where({ id: item.id }).update(rest).returning('*');
    }
  };

  await runInTransaction(async trx => await wrapped({ trx, ...ctx }), ctx);
};

const deleteContactInfo = async (ctx, ids) => {
  const wrapped = async innerCtx => await initQuery(innerCtx).del().from('ContactInfo').whereIn('id', ids);
  return await runInTransaction(async trx => await wrapped({ trx, ...ctx }), ctx);
};

export const getContactInfoDiff = async (ctx, infoItems, personId) => {
  const existingItems = await initQuery(ctx).from('ContactInfo').where({ personId });

  const itemsToProcess = infoItems.map(({ isAnonymous, ...restProperties }) => restProperties);

  const itemsToSave = differenceBy(itemsToProcess, existingItems, 'id');
  const itemsToUpdate = intersectionBy(itemsToProcess, existingItems, 'id');
  const itemsToDelete = differenceBy(existingItems, itemsToProcess, 'id');

  return {
    itemsToSave,
    itemsToUpdate,
    itemsToDelete,
  };
};

export const updateContactInfoForPerson = async (ctx, contactInfoDiff, personId) => {
  const { itemsToSave, itemsToUpdate, itemsToDelete } = contactInfoDiff;

  logger.trace({ ctx, itemsToSave, itemsToUpdate, itemsToDelete }, 'updateContactInfoForPerson');

  const personContactInfoUpdate = async innerCtx => {
    if (itemsToDelete.length) {
      await deleteContactInfo(
        innerCtx,
        itemsToDelete.map(item => item.id),
      );
    }
    if (itemsToUpdate.length) await updateContactInfo(innerCtx, itemsToUpdate);
    if (itemsToSave.length) await saveContactInfo(innerCtx, itemsToSave, personId);
  };

  const res = await runInTransaction(async trx => await personContactInfoUpdate({ trx, ...ctx }), ctx);
  return res;
};

// this instance is used as a query builder
// eslint-disable-next-line
const getContactsInfo = ctx => initQuery(ctx).from('ContactInfo');

export const getContactsInfoByEmail = async (ctx, email) =>
  getContactsInfo(ctx)
    .innerJoin('Person', 'Person.id', 'ContactInfo.personId')
    .select('ContactInfo.*', 'Person.fullName')
    .distinct('ContactInfo.personId')
    .where({ type: 'email', value: email.toLowerCase().trim() });

export const getContactsInfoByPhone = (ctx, phone) => getContactsInfo(ctx).where({ type: 'phone', value: phone });

export const getContactInfoByIds = (ctx, contactInfoIds) => getContactsInfo(ctx).whereIn('id', contactInfoIds);

export const getPersonIdsForContacts = async (ctx, contactInfoIds) => {
  const res = await initQuery(ctx).from('ContactInfo').distinct('personId').select().whereIn('id', contactInfoIds);
  return res.map(p => p.personId);
};

export const getPersonIdForContactInfoValue = async (ctx, value) => {
  const row = await initQuery(ctx)
    .from('ContactInfo')
    .innerJoin('Person', 'Person.id', 'ContactInfo.personId')
    .whereNull('Person.mergedWith')
    .andWhere({ 'ContactInfo.value': value })
    .first('ContactInfo.personId');

  return row && row.personId;
};

export const getExtendedContactInfoByIds = async (ctx, contactInfoIds) =>
  await initQuery(ctx)
    .from('ContactInfo')
    .innerJoin('Person', 'Person.id', 'ContactInfo.personId')
    .select('ContactInfo.*', 'Person.fullName')
    .distinct('ContactInfo.personId')
    .whereIn('ContactInfo.id', contactInfoIds);

export const getContactInfoByPersonIdAndType = async (ctx, personId, type) =>
  await initQuery(ctx)
    .from('ContactInfo')
    .innerJoin('Person', 'Person.id', 'ContactInfo.personId')
    .select('ContactInfo.*')
    .whereIn('ContactInfo.personId', personId)
    .andWhere('ContactInfo.type', type);

export const getContactInfoIdsByPartyIdAndType = async (ctx, partyId, type) =>
  await initQuery(ctx)
    .from('ContactInfo')
    .innerJoin('Person', 'Person.id', 'ContactInfo.personId')
    .innerJoin('PartyMember', 'PartyMember.personId', 'Person.id')
    .select('ContactInfo.id')
    .where('PartyMember.partyId', partyId)
    .andWhere('PartyMember.endDate', null)
    .andWhere('ContactInfo.type', type);

export const getContactInfosByPersonId = async (ctx, personId) => {
  const query = `
  SELECT ci.* FROM db_namespace."ContactInfo" ci
    INNER JOIN db_namespace."Person" person on ci."personId" = person.id
    WHERE ci."personId" = :personId
  `;
  const { rows } = await rawStatement(ctx, query, [{ personId }]);

  return rows;
};

const updateContactInfoWithPersonId = async (ctx, contactInfoId, personId) =>
  await initQuery(ctx).from('ContactInfo').where({ id: contactInfoId }).update({ personId }).returning('*');

const unmarkContactInfoAsPrimary = async (ctx, contactInfoId) =>
  await initQuery(ctx).from('ContactInfo').where({ id: contactInfoId }).update({ isPrimary: false }).returning('*');

export const mergeContactInfos = async (ctx, basePersonId, otherPersonId) => {
  logger.trace({ ctx, basePersonId, otherPersonId }, 'mergeContactInfos - params');

  const basePersonContactInfos = (await getContactInfosByPersonId(ctx, basePersonId)).map(ci => ci.value);
  const secondPersonContactInfos = await getContactInfosByPersonId(ctx, otherPersonId);

  await Promise.each(secondPersonContactInfos, async contactInfo => {
    if (!basePersonContactInfos.includes(contactInfo.value)) {
      await unmarkContactInfoAsPrimary(ctx, contactInfo.id);
      await updateContactInfoWithPersonId(ctx, contactInfo.id, basePersonId);
    }
  });
};

export const existsEmailContactInfo = async (ctx, email, personId) => {
  let query = initQuery(ctx).from('ContactInfo').where({ type: DALTypes.ContactInfoType.EMAIL }).andWhereRaw('"value" ilike :email', { email }).count();

  query = personId ? query.andWhereRaw('"personId" <> :personId', { personId }) : query;
  const [result] = await query;
  return +result.count > 0;
};

export const enhanceContactInfos = async (ctx, contactInfoIds) => {
  const query = `
    SELECT ci.*, array_agg(p.id) AS "partyIds", pers."mergedWith" as "personMergedWith"
    FROM :schema:."ContactInfo" ci
    LEFT JOIN :schema:."PartyMember" pm ON pm."personId" = ci."personId"
    LEFT JOIN :schema:."Party" p ON p."id" = pm."partyId"
    INNER JOIN :schema:."Person" pers ON pers.id = ci."personId"
    WHERE ARRAY[ci.id::varchar(36)] <@ :ids
    GROUP BY ci.id, "personMergedWith"
    `;

  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, ids: contactInfoIds }]);

  return rows;
};

export const getAllPersonsWithSamePhone = async (ctx, personIds) => {
  const query = `
     SELECT "personId"
     FROM :schema:."ContactInfo"
     WHERE value IN (
       SELECT value
       FROM :schema:."ContactInfo"
       WHERE ARRAY["personId"::varchar(36)] <@ :person_ids
       AND type = :phone
     )`;
  // eslint-disable-next-line camelcase
  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, person_ids: personIds, phone: DALTypes.ContactInfoType.PHONE }]);
  return rows.map(r => r.personId);
};

export const getEmailAdressesOfPartyMembers = async (ctx, partyMemberIds) => {
  logger.trace({ ctx, partyMemberIds }, 'getEmailAdressesOfPartyMembers - params');

  const query = `
    SELECT ci.value
    FROM :schema:."PartyMember" pm
    INNER JOIN :schema:."Person" p ON p.id = pm."personId"
    INNER JOIN :schema:."ContactInfo" ci ON ci."personId" = p.id
    WHERE ARRAY[pm.id::varchar(36)] <@ :ids
    AND ci.type = :email
    `;

  const { rows } = await rawStatement(ctx, query, [{ schema: ctx.tenantId, ids: partyMemberIds, email: DALTypes.ContactInfoType.EMAIL }]);
  const emails = rows.map(r => r.value);

  logger.trace({ ctx, partyMemberIds, emails }, 'getEmailAdressesOfPartyMembers - result');
  return emails;
};

export const emailAddressesAlreadyExist = async (ctx, personId, emailAddresses) => {
  const query = `
    SELECT ci.value
    FROM db_namespace."ContactInfo" ci
    WHERE ci.value = ANY( :emailAddresses)
    AND ci.type = :email AND ci."personId" <> :personId
    `;

  const { rows } = await rawStatement(ctx, query, [{ emailAddresses, email: DALTypes.ContactInfoType.EMAIL, personId }]);

  return rows && rows.length > 0;
};
