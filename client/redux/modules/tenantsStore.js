/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import newId from 'uuid/v4';
import notifier from '../../helpers/notifier/notifier';
import { isAdmin } from '../../../common/helpers/auth';
import { DEFAULT_WEBSITES_TOKEN_ID } from '../../../common/auth-constants';
import { formatPhoneNumber } from '../../helpers/strings';
import { formatSelectedPhoneNumbers } from '../../helpers/dropdown-phone-helper';
import { asyncIterate } from '../../../common/helpers/async-iterate';
import { deferred } from '../../../common/helpers/deferred';

const LOAD_TENANTS = 'tenants/LOAD_TENANTS';
const LOAD_TENANTS_SUCCESS = 'tenants/LOAD_TENANTS_SUCCESS';
const LOAD_TENANTS_FAIL = 'tenants/LOAD_TENANTS_FAIL';

const LOAD_TENANT = 'tenants/LOAD_TENANT';
const LOAD_TENANT_SUCCESS = 'tenants/LOAD_TENANT_SUCCESS';
const LOAD_TENANT_FAIL = 'tenants/LOAD_TENANT_FAIL';

const CREATE_TENANT = 'tenants/CREATE_TENANT';
const CREATE_TENANT_SUCCESS = 'tenants/CREATE_TENANT_SUCCESS';
const CREATE_TENANT_FAIL = 'tenants/CREATE_TENANT_FAIL';
const CREATE_TENANT_DONE = 'tenants/CREATE_TENANT_DONE';

const EDIT_TENANT_PHONE_NUMBERS = 'tenants/EDIT_TENANT_PHONE_NUMBERS';
const EDIT_TENANT_PHONE_NUMBERS_SUCCESS = 'tenants/EDIT_TENANT_PHONE_NUMBERS_SUCCESS';
const EDIT_TENANT_PHONE_NUMBERS_FAIL = 'tenants/EDIT_TENANT_PHONE_NUMBERS_FAIL';
const EDIT_TENANT_PHONE_NUMBERS_DONE = 'tenants/EDIT_TENANT_PHONE_NUMBERS_DONE';

const DELETE_TENANT = 'tenants/DELETE_TENANT';
const DELETE_TENANT_SUCCESS = 'tenants/DELETE_TENANT_SUCCESS';
const DELETE_TENANT_FAIL = 'tenants/DELETE_TENANT_FAIL';

const REFRESH_PROVIDER_DATA = 'tenats/REFRESH_PROVIDER_DATA';
const REFRESH_PROVIDER_DATA_SUCCESS = 'tenants/REFRESH_PROVIDER_DATA_SUCCESS';
const REFRESH_PROVIDER_DATA_FAIL = 'tenants/REFRESH_PROVIDER_DATA_FAIL';

const REFRESH_LEASE_TEMPLATES = 'tenats/REFRESH_LEASE_TEMPLATES';
const REFRESH_LEASE_TEMPLATES_SUCCESS = 'tenants/REFRESH_LEASE_TEMPLATES_SUCCESS';
const REFRESH_LEASE_TEMPLATES_FAIL = 'tenants/REFRESH_LEASE_TEMPLATES_FAIL';

const LOAD_PHONE_NUMBERS = 'tenants/LOAD_PHONE_NUMBERS';
const LOAD_PHONE_NUMBERS_SUCCESS = 'tenants/LOAD_PHONE_NUMBERS_SUCCESS';
const LOAD_PHONE_NUMBERS_FAIL = 'tenants/LOAD_PHONE_NUMBERS_FAIL';

const REFRESH_TENANT_SCHEMA = 'tenants/REFRESH_TENANT_SCHEMA';
const REFRESH_TENANT_SCHEMA_SUCCESS = 'tenants/REFRESH_TENANT_SCHEMA_SUCCESS';
const REFRESH_TENANT_SCHEMA_FAIL = 'tenants/REFRESH_TENANT_SCHEMA_FAIL';
const REFRESH_TENANT_SCHEMA_DONE = 'tenants/REFRESH_TENANT_SCHEMA_DONE';

const IMPORT_AND_PROCESS_WORKFLOWS = 'tenants/IMPORT_AND_PROCESS_WORKFLOWS';
const IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS = 'tenants/IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS';
const CLEAR_IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS = 'tenants/CLEAR_IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS';
const IMPORT_AND_PROCESS_WORKFLOW_FINISHED = 'tenants/IMPORT_AND_PROCESS_WORKFLOW_FINISHED';
const CLEAR_IMPORT_AND_PROCESS_WORKFLOW = 'tenants/CLEAR_IMPORT_AND_PROCESS_WORKFLOW';
const IMPORT_AND_PROCESS_WORKFLOW_FAILED = 'tenants/IMPORT_AND_PROCESS_WORKFLOW_FAILED';

