/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { followupParty } from './followupParty';
import { sendRenewalReminder } from './sendRenewalReminder';
import { appointment } from './appointment';
import { manual } from './manual';
import { manualReminder } from './manualReminder';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { notifyConditionalApproval } from './notifyConditionalApproval';
import { requireWork } from './requireWork';
import { placeInventoryHold } from './placeInventoryHold';
import { completeContactInfo } from '../../../decision_service/tasks/taskDefinitions/completeContactInfo';
import { countersignLease } from '../../../decision_service/tasks/taskDefinitions/countersignLease';
import { reviewApplication } from '../../../decision_service/tasks/taskDefinitions/reviewApplication';
import { sendRenewalQuote } from '../../../decision_service/tasks/taskDefinitions/sendRenewalQuote';
import { contactBack } from '../../../decision_service/tasks/taskDefinitions/contactBack';
import { introduceYourself } from '../../../decision_service/tasks/taskDefinitions/introduceYourself';
import { sendContract } from '../../../decision_service/tasks/taskDefinitions/sendContract';
import { removeAnonymousEmail } from '../../../decision_service/tasks/taskDefinitions/removeAnonymousEmail';
import { promoteApplication } from '../../../decision_service/tasks/taskDefinitions/promoteApplication';
import { collectEmergencyContact } from '../../../decision_service/tasks/taskDefinitions/collectEmergencyContact';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

export const taskDefinitions = [
  { ...sendRenewalReminder },
  { ...followupParty },
  { ...appointment },
  { ...manual },
  { ...manualReminder },
  { ...notifyConditionalApproval },
  { ...requireWork },
  { ...placeInventoryHold },
];

const allTaskDefinitions = [
  { ...sendRenewalReminder },
  { ...followupParty },
  { ...reviewApplication },
  { ...appointment },
  { ...manual },
  { ...notifyConditionalApproval },
  { ...requireWork },
  { ...completeContactInfo },
  { ...countersignLease },
  { ...sendRenewalQuote },
  { ...introduceYourself },
  { ...contactBack },
  { ...sendContract },
  { ...removeAnonymousEmail },
  { ...promoteApplication },
  { ...placeInventoryHold },
  { ...collectEmergencyContact },
];

export const tasksForLAA = allTaskDefinitions.filter(t => t.requiredRoles && t.requiredRoles.includes(FunctionalRoleDefinition.LAA.name));

export const tasksForLCA = allTaskDefinitions.filter(t => t.requiredRoles && t.requiredRoles.includes(FunctionalRoleDefinition.LCA.name));

const unrestrictedTasks = allTaskDefinitions.filter(t => !t.requiredRoles || t.requiredRoles.length === 0);

// manual/requireWork tasks do not have a consistent name. An eng story will be added to remove category and add task name for these situations
export const isTaskUnrestricted = task =>
  unrestrictedTasks.some(
    unrestrictedTask =>
      unrestrictedTask.name === task.name || [DALTypes.TaskCategories.REQUIRE_WORK, DALTypes.TaskCategories.MANUAL].find(c => c === task.category),
  );
