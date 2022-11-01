/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { combineReducers } from 'redux';
import { reducer as formReducer } from 'redux-form';

import auth from './auth';
import invite from './invite';
import tenants from './tenantsStore';
import needHelp from './needHelp';
import tokens from './tokens';
import partyStore from './partyStore';
import globalStore from './globalStore';
import memberStore from './memberStore';
import search from './search';
import inventoryStore from './inventoryStore';
import appointments from './appointments';
import appointmentsDialog from './appointments.dialog';
import layoutsStore from './layoutsStore';
import buildingsStore from './buildingsStore';
import dashboardStore from './dashboardStore';
import unitsFilter from './unitsFilter';
import propertyStore from './propertyStore';
import amenityStore from './amenityStore';
import usersStore from './usersStore';
import schedule from './schedule';
import sendMailDialog from './sendMailDialog';
import telephony from './telephony';
import communication from './communication';
import quotes from './quotes';
import seedData from './seedData';
import activityLog from './activityLogStore';
import personsStore from './personsStore';
import screen from './screen';
import dataStore from './dataStore';
import * as appDataLoaderStore from './appDataLoadingActions';
import flyoutStore from './flyoutStore';
import jobsStore from './jobsStore';
import commTemplateStore from './commTemplateStore';
import contactUsStore from './contactUs';
import blacklist from './blacklistStore';
import tasks from './tasks';
import leaseStore from './leaseStore';
import mergePartiesStore from './mergePartiesStore';
import locationTracking from './locationTracking';
import communicationDraftStore from './communicationDraftStore';
import forbiddenDialogStore from './forbiddenDialogStore';
import appSettingsStore from './appSettingsStore';
import exportDatabase from './exportDatabase';
import agentSchedules from './agentSchedulesStore';
import sickLeaves from './sickLeavesStore';
import subscriptionsStore from './subscriptionsStore';

export default combineReducers({
  auth,
  invite,
  tenants,
  needHelp,
  tokens,
  search,
  appointments,
  appointmentsDialog,
  form: formReducer,
  partyStore,
  globalStore,
  memberStore,
  inventoryStore,
  layoutsStore,
  buildingsStore,
  dashboardStore,
  unitsFilter,
  propertyStore,
  amenityStore,
  usersStore,
  sendMailDialog,
  schedule,
  telephony,
  communication,
  quotes,
  seedData,
  exportDatabase,
  activityLog,
  personsStore,
  screen,
  dataStore,
  appDataLoaderStore,
  flyoutStore,
  jobsStore,
  commTemplateStore,
  contactUsStore,
  blacklist,
  tasks,
  leaseStore,
  mergePartiesStore,
  locationTracking,
  communicationDraftStore,
  forbiddenDialogStore,
  appSettingsStore,
  agentSchedules,
  sickLeaves,
  subscriptionsStore,
});
