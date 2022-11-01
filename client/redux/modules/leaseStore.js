/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { downloadDocument } from '../../helpers/download-document';

const SAVE_LEASE = 'reva/SAVE_LEASE';
const SAVE_LEASE_SUCCESS = 'reva/SAVE_LEASE_SUCCESS';
const SAVE_LEASE_FAIL = 'reva/SAVE_LEASE_FAIL';

const PUBLISH_LEASE = 'reva/PUBLISH_LEASE';
const PUBLISH_LEASE_REQUEST_SUCCESS = 'reva/PUBLISH_LEASE_REQUEST_SUCCESS';
const PUBLISH_LEASE_SUCCESS = 'reva/PUBLISH_LEASE_SUCCESS';
const PUBLISH_LEASE_FAIL = 'reva/PUBLISH_LEASE_FAIL';

const CLOSE_PUBLISH_LEASE_DIALOG = 'reva/CLOSE_PUBLISH_LEASE_DIALOG';

const EMAIL_LEASE = 'reva/EMAIL_LEASE';
const EMAIL_LEASE_SUCCESS = 'reva/EMAIL_LEASE_SUCCESS';
const EMAIL_LEASE_FAIL = 'reva/EMAIL_LEASE_FAIL';

const VOID_LEASE = 'reva/VOID_LEASE';
const VOID_LEASE_SUCCESS = 'reva/VOID_LEASE_SUCCESS';
const VOID_LEASE_FAIL = 'reva/VOID_LEASE_FAIL';

const FETCH_LEASE_ADDITIONAL_DATA_SUCCESS = 'reva/FETCH_LEASE_ADDITIONAL_DATA_SUCCESS';
const FETCH_LEASE_ADDITIONAL_DATA_FAIL = 'reva/FETCH_LEASE_ADDITIONAL_DATA_FAIL';
const CLEAR_LEASE_ADDITIONAL_DATA = 'reva/CLEAR_LEASE_ADDITIONAL_DATA';

const UPDATE_ENVELOPE_SIGNATURE_SUCCESS = 'reva/UPDATE_ENVELOPE_SIGNATURE_SUCCESS';
const UPDATE_ENVELOPE_SIGNATURE_FAIL = 'reva/UPDATE_ENVELOPE_SIGNATURE_FAIL';

const MARK_AS_WET_SIGNED_SUCCESS = 'reva/MARK_AS_WET_SIGNED_SUCCESS';
const MARK_AS_WET_SIGNED_FAIL = 'reva/MARK_AS_WET_SIGNED_SUCCESS';

const VOID_EXECUTED_LEASE = 'reva/VOID_EXECUTED_LEASE';
const VOID_EXECUTED_LEASE_SUCCESS = 'reva/VOID_EXECUTED_LEASE_SUCCESS';
const VOID_EXECUTED_LEASE_FAIL = 'reva/VOID_EXECUTED_LEASE_FAIL';
const CLOSE_VOID_EXECUTED_LEASE_DIALOG = 'reva/CLOSE_VOID_EXECUTED_LEASE_DIALOG';

const SYNC_LEASE_SIGNATURES = 'reva/SYNC_LEASE_SIGNATURES';
const SYNC_LEASE_SIGNATURES_SUCCESS = 'reva/SYNC_LEASE_SIGNATURES_SUCCESS';
const SYNC_LEASE_SIGNATURES_FAIL = 'reva/SYNC_LEASE_SIGNATURES_FAIL';
const CLOSE_SYNC_ERROR_DIALOG = 'reva/CLOSE_SYNC_ERROR_DIALOG';

const CLOSE_INITIATE_ESIGNATURE_REQUEST_DIALOG = 'reva/CLOSE_INITIATE_ESIGNATURE_REQUEST_DIALOG';

