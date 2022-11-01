/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { OperationResultType } from '../../common/enums/enumHelper';
import eventTypes from '../../common/enums/eventTypes';
import { leasingNavigator } from '../helpers/leasing-navigator';
import mediator from '../helpers/mediator';
import { delayedLogout } from '../helpers/auth-helper';
import notifier from '../helpers/notifier/notifier';
import {
  handleTenantPhoneAssignationSuccess,
  handleTenantPhoneAssignationFailure,
  handleTenantUpdateSuccess,
  handleCommProviderCleanupDone,
  handleTenantRefreshSchemaDone,
  handleGetAvailableNumbersDone,
  handleTenantClearSchemaDone,
  handleCommServiceSetupComplete,
  handlePasswordChange,
} from '../helpers/models/tenant';
import { notifySmsSendingResult } from '../helpers/sms';
import { notifyDirectMessageSendingResult } from '../helpers/directMessage';
import { emitServerStarted } from '../helpers/notify-version';
import { handleUserUpdated } from '../redux/modules/auth';
import { onImportedPartiesClosed, handleCalendarDataSync, handleReassignActiveLeasesToRS } from '../redux/modules/tenantsStore';
import { handlePersonMerged } from '../redux/modules/personsStore';
import { handleRemoveOrCancelWSNotification } from '../redux/modules/tasks';
import { fetchJobsByCategory, updateJobStepProgress, getJob } from '../redux/modules/jobsStore';
import {
  handleUsersUpdatedWSNotification,
  handleAvailabilityChangedWSNotification,
  handleSandboxAvailabilityChangedWSNotification,
} from '../redux/modules/usersStore';
import { onHoldInventory, onInventoryUpdated } from '../redux/modules/inventoryStore';
import { onLeasePublished } from '../redux/modules/leaseStore';
import { getTransactions } from '../redux/modules/partyStore';
import { getScreeningForParty, updatePartyQuotesOnInventoryHold, updatePartyQuotesOnInventoryUpdated, fetchQuotesIfNeeded } from '../redux/modules/quotes';
import * as telephonyActions from '../redux/modules/telephony';
import { loadEvents } from '../redux/modules/appointments.dialog';
import { refreshPartyData, loadCommunicationsForParties, loadPartyDetailsDataSilent } from '../redux/modules/appDataLoadingActions';

import { connect, disconnect } from './socketClient';

const shouldSkipPageNotification = partyId => {
  const partyIdFromActiveWindow = window.location.pathname.split('/').pop();
  return partyIdFromActiveWindow !== partyId;
};

const forceLogout = () => {
  console.log('Forcing user logout');
  // TODO: refactor the way login/logout is handled to avoid the delay
  delayedLogout(1000);
};

