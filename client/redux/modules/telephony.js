/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import newId from 'uuid/v4';
import { INACTIVE_CALL } from '../../helpers/comm-flyout-types';
import notifier from '../../helpers/notifier/notifier';
import { call, reject, initProvider } from '../../helpers/telephonyProvider';
import callUiStatuses from '../../helpers/enums/callUiStatuses';
import callStates from '../../helpers/enums/callStates';
import { getPreferredCallSource, getAssociatedParty } from '../../helpers/telephony';
import { DALTypes } from '../../../common/enums/DALTypes';
import { addParamsToUrl } from '../../../common/helpers/urlParams';
import { closeFlyout, updateFlyout } from './flyoutStore';
import * as dataStoreActions from './dataStore';
import { AUTH_USER_STATUS_CHANGED } from './usersStore';
import { formatPhoneNumber } from '../../helpers/strings';
import { now } from '../../../common/helpers/moment-utils';

const INIT_INCOMING_CALL = 'telephony/INIT_INCOMING_CALL';
const INCOMING_CALL_CANCELED = 'telephony/INCOMING_CALL_CANCELED ';
const STATUS_UPDATE = 'telephony/STATUS_UPDATE';
const CALL_FAILED = 'telephony/CALL_FAILED';
const CALL_ANSWERED = 'telephony/CALL_ANSWERED';
const CALL_TERMINATED = 'telephony/CALL_TERMINATED';
const MICROPHONE_MUTED = 'telephony/MICROPHONE_MUTED';
const CREATE_OUTGOING_CALL = 'telephony/CREATE_OUTGOING_CALL';
const CREATE_OUTGOING_CALL_SUCCESS = 'telephony/CREATE_OUTGOING_CALL_SUCCESS';
const CREATE_OUTGOING_CALL_FAIL = 'telephony/CREATE_OUTGOING_CALL_FAIL';
const STOP_RECORDING = 'telephony/STOP_RECORDING';
const STOP_RECORDING_SUCCES = 'telephony/STOP_RECORDING_SUCCES';
const STOP_RECORDING_FAIL = 'telephony/STOP_RECORDING_FAIL';
const CLEAR_CALL_TRANSFER_STATUS = 'telephony/CLEAR_CALL_TRANSFER_STATUS';
const LOGOUT = 'telephony/LOGOUT';
const LOAD_ACTIVE_CALL_DATA = 'telephony/LOAD_ACTIVE_CALL_DATA';
const COMMUNICATION_UPDATED = 'telephony/COMMUNICATION_UPDATED';
const OPEN_WRAPUP_COUNTER = 'telephony/OPEN_WRAPUP_COUNTER';
const CLOSE_WRAPUP_COUNTER = 'telephony/CLOSE_WRAPUP_COUNTER';
const DECREASE_WRAPUP_TIME = 'telephony/DECREASE_WRAPUP_TIME';
const SAVE_INTERVAL_FUNCTION_ID = 'telephony/SAVE_INTERVAL_FUNCTION_ID';
const LOAD_CALL_QUEUE_COUNT = 'telephony/LOAD_CALL_QUEUE_COUNT';
const HOLD_CALL = 'telephony/HOLD_CALL';
const UNHOLD_CALL = 'telephony/UNHOLD_CALL';
const PLIVO_CONNECTION_FAILED = 'telephony/PLIVO_CONNECTION_FAILED';
const PLIVO_CONNECTION_SUCCESS = 'telephony/PLIVO_CONNECTION_SUCCESS';
const SHOW_PLIVO_CONNECTION_ERROR_DIALOG = 'telephony/SHOW_PLIVO_CONNECTION_ERROR_DIALOG';
const HIDE_PLIVO_CONNECTION_ERROR_DIALOG = 'telephony/HIDE_PLIVO_CONNECTION_ERROR_DIALOG';