const TRIGGER_COMM_PROVIDER_CLEANUP = 'tenants/TRIGGER_COMM_PROVIDER_CLEANUP';
const TRIGGER_COMM_PROVIDER_CLEANUP_SUCCESS = 'tenants/TRIGGER_COMM_PROVIDER_CLEANUP_SUCCESS';
const TRIGGER_COMM_PROVIDER_CLEANUP_FAIL = 'tenants/TRIGGER_COMM_PROVIDER_CLEANUP_FAIL';
const COMM_PROVIDER_CLEANUP_DONE = 'tenants/COMM_PROVIDER_CLEANUP_DONE';

const LOAD_TENANT_TEAMS = 'tenants/LOAD_TENANT_TEAMS';
const LOAD_TENANT_TEAMS_SUCCESS = 'tenants/LOAD_TENANT_TEAMS_SUCCESS';
const LOAD_TENANT_TEAMS_FAIL = 'tenants/LOAD_TENANT_TEAMS_FAIL';

const LOAD_TENANT_PROGRAMS = 'tenants/LOAD_TENANT_PROGRAMS';
const LOAD_TENANT_PROGRAMS_SUCCESS = 'tenants/LOAD_TENANT_PROGRAMS_SUCCESS';
const LOAD_TENANT_PROGRAMS_FAIL = 'tenants/LOAD_TENANT_PROGRAMS_FAIL';

const UPDATE_TENANT_TEAM = 'tenants/UPDATE_TENANT_TEAMS';
const UPDATE_TENANT_TEAM_SUCCESS = 'tenants/UPDATE_TENANT_TEAMS_SUCCESS';
const UPDATE_TENANT_TEAM_FAIL = 'tenants/UPDATE_TENANT_TEAMS_FAIL';

const CLEAR_TENANT_SCHEMA = 'tenants/CLEAR_TENANT_SCHEMA';
const CLEAR_TENANT_SCHEMA_SUCCESS = 'tenants/CLEAR_TENANT_SCHEMA_SUCCESS';
const CLEAR_TENANT_SCHEMA_FAIL = 'tenants/CLEAR_TENANT_SCHEMA_FAIL';
const CLEAR_TENANT_SCHEMA_DONE = 'tenants/CLEAR_TENANT_SCHEMA_DONE';

const EDIT_TENANT_METADATA = 'tenants/EDIT_TENANT_METADATA';
const EDIT_TENANT_METADATA_SUCCESS = 'tenants/EDIT_TENANT_METADATA_SUCCESS';
const EDIT_TENANT_METADATA_FAIL = 'tenants/EDIT_TENANT_METADATA_FAIL';
const EDIT_TENANT_METADATA_DONE = 'tenants/EDIT_TENANT_METADATA_DONE';

const CLOSE_IMPORTED_PARTIES = 'tenants/CLOSE_IMPORTED_PARTIES';
const CLOSE_IMPORTED_PARTIES_REQUEST_SUCCESS = 'tenants/CLOSE_IMPORTED_PARTIES_REQUEST_SUCCESS';
const CLOSE_IMPORTED_PARTIES_SUCCESS = 'tenants/CLOSE_IMPORTED_PARTIES_SUCCESS';
const CLOSE_IMPORTED_PARTIES_FAIL = 'tenants/CLOSE_IMPORTED_PARTIES_FAIL';

const GENERATE_DOMAIN_TOKEN_SUCCESS = 'tenants/GENERATE_DOMAIN_TOKEN_SUCCESS';
const GENERATE_DOMAIN_TOKEN_FAIL = 'tenants/GENERATE_DOMAIN_TOKEN_FAIL';
const GENERATE_DOMAIN_TOKEN = 'tenants/GENERATE_DOMAIN_TOKEN';

const ARCHIVE_PARTIES = 'tenants/ARCHIVE_PARTIES';
const ARCHIVE_PARTIES_FAIL = 'tenants/ARCHIVE_PARTIES_FAIL';
const ARCHIVE_PARTIES_SUCCESS = 'tenants/ARCHIVE_PARTIES_SUCCESS';
const ARCHIVE_PARTIES_FINISHED = 'tenants/ARCHIVE_PARTIES_FINISHED';

const processWfStatus = {
  FAILED: 'IMPORT_AND_PROCESS_WORKFLOW_FAILED',
  SUCCESS: 'IMPORT_AND_PROCESS_WORKFLOW_SUCCESS',
};

