/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'superagent';
import logger from '../../../common/helpers/logger';
import { toMoment } from '../../../common/helpers/moment-utils';
import config from '../config';

const formatDateAsGMT = date => `${toMoment(date).format('MM/DD/YYYY HH:mm:ss')} GMT`;

const renderAppointments = (appointments = []) =>
  appointments.map(appointment => ({
    createdAt: formatDateAsGMT(appointment.created_at),
    dueDate: formatDateAsGMT(appointment.metadata.startDate),
    __metadata: {
      '#type': 'Appointment',
    },
  }));

const buildCorticonRequest = ({ partyId, initialContactDate, createdAt, appointments }) => ({
  Objects: [
    {
      partyId,
      initialContactDate: formatDateAsGMT(initialContactDate),
      createdAt: formatDateAsGMT(createdAt),
      appointments: renderAppointments(appointments),
      __metadata: {
        '#type': 'Party',
      },
    },
  ],
  __metadataRoot: {
    '#restrictInfoRuleMessages': 'false',
    '#restrictViolationRuleMessages': 'false',
    '#restrictWarningRuleMessages': 'false',
  },
});

const verifyPartyScoreRules = async body => {
  const reqBody = buildCorticonRequest(body);
  logger.trace({ body: JSON.stringify(reqBody) }, 'Corticon request');
  const { corticonServerUrl } = config;
  const serviceUrl = `${corticonServerUrl}/corticon/execute`;
  const res = await request.post(serviceUrl).set('Accept', 'application/json').set('Content-Type', 'application/json').set('dsName', 'Scoring').send(reqBody);
  const response = JSON.parse(res.text);

  logger.trace({ res: JSON.stringify(response, null, 2) }, 'Corticon response');
  return response.Objects[0].score;
};

export const computePartyScore = async (partyId, partyStartDate, appointments, initialContact) => {
  const body = {
    partyId,
    initialContactDate: toMoment(initialContact),
    createdAt: toMoment(partyStartDate),
    appointments,
  };
  const newScore = await verifyPartyScoreRules(body);
  return newScore;
};