const initialState = {
  callState: callStates.NONE,
  contact: { fullName: '' },
  activeCallFlyoutId: newId(),
  wrapUpTime: 0,
  showWrapUpCounter: false,
  countDownFunctionId: '',
  callOnHoldSelected: false,
  isPlivoConnectionError: false,
  plivoConnectionErrorReason: '',
  showPlivoConnectionErrorDialog: false,
  activeCallDataLoaded: false,
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case INIT_INCOMING_CALL: {
      const { failReason, comm, ...rest } = state;

      return {
        ...rest,
        callState: callStates.INCOMING,
        uiStatus: callUiStatuses.INCOMING,
        contact: action.incomingCallInfo,
        commId: action.commId,
        isPhoneToPhone: false,
        partyId: action.incomingCallInfo.partyId,
      };
    }
    case LOAD_ACTIVE_CALL_DATA: {
      const { communication: comm, parties, contact } = action.data;
      const associatedParty = getAssociatedParty(parties, action.partyId);

      return {
        ...state,
        comm,
        contact,
        associatedParty,
        activeCallDataLoaded: true,
      };
    }
    case CALL_ANSWERED: {
      const { failReason, commId, ...rest } = state;

      return {
        ...rest,
        callState: callStates.ONGOING,
        uiStatus: callUiStatuses.ANSWERED,
        isPhoneToPhone: action.isPhoneToPhone,
        commId: action.commId || commId,
      };
    }
    case CALL_FAILED:
      return {
        ...state,
        callState: callStates.FAILED,
        uiStatus: callUiStatuses.FAILED,
        failReason: action.reason,
      };
    case INCOMING_CALL_CANCELED: // fyi: indicator of a missed call
      return {
        ...state,
        callState: callStates.NONE,
        uiStatus: callUiStatuses.INCOMING_CALL_CANCELED,
      };
    case CALL_TERMINATED:
      return {
        ...state,
        callState: callStates.NONE,
        uiStatus: callUiStatuses.TERMINATED,
        microphoneMuted: false,
        callOnHoldSelected: false,
        activeCallDataLoaded: false,
      };
    case STATUS_UPDATE:
      return {
        ...state,
        uiStatus: action.status,
      };
    case CREATE_OUTGOING_CALL: {
      const { failReason, comm, ...rest } = state;

      return {
        ...rest,
        callState: callStates.OUTGOING,
        uiStatus: callUiStatuses.CONNECTING,
        contact: action.to,
        isPhoneToPhone: action.isPhoneToPhone,
        commId: action.commId,
        comm: action.comm,
        partyId: action.to.partyId,
        sourceName: action.sourceName,
      };
    }
    case CREATE_OUTGOING_CALL_SUCCESS:
      return {
        ...state,
        uiStatus: callUiStatuses.CALLING,
        commId: action.commId,
      };
    case CREATE_OUTGOING_CALL_FAIL:
      return {
        ...state,
        callState: callStates.FAILED,
        uiStatus: callUiStatuses.FAILED,
        failReason: action.error.token,
      };
    case STOP_RECORDING:
      return {
        ...state,
        isRemovingRecording: true,
      };
    case STOP_RECORDING_SUCCES:
      return {
        ...state,
        commId: action.commId,
        comm: action.comm,
        isRemovingRecording: false,
      };
    case STOP_RECORDING_FAIL:
      return {
        ...state,
        stopRecordingError: action.error.token,
        isRemovingRecording: false,
      };
    case MICROPHONE_MUTED:
      return {
        ...state,
        microphoneMuted: !state.microphoneMuted,
      };
    case COMMUNICATION_UPDATED:
      return {
        ...state,
        comm: action.comm,
      };
    case LOGOUT:
      return initialState;
    case OPEN_WRAPUP_COUNTER:
      return {
        ...state,
        wrapUpTime: action.wrapUpTime,
        wrapUpEndTime: action.wrapUpEndTime,
        showWrapUpCounter: true,
      };
    case DECREASE_WRAPUP_TIME: {
      return {
        ...state,
        wrapUpTime: action.wrapUpTime,
      };
    }
    case CLOSE_WRAPUP_COUNTER: {
      return {
        ...state,
        showWrapUpCounter: false,
        wrapUpTime: 0,
        wrapUpEndTime: now(),
      };
    }
    case SAVE_INTERVAL_FUNCTION_ID: {
      return {
        ...state,
        countDownFunctionId: action.countDownFunctionId,
      };
    }
    case LOAD_CALL_QUEUE_COUNT: {
      return {
        ...state,
        call: false,
      };
    }
    case HOLD_CALL: {
      return {
        ...state,
        callOnHoldSelected: true,
      };
    }
    case UNHOLD_CALL: {
      return {
        ...state,
        callOnHoldSelected: false,
      };
    }
    case PLIVO_CONNECTION_FAILED: {
      return {
        ...state,
        isPlivoConnectionError: true,
        plivoConnectionErrorReason: action.reason,
      };
    }
    case PLIVO_CONNECTION_SUCCESS: {
      return {
        ...state,
        isPlivoConnectionError: false,
        plivoConnectionErrorReason: '',
        showPlivoConnectionErrorDialog: false,
      };
    }
    case SHOW_PLIVO_CONNECTION_ERROR_DIALOG: {
      return {
        ...state,
        showPlivoConnectionErrorDialog: true,
      };
    }
    case HIDE_PLIVO_CONNECTION_ERROR_DIALOG: {
      return {
        ...state,
        showPlivoConnectionErrorDialog: false,
      };
    }
    default:
      return state;
  }
}

