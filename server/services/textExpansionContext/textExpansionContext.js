/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import set from 'lodash/set';
import isEmpty from 'lodash/isEmpty';
import { mapSeries, reduce } from 'bluebird';
import { getUserByIdQuery } from '../../dal/usersRepo';
import { getExpansionContext as getExpansionContextDb } from '../../dal/textExpansionContextRepo';
import { getAllScreeningResultsForPartyQuery } from '../../dal/helpers/screening';
import { loadPartyById, getPartyAgentQuery } from '../../dal/partyRepo';
import { getPersonById } from '../../dal/personRepo';
import { getPrimaryPropertyTeamQuery } from '../../dal/teamsRepo';
import { getPartyAppointmentsQuery, getAppointmentByIdQuery } from '../../dal/appointmentRepo';
import { getAppointmentByContextType, getFormattedAppointmentInfo } from '../appointments';
import loggerModule from '../../../common/helpers/logger';
import nullish from '../../../common/helpers/nullish';
import { formatPhoneToDisplay } from '../../../common/helpers/phone/phone-helper';
import { AppointmentContextTypes } from '../../../common/enums/enums';
import { getPropertyTimezone } from '../properties';
import { AppLinkIdUrls } from '../../../common/enums/messageTypes';
import { now } from '../../../common/helpers/moment-utils';
import { sendUrltoShortener } from '../urlShortener';
import config from '../../config';
import * as recipientContext from './recipientContext';
import * as inventoryContext from './inventoryContext';
import * as agentContext from './agentContext';
import * as propertyContext from './propertyContext';
import * as invitingGuestContext from './invitingGuestContext';
import * as partyContext from './partyContext';
import * as registrationContext from './registrationContext';
import * as resetPasswordContext from './resetPasswordContext';
import * as customerContext from './customerContext';
import * as stylesContext from './stylesContext';
import * as quoteContext from './quoteContext';
import * as renewalContext from './renewalContext';
import * as currentLeaseTermContext from './currentLeaseTermContext';
import * as rxpContext from './rxpContext';
import { VIEW_MODEL_TYPES } from './enums';
import { getSmallAvatar, getImageForEmail, init as initCloudinaryHelpers } from '../../../common/helpers/cloudinary';
import { formatEmployeeAssetUrl } from '../../helpers/assets-helper';
import { getTokensToExpandByMainToken, getParsedTokens } from './helpers/tokens';
import { ServiceError } from '../../common/errors';

const logger = loggerModule.child({ subType: 'textExpansionContext' });

const contextQueriesMapping = {
  employee: (ctx, { userId, partyId }) => (userId ? getUserByIdQuery(ctx, userId) : getPartyAgentQuery(ctx, partyId)).toString(),
  property: (...args) => propertyContext.getContextQuery(...args),
  primaryPropertyTeam: (ctx, { primaryPropertyId, teamId }) => getPrimaryPropertyTeamQuery(ctx, primaryPropertyId, teamId).toString(),
  partyAppointments: (ctx, { partyId }) => getPartyAppointmentsQuery(ctx, partyId).toString(),
  quote: (...args) => quoteContext.getContextQuery(...args),
  partyAppointment: (ctx, { appointmentId }) => getAppointmentByIdQuery(ctx, appointmentId).toString(),
  invitingGuest: (...args) => invitingGuestContext.getContextQuery(...args),
  screening: (ctx, { partyId }) => getAllScreeningResultsForPartyQuery(ctx, partyId).toString(),
  recipient: (...args) => recipientContext.getContextQuery(...args),
  inventory: (...args) => inventoryContext.getContextQuery(...args),
  party: (...args) => partyContext.getContextQuery(...args),
  customer: (...args) => customerContext.getContextQuery(...args),
  renewal: (...args) => renewalContext.getContextQuery(...args),
  currentLeaseTerm: (...args) => currentLeaseTermContext.getContextQuery(...args),
  rxp: (...args) => rxpContext.getContextQuery(...args),
};

const viewModelTypesHandlersMapping = {
  [VIEW_MODEL_TYPES.OBJECT]: rowOrRows => (Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows),
  [VIEW_MODEL_TYPES.ARRAY]: rowOrRows => rowOrRows,
};