const archivePartiesStatus = {
  FAILED: 'ARCHIVE_PARTIES_FAILED',
  SUCCESS: 'ARCHIVE_PARTIES_SUCCESS',
};

export const getTenantComputedProps = ({ metadata, availablePhoneNumbers } = {}) => {
  const { phoneNumbers = [], enablePhoneSupport } = metadata || {};
  const tenantPhoneNumbers = phoneNumbers.map(p => p.phoneNumber);
  const otherPhoneNumbers = enablePhoneSupport ? availablePhoneNumbers : [];

  const phoneNumberItems = Array.from(new Set([...tenantPhoneNumbers, ...otherPhoneNumbers]), no => ({ id: no, text: formatPhoneNumber(no) }));
  const phoneNumberCellLabel = formatSelectedPhoneNumbers({ textElements: tenantPhoneNumbers });

  return {
    tenantPhoneNumbers,
    phoneNumberItems,
    phoneNumberCellLabel,
  };
};

const enhanceTenant = (tenant, availablePhoneNumbers) => {
  const computedProps = getTenantComputedProps({ metadata: tenant.metadata, availablePhoneNumbers });

  return {
    ...tenant,
    computedProps,
  };
};

const optimizeTenantsStructure = async (tenants = [], availablePhoneNumbers = []) => {
  const ret = [];
  const dfd = deferred();

  asyncIterate(tenants, {
    itemCb: ({ item: tenant }, cb) => {
      if (tenant.id === 'admin') {
        cb();
        return;
      }
      const enhancedTenant = enhanceTenant(tenant, availablePhoneNumbers);
      ret.push(enhancedTenant);
      cb();
    },
    done: () => {
      dfd.resolve(ret.sort((tenantA, tenantB) => (tenantA.name.toLowerCase() < tenantB.name.toLowerCase() ? -1 : 1)));
    },
    delay: 16,
  });

  return dfd;
};

const updateTenantWorkInProgress = (wip, id, tenants) => tenants.map(tn => (tn.id === id ? { ...tn, workInProgress: wip } : tn));

const initialState = {
  loaded: false,
  tenants: [],
  availablePhoneNumbers: [],
  tenantTeams: [],
  tenantProperties: [],
  tenantPhoneNumbers: [],
  programs: [],
  isLoading: false,
  clearingTenantSchema: false,
  updatingTenantMetadata: false,
  closingImportedParties: false,
  openDataMigration: false,
  accountsNotFound: [],
  isJobLoading: false,
  finished: false,
  processStatus: '',
  archiveInProgress: false,
  archiveFinished: false,
  archiveStatus: '',
  numberOfArchivedParties: 0,
};

