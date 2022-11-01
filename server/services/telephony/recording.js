/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadMessageById, updateMessages } from '../../dal/communicationRepo';
import { shouldRecordCall } from '../helpers/telephonyHelpers';
import { getTelephonyConfigs } from '../../helpers/tenantContextConfigs';
import config from '../../config';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import { addVoiceMessageToResponse } from './voiceResponses';

const { telephony } = config;

export const updateCommAndNotifyAboutRecording = async (ctx, comm) => {
  await updateMessages(ctx, { id: comm.id }, { message: { isRecorded: true } });
  await notifyCommunicationUpdate(ctx, comm);
};

export const addRecordingInstructions = async (ctx, response, commId) => {
  const commEntry = await loadMessageById(ctx, commId);
  if (!(await shouldRecordCall(ctx, commEntry))) return false;

  const { callRecordingUrl } = await getTelephonyConfigs(ctx);
  response.addRecord({
    callbackUrl: addParamsToUrl(callRecordingUrl, { commId }),
    maxLength: telephony.callMaxRecordingDuration,
    startOnDialAnswer: true,
    redirect: false,
  });

  await updateCommAndNotifyAboutRecording(ctx, commEntry);

  return true;
};

export const addRecordingNotice = (ctx, response, recordingNotice) => {
  // sometimes the message is trimmed by third party telephony systems carrying the call
  // this introduces a delay to avoid this
  const delayInSeconds = 3;
  response.addWait({ length: delayInSeconds });

  addVoiceMessageToResponse(ctx, response, recordingNotice);
};