const connectSocketAndSubscribeForEvents = async (getState, dispatch) => {
  const theState = getState();
  const token = theState.auth.token;
  const authUser = theState.auth.user;

  const onPartyUpdateReceived = data => dispatch(refreshPartyData(data));

  const subscriptions = [
    {
      event: eventTypes.USER_SOCKET_DISCONNECTED,
      callback: () => {
        console.log('user lost a socket connection, retriggering telephony provider initialization');
        dispatch(telephonyActions.reinitializeProvider(authUser));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.MAIL_RECEIVED,
      callback: () => notifier.success(t('EMAIL_RECEIVED')),
      excludeAdmin: true,
    },
    {
      event: eventTypes.MAIL_SENT,
      callback: sendInfo => {
        if (sendInfo.type === OperationResultType.SUCCESS) {
          notifier.success(t(sendInfo.notificationMessage || 'EMAIL_SUCCESSFULLY_SENT'));
        } else {
          notifier.error(t('EMAIL_SENDING_FAILED'));
        }
      },
    },
    {
      event: eventTypes.SMS_RECEIVED,
      callback: () => notifier.success(t('SMS_RECEIVED')),
      excludeAdmin: true,
    },
    {
      event: eventTypes.SMS_SENT,
      callback: data => {
        const { type, userId, ids, partyId, persons, notificationMessage, wsUsers, reqId } = data;
        const route = leasingNavigator.location.pathname;

        if (route === '/') onPartyUpdateReceived({ partyId, wsUsers, reqId });

        const state = getState();
        const { partyStore } = state;
        const { partyId: pagePartyId } = partyStore;

        const isCommForCurrentParty = pagePartyId && partyId === pagePartyId;
        if (!isCommForCurrentParty) return;

        dispatch(loadCommunicationsForParties({ ids, partyIds: [partyId], reqId }));
        if (userId && userId === authUser.id) {
          notifySmsSendingResult(persons, getState().dataStore.get('persons'), notificationMessage, type);
        }
      },
    },
    {
      event: eventTypes.DIRECT_MESSAGE_SENT,
      callback: data => {
        const { type, userId, ids, partyId, persons, notificationMessage, wsUsers, reqId } = data;
        const route = leasingNavigator.location.pathname;

        if (route === '/') onPartyUpdateReceived({ partyId, wsUsers, reqId });

        const state = getState();
        const { partyStore } = state;
        const { partyId: pagePartyId } = partyStore;

        const isCommForCurrentParty = pagePartyId && partyId === pagePartyId;
        if (!isCommForCurrentParty) return;

        dispatch(loadCommunicationsForParties({ ids, partyIds: [partyId], reqId }));
        if (userId && userId === authUser.id) {
          notifyDirectMessageSendingResult(persons, getState().dataStore.get('persons'), notificationMessage, type);
        }
      },
    },
    {
      event: eventTypes.COMMUNICATION_UPDATE,
      callback: data => {
        const route = leasingNavigator.location.pathname;

        if (route === '/') {
          // [RR] Question: should we only update the data if we're currently on that partyId page?
          (data.partyIds || []).forEach(partyId => onPartyUpdateReceived({ partyId, wsUsers: data.wsUsers }));
        } else {
          const state = getState();
          const { partyStore, flyoutStore } = state;
          const { partyId } = partyStore;
          const { openedFlyouts } = flyoutStore;

          // Skip comms refresh if not on the party page and there are no open flyouts related to the updated comm
          const isCommForAnotherParty = partyId && !(data.partyIds || []).includes(partyId);
          const flyoutIds = Object.keys(openedFlyouts);
          const hasOpenCommFlyouts = flyoutIds.map(fid => openedFlyouts[fid]).some(flyout => data.threadIds.includes(flyout.flyoutProps.threadId));

          if (isCommForAnotherParty && !hasOpenCommFlyouts) return;

          dispatch(loadCommunicationsForParties(data));
        }
        dispatch(telephonyActions.updateActiveCommunication(data.ids, data.reqId));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.OUTGOING_CALL_INITIATED,
      callback: ({ partyIds, commId, isPhoneToPhone, to, reqId }) => {
        dispatch(loadCommunicationsForParties({ partyIds, ids: [commId], reqId }));
        dispatch(telephonyActions.handleOutgoingCallInitiated({ commId, isPhoneToPhone, to, reqId }));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.PARTY_UPDATED,
      callback: data => {
        onPartyUpdateReceived(data);
        mediator.fire(eventTypes.PARTY_UPDATED, data);
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.QUOTES_UPDATED,
      callback: ({ partyId, reqId }) => {
        if (shouldSkipPageNotification(partyId)) return;
        dispatch(fetchQuotesIfNeeded(partyId, reqId));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.QUOTE_PUBLISHED_FAILED,
      callback: ({ partyId }) => {
        if (shouldSkipPageNotification(partyId)) return;
        notifier.error(t('PRICE_NOT_AVAILABLE_SNACKBAR_MESSAGE'));
      },
    },
    {
      event: eventTypes.PARTY_ASSIGNED,
      callback: onPartyUpdateReceived,
      excludeAdmin: true,
    },
    {
      event: eventTypes.OWNER_CHANGED,
      callback: data => {
        onPartyUpdateReceived(data);
        const currentPartyId = getState().partyStore.partyId;
        const { name, partyId } = data;
        if (currentPartyId === partyId) notifier.success(t('PARTY_OWNERSHIP_CHANGED', { name }));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.APPLICATION_CREATED,
      callback: onPartyUpdateReceived,
      excludeAdmin: true,
    },
    {
      event: eventTypes.APPLICATION_UPDATED,
      callback: data => {
        onPartyUpdateReceived(data);
        if (shouldSkipPageNotification(data.partyId)) return;
        if (data.personId || (data.personIds && data.personIds.length)) {
          dispatch(getScreeningForParty(data));
        }
        dispatch(getTransactions(data));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.PARTY_DETAILS_UPDATED,
      callback: data => {
        if (shouldSkipPageNotification(data.partyId)) return;
        dispatch(loadPartyDetailsDataSilent(data.partyId, data.reqId));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.LEASE_CREATED,
      callback: onPartyUpdateReceived,
      excludeAdmin: true,
    },
    {
      event: eventTypes.LEASE_PUBLISHED,
      callback: data => dispatch(onLeasePublished(data)),
      excludeAdmin: true,
    },
    {
      event: eventTypes.LEASE_UPDATED,
      callback: onPartyUpdateReceived,
      excludeAdmin: true,
    },
    {
      event: eventTypes.INVENTORY_HOLD,
      callback: data => {
        dispatch(updatePartyQuotesOnInventoryHold(data));
        dispatch(onHoldInventory(data));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.INVENTORY_UPDATED,
      callback: data => {
        dispatch(updatePartyQuotesOnInventoryUpdated(data));
        dispatch(onInventoryUpdated(data));
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.REFRESH_TENANT_SCHEMA_DONE,
      callback: handleTenantRefreshSchemaDone(dispatch),
    },
    {
      event: eventTypes.CLEAR_TENANT_SCHEMA_DONE,
      callback: handleTenantClearSchemaDone(dispatch),
    },
    {
      event: eventTypes.PHONENO_ASSIGNATION_SUCCESS,
      callback: handleTenantPhoneAssignationSuccess(dispatch),
    },
    {
      event: eventTypes.PHONENO_ASSIGNATION_FAILURE,
      callback: handleTenantPhoneAssignationFailure(dispatch),
    },
    {
      event: eventTypes.COMM_PROVIDER_CLEANUP_DONE,
      callback: handleCommProviderCleanupDone(dispatch),
    },
    {
      event: eventTypes.SIP_UPDATED,
      callback: usr => dispatch(handleUserUpdated(usr)),
    },
    {
      event: eventTypes.USERS_UPDATED,
      callback: ({ userIds, reqId }) => dispatch(handleUsersUpdatedWSNotification(userIds, authUser, reqId)),
    },
    {
      event: eventTypes.USERS_AVAILABILITY_CHANGED,
      callback: ({ userIds, status, statusUpdatedAt }) => dispatch(handleAvailabilityChangedWSNotification(userIds, authUser, status, statusUpdatedAt)),
    },
    {
      event: eventTypes.UNIVERSITY_SANDBOX_CREATION_COMPLETED,
      callback: ({ userIds, sandboxTenant, sandboxAvailable }) =>
        dispatch(handleSandboxAvailabilityChangedWSNotification(userIds, authUser, sandboxTenant, sandboxAvailable)),
    },
    {
      event: eventTypes.COMM_PROVIDER_SETUP_DONE,
      callback: handleCommServiceSetupComplete(dispatch),
    },
    {
      event: eventTypes.UPDATE_TYPES_PASSWORD,
      callback: data => handlePasswordChange(data),
    },
    {
      event: eventTypes.JOB_CREATED,
      callback: data => dispatch(fetchJobsByCategory(data)),
    },
    {
      event: eventTypes.JOB_PROGRESS,
      callback: data => dispatch(updateJobStepProgress(data)),
    },
    {
      event: eventTypes.JOB_UPDATED,
      callback: data => dispatch(getJob(data)),
    },
    {
      event: eventTypes.TENANT_UPDATE_DONE,
      callback: data => dispatch(handleTenantUpdateSuccess(data)),
    },
    {
      event: eventTypes.CALL_ANSWERED,
      callback: data => dispatch(telephonyActions.handleCallAnswered(data)),
      excludeAdmin: true,
    },
    {
      event: eventTypes.CALL_TERMINATED,
      callback: data => dispatch(telephonyActions.handleCallTerminated(data)),
      excludeAdmin: true,
    },
    {
      event: eventTypes.START_WRAPUP_CALL,
      callback: ({ wrapUpTime }) => {
        dispatch(telephonyActions.startWrapUpTime(wrapUpTime));
      },
    },
    {
      event: eventTypes.LOAD_APPOINTMENTS_EVENT,
      callback: data => dispatch(loadEvents(data)),
    },
    {
      event: eventTypes.BROADCAST_WEB_UPDATED,
      callback: data => emitServerStarted(data),
    },
    {
      event: eventTypes.PROCESS_TASK_EVENT,
      callback: data => {
        (data.tasks || []).map(item => {
          if (item.deleted || item.canceled) {
            dispatch(handleRemoveOrCancelWSNotification(item));
          }
          return onPartyUpdateReceived({ partyId: item.partyId, ...data });
        });
      },
      excludeAdmin: true,
    },
    {
      event: eventTypes.FORCE_LOGOUT,
      callback: forceLogout,
      excludeAdmin: true,
    },
    {
      event: eventTypes.FORCE_LOGOUT_PLUS_ADMIN,
      callback: forceLogout,
      excludeAdmin: false,
    },
    {
      event: eventTypes.CLOSE_IMPORTED_PARTIES_COMPLETED,
      callback: data => dispatch(onImportedPartiesClosed(data)),
    },
    {
      event: eventTypes.SYNC_CALENDAR_DATA_COMPLETED,
      callback: data => handleCalendarDataSync(data, getState().auth),
    },
    {
      event: eventTypes.REASSIGN_AL_TO_RS_TEAM_COMPLETED,
      callback: data => handleReassignActiveLeasesToRS(data, getState().auth),
    },
    {
      event: eventTypes.TENANT_AVAILABLE_NUMBERS_COMPLETED,
      callback: handleGetAvailableNumbersDone(dispatch),
    },
    {
      event: eventTypes.PERSON_MERGED,
      callback: data => dispatch(handlePersonMerged(data.personId)),
    },
    {
      event: eventTypes.DOCUMENTS_UPLOADED,
      callback: data => {
        if (data?.files) {
          (data.files || []).forEach(file => {
            const { clientFileId } = file || {};

            if (clientFileId) {
              mediator.fire(`${eventTypes.DOCUMENTS_UPLOADED}_${clientFileId}`, data);
            }
          });
        }

        mediator.fire(eventTypes.DOCUMENTS_UPLOADED, data);
      },
    },
    {
      event: eventTypes.DOCUMENTS_UPLOADED_FAILURE,
      callback: data => {
        mediator.fire(`${eventTypes.DOCUMENTS_UPLOADED_FAILURE}_${data.postId}`, data);
      },
    },
    {
      event: eventTypes.POST_CREATED,
      callback: data => {
        mediator.fire(eventTypes.POST_CREATED, data);
      },
    },
    {
      event: eventTypes.POST_UPDATED,
      callback: data => {
        mediator.fire(eventTypes.POST_UPDATED, data);
      },
    },
    {
      event: eventTypes.POST_DELETED,
      callback: data => {
        mediator.fire(eventTypes.POST_DELETED, data);
      },
    },
    {
      event: eventTypes.POST_SENT,
      callback: data => {
        const { post } = data;
        mediator.fire(`${eventTypes.POST_SENT}_${post.id}`, data);
        mediator.fire(eventTypes.POST_SENT, data);
      },
    },
    {
      event: eventTypes.POST_SENT_FAILURE,
      callback: data => {
        mediator.fire(`${eventTypes.POST_SENT_FAILURE}_${data.postId}`, data);
      },
    },
    {
      event: eventTypes.DOCUMENTS_DELETED,
      callback: data => {
        mediator.fire(eventTypes.DOCUMENTS_DELETED, data);
      },
    },
    {
      event: eventTypes.TEAMS_CALL_QUEUE_CHANGED,
      callback: data => {
        mediator.fire(eventTypes.TEAMS_CALL_QUEUE_CHANGED, data);
      },
    },
  ];

  return await connect(token, subscriptions, authUser, dispatch);
};

const disconnectSocketAndUnsubscribe = () => {
  disconnect();
};

export const initListener = ({ subscribe, getState, dispatch }, apiClient) => {
  let currentToken;
  const WEB_SOCKET_HEADER_NAME = 'X-Socket-Id';

  subscribe(async () => {
    const prevToken = currentToken;
    currentToken = getState().auth.token;
    if (currentToken === prevToken) return;

    if (currentToken) {
      try {
        const socket = await connectSocketAndSubscribeForEvents(getState, dispatch);
        const { id } = socket;
        id && apiClient.setHeader(WEB_SOCKET_HEADER_NAME, id);
      } catch (e) {
        console.error('Error when trying to connect socket client:', e);
      }
    } else {
      apiClient.removeHeader(WEB_SOCKET_HEADER_NAME);
      disconnectSocketAndUnsubscribe();
    }
  });
};
