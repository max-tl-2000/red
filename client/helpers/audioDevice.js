/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loadScript } from '../../common/client/load-script';
import { window } from '../../common/helpers/globals';

const jabraOffHook = async _event => {
  window.jabra.offHook();
};

const jabraOnHook = async _event => {
  window.jabra.onHook();
};

const jabraMute = async _event => {
  window.jabra.mute();
};

const jabraUnmute = async _event => {
  window.jabra.unmute();
};

const isHandledDevice = device => device.label.toLowerCase().indexOf('jabra') > -1;

const getDevice = async () => {
  await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(stream => {
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone access granted');
    })
    .catch(err => {
      console.warn('Microphone access not granted', err);
    });
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.deviceId !== 'default');
  console.info('Audio Device - Detected devices: ', devices);
  const jabraDevice = devices.find(isHandledDevice);
  console.info('Audio Device - Detected Jabra device: ', jabraDevice);
  return {
    deviceId: jabraDevice?.deviceId,
    handledDevice: !!jabraDevice?.deviceId,
  };
};

const registerEventListeners = async (jabra, handlers) => {
  jabra.addEventListener('reject', async event => {
    handlers?.reject && handlers.reject();
    await jabraOnHook(event);
  });

  jabra.addEventListener('acceptcall', async event => {
    handlers?.answer && handlers.answer();
    await jabraOffHook(event);
  });

  jabra.addEventListener('mute', async event => {
    handlers?.mute && handlers.mute();
    await jabraMute(event);
  });

  jabra.addEventListener('unmute', async event => {
    handlers?.unmute && handlers.unmute();
    await jabraUnmute(event);
  });

  jabra.addEventListener('endcall', async event => {
    handlers?.hangup && handlers.hangup();
    await jabraOnHook(event);
  });
};

export const initDevice = async (plivo, handlers) => {
  const connectedDevice = await getDevice();
  let jabra = window.jabra || null;

  if (connectedDevice.handledDevice && !jabra) {
    const jabraLib = '/libs/jabra/jabra.browser.integration-3.0.js';
    try {
      await loadScript(jabraLib, { async: true });
      jabra = window.jabra;
      await jabra.init();
      console.info('Audio Device - Library Initialized');
      await registerEventListeners(jabra, handlers);
    } catch (error) {
      jabra = null;
      window.jabra = null;
      console.warn('Audio Device - Library cannot be initialized', error);
    }
  }
  return { device: jabra, ...connectedDevice };
};