const updateTenant = (tenantId, tenants, updatedTenant) => tenants.map(tn => (tn.id === tenantId ? updatedTenant : tn));

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD_TENANTS:
      return {
        ...state,
        isLoading: true,
        tenants: [],
      };
    case LOAD_TENANTS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        loaded: true,
        tenants: action.result.tenants,
      };
    case LOAD_TENANTS_FAIL:
      return {
        ...state,
        isLoading: false,
        error: action.error || 'LOAD_TENANTS_ERROR',
      };

    case LOAD_TENANT: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(true, action.tenantId, state.tenants),
      };
    }
    case LOAD_TENANT_SUCCESS: {
      const loadedTenant = action.result;
      return {
        ...state,
        tenants: state.tenants.map(tenant => (tenant.id === loadedTenant.id ? loadedTenant : tenant)),
      };
    }
    case LOAD_TENANT_FAIL:
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
        error: action.error.token,
      };

    case CREATE_TENANT:
      return {
        ...state,
        isCreating: true,
      };
    case CREATE_TENANT_SUCCESS: {
      let { tenants } = state;
      const indexOfTenant = tenants.findIndex(tenant => tenant.id === action.result.id);
      let shouldUpdateWorkInProgress = false;

      // if we have a tenant in the state is most likely because
      // the CREATE_TENANT_DONE was fired before this one hence
      // the state already has the tenant object with the right values
      // This happens on very rare occasions but it definitively can happen
      // so it is better to prevent it
      if (indexOfTenant === 0) {
        shouldUpdateWorkInProgress = true;
        tenants = [...tenants, enhanceTenant(action.result, state.availablePhoneNumbers)];
      }

      return {
        ...state,
        isCreating: false,
        tenants: updateTenantWorkInProgress(shouldUpdateWorkInProgress, action.result.id, tenants),
      };
    }
    case CREATE_TENANT_FAIL:
      return {
        ...state,
        isCreating: false,
        error: action.error.token,
      };
    case EDIT_TENANT_PHONE_NUMBERS: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(true, action.tenantId, state.tenants),
      };
    }
    case EDIT_TENANT_PHONE_NUMBERS_SUCCESS: {
      return {
        ...state,
      };
    }
    case EDIT_TENANT_PHONE_NUMBERS_FAIL: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
        error: action.error.token,
      };
    }
    case CREATE_TENANT_DONE:
    case EDIT_TENANT_PHONE_NUMBERS_DONE: {
      const tenants = state.tenants.filter(tenant => tenant.id !== action.result.id);
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.result.id, [...tenants, enhanceTenant(action.result, state.availablePhoneNumbers)]),
      };
    }
    case REFRESH_TENANT_SCHEMA:
      return {
        ...state,
        tenants: updateTenantWorkInProgress(true, action.tenantId, state.tenants),
      };
    case REFRESH_TENANT_SCHEMA_SUCCESS:
      return {
        ...state,
      };
    case REFRESH_TENANT_SCHEMA_FAIL:
      return {
        ...state,
        error: action.error,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
      };
    case REFRESH_TENANT_SCHEMA_DONE:
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
      };
    case IMPORT_AND_PROCESS_WORKFLOWS:
      return {
        ...state,
        isJobLoading: action.data.waitForResponse,
      };
    case IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS:
      return {
        ...state,
        importAndProcessWorkflowsAlreadyInProgress: true,
      };
    case IMPORT_AND_PROCESS_WORKFLOW_FINISHED:
      return {
        ...state,
        isJobLoading: false,
        finished: true,
        processStatus: action.result.message,
      };
    case IMPORT_AND_PROCESS_WORKFLOW_FAILED: {
      return {
        ...state,
        isJobLoading: false,
        finished: true,
        processStatus: action.result.message,
      };
    }
    case CLEAR_IMPORT_AND_PROCESS_WORKFLOW:
      return {
        ...state,
        isJobLoading: false,
        finished: false,
        processStatus: '',
      };
    case CLEAR_IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS:
      return {
        ...state,
        importAndProcessWorkflowsAlreadyInProgress: false,
      };
    case CLEAR_TENANT_SCHEMA:
      return {
        ...state,
        clearingTenantSchema: true,
      };
    case CLEAR_TENANT_SCHEMA_DONE:
      return {
        ...state,
        clearingTenantSchema: false,
      };
    case CLEAR_TENANT_SCHEMA_FAIL:
      notifier.error(t('CLEAR_TENANT_SCHEMA_FAIL'));
      return {
        ...state,
        clearingTenantSchema: false,
      };
    case DELETE_TENANT:
      return {
        ...state,
        error: null,
        tenants: updateTenantWorkInProgress(true, action.tenant.id, state.tenants),
      };
    case DELETE_TENANT_SUCCESS: {
      return {
        ...state,
        tenants: state.tenants.filter(tenant => tenant.id !== action.tenant.id),
      };
    }
    case DELETE_TENANT_FAIL:
      return {
        ...state,
        error: action.error,
        tenants: updateTenantWorkInProgress(false, action.tenant.id, state.tenants),
      };
    case REFRESH_LEASE_TEMPLATES:
    case REFRESH_PROVIDER_DATA: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(true, action.tenantId, state.tenants),
      };
    }
    case REFRESH_LEASE_TEMPLATES_SUCCESS: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
      };
    }
    case REFRESH_PROVIDER_DATA_SUCCESS: {
      return {
        ...state,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
        accountsNotFound: action.result.accountsNotFound,
      };
    }
    case REFRESH_LEASE_TEMPLATES_FAIL:
    case REFRESH_PROVIDER_DATA_FAIL: {
      return {
        ...state,
        error: action.error,
        tenants: updateTenantWorkInProgress(false, action.tenantId, state.tenants),
      };
    }
    case LOAD_PHONE_NUMBERS:
      return {
        ...state,
        availablePhoneNumbers: [],
        isLoadingPhoneNumbers: true,
      };
    case LOAD_PHONE_NUMBERS_SUCCESS:
      return {
        ...state,
        availablePhoneNumbers: action.result?.availablePhoneNumbers,
        tenants: action.result?.tenants,
        isLoadingPhoneNumbers: false,
      };
    case LOAD_PHONE_NUMBERS_FAIL:
      return {
        ...state,
        error: 'LOAD_AVAILABLE_TENANT_PHONE_NUMBERS_ERROR',
        isLoadingPhoneNumbers: false,
      };
    case TRIGGER_COMM_PROVIDER_CLEANUP:
      return {
        ...state,
        isCleaningUpCommProvider: true,
      };
    case TRIGGER_COMM_PROVIDER_CLEANUP_FAIL:
    case COMM_PROVIDER_CLEANUP_DONE:
      return {
        ...state,
        isCleaningUpCommProvider: false,
      };
    case LOAD_TENANT_TEAMS:
    case UPDATE_TENANT_TEAM:
      return {
        ...state,
      };
    case LOAD_TENANT_TEAMS_SUCCESS:
      return {
        ...state,
        tenantTeams: action.result.teams,
        tenantPhoneNumbers: action.result.tenantPhoneNumbers,
      };
    case LOAD_TENANT_TEAMS_FAIL:
      return {
        ...state,
        error: 'LOAD_TENANT_TEAMS_ERROR',
      };
    case UPDATE_TENANT_TEAM_SUCCESS: {
      const res = action.result;
      const newTenantTeams = state.tenantTeams.map(tn => (tn.id === res.id ? { ...res } : tn));

      return {
        ...state,
        tenantTeams: newTenantTeams,
      };
    }
    case UPDATE_TENANT_TEAM_FAIL:
      return {
        ...state,
        error: 'UPDATE_TENANT_TEAMS_ERROR',
      };
    case EDIT_TENANT_METADATA:
      return {
        ...state,
        updatingTenantMetadata: true,
      };
    case EDIT_TENANT_METADATA_SUCCESS:
      return {
        ...state,
        updatingTenantMetadata: false,
        tenants: updateTenant(action.tenantId, state.tenants, enhanceTenant(action.result, state.availablePhoneNumbers)),
      };
    case EDIT_TENANT_METADATA_FAIL:
      return {
        ...state,
        updatingTenantMetadata: false,
        error: 'EDIT_TENANT_METADATA_ERROR',
      };
    case CLOSE_IMPORTED_PARTIES:
      return {
        ...state,
        lastCloseImportedPartiesRequestId: action.reqId,
        closingImportedParties: true,
        openDataMigration: false,
      };
    case CLOSE_IMPORTED_PARTIES_REQUEST_SUCCESS:
      if (state.lastCloseImportedPartiesRequestId !== action.reqId) return state;
      return {
        ...state,
        closingImportedParties: true,
        openDataMigration: false,
      };
    case CLOSE_IMPORTED_PARTIES_SUCCESS:
      return {
        ...state,
        closingImportedParties: false,
        openDataMigration: true,
      };
    case CLOSE_IMPORTED_PARTIES_FAIL:
      notifier.error(t('CLOSE_IMPORTED_PARTIES_FAIL'));
      return {
        ...state,
        closingImportedParties: false,
        openDataMigration: false,
      };
    case LOAD_TENANT_PROGRAMS:
      return {
        ...state,
        isLoading: true,
      };
    case LOAD_TENANT_PROGRAMS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        programs: action.result,
      };
    case LOAD_TENANT_PROGRAMS_FAIL:
      return {
        ...state,
        isLoading: false,
        error: action.error.token,
      };
    case GENERATE_DOMAIN_TOKEN:
      return {
        ...state,
        domainToken: '',
        isGeneratingToken: true,
      };
    case GENERATE_DOMAIN_TOKEN_SUCCESS:
      return {
        ...state,
        domainToken: action.result.token,
        isGeneratingToken: false,
      };
    case GENERATE_DOMAIN_TOKEN_FAIL:
      return {
        ...state,
        domainToken: '',
        error: action.error.token,
        isGeneratingToken: false,
      };
    case ARCHIVE_PARTIES:
      return {
        ...state,
        archiveInProgress: true,
        archiveFinished: false,
        archiveStatus: '',
        numberOfPartiesToArchive: 0,
      };
    case ARCHIVE_PARTIES_SUCCESS:
      return {
        ...state,
        archiveInProgress: false,
        archiveFinished: true,
        archiveStatus: archivePartiesStatus.SUCCESS,
        numberOfPartiesToArchive: action.data.numberOfPartiesToArchive,
      };
    case ARCHIVE_PARTIES_FAIL:
      return {
        ...state,
        archiveInProgress: false,
        archiveFinished: true,
        archiveStatus: archivePartiesStatus.FAILED,
        numberOfPartiesToArchive: 0,
      };
    case ARCHIVE_PARTIES_FINISHED:
      return {
        ...state,
        archiveInProgress: false,
        archiveFinished: false,
        archiveStatus: '',
        numberOfPartiesToArchive: 0,
      };
    default:
      return state;
  }
}

