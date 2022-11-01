/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { downloadDocument } from 'helpers/download-document';
import {
  UPDATE_DATA,
  UPDATE_DATA_SUCCESS,
  UPDATE_DATA_FAIL,
  SET_HOLD_SCREEENING,
  SET_HOLD_SCREEENING_SUCCESS,
  SET_HOLD_SCREEENING_FAILURE,
  LOAD_PARTY_DATA_SUCCESS,
  LOAD_PARTY_DATA_FAILED,
} from './dataStore';
import { loadData } from '../../../common/employee-selectors/selector-data';
import { loadDataForParty } from '../../../common/employee-selectors/selector-data-for-party';
import { showPartyAssignedMessage } from '../../helpers/party';
import { cannotChangePartyTypeToken } from '../../../common/helpers/party-utils';
import { buildPartyUrl } from '../../helpers/leasing-navigator';

const LOAD_PARTIES = 'reva/LOAD_PROSPECT';
const LOAD_PARTIES_SUCCESS = 'reva/LOAD_PARTIES_SUCCESS';
const LOAD_PARTIES_FAIL = 'reva/LOAD_PARTIES_FAIL';

const LOAD_PARTY_GROUP = 'reva/LOAD_PARTY_GROUP';
const LOAD_PARTY_GROUP_SUCCESS = 'reva/LOAD_PARTY_GROUP_SUCCESS';
const LOAD_PARTY_GROUP_FAIL = 'reva/LOAD_PARTY_GROUP_FAIL';

const ADD_PARTY = 'reva/ADD_PARTY';
const ADD_PARTY_SUCCESS = 'reva/ADD_PARTY_SUCCESS';
const ADD_PARTY_FAIL = 'reva/ADD_PARTY_FAIL';

const LOAD_SELECTOR_DATA = 'reva/LOAD_SELECTOR_DATA';
const LOAD_SELECTOR_DATA_FOR_PARTY = 'reva/LOAD_SELECTOR_DATA_FOR_PARTY';

const EXPORT_PARTY_SUCCESS = 'reva/EXPORT_PARTY_SUCCESS';

const UPDATE_PARTY_TYPE_ACTION = 'reva/UPDATE_PARTY_TYPE_ACTION';

const ASSIGN_PARTY_FAIL = 'reva/ASSIGN_PARTY_FAIL';
const CLEAR_ASSIGN_PARTY_ERROR = 'persons/CLEAR_ASSIGN_PARTY_ERROR';

const RERUN_SCREENING = 'reva/RERUN_SCREENING';
const RERUN_SCREENING_SUCCESS = 'reva/RERUN_SCREENING_SUCCESS';
const RERUN_SCREENING_FAILURE = 'reva/RERUN_SCREENING_FAILURE';
const FORCE_RESCREENING = 'reva/FORCE_RESCREENING';
const FORCE_RESCREENING_SUCCESS = 'reva/FORCE_RESCREENING_SUCCESS';
const FORCE_RESCREENING_FAILURE = 'reva/FORCE_RESCREENING_FAILURE';
const TRANSACTIONS_SUCCESS = 'transactions-success';
const TRANSACTIONS_FAILURE = 'transactions-failure';
const SET_PARTY_ID = 'reva/SET_PARTY_ID';
const CLEAR_PARTY_ID = 'reva/CLEAR_PARTY_ID';
const SET_CONTACT_CHANNEL = 'reva/SET_CONTACT_CHANNEL';
const SET_PARTY_WORKFLOW = 'reva/SET_PARTY_WORKFLOW';
const SET_PARTY_IS_TRANSFER_LEASE = 'reva/SET_PARTY_IS_TRANSFER_LEASE';
const UPDATE_PERSON_APPLICATION = 'reva/UPDATE_PERSON_APPLICATION';
const UPDATE_PERSON_APPLICATION_SUCCESS = 'reva/UPDATE_PERSON_APPLICATION_SUCCESS';
const UPDATE_PERSON_APPLICATION_FAIL = 'reva/UPDATE_PERSON_APPLICATION_FAIL';