export const PUBLISH_STATUSES = {
  ONGOING: 'ONGOING',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

const initialState = {
  publishLeaseOpen: false,
  publishStatus: null,
  publishRequestSuccess: false,
  publishFadvSuccess: false,
  isSaving: false,
  lease: {},
  leases: [],
  error: null,
  additionalData: null,
  leaseEnvelopeData: null,
  leaseWasVoided: false,
  leaseStartDate: null,
  voidExecutedLeaseLoading: false,
  voidExecutedLeaseFailed: false,
  navigateToPartyId: '',
  isMoveInAlreadyConfirmed: false,
  leaseSyncInProgress: false,
  leaseSyncSuccess: null,
  leaseSyncError: null,
  updatedSignature: {},
};

export default (state = initialState, action = {}) => {
  switch (action.type) {
    case PUBLISH_LEASE:
      return {
        ...state,
        lease: action.lease,
        isSaving: true,
        publishLeaseOpen: true,
        publishRequestSuccess: false,
        publishFadvSuccess: false,
        publishStatus: PUBLISH_STATUSES.ONGOING,
      };
    case SAVE_LEASE:
      return {
        ...state,
        isSaving: true,
      };
    case VOID_LEASE:
      return {
        ...state,
        isSaving: true,
        leaseWasVoided: false,
      };
    case PUBLISH_LEASE_REQUEST_SUCCESS: {
      const lease = action.result;
      if (state.publishFadvSuccess) {
        return {
          ...state,
          lease,
          publishStatus: PUBLISH_STATUSES.SUCCESS,
        };
      }
      return {
        ...state,
        publishRequestSuccess: true,
        lease: action.result,
      };
    }
    case PUBLISH_LEASE_SUCCESS:
      if (state.lease && state.lease.id !== action.leaseId) {
        return state;
      }
      return {
        ...state,
        isSaving: false,
        error: null,
        publishStatus: PUBLISH_STATUSES.SUCCESS,
      };
    case SAVE_LEASE_SUCCESS:
      return {
        ...state,
        isSaving: false,
        lease: action.result,
        error: null,
      };
    case VOID_LEASE_SUCCESS:
      return {
        ...state,
        isSaving: false,
        lease: action.result,
        leaseWasVoided: true,
        error: null,
      };
    case PUBLISH_LEASE_FAIL:
      return {
        ...state,
        isSaving: false,
        lease: {},
        error: action.error.token,
        publishStatus: PUBLISH_STATUSES.FAILURE,
      };
    case SAVE_LEASE_FAIL:
      return {
        ...state,
        isSaving: false,
        lease: {},
        error: action.error.token,
      };
    case VOID_LEASE_FAIL:
      return {
        ...state,
        isSaving: false,
        lease: {},
        error: action.error.token,
        leaseWasVoided: false,
      };
    case CLOSE_PUBLISH_LEASE_DIALOG:
      return {
        ...state,
        publishLeaseOpen: false,
        publishStatus: null,
      };
    case FETCH_LEASE_ADDITIONAL_DATA_SUCCESS:
      return {
        ...state,
        additionalData: action.result,
      };
    case UPDATE_ENVELOPE_SIGNATURE_FAIL:
    case FETCH_LEASE_ADDITIONAL_DATA_FAIL:
      return {
        ...state,
        error: action.error.token || action.error.message, // on jwt token expired errors the error.token is not populated
      };
    case CLEAR_LEASE_ADDITIONAL_DATA:
      return {
        ...state,
        additionalData: null,
      };
    case UPDATE_ENVELOPE_SIGNATURE_SUCCESS:
      return {
        ...state,
        leaseEnvelopeData: action.result,
      };
    case VOID_EXECUTED_LEASE:
      return {
        ...state,
        voidExecutedLeaseLoading: true,
      };
    case VOID_EXECUTED_LEASE_SUCCESS:
      return {
        ...state,
        navigateToPartyId: action.result.navigateToPartyId,
        isMoveInAlreadyConfirmed: action.result.moveInAlreadyConfirmed || false,
        voidExecutedLeaseLoading: false,
      };
    case VOID_EXECUTED_LEASE_FAIL:
      return {
        ...state,
        voidExecutedLeaseLoading: false,
        voidExecutedLeaseFailed: true,
      };
    case CLOSE_VOID_EXECUTED_LEASE_DIALOG:
      return {
        ...state,
        voidExecutedLeaseFailed: false,
      };
    case SYNC_LEASE_SIGNATURES:
      return {
        ...state,
        leaseSyncInProgress: true,
        leaseSyncSuccess: null,
      };
    case SYNC_LEASE_SIGNATURES_SUCCESS:
      return {
        ...state,
        leaseSyncInProgress: false,
        leaseSyncSuccess: true,
        updatedSignature: action.result,
      };
    case SYNC_LEASE_SIGNATURES_FAIL:
      return {
        ...state,
        leaseSyncInProgress: false,
        leaseSyncError: action.error,
      };
    case CLOSE_SYNC_ERROR_DIALOG:
      return {
        ...state,
        leaseSyncError: null,
      };
    case CLOSE_INITIATE_ESIGNATURE_REQUEST_DIALOG:
      return {
        ...state,
        leaseSyncSuccess: null,
        updatedSignature: {},
      };
    default:
      return state;
  }
};

export const saveLease = (partyId, lease) => ({
  types: [SAVE_LEASE, SAVE_LEASE_SUCCESS, SAVE_LEASE_FAIL],
  promise: client => client.post(`/parties/${partyId}/leases`, { data: lease }),
});

export const publishLease = (partyId, leaseId, lease) => ({
  types: [PUBLISH_LEASE, PUBLISH_LEASE_REQUEST_SUCCESS, PUBLISH_LEASE_FAIL],
  promise: client =>
    client.post(`/parties/${partyId}/leases/${leaseId}/publish`, {
      data: lease,
    }),
  lease,
});

export const syncLeaseSignatures = (leaseId, partyId, clientUserId) => async (makeRequest, dispatch) => {
  dispatch({
    type: SYNC_LEASE_SIGNATURES,
  });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `leases/${leaseId}/syncLeaseSignatures`,
    payload: { partyId, clientUserId },
  });

  if (error) {
    error.__handled = true; // avoid snackbar error message
    error.leaseId = leaseId;
    error.clientUserId = clientUserId;
    dispatch({ type: SYNC_LEASE_SIGNATURES_FAIL, error });
    return;
  }

  dispatch({
    type: SYNC_LEASE_SIGNATURES_SUCCESS,
    result: data,
  });
};