/**
 * This function maps the template data using the rules defined in the viewModelsMapping object:
 * @param {string} type - The type of view model to map:
 *    OBJECT: The data will be treated as an object
 *    ARRAY: The data will be treated as an array, for example: a list of appointments
 * @param {function} prerequisites - A function that will gather information required by the tokens.
 * @param {object} rowOrRows - The data retrieved from the database, it could be an array or an object.
 * @param {object} tokensMapping - The structure and rules to be considered when building the view model/context object. For example:
 *    {
 *      templateDisplayName: 'displayName',    // templateDisplayName will be the name of the resulting token plus the parent: property.templateDisplayName
 *                                             // displayName is the key name insid the json db result, to get the value
 *      name: (data, extraData) => { logic },  // name will be the name of the resulting token plus the parent: property.name
 *                                             // (data, extraData) => { logic } is the function that will map the json db result
 *                                                The first parameter is the json db result and the second parameter is the required extra data
 *    }
 * @param {object} extraData - The data required to map the json db result, for example: tenantId, personId, etc.
 */
const mapViewModelKeys = async (ctx, { type, prerequisites, rowOrRows, tokensMapping, tokensToExpand, extraData }) => {
  let data = viewModelTypesHandlersMapping[type](rowOrRows);
  data = prerequisites ? prerequisites(data, extraData) : data;
  const parsedTokens = getParsedTokens(tokensToExpand);

  return await reduce(
    Object.keys(tokensMapping),
    async (acc, key) => {
      const parsedTokensForMapping = parsedTokens.filter(pt => pt.token === key);
      if (!parsedTokensForMapping.length) return acc;

      const keyNameOrHandler = get(tokensMapping, key);
      const getValue = typeof keyNameOrHandler === 'function' ? keyNameOrHandler : () => get(data, keyNameOrHandler);

      await mapSeries(parsedTokensForMapping, async parsedToken => {
        const value = await getValue(data, { ...extraData, tokenParams: parsedToken.parameters });
        acc = set(acc, parsedToken.originalToken, value);
      });

      return acc;
    },
    {},
  );
};

/**
 * This object is used to append tokens to the static tokens list when a dynamic component is found in the template
 */
export const dynamicComponentTokens = {
  quote: [
    'quote.applyNowUrl',
    'quote.leaseStartDate',
    'quote.expirationDate',
    'quote.flattenedInventory',
    'quote.flattenedLeaseTerms',
    'quote.paymentSchedule',
    'quote.hideApplicationLink',
    'quote.hideApplicationLink',
    'styles.primaryButtonBackgroundColor',
    'styles.primaryButtonTextColor',
  ],
  renewalQuote: [
    'quote.leaseStartDate',
    'quote.flattenedInventory',
    'quote.flattenedLeaseTerms',
    'quote.inventory.type',
    'quote.inventory.displayName',
    'quote.renewalLeaseFees',
    'party.activeLease',
    'party.inReplyToEmail',
    'primaryPropertyTeam.email.displayFormat',
    'primaryPropertyTeam.phone.displayFormat',
    'primaryPropertyTeam.phone.href',
    'styles.primaryButtonBackgroundColor',
    'styles.primaryButtonTextColor',
  ],
  priceChanges: [],
  avatar: ['employee.fullName', 'employee.avatarImage.imageUrl', 'employee.avatarImage.altText'],
};

/**
 * This object is in charge of the mapping rules for each context object. These are the different available options:
 *   - type: This option allows to define how the db result should be treated, it could be an objects array or a single object
 *   - prerequisites: This option is a function to be executed before the tokens mapping, it receives the db result and it returns the formatted data to the tokens mappers
 *   - tokensMapping: An object to define each mapping rule for the final result, the value can be a handler function or the db result column name
 *   * noDbQuery: This allows to skip the db query and just use static data or make external services calls
 */