export const loadAvailablePhoneNumbers = () => async (makeRequest, dispatch) => {
  dispatch({ type: LOAD_PHONE_NUMBERS });

  await makeRequest({
    method: 'GET',
    url: '/tenants/availablePhoneNumbers',
  });
};

export const loadAvailablePhoneNumbersDone = tenantNumbers => async (makeRequest, dispatch, getState) => {
  let tenants = getState().tenants?.tenants;

  tenants = await optimizeTenantsStructure(tenants, tenantNumbers);

  const result = {
    tenants,
    availablePhoneNumbers: tenantNumbers,
  };

  dispatch({ type: LOAD_PHONE_NUMBERS_SUCCESS, result });
};

export const loadAvailablePhoneNumbersFailed = () => ({
  type: LOAD_PHONE_NUMBERS_FAIL,
});

export const loadTenants = () => async (makeRequest, dispatch, getState) => {
  dispatch({ type: LOAD_TENANTS });

  const { data, error } = await makeRequest({
    method: 'GET',
    url: '/tenants',
  });

  if (error) {
    dispatch({ type: LOAD_TENANTS_FAIL, error });
  }

  const availablePhoneNumbers = getState().tenants?.availablePhoneNumbers;

  const result = {
    tenants: await optimizeTenantsStructure(data?.tenants, availablePhoneNumbers),
  };
  dispatch({ type: LOAD_TENANTS_SUCCESS, result });
};