const countDown = (dispatch, getState) => {
  const countDownFunctionId = setInterval(() => {
    const { wrapUpEndTime, wrapUpTime } = getState().telephony;
    const diff = wrapUpEndTime - now();
    const newWrapUpTime = Math.ceil(diff / 1000);

    if (newWrapUpTime > 0) {
      wrapUpTime !== newWrapUpTime && dispatch({ type: DECREASE_WRAPUP_TIME, wrapUpTime: newWrapUpTime });
      return;
    }

    dispatch({ type: CLOSE_WRAPUP_COUNTER });
    clearInterval(countDownFunctionId);
  }, 100);

  dispatch({ type: SAVE_INTERVAL_FUNCTION_ID, countDownFunctionId });
};

export const startWrapUpTime = wrapUpTime => (makeRequest, dispatch, getState) => {
  const wrapUpEndTime = now().add(wrapUpTime, 'seconds');
  dispatch({ type: OPEN_WRAPUP_COUNTER, wrapUpTime, wrapUpEndTime });
  countDown(dispatch, getState);
};

export const closeWrapUpCounter = () => (makeRequest, dispatch, getState) => {
  clearInterval(getState().telephony.countDownFunctionId);
  dispatch({ type: CLOSE_WRAPUP_COUNTER });
};

export const getInactiveCallData = ({ flyoutId, threadId, partyId, personId, reqId }) => async (makeRequest, dispatch) => {
  const baseUrl = `/communications/phone/${threadId}/inactiveCallData`;
  const urlParams = {
    partyId,
    personId,
  };

  const { data, error } = await makeRequest({
    method: 'GET',
    url: addParamsToUrl(baseUrl, urlParams),
    reqId,
  });

  if (error) {
    console.error(`Failed to retrieve inactive call info for thread: ${threadId} party: ${partyId} person: ${personId}`);
    return;
  }

  const { communications, parties, person } = data;
  if (!communications.length || !person.length || !parties.length) {
    console.warn('Inactive flyout closed:', `threadId: ${threadId}`, `communications: ${communications}`, `person: ${person}`, `parties: ${parties}`);
    await dispatch(closeFlyout(flyoutId));
    return;
  }

  await dispatch(
    updateFlyout(flyoutId, {
      associatedParty: getAssociatedParty(parties, partyId),
      communications,
      person,
      threadId,
      partyId,
      personId,
    }),
  );
};

export const refreshInactiveCallFlyouts = (comms, dispatch, getState, reqId) => {
  const threads = new Set(comms.filter(c => c.type === DALTypes.CommunicationMessageType.CALL).map(c => c.threadId));

  const openFlyouts = getState().flyoutStore.openedFlyouts;
  const openFlyoutIds = Object.keys(openFlyouts);

  openFlyoutIds
    .map(id => ({ id, ...openFlyouts[id] }))
    .filter(flyout => flyout.flyoutType === INACTIVE_CALL && threads.has(flyout.flyoutProps.threadId))
    .forEach(({ flyoutProps: fp }) => {
      const { flyoutId, threadId, partyId, personId } = fp;
      return dispatch(getInactiveCallData({ flyoutId, threadId, partyId, personId, reqId }));
    });
};

const loadCommunication = async ({ commId, reqId, makeRequest, dispatch }) => {
  const { data: comm, error } = await makeRequest({
    method: 'GET',
    url: `/communications/${commId}`,
    reqId,
  });

  if (error) {
    console.error(`Failed to get comm ${commId}`);
    return;
  }
  await dispatch({ type: COMMUNICATION_UPDATED, comm });
};

export const loadExternalPhones = () => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/communications/phone/externalPhones',
  });

  const { UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL } = dataStoreActions;

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  await dispatch({ type: UPDATE_DATA_SUCCESS, result: { externalPhones: data } });
};

