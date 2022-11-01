/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import snackbar from 'helpers/snackbar/snackbar';
import { isStorageSupported } from '../../common/client/storage-polyfill';
import { encodeSIP } from '../../common/helpers/strings';
import { initDevice } from './audioDevice';
import { handlePlivoLoginFailure, handlePlivoLoginSuccess } from '../redux/modules/telephony';
import { telephonyDisconnectedReasons } from '../../common/enums/enums';
import { pathExists } from '../../common/helpers/paths';

const isLocalStorageSupported = isStorageSupported('localStorage');

const { client: plivo } =
  (isLocalStorageSupported &&
    window.Plivo &&
    new window.Plivo({
      debug: 'ALL',
      permOnClick: true,
      audioConstraints: {
        optional: [{ googAutoGainControl: false }, { googEchoCancellation: false }],
      },
      enableTracking: false,
    })) ||
  {};

let onLogoutHandler;
let onWebrtcNotSupportedHandler;
let device;
let deviceIsConnected = false;
let onMicrophoneMutedHandler;

export const reject = () => plivo.reject();
export const answer = () => plivo.answer();
export const hangup = () => plivo.hangup();
export const mute = () => {
  plivo.mute();
  device && device.mute();
};
export const unmute = () => {
  plivo.unmute();
  device && device.unmute();
};
export const sendDigit = digit => plivo.sendDtmf(digit);
export const providerLogout = () => {
  if (!plivo) {
    console.error('no telephony provider object');
    return;
  }

  console.log('Logging out from communication provider');
  plivo.on('onLogout', () => console.info('Logged out from communication provider'));
  onLogoutHandler && onLogoutHandler();
  if (plivo.getCallUUID()) plivo.reject();
  if (plivo.isLoggedIn) plivo.logout();
};

export const call = ({ numberToCall, personId, partyId, phoneOverride }) => {
  console.log('Calling:', { numberToCall, phoneOverride });
  const phoneToCall = phoneOverride || numberToCall;

  const extraHeaders = {
    'X-PH-PersonId': encodeSIP(personId),
    'X-PH-PartyId': encodeSIP(partyId),
  };
  console.log('Extra headers for outgoing call:', extraHeaders);

  plivo.call(phoneToCall, extraHeaders);
};

const muteFromDevice = async () => {
  plivo.mute();
  onMicrophoneMutedHandler && onMicrophoneMutedHandler();
};
const unmuteFromDevice = async () => {
  plivo.unmute();
  onMicrophoneMutedHandler && onMicrophoneMutedHandler();
};

const registerAudioDevice = async () => {
  const { device: audioDevice, deviceId, handledDevice } = await initDevice(plivo, {
    reject,
    answer,
    hangup,
    mute: muteFromDevice,
    unmute: unmuteFromDevice,
  });

  console.info('Audio Device - DeviceId: ', deviceId);

  deviceId && plivo.audio.microphoneDevices.set(deviceId);
  deviceId && plivo.audio.speakerDevices.set(deviceId);
  deviceId && plivo.audio.ringtoneDevices.set(deviceId);
  audioDevice &&
    !handledDevice &&
    deviceIsConnected &&
    snackbar.show({
      text: t('HEADSET_DISCONNECTED'),
    });
  audioDevice &&
    handledDevice &&
    snackbar.show({
      text: t('HEADSET_CONNECTED'),
    });

  deviceIsConnected = audioDevice && handledDevice;
  return audioDevice;
};