export const loadTenant = id => ({
  types: [LOAD_TENANT, LOAD_TENANT_SUCCESS, LOAD_TENANT_FAIL],
  promise: client => client.get(`/tenants/${id}`),
});

export const importAndProcessWorkflows = ({ tenantId, skipImport, skipProcess, partyGroupId = '', propertyExternalId = '', waitForResponse = false }) => async (
  makeRequest,
  dispatch,
) => {
  dispatch({ type: IMPORT_AND_PROCESS_WORKFLOWS, data: { waitForResponse } });
  const { error } = await makeRequest({
    method: 'post',
    url: `/test/importActiveLeases?skipImport=${skipImport}&skipProcess=${skipProcess}&propertyId=${propertyExternalId}&partyGroupId=${partyGroupId}`,
    payload: { tenantId },
  });

  if (error?.status === 412) {
    error.__handled = true;
    dispatch({ type: IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS, error });
    return;
  }

  if (waitForResponse) {
    if (error) {
      dispatch({ type: IMPORT_AND_PROCESS_WORKFLOW_FAILED, result: { message: processWfStatus.FAILED } });
      return;
    }
    dispatch({ type: IMPORT_AND_PROCESS_WORKFLOW_FINISHED, result: { message: processWfStatus.SUCCESS } });
  }
};

export const archivePartiesFromSoldProperties = (tenantId, propertyIds) => async (makeRequest, dispatch) => {
  dispatch({ type: ARCHIVE_PARTIES });

  const { error, data } = await makeRequest({
    method: 'post',
    url: `/tenants/${tenantId}/archivePartiesFromSoldProperties`,
    payload: {
      propertyIds,
    },
  });

  if (error) {
    error.__handled = true;
    dispatch({ type: ARCHIVE_PARTIES_FAIL, error });
    return;
  }
  dispatch({ type: ARCHIVE_PARTIES_SUCCESS, data });
};

export const finishArchivePartiesFromSoldProperties = () => ({ type: ARCHIVE_PARTIES_FINISHED });

export const clearImportAndProcessWorkflowsInProgress = () => ({ type: CLEAR_IMPORT_AND_PROCESS_WORKFLOWS_ALREADY_IN_PROGRESS });

export const clearImportAndProcessWorkflow = () => ({ type: CLEAR_IMPORT_AND_PROCESS_WORKFLOW });

export const createTenant = tenant => ({
  types: [CREATE_TENANT, CREATE_TENANT_SUCCESS, CREATE_TENANT_FAIL],
  promise: client => client.post('/tenants', { data: tenant }),
});

export const editTenantPhoneNumbers = (id, delta) => ({
  types: [EDIT_TENANT_PHONE_NUMBERS, EDIT_TENANT_PHONE_NUMBERS_SUCCESS, EDIT_TENANT_PHONE_NUMBERS_FAIL],
  promise: client => client.patch(`/tenants/${id}`, { data: delta }),
  tenantId: id,
});