const MANUAL_RENEWAL = 'reva/MANUAL_RENEWAL';
const MANUAL_RENEWAL_SUCCESS = 'reva/MANUAL_RENEWAL_SUCCESS';
const MANUAL_RENEWAL_FAIL = 'reva/MANUAL_RENEWAL_FAIL';
const GO_TO_RENEWAL_PARTY = 'reva/GO_TO_RENEWAL_PARTY';
const CLEAR_MANUAL_RENEWAL_ERROR = 'reva/CLEAR_MANUAL_RENEWAL_ERROR';
const CLEAR_PARTY_REDIRECT_URL = 'reva/CLEAR_PARTY_REDIRECT_URL';

const IMPORT_MOVEOUT_IN_PROGRESS = 'reva/IMPORT_MOVEOUT_IN_PROGRESS';
const IMPORT_MOVEOUT_ERROR = 'reva/IMPORT_MOVEOUT_ERROR';
const MOVEOUT_NO_VACATE_DATE_IN_MRI = 'reva/MOVEOUT_NO_VACATE_DATE_IN_MRI';
const CLEAR_MOVEOUT_NO_VACATE_DATE_IN_MRI = 'reva/CLEAR_MOVEOUT_NO_VACATE_DATE_IN_MRI';
const IMPORT_CANCEL_MOVEOUT_IN_PROGRESS = 'reva/IMPORT_CANCEL_MOVEOUT_IN_PROGRESS';
const IMPORT_CANCEL_MOVEOUT_ERROR = 'reva/IMPORT_CANCEL_MOVEOUT_ERROR';
const NO_CANCEL_MOVEOUT_IN_MRI = 'reva/NO_CANCEL_MOVEOUT_IN_MRI';
const CLEAR_NO_CANCEL_MOVEOUT_IN_MRI = 'reva/CLEAR_NO_CANCEL_MOVEOUT_IN_MRI';