export const stopRecording = commId => async (makeRequest, dispatch) => {
  dispatch({ type: STOP_RECORDING });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/communications/phone/${commId}/stopRecording`,
  });

  if (error) {
    dispatch({ type: STOP_RECORDING_FAIL, error });
    return;
  }

  const { UPDATE_DATA_SUCCESS } = dataStoreActions;
  await dispatch({ type: UPDATE_DATA_SUCCESS, result: { communications: [data] } });

  await dispatch({ type: STOP_RECORDING_SUCCES, commId: data.id, comm: data });
};

export const handleOutgoingCallInitiated = ({ commId, isPhoneToPhone, to, reqId }) => async (makeRequest, dispatch) => {
  if (isPhoneToPhone) dispatch({ type: CREATE_OUTGOING_CALL, commId, to, isPhoneToPhone });
  else dispatch({ type: CREATE_OUTGOING_CALL_SUCCESS, commId });

  await loadCommunication({ commId, reqId, makeRequest, dispatch });
};

const initCallFromApp = async (to, makeRequest, dispatch, getState) => {
  dispatch({ type: CREATE_OUTGOING_CALL, to, isPhoneToPhone: false });

  const user = getState().auth.user;
  const phoneOverride = (user.tenantCommunicationOverrides || {}).customerPhone;

  const { phone, personId, partyId } = to;

  call({ numberToCall: phone, personId, partyId, phoneOverride });
};

const initCallFromPhone = async ({ from, to }, makeRequest, dispatch) => {
  const outgoingAction = {
    type: CREATE_OUTGOING_CALL,
    to,
    isPhoneToPhone: true,
    sourceName: from.sourceName,
  };
  dispatch(outgoingAction);

  const { error, data: comm } = await makeRequest({
    method: 'POST',
    url: '/communications/phone/makeCallFromPhone',
    payload: { from, to },
  });

  if (error) {
    dispatch({ type: CREATE_OUTGOING_CALL_FAIL, error });
    return;
  }

  dispatch({ ...outgoingAction, commId: comm.id, comm });
};

export const initOutgoingCall = to => async (makeRequest, dispatch, getState) => {
  const isPlivoConnectionError = getState().telephony.isPlivoConnectionError;

  if (isPlivoConnectionError) {
    dispatch({ type: SHOW_PLIVO_CONNECTION_ERROR_DIALOG });
    return;
  }

  dispatch({ type: AUTH_USER_STATUS_CHANGED, isAuthUserBusy: true });
  const userId = getState().auth.user.id;
  const user = getState().globalStore.get('users').get(userId);

  const { source, isSipUsername, sourceName } = getPreferredCallSource(user);

  if (source === 'app') {
    await initCallFromApp(to, makeRequest, dispatch, getState);
  } else {
    const phone = isSipUsername ? `sip:${source}@phone.plivo.com` : source;
    await initCallFromPhone({ to, from: { phone, sourceName } }, makeRequest, dispatch);
  }
};

export const transferCall = (commId, to, from) => async makeRequest => {
  const { error } = await makeRequest({
    method: 'POST',
    url: `/communications/phone/${commId}/transfer`,
    payload: to,
  });

  if (error && error.token === 'TRANSFER_CALL_INTERRUPTED') {
    notifier.success(t(error.token, { fromName: from.fullName || formatPhoneNumber(from.contactInfo.defaultPhone) }));
  } else if (error) notifier.error(t('TRANSFER_CALL_ERROR'));
  else notifier.success(t('TRANSFER_CALL_SUCCESS', { toName: to.fullName }));
};

export const clearCallTransferStatus = () => ({ type: CLEAR_CALL_TRANSFER_STATUS });

export const endCallSession = () => ({ type: CALL_TERMINATED });

export const initIncomingCall = commId => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/communications/phone/${commId}/incomingCallInfo`,
  });

  if (error) {
    console.error('Failed to retrieve incoming call info');
    reject();
    endCallSession();
    return;
  }

  await dispatch({ type: INIT_INCOMING_CALL, commId, incomingCallInfo: data });
};

export const updateCallStatus = status => ({ type: STATUS_UPDATE, status });

export const handleCallFailed = reason => ({ type: CALL_FAILED, reason });

export const handleCallAnswered = ({ commId, isPhoneToPhone } = {}) => async (makeRequest, dispatch) => {
  const callIsAnsweredFromApp = !commId;
  if (callIsAnsweredFromApp) {
    dispatch({ type: CALL_ANSWERED });
    return;
  }

  dispatch({ type: CALL_ANSWERED, isPhoneToPhone, commId });
};