const viewModelsMapping = {
  party: {
    type: partyContext.viewModelType,
    prerequisites: partyContext.prerequisites,
    tokensMapping: partyContext.tokensMapping,
  },
  employee: {
    type: VIEW_MODEL_TYPES.OBJECT,
    tokensMapping: {
      fullName: 'fullName',
      preferredName: 'preferredName',
      businessTitle: 'metadata.businessTitle',
      'avatarImage.imageUrl': async ({ id: employeeId, fullName }, { ctx, tokenParams }) => {
        const employeeAssetUrl = await formatEmployeeAssetUrl(ctx, employeeId, { permaLink: true, from: 'template' });

        initCloudinaryHelpers({
          cloudName: config.cloudinaryCloudName,
          tenantName: ctx.tenantName,
          isPublicEnv: config.isPublicEnv,
          isDevelopment: config.isDevelopment,
          domainSuffix: config.domainSuffix,
          reverseProxyUrl: config.reverseProxy.url,
          rpImageToken: config.rpImageToken,
          cloudEnv: config.cloudEnv,
        });

        return tokenParams.length ? getImageForEmail(employeeAssetUrl, tokenParams) : getSmallAvatar(employeeAssetUrl, fullName, 40);
      },
      'avatarImage.altText': 'fullName',
    },
  },
  property: {
    type: propertyContext.viewModelType,
    tokensMapping: propertyContext.tokensMapping,
  },
  primaryPropertyTeam: {
    type: VIEW_MODEL_TYPES.OBJECT,
    tokensMapping: {
      'phone.displayFormat': ({ displayPhoneNumber }) => formatPhoneToDisplay(displayPhoneNumber),
      'phone.href': ({ displayPhoneNumber }) => `tel:${displayPhoneNumber}`,
      'email.displayFormat': 'displayEmail',
    },
  },
  partyAppointments: {
    type: VIEW_MODEL_TYPES.ARRAY,
    prerequisites: (appointments, { ctx }) => ({
      mostRecent: getAppointmentByContextType(ctx, appointments, { contextType: AppointmentContextTypes.MOST_RECENT }),
      upcoming: getAppointmentByContextType(ctx, appointments, { contextType: AppointmentContextTypes.UPCOMING }),
    }),
    tokensMapping: {
      'mostRecent.date': ({ mostRecent }) => mostRecent.date,
      'mostRecent.time': ({ mostRecent }) => mostRecent.time,
      'mostRecent.showAgent.preferredName': ({ mostRecent: { showAgent } }) => showAgent.preferredName,
      'mostRecent.showAgent.fullName': ({ mostRecent: { showAgent } }) => showAgent.fullName,
      'mostRecent.showAgent.businessTitle': ({ mostRecent: { showAgent } }) => showAgent.businessTitle,
      'mostRecent.address': ({ mostRecent }) => mostRecent.address,
      'upcoming.date': ({ upcoming }) => upcoming.date,
      'upcoming.time': ({ upcoming }) => upcoming.time,
      'upcoming.showAgent.preferredName': ({ upcoming: { showAgent } }) => showAgent.preferredName,
      'upcoming.showAgent.fullName': ({ upcoming: { showAgent } }) => showAgent.fullName,
      'upcoming.showAgent.businessTitle': ({ upcoming: { showAgent } }) => showAgent.businessTitle,
      'upcoming.address': ({ upcoming }) => upcoming.address,
    },
  },
  partyAppointment: {
    type: VIEW_MODEL_TYPES.OBJECT,
    prerequisites: (appointment, { ctx }) => getFormattedAppointmentInfo(ctx, appointment, { timezone: appointment.propertyTimeZone }),
    tokensMapping: {
      date: ({ date }) => date,
      time: ({ time }) => time,
      'showAgent.preferredName': ({ showAgent }) => showAgent.preferredName,
      'showAgent.fullName': ({ showAgent }) => showAgent.fullName,
      'showAgent.businessTitle': ({ showAgent }) => showAgent.businessTitle,
      address: ({ address }) => address,
      editAppointmentUrl: async ({ ctx, editAppointmentUrl }) => await sendUrltoShortener(ctx, [editAppointmentUrl]),
      cancelAppointmentUrl: async ({ ctx, cancelAppointmentUrl }) => await sendUrltoShortener(ctx, [cancelAppointmentUrl]),
      'property.displayName': ({ property }) => property.displayName,
      'property.leasingOfficeAddress': ({ property }) => property.leasingOfficeAddress,
    },
  },
  invitingGuest: {
    type: invitingGuestContext.viewModelType,
    tokensMapping: invitingGuestContext.tokensMapping,
  },
  reva: {
    type: VIEW_MODEL_TYPES.OBJECT,
    tokensMapping: {
      reva: {
        termsUrl: AppLinkIdUrls.TERMS_AND_CONDITIONS_ID,
        privacyUrl: AppLinkIdUrls.PRIVACY_POLICY_ID,
      },
    },
    noDbQuery: true,
  },
  quote: {
    type: quoteContext.viewModelType,
    prerequisites: quoteContext.prerequisites,
    tokensMapping: quoteContext.tokensMapping,
  },
  renewal: {
    type: renewalContext.viewModelType,
    prerequisites: renewalContext.prerequisites,
    tokensMapping: renewalContext.tokensMapping,
  },
  currentLeaseTerm: {
    type: currentLeaseTermContext.viewModelType,
    prerequisites: currentLeaseTermContext.prerequisites,
    tokensMapping: currentLeaseTermContext.tokensMapping,
  },
  recipient: {
    type: recipientContext.viewModelType,
    tokensMapping: recipientContext.tokensMapping,
  },
  rxp: {
    type: rxpContext.viewModelType,
    tokensMapping: rxpContext.tokensMapping,
  },
  inventory: {
    type: inventoryContext.viewModelType,
    tokensMapping: inventoryContext.tokensMapping,
  },
  agent: {
    type: agentContext.viewModelType,
    tokensMapping: agentContext.tokensMapping,
    noDbQuery: agentContext.noDbQuery,
  },
  registration: {
    type: registrationContext.viewModelType,
    tokensMapping: registrationContext.tokensMapping,
    noDbQuery: registrationContext.noDbQuery,
  },
  resetPassword: {
    type: resetPasswordContext.viewModelType,
    tokensMapping: resetPasswordContext.tokensMapping,
    noDbQuery: resetPasswordContext.noDbQuery,
  },
  customer: {
    type: customerContext.viewModelType,
    tokensMapping: customerContext.tokensMapping,
  },
  currentYear: {
    type: VIEW_MODEL_TYPES.OBJECT,
    tokensMapping: {
      currentYear: ({ timezone }) => now({ timezone }).format('YYYY'),
    },
    noDbQuery: true,
  },
  screening: {
    type: VIEW_MODEL_TYPES.OBJECT,
    tokensMapping: {
      transactionNumber: 'transactionNumber',
    },
  },
  styles: {
    type: stylesContext.viewModelType,
    tokensMapping: stylesContext.tokensMapping,
    noDbQuery: true,
  },
};