const initialState = {
  loading: false,
  loadingPartyGroupWorkflows: false,
  partyId: null,
  selectorData: {},
  selectorDataForParty: {},
  holdingApplicationStatus: false,
  isUpdatePartyTypeAllowed: true,
  isUpdatePartyTypeNotAllowedError: false,
  updatePartyTypeNotAllowedReason: '',
  isManualHoldType: false,
  partyGroupWorkflows: [],
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_PARTY_GROUP:
      return {
        ...state,
        loadingPartyGroupWorkflows: true,
      };
    case LOAD_PARTIES:
      return {
        ...state,
        loading: true,
      };
    case LOAD_PARTIES_SUCCESS:
      return {
        ...state,
        loading: false,
      };
    case LOAD_PARTY_GROUP_SUCCESS:
      return {
        ...state,
        partyGroupWorkflows: action.result.parties,
        loadingPartyGroupWorkflows: false,
      };
    case LOAD_PARTIES_FAIL:
      return {
        ...state,
        loadingPartyGroupWorkflows: false,
      };
    case LOAD_PARTY_GROUP_FAIL:
    case ADD_PARTY_FAIL:
      return {
        ...state,
        prospectError: action.error.token,
        loading: false,
      };
    case LOAD_SELECTOR_DATA:
      return {
        ...state,
        selectorData: action.result.selectorData,
      };
    case LOAD_SELECTOR_DATA_FOR_PARTY:
      return {
        ...state,
        selectorDataForParty: action.result,
      };
    case ASSIGN_PARTY_FAIL:
      return {
        ...state,
        assignPartyError: action.error,
        loading: false,
      };
    case CLEAR_ASSIGN_PARTY_ERROR:
      return {
        ...state,
        assignPartyError: '',
      };
    case RERUN_SCREENING:
      return {
        ...state,
        rerunningScreening: true,
      };
    case RERUN_SCREENING_SUCCESS:
    case RERUN_SCREENING_FAILURE:
      return {
        ...state,
        rerunningScreening: false,
      };
    case FORCE_RESCREENING:
      return {
        ...state,
        refreshingScreening: true,
      };
    case FORCE_RESCREENING_SUCCESS:
    case FORCE_RESCREENING_FAILURE:
      return {
        ...state,
        refreshingScreening: false,
      };
    case TRANSACTIONS_SUCCESS:
      return {
        ...state,
        transactions: action.transactions,
      };
    case TRANSACTIONS_FAILURE:
      return {
        ...state,
        transactions: [],
      };
    case SET_PARTY_ID:
      return {
        ...state,
        partyId: action.partyId,
      };
    case CLEAR_PARTY_ID:
      return {
        ...state,
        partyId: null,
      };
    case SET_CONTACT_CHANNEL: {
      return {
        ...state,
        contactChannel: action.contactChannel,
      };
    }
    case SET_PARTY_WORKFLOW: {
      return {
        ...state,
        partyWorkflow: action.partyWorkflow,
      };
    }
    case SET_PARTY_IS_TRANSFER_LEASE: {
      return {
        ...state,
        isTransferLease: action.isTransferLease,
      };
    }
    case UPDATE_PARTY_TYPE_ACTION: {
      const { token, reason = '' } = action.error || {};
      const isUpdatePartyTypeNotAllowedError = token === cannotChangePartyTypeToken || false;
      const isUpdatePartyTypeAllowed = {}.hasOwnProperty.call(action, 'allowAction') ? action.allowAction : state.isUpdatePartyTypeAllowed;
      return {
        ...state,
        isUpdatePartyTypeAllowed: isUpdatePartyTypeNotAllowedError ? false : isUpdatePartyTypeAllowed,
        isUpdatePartyTypeNotAllowedError,
        updatePartyTypeNotAllowedReason: (isUpdatePartyTypeNotAllowedError && reason) || '',
      };
    }
    case UPDATE_PERSON_APPLICATION:
    case UPDATE_PERSON_APPLICATION_SUCCESS:
    case UPDATE_PERSON_APPLICATION_FAIL:
      return {
        ...state,
      };
    case MANUAL_RENEWAL:
      return {
        ...state,
        renewalInProgress: true,
        renewalTransition: false,
      };
    case MANUAL_RENEWAL_SUCCESS: {
      const redirectToPartyUrl = buildPartyUrl(action.partyId);
      return {
        ...state,
        renewalInProgress: false,
        renewalTransition: true,
        redirectToPartyUrl,
      };
    }
    case MANUAL_RENEWAL_FAIL:
      return {
        ...state,
        renewalInProgress: false,
        renewalTransition: false,
        renewalError: action.error,
      };
    case GO_TO_RENEWAL_PARTY: {
      return {
        ...state,
        renewalTransition: action.renewalTransition,
      };
    }
    case CLEAR_MANUAL_RENEWAL_ERROR:
      return {
        ...state,
        renewalError: null,
      };
    case CLEAR_PARTY_REDIRECT_URL:
      return {
        ...state,
        redirectToPartyUrl: null,
      };
    case IMPORT_MOVEOUT_IN_PROGRESS:
      return {
        ...state,
        importMoveoutInProgress: true,
      };
    case IMPORT_MOVEOUT_ERROR:
      return {
        ...state,
        importMoveoutInProgress: false,
      };
    case MOVEOUT_NO_VACATE_DATE_IN_MRI:
      return {
        ...state,
        importMoveoutInProgress: false,
        noVacateDateInMRI: true,
      };
    case CLEAR_MOVEOUT_NO_VACATE_DATE_IN_MRI:
      return {
        ...state,
        noVacateDateInMRI: false,
      };
    case IMPORT_CANCEL_MOVEOUT_IN_PROGRESS:
      return {
        ...state,
        importCancelMoveoutInProgress: true,
      };
    case IMPORT_CANCEL_MOVEOUT_ERROR:
      return {
        ...state,
        importCancelMoveoutInProgress: false,
      };
    case NO_CANCEL_MOVEOUT_IN_MRI:
      return {
        ...state,
        importCancelMoveoutInProgress: false,
        noCancelMoveoutInMRI: true,
      };
    case CLEAR_NO_CANCEL_MOVEOUT_IN_MRI:
      return {
        ...state,
        noCancelMoveoutInMRI: false,
      };
    case LOAD_PARTY_DATA_SUCCESS:
    case LOAD_PARTY_DATA_FAILED:
      return {
        ...state,
        importMoveoutInProgress: false,
        noVacateDateInMRI: false,
        importCancelMoveoutInProgress: false,
        noCancelMoveoutInMRI: false,
      };
    default:
    // Do nothing
  }
  return state;
}

