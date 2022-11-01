/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { prepareRawQuery, admin } from '../../common/schemaConstants';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTenantByName } from '../../dal/tenantsRepo';
import { processInlineImages, saveAttachments } from '../../services/routing/incomingCommunicationProcessor';
import { BASE_64_IMAGE } from '../../../common/regex';
import { getPartyBy } from '../../dal/partyRepo';
import { knex } from '../../database/factory';
import { getTeamBy } from '../../dal/teamsRepo';
import loggerModule from '../../../common/helpers/logger';
import { stopQueueConnection } from '../../services/pubsub';
import sleep from '../../../common/helpers/sleep';

const logger = loggerModule.child({ subType: 'comms - resize inline images' });

// we get all the comms that have a size over 2MB
const getAllLargeComms = async ctx => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT id
      FROM db_namespace."Communication"
      WHERE direction = '${DALTypes.CommunicationDirection.IN}' AND type = '${DALTypes.CommunicationMessageType.EMAIL}' 
        AND pg_column_size(message) > 2000000;
      `,
      ctx.tenantId,
    ),
  );

  return (rows || []).map(comm => comm.id);
};

const getLargeComm = async (ctx, id) => {
  const { rows } = await knex.raw(
    prepareRawQuery(
      `
      SELECT id, "messageId", message, parties
      FROM db_namespace."Communication"
      WHERE id = :id;
      `,
      ctx.tenantId,
    ),
    { id },
  );

  return rows[0];
};

const updateCommMessage = async (ctx, id, message) => {
  await knex.raw(
    prepareRawQuery(
      `
      UPDATE db_namespace."Communication"
        SET message = :message
      WHERE id = :id;
          `,
      ctx.tenantId,
    ),
    { message, id },
  );
};

const resizeInlineImages = async ctx => {
  logger.trace({ ctx }, 'resizeInlineImages - start');

  const largeCommIds = await getAllLargeComms(ctx);
  let resizedComms = 0;
  logger.trace({ ctx, commNumbersToUpdate: (largeCommIds || []).length }, 'resizeInlineImages - number of communications');

  await mapSeries(largeCommIds, async commId => {
    logger.trace({ ctx, commId }, 'starting to process comm');
    const comm = await getLargeComm(ctx, commId);

    let baseHtml = comm.message.rawMessage.html;
    let existingFiles = comm.message.files || [];

    const inlineImageOccurences = (baseHtml && baseHtml.match(BASE_64_IMAGE)) || [];
    if (inlineImageOccurences.length) {
      const { newBaseHtml, newInlineAttachments } = await processInlineImages(ctx, comm.messageId, baseHtml, existingFiles);
      baseHtml = newBaseHtml;

      if (newInlineAttachments) {
        const party = await getPartyBy(ctx, { id: comm.parties[0] });
        const team = await getTeamBy(ctx, { id: party.ownerTeam });
        const moduleContext = team.module;
        const uploadedAttachments = await saveAttachments(ctx, newInlineAttachments, moduleContext);
        if (uploadedAttachments && uploadedAttachments.length) {
          existingFiles = [...existingFiles, ...uploadedAttachments];
        }
      }

      const newRawMessage = { ...comm.message.rawMessage, html: baseHtml };
      const message = { ...comm.message, files: existingFiles, inlineImageUpdated: true, rawMessage: newRawMessage };
      resizedComms++;
      logger.trace(
        {
          ctx,
          commId: comm.id,
          newUploadedAttachements: (newInlineAttachments || []).map(at => at.filename),
          oldAttachments: (comm.message.files || []).map(at => at.originalName),
          resizedCommNumber: resizedComms,
        },
        'Resize inline image and add attachment',
      );

      await updateCommMessage(ctx, comm.id, message);
    }
  });

  await sleep(5000); // adding this after local testing; without it the script exits before the message is actually added to the queue

  logger.trace({ ctx }, 'resizeInlineImages - done');
};

const getTenantContext = async () => {
  const tenantName = process.argv[2];
  const ctx = { tenantId: admin.id };
  const tenant = await getTenantByName(ctx, tenantName);

  if (!tenant) {
    logger.error('Tenant not found');
    return {};
  }
  return { tenantId: tenant.id };
};

async function main() {
  const tenantCtx = await getTenantContext();
  await resizeInlineImages(tenantCtx);
}

main()
  .then(stopQueueConnection)
  .then(process.exit)
  .catch(e => {
    logger.error('An error ocurred while resizing inline images for comms', e);
    stopQueueConnection();
    process.exit(1); // eslint-disable-line
  });