export const closePublishLeaseDialog = () => ({
  type: CLOSE_PUBLISH_LEASE_DIALOG,
});

export const emailLease = (partyId, leaseId, partyMemberIds) => ({
  types: [EMAIL_LEASE, EMAIL_LEASE_SUCCESS, EMAIL_LEASE_FAIL],
  promise: client =>
    client.post(`/parties/${partyId}/leases/${leaseId}/email`, {
      data: { partyMemberIds },
    }),
});

export const voidLease = (partyId, leaseId) => ({
  types: [VOID_LEASE, VOID_LEASE_SUCCESS, VOID_LEASE_FAIL],
  promise: client => client.post(`/parties/${partyId}/leases/${leaseId}/void`, {}),
});

export const onLeasePublished = data => {
  const { leaseId, error } = data;
  return error ? { type: PUBLISH_LEASE_FAIL, error } : { type: PUBLISH_LEASE_SUCCESS, leaseId };
};

export const fetchResidentDocusignUrl = token => async makeRequest => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/leases/signature-token',
    params: { token },
  });
  if (error?.status === 412) {
    error.__handled = true;
  }

  return { data, error };
};

export const fetchEnvelopeToken = (envelopeId, clientUserId, inOfficeSignature) => async makeRequest => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/leases/${envelopeId}/token/${clientUserId}`,
    params: { inOfficeSignature },
  });
  if (error?.status === 412) {
    error.__handled = true;
  }

  return { data, error };
};

export const fetchLeaseStatus = (partyId, leaseId) => async makeRequest => {
  await makeRequest({
    method: 'GET',
    url: `/parties/${partyId}/leases/${leaseId}/status`,
  });
};

export const fetchLeaseAdditionalData = (partyId, leaseId) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/parties/${partyId}/leases/${leaseId}/additionalData`,
  });

  if (error) {
    dispatch({ type: FETCH_LEASE_ADDITIONAL_DATA_FAIL, error });
    return;
  }

  dispatch({ type: FETCH_LEASE_ADDITIONAL_DATA_SUCCESS, result: data });
};

export const clearLeaseAdditionalData = () => ({
  type: CLEAR_LEASE_ADDITIONAL_DATA,
});

export const updateEnvelopeSignature = token => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/leases/updateEnvelopeStatus',
    params: { token },
  });

  if (error) {
    error.__handled = true;
    error.__stopRedirect = true;
    dispatch({ type: UPDATE_ENVELOPE_SIGNATURE_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_ENVELOPE_SIGNATURE_SUCCESS, result: data });
};

export const markAsWetSigned = (partyId, leaseId, signature) => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/leases/${leaseId}/wetSign`,
    payload: { signature },
  });

  if (error) {
    dispatch({ type: MARK_AS_WET_SIGNED_FAIL, error });
    return;
  }

  dispatch({ type: MARK_AS_WET_SIGNED_SUCCESS, result: data });
};

export const voidExecutedLease = (partyId, leaseId, seedPartyId) => async (makeRequest, dispatch) => {
  dispatch({ type: VOID_EXECUTED_LEASE });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${seedPartyId}/leases/${leaseId}/voidExecutedLease`,
    payload: { activeLeasePartyId: partyId },
  });

  if (error) {
    dispatch({ type: VOID_EXECUTED_LEASE_FAIL, error });
    return;
  }

  dispatch({ type: VOID_EXECUTED_LEASE_SUCCESS, result: data });
};

export const closeVoidExecutedLeaseDialog = () => (_makeRequest, dispatch) => dispatch({ type: CLOSE_VOID_EXECUTED_LEASE_DIALOG });

export const closeSyncErrorDialog = () => (_makeRequest, dispatch) => dispatch({ type: CLOSE_SYNC_ERROR_DIALOG });

export const closeInitiateESignatureRequestDialog = () => (_makeRequest, dispatch) => dispatch({ type: CLOSE_INITIATE_ESIGNATURE_REQUEST_DIALOG });

export const downloadLeaseDocument = leaseId => (_makeRequest, _dispatch, getState) => {
  const {
    auth: { token },
  } = getState();
  if (!token) {
    console.error('attempt to download lease from a party without a valid token');
    return;
  }

  const downloadUrl = `${window.location.origin}/api/leases/${leaseId}/download?token=${token}`;
  downloadDocument(downloadUrl);
};