const separateMemberAndPersonData = members =>
  members.reduce(
    (acc, member) => {
      const { fullName, preferredName, contactInfo, ...rest } = member;
      acc.members.push(rest);
      acc.persons.push({
        id: rest.personId,
        fullName,
        preferredName,
        contactInfo,
      });
      return acc;
    },
    { members: [], persons: [] },
  );

export const loadParty = partyId => {
  const formatter = party => {
    const { members, persons } = separateMemberAndPersonData(party.partyMembers);
    return {
      parties: [party],
      members,
      persons,
    };
  };
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.get(`/parties/${partyId}`),
  };
};

export const loadPartiesByPartyGroupId = partyGroupId => async (makeRequest, dispatch) => {
  const formatter = parties => ({ parties });
  dispatch({ type: LOAD_PARTY_GROUP });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/partyGroups/${partyGroupId}`,
  });

  if (error) {
    dispatch({ type: LOAD_PARTY_GROUP_FAIL, error });
  }

  dispatch({ type: LOAD_PARTY_GROUP_SUCCESS, result: formatter(data) });
};

export const addParty = data => {
  const formatter = party => ({ parties: [party] });
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    uiActions: [ADD_PARTY, ADD_PARTY_SUCCESS, ADD_PARTY_FAIL],
    promise: client => client.post('/parties', { data }),
  };
};

export const enableUpdatePartyTypeAction = (allowAction = true, partyTypeDisabledReason = '') => ({
  type: UPDATE_PARTY_TYPE_ACTION,
  allowAction,
  ...((!allowAction && partyTypeDisabledReason && { error: { token: cannotChangePartyTypeToken, reason: partyTypeDisabledReason } }) || {}),
});

export const updateParty = ({ id, ...delta }) => async (makeRequest, dispatch) => {
  const formatter = party => ({ parties: [party] });
  dispatch({ type: UPDATE_DATA });
  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/parties/${id}`,
    payload: { ...delta },
  });

  dispatch({ type: UPDATE_PARTY_TYPE_ACTION, error });
  if (error) {
    error.__handled = error.token === cannotChangePartyTypeToken;
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return false;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: formatter(data) });
  return true;
};

export const activatePaymentPlan = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/parties/${partyId}`,
    payload: {
      metadata: { activatePaymentPlan: true },
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: { parties: [data] } });
};

export const assignParty = (partyId, assignTo, isCurrentUser, name, checkConflictingAppointments, reassignReason) => async (makeRequest, dispatch) => {
  const formatter = party => ({ parties: [party] });
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/assign`,
    payload: {
      to: assignTo,
      checkConflictingAppointments,
      reassignReason,
    },
  });

  if (error) {
    error.__handled = true; // avoid the generic error snackbar message
    dispatch({ type: ASSIGN_PARTY_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: formatter(data) });
  showPartyAssignedMessage(isCurrentUser, assignTo, name);
};

export const closeParty = (partyId, reasonId) => {
  const formatter = party => ({ parties: [party] });
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client =>
      client.post(`/parties/${partyId}/close`, {
        data: {
          closeReasonId: reasonId,
        },
      }),
  };
};

export const reopenParty = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/reopen`,
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: { parties: [data] } });
};

export const markAsSpam = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/markAsSpam`,
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: { parties: [data] } });
};

export const enablePartyCai = (partyId, caiEnabled = true) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  if (!caiEnabled) {
    const { error } = await makeRequest({
      method: 'POST',
      url: `/parties/${partyId}/restartCai`,
    });

    if (error) {
      dispatch({ type: UPDATE_DATA_FAIL, error });
      return;
    }
  }

  const { data, error } = await makeRequest({
    method: 'PATCH',
    url: `/parties/${partyId}`,
    payload: {
      metadata: { caiEnabled },
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: { parties: [data] } });
};