export const setProviderHandlers = async handlers => {
  if (!plivo) {
    console.error('no telephony provider object');
    return;
  }

  device = await registerAudioDevice();

  const {
    onStatusUpdate,
    onCallAnswered,
    onMicrophoneMuted,
    onCallFailed,
    onIncomingCall,
    onIncomingCallCanceled,
    onCallTerminated,
    onLogout,
    onWebrtcNotSupported,
  } = handlers;

  onLogoutHandler = onLogout;
  onWebrtcNotSupportedHandler = onWebrtcNotSupported;
  onMicrophoneMutedHandler = onMicrophoneMuted;

  plivo.on('onCalling', () => {
    onStatusUpdate('CONNECTING');
    deviceIsConnected && device.offHook();
  });
  plivo.on('onCallRemoteRinging', () => onStatusUpdate('RINGING'));
  plivo.on('onCallTerminated', () => {
    onCallTerminated();
    deviceIsConnected && device.onHook();
  });

  plivo.on('onIncomingCallCanceled', () => {
    onIncomingCallCanceled();
    deviceIsConnected && device.onHook();
  });
  plivo.on('onCallFailed', () => {
    onCallFailed();
    deviceIsConnected && device.onHook();
  });
  plivo.on('onCallAnswered', () => {
    onCallAnswered();
    deviceIsConnected && device.offHook();
  });

  plivo.on('onIncomingCall', (accountName, extraHeaders) => {
    console.info('Incoming call:', accountName, extraHeaders);

    const commId = decodeURIComponent(extraHeaders['X-Ph-Commid']);
    onIncomingCall(commId);
    deviceIsConnected && device.ring();
  });

  plivo.on('audioDeviceChange', async e => {
    if (e.device?.kind === 'audioinput') {
      device = await registerAudioDevice();
    }
  });
};

const handleWebrtcNotSupported = () => {
  console.error("The browser doesn't support WebRTC");
  onWebrtcNotSupportedHandler && onWebrtcNotSupportedHandler();
};

let loginTriggered = false;
const updateDelayedLoginFlag = () => setTimeout(() => (loginTriggered = false), 1000);

const handlePlivoLogginErrorStatus = (store, user, reason) => {
  if (!user.phoneSupportEnabled) return;

  store.dispatch(handlePlivoLoginFailure(reason));
};

const plivoPaths = { HOME: '/', PARTY_PAGE_UNIFIED: 'party(/:partyId)', PERSON_DETAILS: 'leads/:personId', NOT_FOUND: '*' };

export const initProvider = async (user, store) => {
  const isPlivoPath = await pathExists(window.location.pathname, plivoPaths);
  if (!isPlivoPath) return;

  if (!navigator.onLine) {
    plivo.logout();
    handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.NO_INTERNET_CONNECTION);
    return;
  }

  if (!user) {
    handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.OTHER);
    console.log('missing user information for initialising telephony provider');
    return;
  }

  const sipEndpoint = (user.sipEndpoints || []).find(e => e.isUsedInApp);

  if (!plivo) {
    handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.OTHER);
    console.error('no telephony provider object');
    return;
  }

  if (!window.RTCPeerConnection) {
    handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.OTHER);
    handleWebrtcNotSupported();
    return;
  }

  plivo.on('onWebrtcNotSupported', handleWebrtcNotSupported);

  let microphoneAccessNotGranted = false;

  await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(stream => {
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone access granted');
    })
    .catch(err => {
      microphoneAccessNotGranted = true;
      console.warn('Microphone access not granted', err);
      handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.USER_REFUSED_MIC_ACCESS);
      return;
    });

  if (microphoneAccessNotGranted) return;

  if (sipEndpoint) {
    const { username, password } = sipEndpoint;

    plivo.logout();
    plivo.login(username, password);

    plivo.on('onLogin', () => {
      if (loginTriggered) return;
      loginTriggered = true;

      store.dispatch(handlePlivoLoginSuccess());
      console.log('Logged in to Plivo');
      updateDelayedLoginFlag();
    });
    plivo.on('onLoginFailed', args => {
      handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.OTHER);
      console.error('Login to Plivo failed:', args);
    });
  } else {
    handlePlivoLogginErrorStatus(store, user, telephonyDisconnectedReasons.OTHER);
    console.info('No SIP endpoint credentials, can’t initialise telephony provider');
  }

  plivo.on('onMediaPermission', granted =>
    granted ? console.info('Media permission granted') : console.info('Media permission not granted, cannot make or receive calls'),
  );

  plivo.setConnectTone(false);
};