const createMainPartyContext = async (ctx, partyId) => {
  if (!partyId) throw new ServiceError({ token: 'PARTY_ID_NOT_DEFINED', status: 412 });

  const party = await loadPartyById(ctx, partyId);
  if (!party) logger.error({ ctx, partyId }, 'Party not found');

  return { party };
};

const getTokenValue = async (token, { tokensMapping, templateArguments }) => {
  const valueOrHandler = get(tokensMapping, token);
  // TODO: this should handle the error cases gracefully
  return typeof valueOrHandler === 'function' ? await valueOrHandler(templateArguments) : valueOrHandler;
};

const getExpansionContextQueries = async (ctx, { tokensToExpand, partyId, primaryPropertyId, userId, teamId, timezone, templateArgs }) =>
  await reduce(
    tokensToExpand,
    async (acc, token) => {
      const mainToken = token.split('.')[0];
      const { noDbQuery, tokensMapping } = viewModelsMapping[mainToken] || {};

      const templateArguments = { partyId, userId, teamId, timezone, primaryPropertyId, ...templateArgs };
      if (!noDbQuery) {
        if (acc.missingContextQueries[mainToken]) return acc;

        const queryGetter = contextQueriesMapping[mainToken];
        if (!queryGetter) {
          logger.error({ ctx, partyId, token: mainToken }, 'Query not specified for main token');
          return acc;
        }

        acc.missingContextQueries[mainToken] = queryGetter(ctx, templateArguments);
      } else {
        const [parsedToken] = getParsedTokens([token]);
        const tokenValue = await getTokenValue(parsedToken.token, {
          tokensMapping,
          templateArguments: { ctx, ...templateArguments, tokenParams: parsedToken.parameters },
        });

        if (nullish(tokenValue)) {
          logger.error({ ctx, partyId, token }, 'Token does not exist in the context');
          return acc;
        }
        acc.expansionContext = set(acc.expansionContext, parsedToken.originalToken, tokenValue);
      }

      return acc;
    },
    {
      expansionContext: {},
      missingContextQueries: {},
    },
  );

