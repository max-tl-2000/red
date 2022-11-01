/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const DEFAULT_UNAVAILABLE_MESSAGE = `Hi. Thank you for your interest in joining our community.
   All of our representatives are currently unavailable.
   Please leave your name, number and a detailed message.
   We will return your call as soon as possible.`;

export const DIAL_SOUND_URL = 'https://s3.amazonaws.com/plivosdk/audio/us-ring.mp3';

export const speakParams = { language: 'en-US', voice: 'WOMAN' };

export const RECORDING_NOTICE = 'This phone call may be recorded for security and training purposes';

export const OUTGOING_TO_UNKNOWN_NO =
  'Make calls from Reva by clicking the phone icon on the party you want to call. ' +
  'You can select this phone from the dialog. This line cannot be used directly from your handset.';

export const INCOMING_TO_UNKNOWN_NO =
  'We are sorry. You have reached a number that has been disconnected or is no longer in service. ' +
  'If you feel that you have reached this recording on error, please check the number and try your call again.';
