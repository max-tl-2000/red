/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveUser, getUsers, insertUserStatus } from '../../dal/usersRepo';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants';
import { hash } from '../../helpers/crypto';
import config from '../../config';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { sanitizeDirectEmailIdentifier } from '../../../common/helpers/mails';
import { CalendarActionTypes } from '../../../common/enums/calendarTypes';
import { isCalendarIntegrationEnabled } from '../../services/externalCalendars/cronofyService';
import { getActionForCalendarSync, getExternalCalendars, addMessage } from '../../helpers/externalCalendarUtils';
import logger from '../../../common/helpers/logger';

export const CALENDAR_ACCOUNT = 'INVALID_CALENDAR_ACCOUNT';
export const CALENDAR_ACCOUNT_OCCURENCE_ERROR = 'CALENDAR_ACCOUNT_ASSIGNED_MORE_THAN_ONCE';
export const DB_CALENDAR_ACCOUNT_OCCURENCE_ERROR = 'CALENDAR_ACCOUNT_ALREADY_IN_DB';
import { revaAdminEmail } from '../../../common/helpers/database';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const EMPLOYEE_REQUIRED_FIELDS = [
  {
    fieldName: 'userUniqueId',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'registrationEmail',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.MAIL],
    maxLength: DBColumnLength.Email,
  },
  {
    fieldName: 'fullName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'preferredName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'employmentType',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC, Validation.EXISTS_IN],
    validValues: DALTypes.EmploymentType,
    maxLength: DBColumnLength.Type,
  },
  {
    fieldName: 'businessTitle',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'calendarAccount',
    validation: [Validation.ALPHANUMERIC, Validation.MAIL],
    maxLength: DBColumnLength.Email,
  },
];

const validateEmployeeCalendarAccount = (user, users, dbUsers) => {
  const userCalendarAccount = sanitizeDirectEmailIdentifier(user.calendarAccount || '');
  if (!userCalendarAccount) return [];

  const dbUser = dbUsers.find(u => u.externalUniqueId === user.userUniqueId);
  const isNewUser = !dbUser;
  const validationErrors = [];

  const allUsersCalendarAccounts = users.map(item => sanitizeDirectEmailIdentifier(item.data.calendarAccount || ''));
  const calendarAccountOccurences = allUsersCalendarAccounts.filter(email => email === userCalendarAccount).length;
  if (calendarAccountOccurences > 1) {
    validationErrors.push({
      name: CALENDAR_ACCOUNT,
      message: CALENDAR_ACCOUNT_OCCURENCE_ERROR,
    });
  }
  if (isNewUser) {
    const dbCalendarAccountOccurences = dbUsers.filter(item => item.externalCalendars.calendarAccount === userCalendarAccount).length;
    if (dbCalendarAccountOccurences) {
      validationErrors.push({
        name: CALENDAR_ACCOUNT,
        message: DB_CALENDAR_ACCOUNT_OCCURENCE_ERROR,
      });
    }
  }

  return validationErrors;
};

const processUserForCalendarSync = async (ctx, importUser, dbUser) => {
  const hasCalendar = dbUser && dbUser.externalCalendars && dbUser.externalCalendars.revaCalendarId;
  const action = getActionForCalendarSync(importUser, dbUser, hasCalendar);

  if (action !== CalendarActionTypes.UPDATE_ACCOUNT) return;
  // for the case when a user has a calendar account in the spreadsheet different than the one that he already has in the database
  // we want to handle the calendar integration here. for removing the account at user deactivation or setting up calendars for the rest of the users,
  // we will do that through the team members import - CPM-15729
  const dbCalendarAccount = dbUser && dbUser.externalCalendars ? dbUser.externalCalendars.calendarAccount : '';
  logger.info(
    {
      ctx,
      userExternalUniqueId: importUser.userUniqueId,
      action,
      oldCalendarAccount: dbCalendarAccount,
      newCalendarAccount: importUser.calendarAccount,
    },
    'processUserForCalendarSync',
  );
  await addMessage(ctx, action, importUser.userUniqueId);
};

const saveEmployee = async (ctx, employee, dbUser) => {
  const user = {
    externalUniqueId: employee.userUniqueId,
    email: employee.registrationEmail.toLowerCase(),
    fullName: employee.fullName,
    preferredName: employee.preferredName,
    employmentType: employee.employmentType,
    metadata: {
      businessTitle: employee.businessTitle,
    },
    externalCalendars: getExternalCalendars(employee.calendarAccount, dbUser),
  };
  if (user.email === revaAdminEmail) {
    user.password = await hash(config.import.users.revaAdminPassword);
  }
  const savedUser = await saveUser(ctx, user);

  !dbUser?.id && (await insertUserStatus(ctx, savedUser.id));

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.NEW_USER_REGISTERED,
    message: {
      ctx: { tenantId: ctx.tenantId }, // slim up the context as the queue processing fails if all the req is passed
      user: savedUser,
    },
    ctx,
  });
};

const customEmployeeValidation = async (user, users, dbUsers) => {
  const validation = [];

  const calendarAccountValidationErrors = validateEmployeeCalendarAccount(user, users, dbUsers);
  if (calendarAccountValidationErrors.length) validation.push(...calendarAccountValidationErrors);
  return validation;
};

export const importEmployees = async (ctx, employees) => {
  logger.time('importEmployees');
  const dbEmployees = await getUsers(ctx);
  const integrationEnabled = await isCalendarIntegrationEnabled(ctx);

  const invalidFields = await validate(
    employees,
    {
      requiredFields: EMPLOYEE_REQUIRED_FIELDS,
      async onValidEntity(employee) {
        const dbUser = dbEmployees.find(e => e.externalUniqueId === employee.userUniqueId);
        await saveEmployee(ctx, employee, dbUser);
        if (integrationEnabled) await processUserForCalendarSync(ctx, employee, dbUser);
      },
      async customCheck(employee) {
        return await customEmployeeValidation(employee, employees, dbEmployees);
      },
    },
    ctx,
    spreadsheet.Employee.columns,
  );
  logger.timeEnd('importEmployees');

  return {
    invalidFields,
  };
};