export const editTenantMetadata = (id, delta) => ({
  types: [EDIT_TENANT_METADATA, EDIT_TENANT_METADATA_SUCCESS, EDIT_TENANT_METADATA_FAIL],
  promise: client => client.patch(`/tenants/${id}`, { data: delta }),
  tenantId: id,
});

export const deleteTenant = tenant => ({
  types: [DELETE_TENANT, DELETE_TENANT_SUCCESS, DELETE_TENANT_FAIL],
  promise: client => client.del(`/tenants/${tenant.id}`),
  tenant,
});

export const refreshTenantSchema = ({ id }, noOfTeams = 0, bigDataCount = 0) => ({
  types: [REFRESH_TENANT_SCHEMA, REFRESH_TENANT_SCHEMA_SUCCESS, REFRESH_TENANT_SCHEMA_FAIL],
  promise: client => client.post(`/tenants/${id}/refreshTenantSchema?importInventory=true&bigDataCount=${bigDataCount}&noOfTeams=${noOfTeams}`),
  tenantId: id,
});

export const refreshTenantSchemaDone = tenantId => ({
  type: REFRESH_TENANT_SCHEMA_DONE,
  tenantId,
});

export const clearTenantSchemaDone = () => ({
  type: CLEAR_TENANT_SCHEMA_DONE,
});

export const generateDomainTokenDone = tenantId => ({
  type: GENERATE_DOMAIN_TOKEN_SUCCESS,
  tenantId,
});

export const editTenantPhoneNumbersDone = tenant => ({
  type: EDIT_TENANT_PHONE_NUMBERS_DONE,
  result: tenant,
});

export const triggerCommunicationProviderCleanup = () => ({
  types: [TRIGGER_COMM_PROVIDER_CLEANUP, TRIGGER_COMM_PROVIDER_CLEANUP_SUCCESS, TRIGGER_COMM_PROVIDER_CLEANUP_FAIL],
  promise: client => client.post('/tenants/communicationProviderCleanup'),
});

export const commProviderCleanupDone = () => ({
  type: COMM_PROVIDER_CLEANUP_DONE,
});

export const loadTenantTeams = tenantId => ({
  types: [LOAD_TENANT_TEAMS, LOAD_TENANT_TEAMS_SUCCESS, LOAD_TENANT_TEAMS_FAIL],
  promise: client => client.get(`/tenants/${tenantId}/teams`),
});

export const updateTeam = (tenantId, id, data) => ({
  types: [UPDATE_TENANT_TEAM, UPDATE_TENANT_TEAM_SUCCESS, UPDATE_TENANT_TEAM_FAIL],
  promise: client => client.patch(`/tenants/${tenantId}/teams/${id}`, { data }),
});

export const updatePasswordForType = (tenantId, payload) => async makeRequest =>
  await makeRequest({
    method: 'PATCH',
    url: `/tenants/${tenantId}/passwordForType`,
    payload,
  });

export const clearTenantSchema = tenantId => ({
  types: [CLEAR_TENANT_SCHEMA, CLEAR_TENANT_SCHEMA_SUCCESS, CLEAR_TENANT_SCHEMA_FAIL],
  promise: client => client.post(`tenants/${tenantId}/clearTenantSchema`),
});

export const createTenantDone = tenant => ({
  type: CREATE_TENANT_DONE,
  result: tenant,
});

export const refreshLeaseTemplates = tenant => ({
  types: [REFRESH_LEASE_TEMPLATES, REFRESH_LEASE_TEMPLATES_SUCCESS, REFRESH_LEASE_TEMPLATES_FAIL],
  promise: client => client.post(`/tenants/${tenant.id}/refreshLeaseTemplates`, { data: {} }),
  tenantId: tenant.id,
});

export const updateTenantDone = tenant => ({
  type: EDIT_TENANT_METADATA_DONE,
  result: tenant,
});

export const refreshRCToken = ({ tenantId }) => async makeRequest =>
  await makeRequest({
    method: 'post',
    url: `/tenants/${tenantId}/ringCentral/token/refresh`,
  });
export const requestRCAuthUrl = ({ tenantId }) => async makeRequest =>
  await makeRequest({
    method: 'GET',
    url: `/tenants/${tenantId}/ringCentral/authUrl`,
  });

export const requestRCToken = ({ tenantId, code }) => async makeRequest =>
  await makeRequest({
    method: 'POST',
    url: `/tenants/${tenantId}/ringCentral/token`,
    payload: {
      code,
    },
  });