export const exportParty = (partyId, isAuditor = false) => (makeRequest, dispatch, getState) => {
  const {
    auth: { token },
  } = getState();
  if (!token) {
    console.error('attempt to download info from a party without a valid token');
    return;
  }
  downloadDocument(`${window.location.origin}/api/parties/${partyId}/export?token=${token}&isAuditor=${isAuditor}`);

  dispatch({ type: EXPORT_PARTY_SUCCESS });
};

export const loadSelectorData = users => ({
  type: LOAD_SELECTOR_DATA,
  result: loadData(users),
});

export const loadSelectorDataForParty = (users, loggedInUser, party) => ({
  type: LOAD_SELECTOR_DATA_FOR_PARTY,
  result: loadDataForParty(users, loggedInUser, party),
});

export const loadTasksForParty = partyId => {
  const formatter = tasks => ({ tasks });
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client => client.get(`/parties/${partyId}/tasks`),
  };
};

export const createReviewApplicationTask = (partyId, propertyId) => {
  const formatter = tasks => ({ tasks });
  return {
    types: [UPDATE_DATA, UPDATE_DATA_SUCCESS, UPDATE_DATA_FAIL],
    formatter,
    promise: client =>
      client.post(`/parties/${partyId}/tasks/requestReviewApplication`, {
        data: {
          propertyId,
        },
      }),
  };
};

export const clearAssignPartyError = () => ({ type: CLEAR_ASSIGN_PARTY_ERROR });

export const holdScreening = (partyId, holdScreeningType, isHeld) => ({
  types: [SET_HOLD_SCREEENING, SET_HOLD_SCREEENING_SUCCESS, SET_HOLD_SCREEENING_FAILURE],
  partyId,
  isHeld,
  holdScreeningType,
  promise: client =>
    client.post(`/parties/${partyId}/holdApplicationStatus`, {
      data: {
        isHeld,
        holdReason: holdScreeningType,
      },
    }),
});

export const rerunScreening = partyId => ({
  types: [RERUN_SCREENING, RERUN_SCREENING_SUCCESS, RERUN_SCREENING_FAILURE],
  promise: client => client.get(`/parties/${partyId}/rerunScreening`),
});

export const forceRescreening = (partyId, requestType) => async (makeRequest, dispatch) => {
  dispatch({ type: FORCE_RESCREENING });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/rescreen`,
    payload: {
      requestType,
    },
  });

  if (error) {
    dispatch({ type: FORCE_RESCREENING_FAILURE, error });
  }

  dispatch({ type: FORCE_RESCREENING_SUCCESS, result: data });
};

export const getTransactions = ({ partyId, skipActivePartyTest, reqId }) => async (makeRequest, dispatch, getState) => {
  const activeWindowPartyId = getState().partyStore.partyId;
  if (activeWindowPartyId === partyId || skipActivePartyTest) {
    const { data, error } = await makeRequest({
      method: 'GET',
      url: `/parties/${partyId}/transactions`,
      reqId,
    });

    if (error) {
      dispatch({ type: TRANSACTIONS_FAILURE });
    }

    dispatch({ type: TRANSACTIONS_SUCCESS, transactions: data });
  }
};

export const setPartyId = partyId => ({
  type: SET_PARTY_ID,
  partyId,
});

export const clearPartyId = () => ({ type: CLEAR_PARTY_ID });

export const setFirstContactChannel = contactChannel => ({
  type: SET_CONTACT_CHANNEL,
  contactChannel,
});

export const setPartyWorkflow = partyWorkflow => ({
  type: SET_PARTY_WORKFLOW,
  partyWorkflow,
});

export const clearPartyWorkflow = () => ({
  type: SET_PARTY_WORKFLOW,
  partyWorkflow: null,
});

export const setIsTransferLease = isTransferLease => ({
  type: SET_PARTY_IS_TRANSFER_LEASE,
  isTransferLease,
});

export const updatePersonApplication = (personApplication, reload) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_PERSON_APPLICATION });
  const url = reload ? `/personApplications/current/screeningData?reload=${reload}` : '/personApplications/current/screeningData';
  const { data, error } = await makeRequest({
    method: 'POST',
    url,
    payload: personApplication,
  });

  if (error) {
    dispatch({ type: UPDATE_PERSON_APPLICATION_FAIL, error });
  }

  dispatch({ type: UPDATE_PERSON_APPLICATION_SUCCESS, result: data });
};

export const startManualRenewal = payload => async (makeRequest, dispatch) => {
  dispatch({ type: MANUAL_RENEWAL });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: '/renewals',
    payload,
  });

  if (error) {
    error.status === 412 && (error.__handled = true);
    dispatch({ type: MANUAL_RENEWAL_FAIL, error });
    return;
  }

  dispatch({ type: MANUAL_RENEWAL_SUCCESS, partyId: data.id });
};

export const setRenewalTransition = (renewalTransition = true) => ({ type: GO_TO_RENEWAL_PARTY, renewalTransition });

export const clearManualRenewalError = () => ({ type: CLEAR_MANUAL_RENEWAL_ERROR });

export const clearPartyRedirectUrl = () => ({ type: CLEAR_PARTY_REDIRECT_URL });

export const importMovingOut = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: IMPORT_MOVEOUT_IN_PROGRESS });

  const { error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/importMovingOut`,
  });

  if (error?.status === 412) {
    error.__handled = true;
    dispatch({ type: MOVEOUT_NO_VACATE_DATE_IN_MRI, error });
    return;
  }
  if (error) {
    dispatch({ type: IMPORT_MOVEOUT_ERROR });
  }
};