const getExpansionContextFromDb = async (ctx, { missingContextQueries, tokensToExpand, partyId, timezone, templateArgs }) => {
  const [expansionContextFromDb] = await getExpansionContextDb(ctx, missingContextQueries);
  const expansionContext = {};

  await mapSeries(Object.keys(missingContextQueries), async mainToken => {
    const rows = expansionContextFromDb[mainToken.toLowerCase()];

    if (!rows || !rows.length) {
      logger.error({ ctx, partyId, mainToken }, 'There are not db results for that main token');
      return;
    }

    const viewModelMapping = viewModelsMapping[mainToken];
    if (!viewModelMapping) {
      logger.error({ ctx, partyId, mainToken }, 'View model mapping not specified for main token');
      set(expansionContext, mainToken, rows);
    }

    const { type, tokensMapping, prerequisites } = viewModelMapping;

    const viewModel = await mapViewModelKeys(ctx, {
      type,
      prerequisites,
      rowOrRows: rows,
      tokensMapping,
      tokensToExpand: [...getTokensToExpandByMainToken(tokensToExpand, mainToken)],
      extraData: { timezone, ctx, partyId, ...templateArgs },
    });

    set(expansionContext, mainToken, viewModel);
    return;
  });

  return expansionContext;
};

/**
 * This function builds the template data given the following arguments:
 * @param {string} partyId - The id of the party in which the template data will be based.
 * @param {array} tokensToExpand - The list of token to replace inside the template.
 * @param {object} templateArguments - The required arguments to build the template data.
 */
export const getTextExpansionContext = async (ctx, partyId, tokensToExpand, templateArguments = {}) => {
  const { quoteId } = templateArguments;
  logger.info({ ctx, partyId, tokensToExpand, tempArgs: { ...templateArguments, quoteId: JSON.stringify(quoteId) } }, 'getTextExpansionContext');
  let textExpansionContext;
  let expansionContext;
  let dbExpansionContext;

  try {
    const mainPartyContext = await createMainPartyContext(ctx, partyId);
    if (!mainPartyContext.party) return {};

    const { assignedPropertyId: primaryPropertyId } = mainPartyContext.party;

    const { sender, authUser = { teams: [] } } = ctx;
    const user = sender || authUser;
    const { party } = mainPartyContext;
    const senderTeams = (user.teams && user.teams.filter(team => party.teams.includes(team.id))) || [];
    const senderTeamId = (senderTeams[0] || {}).id;
    const teamId = senderTeamId || party.ownerTeam;

    const { personId, propertyId: templatePropertyId } = templateArguments;
    let templateArgs = personId ? { person: await getPersonById(ctx, personId), ...templateArguments } : templateArguments;
    const propertyId = templatePropertyId || primaryPropertyId;
    templateArgs = { ...templateArgs, propertyId };

    const timezone = await getPropertyTimezone(ctx, propertyId);

    const { expansionContext: expansionContextQuery, missingContextQueries } = await getExpansionContextQueries(ctx, {
      tokensToExpand,
      partyId,
      primaryPropertyId,
      userId: user.id,
      teamId,
      timezone,
      templateArgs,
    });
    expansionContext = expansionContextQuery;
    dbExpansionContext = !isEmpty(missingContextQueries)
      ? await getExpansionContextFromDb(ctx, { missingContextQueries, tokensToExpand, partyId, timezone, templateArgs })
      : {};

    textExpansionContext = { ...expansionContext, ...dbExpansionContext };
    logger.info({ ctx, partyId }, 'getTextExpansionContext finished');
  } catch (error) {
    textExpansionContext = { ...expansionContext, ...dbExpansionContext };
    logger.error({ ctx, partyId, error, textExpansionContextResult: textExpansionContext }, 'getTextExpansionContext error');
    throw new Error(`Unable to get text expansion context, error ${error}`);
  }
  return textExpansionContext;
};

export const getCommonTextExpansionContext = async (ctx, tokensToExpand, templateArguments = {}) => {
  logger.info({ ctx, tokensToExpand, templateArguments }, 'getCommonTextExpansionContext');

  const { expansionContext, missingContextQueries } = await getExpansionContextQueries(ctx, {
    tokensToExpand,
    templateArgs: templateArguments,
  });

  const dbExpansionContext = !isEmpty(missingContextQueries)
    ? await getExpansionContextFromDb(ctx, { missingContextQueries, tokensToExpand, templateArgs: templateArguments })
    : {};

  const textExpansionContext = { ...expansionContext, ...dbExpansionContext };
  logger.info({ ctx, textExpansionContext }, 'getCommonTextExpansionContext result');
  return textExpansionContext;
};