export const renewRCSubscription = ({ tenantId, code }) => async makeRequest =>
  await makeRequest({
    method: 'POST',
    url: `/tenants/${tenantId}/ringCentral/renewSubscription`,
    payload: {
      code,
    },
  });

export const closeImportedParties = (tenantId, propertyIds, activityDate) => async (makeRequest, dispatch, getState) => {
  const requestId = newId();
  dispatch({ type: CLOSE_IMPORTED_PARTIES, requestId });
  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/tenants/${tenantId}/closeImportedParties`,
    payload: { propertyIds, activityDate },
    requestId,
  });

  const lastRequest = getState().inventoryStore.lastCloseImportedPartiesRequestId;
  if (lastRequest !== requestId) {
    console.log(`Discarding request=${requestId}, last request is=${lastRequest}`);
    return;
  }

  if (error) {
    dispatch({ type: CLOSE_IMPORTED_PARTIES_FAIL, error });
    return;
  }

  dispatch({ type: CLOSE_IMPORTED_PARTIES_REQUEST_SUCCESS, result: data });
};

export const onImportedPartiesClosed = data => {
  const { reqId, error } = data;
  return error ? { type: CLOSE_IMPORTED_PARTIES_FAIL, error } : { type: CLOSE_IMPORTED_PARTIES_SUCCESS, reqId };
};

export const loadTenantPrograms = tenantId => async (makeRequest, dispatch) => {
  const { data, error } = await makeRequest({
    method: 'GET',
    url: `/tenants/${tenantId}/programs`,
  });

  if (error) {
    dispatch({ type: LOAD_TENANT_PROGRAMS_FAIL });
    return;
  }
  dispatch({ type: LOAD_TENANT_PROGRAMS_SUCCESS, result: data.programs });
};

export const getEnterpriseConnectAuthorizationUrl = () => async makeRequest =>
  await makeRequest({
    method: 'GET',
    url: '/externalCalendars/enterpriseConnect/authorizationUrl',
  });

export const requestEnterpriseConnectAccessToken = code => async makeRequest =>
  await makeRequest({
    method: 'POST',
    url: '/externalCalendars/enterpriseConnect/accessToken',
    payload: {
      code,
    },
  });

export const syncExternalCalendarEvents = () => async makeRequest =>
  await makeRequest({
    method: 'GET',
    url: '/externalCalendars/externalCalendarEventsSync',
  });

export const handleCalendarDataSync = ({ successfully, token }, auth) => {
  if (auth && auth.user && isAdmin(auth.user)) {
    successfully ? notifier.success(t(token)) : notifier.error(t(token));
  }
};

export const reassignActiveLeasesToRS = () => async makeRequest =>
  await makeRequest({
    method: 'GET',
    url: '/activeLeases/reassignActiveLeasesToRS',
  });

export const handleReassignActiveLeasesToRS = ({ successfully, token, partiesCount }, auth) => {
  if (auth && auth.user && isAdmin(auth.user)) {
    successfully ? notifier.success(t(token, { partiesCount })) : notifier.error(t(token));
  }
};

export const refreshProviderData = tenant => async (makeRequest, dispatch) => {
  dispatch({ type: REFRESH_PROVIDER_DATA, tenantId: tenant.id });

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/tenants/${tenant.id}/refreshPaymentProvider`,
  });

  if (error) {
    error.__handled = error.token === 'APTEXX_FETCH_FAILED' || error.token === 'DUPLICATE_ACTIVE_ACCOUNTS';
    dispatch({ type: REFRESH_PROVIDER_DATA_FAIL, error, tenantId: tenant.id });
    return;
  }

  dispatch({ type: REFRESH_PROVIDER_DATA_SUCCESS, result: data, tenantId: tenant.id });
};

export const generateDomainTokenForWebsite = (tenantId, domain, useDefaultTokenId, validateReferrer, allowedEndpoints) => async (makeRequest, dispatch) => {
  dispatch({ type: GENERATE_DOMAIN_TOKEN });

  const defaultPayload = {
    domain,
    expiresIn: '2y',
    allowedEndpoints,
    validateReferrer,
  };

  const { data, error } = await makeRequest({
    method: 'POST',
    url: `/tenants/${tenantId}/generateDomainToken`,
    payload: useDefaultTokenId
      ? {
          tokenId: DEFAULT_WEBSITES_TOKEN_ID,
          ...defaultPayload,
        }
      : defaultPayload,
  });

  if (error) {
    dispatch({ type: GENERATE_DOMAIN_TOKEN_FAIL });
    return;
  }

  dispatch({ type: GENERATE_DOMAIN_TOKEN_SUCCESS, result: data });
};