export const clearNoVacateDateInMRI = () => ({ type: CLEAR_MOVEOUT_NO_VACATE_DATE_IN_MRI });

export const importCancelMoveout = partyId => async (makeRequest, dispatch) => {
  dispatch({ type: IMPORT_CANCEL_MOVEOUT_IN_PROGRESS });

  const { error } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/importCancelMoveout`,
  });

  if (error?.status === 412) {
    error.__handled = true;
    dispatch({ type: NO_CANCEL_MOVEOUT_IN_MRI, error });
    return;
  }
  if (error) {
    dispatch({ type: IMPORT_CANCEL_MOVEOUT_ERROR });
  }
};

export const copyPersonApplication = (personApplication, partyId) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });

  const { error, data } = await makeRequest({
    method: 'POST',
    url: `/parties/${partyId}/personApplications/copy`,
    payload: { personApplication },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }

  dispatch({ type: UPDATE_DATA_SUCCESS, result: { applications: [data] } });
  return;
};

export const clearNoCancelMoveoutInMRI = () => ({ type: CLEAR_NO_CANCEL_MOVEOUT_IN_MRI });

export const updateShowPastApplications = (partyId, showPastApplicationBanner) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });
  const { error, data } = await makeRequest({
    method: 'PATCH',
    url: `/parties/${partyId}`,
    payload: {
      metadata: { showPastApplicationBanner },
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }
  dispatch({ type: UPDATE_DATA_SUCCESS, result: { parties: [data] } });
  return;
};

export const updateCompany = company => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });
  const { error } = await makeRequest({
    method: 'PATCH',
    url: `/companies/${company.companyId}`,
    payload: {
      id: company.companyId,
      displayName: company.companyName,
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }
};

export const addCompany = (companyName, partyMemberId) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });
  const { error } = await makeRequest({
    method: 'POST',
    url: '/companies',
    payload: {
      companyName,
      partyMemberId,
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }
};

export const addTransferReasonActivityLogAndComm = (party, reassignReason) => async (makeRequest, dispatch) => {
  dispatch({ type: UPDATE_DATA });
  const { error } = await makeRequest({
    method: 'POST',
    url: '/parties/addTransferReasonActivityLogAndComm',
    payload: {
      party,
      reassignReason,
    },
  });

  if (error) {
    dispatch({ type: UPDATE_DATA_FAIL, error });
    return;
  }
};