export const handleCurrentCallTerminated = () => async (makeRequest, dispatch) => dispatch({ type: CALL_TERMINATED });

export const handleCallTerminated = ({ machineDetected }) => async (makeRequest, dispatch, getState) => {
  const isPhoneToPhone = getState().telephony.isPhoneToPhone;
  const sourceName = getState().telephony.sourceName;

  if (isPhoneToPhone) {
    if (machineDetected) notifier.error(t('CALL_FAILED_SOURCE_UNREACHABLE', { sourceName }));

    dispatch({ type: CALL_TERMINATED });
  }
};

export const handleMicrophoneMuted = () => ({ type: MICROPHONE_MUTED });

export const handleIncomingCallCanceled = () => async (makeRequest, dispatch, getState) => {
  const isPhoneToPhone = getState().telephony.isPhoneToPhone;
  if (!isPhoneToPhone) dispatch({ type: INCOMING_CALL_CANCELED });
};

export const handleLogout = () => ({ type: LOGOUT });

export const handleHoldCall = commId => async (makeRequest, dispatch) => {
  const { error } = await makeRequest({
    method: 'POST',
    url: `/communications/phone/${commId}/holdCall`,
  });

  if (error) {
    console.error('Failed to hold active call');
    return;
  }

  await dispatch({ type: HOLD_CALL });
};

export const handleUnholdCall = commId => async (makeRequest, dispatch) => {
  const { error } = await makeRequest({
    method: 'POST',
    url: `/communications/phone/${commId}/unholdCall`,
  });

  if (error) {
    console.error('Failed to unhold active call');
    return;
  }

  await dispatch({ type: UNHOLD_CALL });
};

export const updateActiveCommunication = (commIds, reqId) => async (makeRequest, dispatch, getState) => {
  const activeCommId = getState().telephony.commId;

  if (commIds.some(id => activeCommId === id)) {
    await loadCommunication({ commId: activeCommId, reqId, makeRequest, dispatch });
  }
};

export const getActiveCallData = (commId, partyId, reqId) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/communications/phone/${commId}/activeCallData`,
    reqId,
  });

  if (error) {
    console.error('Failed to retrieve active call info');
    return;
  }

  await dispatch({ type: LOAD_ACTIVE_CALL_DATA, partyId, data });
};

export const reloadCallAssociatedParty = (updatedPartyId, reqId) => async (_makeRequest, dispatch, getState) => {
  const { commId, associatedParty } = getState().telephony;
  if (commId && associatedParty && associatedParty.id === updatedPartyId) dispatch(getActiveCallData(commId, associatedParty.id, reqId));
};

const isCallInProgress = getState => {
  const callState = getState().telephony.callState;
  return [callStates.INCOMING, callStates.OUTGOING, callStates.ONGOING].includes(callState);
};

export const reinitializeProvider = user => (makeRequest, dispatch, getState) => {
  if (isCallInProgress(getState)) {
    console.info('there is a call in progress in this tab, no need to reinitialize telephony provider');
  } else {
    initProvider(user, { dispatch, state: getState() });
  }
};

export const setupWarningAtPageUnload = e => (makeRequest, dispatch, getState) => {
  const inProgress = isCallInProgress(getState);
  if (!inProgress) return undefined;

  console.log('A call is in progress - attempting to warn user before page unloads.');
  e.stopImmediatePropagation();
  // as per docs https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
  // the return value must be something truthy for the dialog to be shown, actual value is disregarded
  const result = 'call in progress';
  e.returnValue = result;
  return result;
};

export const handlePlivoLoginFailure = reason => (_makeRequest, dispatch) => dispatch({ type: PLIVO_CONNECTION_FAILED, reason });

export const handlePlivoLoginSuccess = () => (_makeRequest, dispatch, getState) => {
  const isPlivoConnectionError = getState().telephony.isPlivoConnectionError;
  isPlivoConnectionError && notifier.success(t('PHONE_SERVICE_ESTABLISHED_SUCCESSFULLY'));

  dispatch({ type: PLIVO_CONNECTION_SUCCESS });
};

export const hidePlivoConnectionDialogError = () => (_makeRequest, dispatch) => dispatch({ type: HIDE_PLIVO_CONNECTION_ERROR_DIALOG });
