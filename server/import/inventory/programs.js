/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import isEqual from 'lodash/isEqual';
import orderBy from 'lodash/orderBy';
import { mapSeries } from 'bluebird';
import { getTeamsFromTenant } from '../../dal/teamsRepo';
import { getSources } from '../../dal/sourcesRepo';
import { saveProgram, loadPrograms } from '../../dal/programsRepo';
import { getCampaigns } from '../../dal/campaignsRepo';
import { getAllVoiceMessages } from '../../dal/voiceMessageRepo';
import { getProperties } from '../../dal/propertyRepo';
import { validate, Validation, tryParseAsDate } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getValidationMessagesForPlaceholders, getPhoneRankForRow } from './phoneUtils';
import { getTenantReservedPhoneNumbers } from '../../dal/tenantsRepo';
import { isPhoneAreaPreferencesPlaceHolder, getPhoneNumber } from '../../helpers/phoneUtils';
import { formatProgramForSave, formatDbEndDate } from '../../helpers/importUtils';
import { sanitizeDirectEmailIdentifier } from '../../../common/helpers/mails';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { replaceEmptySpaces } from '../../../common/helpers/utils';
import { isInactiveProgram } from '../../../common/helpers/programs.js';
import { PhoneOwnerType } from '../../../common/enums/enums';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { isValidPhoneNumber } from '../../../common/helpers/phone/phone-helper';
import loggerModule from '../../../common/helpers/logger';
import { extractValuesFromCommaSeparatedString } from '../../../common/helpers/strings';

const logger = loggerModule.child({ subType: 'phoneUtils' });

export const PROGRAM_FALLBACK_NONE = 'NONE';

export const TEAM = 'team';
export const INVALID_TEAM = 'INVALID_TEAM_SPECIFIED_FOR_PROGRAM';
export const PROPERTY = 'primaryProperty';
export const INVALID_PROPERTY = 'INVALID_PRIMARY_PROPERTY_SPECIFIED_FOR_PROGRAM';
export const ON_SITE_LEASING_TEAM = 'onSiteLeasingTeam';
export const INVALID_ON_SITE_LEASING_TEAM = 'INVALID_ON_SITE_LEASING_TEAM';
export const INACTIVE_TEAM_ERROR = 'Cannot assign inactive team to active program';
export const SOURCE = 'source';
export const CAMPAIGN = 'campaign';
export const INVALID_SOURCE = 'INVALID_SOURCE_SPECIFIED_FOR_PROGRAM';
export const INVALID_DEFAULT_MATCHINIG_SOURCE = 'INVALID_DEFAULT_MATCHING_SOURCE_SPECIFIED_FOR_PROGRAM';
export const INVALID_END_DATE = 'INVALID_END_DATE';
export const REACTIVATED_PROGRAM = 'REACTIVATED_PROGRAM';
export const DEFAULT_SOURCE = 'defaultMatchingSource';
export const INVALID_CAMPAIGN = 'INVALID_CAMPAIGN_SPECIFIED_FOR_PROGRAM';
export const DIRECT_PHONE_IDENTIFIER = 'INVALID_DIRECT_PHONE_IDENTIFIER';
export const PHONE_NUMBER_OCCURRENCE_ERROR = 'PHONE_NUMBER_ASSIGNED_MORE_THAN_ONCE';
export const PHONE_NUMBER_CHANGE_ERROR = 'PHONE_NUMBER_CANNOT_BE_CHANGED';
export const DB_PHONE_NUMBER_OCCURRENCE_ERROR = 'PHONE_NUMBER_ALREADY_IN_DB';
export const DIRECT_EMAIL_IDENTIFIER = 'INVALID_DIRECT_EMAIL_IDENTIFIER';
export const EMAIL_ADDRESS_OCCURENCE_ERROR = 'EMAIL_ADDRESS_ASSIGNED_MORE_THAN_ONCE';
export const DB_EMAIL_ADDRESS_OCCURRENCE_ERROR = 'EMAIL_ADDRESS_ALREADY_IN_DB';
export const EMAIL_OR_PHONE_NOT_PRESENT = 'EMAIL_OR_PHONE_NOT_PRESENT';
export const PROGRAM_NAME = 'name';
export const PROGRAM_NAME_ALREADY_IN_USE = 'Program name already in use';
export const VOICE_MESSAGE = 'Voice Message';
export const INVALID_VOICE_MESSAGE = 'Invalid voice message';
export const REQUIRED_MATCHING_PATH = 'REQUIRED_MATCHING_PATH_FLAG_OR_DEFAULT';
export const REQUIRED_MATCHING_SOURCE = 'REQUIRED_MATCHING_SOURCE_FLAG_OR_DEFAULT';
export const REQUIRE_MATCHING_PATH = 'requireMatchingPathFlag';
export const REQUIRE_MATCHING_SOURCE = 'requireMatchingSourceFlag';
export const DEFAULT_PATH = 'defaultMatchingPath';
export const DEFAULT_PATH_ERROR = 'PATH_SAME_AS_DEFAULT_MATCH_PATH';
export const DEFAULT_SOURCE_ERROR = 'SOURCE_SAME_AS_DEFAULT_MATCH_SOURCE';
export const END_DATE = 'endDate';
export const REQUIRED_FORWARDING_EMAIL = 'REQUIRED_EXTERNAL_TARGET_FOR_EMAILS';
export const REQUIRED_FORWARDING_PHONE = 'REQUIRED_EXTERNAL_TARGET_FOR_CALLS';
export const REQUIRED_FORWARDING_SMS = 'REQUIRED_EXTERNAL_TARGET_FOR_SMS';
export const REQUIRE_FORWARDING_EMAIL = 'forwardEmailToExternalTarget';
export const REQUIRE_FORWARDING_PHONE = 'forwardCallToExternalTarget';
export const REQUIRE_FORWARDING_SMS = 'forwardSMSToExternalTarget';
export const FORWARDING_ENABLED = 'forwardingEnabled';
export const INVALID_FORWARDING_SMS_FIELD = 'EXTERNAL_TARGET_FOR_SMS_NOT_PHONE_OR_EMAIL';
export const INVALID_FIELD = 'INVALID_FIELD';
export const PROGRAM_FALLBACK = 'programFallback';
const SELECTED_PROPERTIES = 'selectedProperties';
const INVALID_SELECTED_PROPERTIES = 'INVALID_SELECTED_PROPERTIES_SPECIFIED_FOR_PROGRAM';

const sourceRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'reportingDisplayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'path',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    filedName: 'campaign',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'onSiteLeasingTeam',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'primaryProperty',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'source',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'directEmailIdentifier',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'outsideDedicatedEmails',
    validation: [Validation.MAIL_ARRAY],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'displayEmail',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'directPhoneIdentifier',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'displayPhoneNumber',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'displayUrl',
    validation: [Validation.ALPHANUMERIC, Validation.URL],
    maxLength: DBColumnLength.WebSite,
  },
  {
    fieldName: 'voiceMessage',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'reportingDisplayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'path',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'requireMatchingPathFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'defaultMatchingPath',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'requireMatchingSourceFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'defaultMatchingSource',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'forwardingEnabledFlag',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'forwardEmailToExternalTarget',
    validation: [Validation.MAIL_ARRAY],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'forwardCallToExternalTarget',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Phone,
  },
  {
    fieldName: 'forwardSMSToExternalTarget',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'enableBotResponseOnCommunications',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'activatePaymentPlan',
    validation: [Validation.BOOLEAN],
  },
  {
    fieldName: 'programFallback',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'selectedProperties',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
];

const formatDbProgramForImportComparison = dbProgram => (dbProgram.endDate ? { ...dbProgram, endDate: formatDbEndDate(dbProgram.endDate) } : dbProgram);

const isProgramUpdated = (programData, dbProgramData = {}) => {
  const formatedDbProgram = formatDbProgramForImportComparison(dbProgramData);
  return Object.keys(programData).every(key => isEqual(programData[key], formatedDbProgram[key]));
};

const isDuplicateDirectPhoneIdentifier = ({ programPhoneNumber, directPhoneIdentifier, programs }) => {
  const isDirectPhoneNotPlaceHolder = directPhoneIdentifier && !isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(directPhoneIdentifier.toString()));

  if (isDirectPhoneNotPlaceHolder) {
    const phoneNoOccurrences = programs.filter(p => p.programDirectPhoneIdentifier === programPhoneNumber).length;
    return phoneNoOccurrences > 1;
  }
  return false;
};

const isDuplicatePhoneFromUpdateOrNewProgram = (programPhoneNumber, program, dbPrograms) => {
  const dbProgram = program.dbProgram;
  const isNewProgram = !dbProgram;

  const hasChangedPhoneNumber = dbProgram && !isEqual(programPhoneNumber, dbProgram.directPhoneIdentifier);

  const isNewProgramOrHasChangedPhone = isNewProgram || hasChangedPhoneNumber;

  if (isNewProgramOrHasChangedPhone) {
    const dbPhoneNoOccurrences = dbPrograms.filter(item => item.directPhoneIdentifier === programPhoneNumber).length;
    return !!dbPhoneNoOccurrences;
  }
  return false;
};

const isChangedPhone = (program, phoneNumber) => {
  const dbProgram = program.dbProgram;
  const isNewProgram = !dbProgram;
  return !isNewProgram && dbProgram.directPhoneIdentifier && dbProgram.directPhoneIdentifier !== phoneNumber;
};

const validateDirectPhoneIdentifier = async (ctx, program, programs, dbPrograms) => {
  const { directPhoneIdentifier, programDirectPhoneIdentifier } = program;
  const validationErrors = [];

  if (isChangedPhone(program, programDirectPhoneIdentifier)) {
    validationErrors.push({
      name: DIRECT_PHONE_IDENTIFIER,
      message: PHONE_NUMBER_CHANGE_ERROR,
    });
  }

  if (directPhoneIdentifier) {
    const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);
    const dbProgram = program.dbProgram;
    const validationError = getValidationMessagesForPlaceholders({
      tenantReservedPhoneNumbers,
      excelPhoneNumber: directPhoneIdentifier.toString(),
      determinedNumber: programDirectPhoneIdentifier,
      ownerType: PhoneOwnerType.PROGRAM,
      ownerId: dbProgram?.id,
    });

    if (validationError) {
      validationErrors.push({
        name: DIRECT_PHONE_IDENTIFIER,
        message: validationError,
      });
    }

    if (isDuplicateDirectPhoneIdentifier({ programPhoneNumber: programDirectPhoneIdentifier, directPhoneIdentifier, programs })) {
      validationErrors.push({
        name: DIRECT_PHONE_IDENTIFIER,
        message: PHONE_NUMBER_OCCURRENCE_ERROR,
      });
    }

    if (isDuplicatePhoneFromUpdateOrNewProgram(programDirectPhoneIdentifier, program, dbPrograms)) {
      validationErrors.push({
        name: DIRECT_PHONE_IDENTIFIER,
        message: DB_PHONE_NUMBER_OCCURRENCE_ERROR,
      });
    }
  }

  return validationErrors;
};

const validateDirectEmailIdentifier = (program, programs, dbPrograms) => {
  const dbProgram = program.dbProgram;
  const isNewProgram = !dbProgram;

  const validationErrors = [];

  const programEmail = sanitizeDirectEmailIdentifier(program.directEmailIdentifier || '');

  if (programEmail) {
    const allDirectEmailIdentifiers = programs.map(item => sanitizeDirectEmailIdentifier(item.data.directEmailIdentifier || ''));
    const emailAddressOccurences = allDirectEmailIdentifiers.filter(email => email === programEmail).length;
    if (emailAddressOccurences > 1) {
      validationErrors.push({
        name: DIRECT_EMAIL_IDENTIFIER,
        message: EMAIL_ADDRESS_OCCURENCE_ERROR,
      });
    }
    if (isNewProgram) {
      const dbEmailAddressOccurences = dbPrograms.filter(item => item.directEmailIdentifier === programEmail).length;
      if (dbEmailAddressOccurences) {
        validationErrors.push({
          name: DIRECT_EMAIL_IDENTIFIER,
          message: DB_EMAIL_ADDRESS_OCCURRENCE_ERROR,
        });
      }
    }
  }

  return validationErrors;
};

const programConstraints = ['team', 'primaryProperty', 'source'];
const getAlteredFields = (program, dbProgram) => programConstraints.filter(key => !isEqual(program[key].trim(), dbProgram[key]));

const isUpdateOnProgram = (programData, dbprogramData) => {
  if (!dbprogramData) return { isAlteredProgram: false, alteredFields: [] };

  const isAlteredConstraints = programConstraints.some(key => !isEqual(programData[key].trim(), dbprogramData[key]));
  const alteredFields = isAlteredConstraints ? getAlteredFields(programData, dbprogramData) : [];

  return { isAlteredConstraints, alteredFields };
};

const hasEmailOrPhone = program => program.directEmailIdentifier || program.programDirectPhoneIdentifier;

const getPhoneAndEmailValidationErrors = async (ctx, program, programs, dbPrograms, formattedProgram) => {
  const errors = [];

  if (!hasEmailOrPhone(formattedProgram)) {
    errors.push({
      name: DIRECT_PHONE_IDENTIFIER,
      message: EMAIL_OR_PHONE_NOT_PRESENT,
    });
  }

  const phoneNumberValidationErrors = await validateDirectPhoneIdentifier(ctx, program, programs, dbPrograms);
  if (phoneNumberValidationErrors.length) errors.push(...phoneNumberValidationErrors);

  const emailValidationErrors = validateDirectEmailIdentifier(program, programs, dbPrograms);
  if (emailValidationErrors.length) errors.push(...emailValidationErrors);

  return errors;
};

const getEndDateValidationErrors = program => {
  const errors = [];
  const { endDate, dbProgram } = program;

  if (!endDate && dbProgram?.endDate) {
    errors.push({
      name: END_DATE,
      message: REACTIVATED_PROGRAM,
    });
  }

  const isValidEndDate = !!endDate && tryParseAsDate(endDate);

  if (endDate && !isValidEndDate) {
    errors.push({
      name: END_DATE,
      message: INVALID_END_DATE,
    });
  }

  return errors;
};

const getMatchConfigValidationErrors = async program => {
  const errors = [];

  if (!program.requireMatchingPathFlag && !program.defaultMatchingPath) {
    errors.push({
      name: REQUIRE_MATCHING_PATH,
      message: REQUIRED_MATCHING_PATH,
    });
  }

  if (!program.requireMatchingSourceFlag && !program.defaultMatchingSource) {
    errors.push({
      name: REQUIRE_MATCHING_SOURCE,
      message: REQUIRED_MATCHING_SOURCE,
    });
  }

  if (program.defaultMatchingSource && program.source === program.defaultMatchingSource) {
    errors.push({
      name: DEFAULT_SOURCE,
      message: DEFAULT_SOURCE_ERROR,
    });
  }

  if (program.defaultMatchingPath && program.path === program.defaultMatchingPath) {
    errors.push({
      name: DEFAULT_PATH,
      message: DEFAULT_PATH_ERROR,
    });
  }

  if (program.defaultMatchingSource && !program.defaultMatchingSourceId) {
    errors.push({
      name: DEFAULT_SOURCE,
      message: INVALID_DEFAULT_MATCHINIG_SOURCE,
    });
  }

  return errors;
};

const getForwardingValidationErrors = program => {
  const errors = [];
  const {
    metadata: { commsForwardingData },
  } = program;

  if (commsForwardingData.forwardingEnabled) {
    const { forwardCallToExternalTarget, forwardEmailToExternalTarget, forwardSMSToExternalTarget } = commsForwardingData;
    !forwardEmailToExternalTarget?.length &&
      errors.push({
        name: REQUIRE_FORWARDING_EMAIL,
        message: REQUIRED_FORWARDING_EMAIL,
      });

    !forwardCallToExternalTarget &&
      errors.push({
        name: REQUIRE_FORWARDING_PHONE,
        message: REQUIRED_FORWARDING_PHONE,
      });

    !forwardSMSToExternalTarget?.length &&
      errors.push({
        name: REQUIRE_FORWARDING_SMS,
        message: REQUIRED_FORWARDING_SMS,
      });

    if (!isValidPhoneNumber(forwardCallToExternalTarget)) {
      errors.push({
        name: REQUIRE_FORWARDING_PHONE,
        message: INVALID_FIELD,
      });
    }

    const invalidForwardSMSToExternalTargetEmails =
      (forwardSMSToExternalTarget || []).length > 1 ? forwardSMSToExternalTarget.filter(val => !isEmailValid(val)) : [];
    const invalidForwardSMSToExternalTarget =
      (forwardSMSToExternalTarget.length || []) === 1 && !isValidPhoneNumber(forwardSMSToExternalTarget[0]) && !isEmailValid(forwardSMSToExternalTarget[0]);

    if (invalidForwardSMSToExternalTargetEmails.length) {
      errors.push({
        name: REQUIRE_FORWARDING_SMS,
        message: `${program.name}-${INVALID_FIELD}-The following values are not valid email addresses: ${invalidForwardSMSToExternalTargetEmails.join(', ')}`,
      });
    }

    if (invalidForwardSMSToExternalTarget) {
      errors.push({
        name: REQUIRE_FORWARDING_SMS,
        message: `${program.name}-${INVALID_FIELD}-The value provided is not a valid phone number or email address: ${forwardSMSToExternalTarget[0]}`,
      });
    }
  }

  return errors;
};

const getTeamValidationErrors = (program, isInactiveProgramProcessing) => {
  const errors = [];

  if (!program.teamId) {
    errors.push({
      name: TEAM,
      message: INVALID_TEAM,
    });
  }

  if (!program.onSiteLeasingTeamId) {
    errors.push({
      name: ON_SITE_LEASING_TEAM,
      message: INVALID_ON_SITE_LEASING_TEAM,
    });
  }
  if (isInactiveProgramProcessing || isInactiveProgram(program.endDate)) {
    logger.info({ endDate: program.endDate, isInactiveProgramProcessing, errors }, 'imported invalid program');
    return errors;
  }

  if (program.teamEndDate) {
    errors.push({
      name: TEAM,
      message: INACTIVE_TEAM_ERROR,
    });
  }

  if (program.onSiteLeasingTeamEndDate) {
    errors.push({
      name: ON_SITE_LEASING_TEAM,
      message: INACTIVE_TEAM_ERROR,
    });
  }

  if (errors.length) {
    logger.info({ program, errors }, 'imported invalid program');
  }

  return errors;
};

const programsFallbackValidations = program => {
  const errors = [];

  if (program.endDate && !program.programFallback) {
    errors.push({
      name: PROGRAM_FALLBACK,
      message: `Deactivated program ${program.name} needs to fallback to another active program or to ${PROGRAM_FALLBACK_NONE}`,
    });
  }

  if (program.programFallback && !program.programFallbackId && program.programFallback !== PROGRAM_FALLBACK_NONE) {
    errors.push({
      name: PROGRAM_FALLBACK,
      message: `Deactivated program ${program.name} has invalid program fallback ${program.programFallback}`,
    });
  }

  return errors;
};

const customProgramsValidations = async ({ ctx, program, programs, dbPrograms, isInactiveProgramProcessing }) => {
  const validation = [];

  const formattedProgram = {
    ...program,
    ...formatProgramForSave(program, {
      programDirectPhoneNumber: program.directPhoneIdentifier,
      programDisplayPhoneNumber: program.displayPhoneNumber,
    }),
  };

  const dbProgram = program.dbProgram;
  const { isAlteredConstraints, alteredFields } = isUpdateOnProgram(formattedProgram, dbProgram);

  if (isAlteredConstraints) {
    validation.push({
      name: PROGRAM_NAME,
      message: `${program.name} - ${PROGRAM_NAME_ALREADY_IN_USE}. Is not possible to update: ${alteredFields.join(', ')}`,
    });
  }

  if (program.invalidSelectedPropertiesNames.length) {
    validation.push({
      name: SELECTED_PROPERTIES,
      message: `${
        program.name
      } - ${INVALID_SELECTED_PROPERTIES}. The following names do not match an existing property: ${program.invalidSelectedPropertiesNames.join(', ')}`,
    });
  }

  if (!program.propertyId) {
    validation.push({
      name: PROPERTY,
      message: INVALID_PROPERTY,
    });
  }

  if (!program.sourceId) {
    validation.push({
      name: SOURCE,
      message: INVALID_SOURCE,
    });
  }

  if (program.campaign && !program.campaignId) {
    validation.push({
      name: CAMPAIGN,
      message: INVALID_CAMPAIGN,
    });
  }

  if (program.voiceMessage && !program.voiceMessageId) {
    validation.push({
      name: VOICE_MESSAGE,
      message: INVALID_VOICE_MESSAGE,
    });
  }

  const teamValidationErrors = getTeamValidationErrors(program, isInactiveProgramProcessing);
  if (teamValidationErrors.length) validation.push(...teamValidationErrors);

  if (!isInactiveProgramProcessing) {
    const phoneAndEmailValidationErrors = await getPhoneAndEmailValidationErrors(ctx, program, programs, dbPrograms, formattedProgram);
    if (phoneAndEmailValidationErrors.length) validation.push(...phoneAndEmailValidationErrors);
  }

  const endDateValidationErrors = getEndDateValidationErrors(program);
  if (endDateValidationErrors.length) validation.push(...endDateValidationErrors);

  const matchConfigValidationErrors = await getMatchConfigValidationErrors(formattedProgram);
  if (matchConfigValidationErrors.length) validation.push(...matchConfigValidationErrors);

  const forwardingValidationErrors = getForwardingValidationErrors(formattedProgram);
  if (forwardingValidationErrors) validation.push(...forwardingValidationErrors);

  const programFallbackValidations = programsFallbackValidations(formattedProgram);
  if (programFallbackValidations) validation.push(...programFallbackValidations);
  return validation;
};

const getDirectPhoneIdentifier = async (ctx, { directPhoneIdentifier, tenantReservedPhoneNumbers, dbProgram }) => {
  if (dbProgram && dbProgram.directPhoneIdentifier && isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(directPhoneIdentifier.toString()))) {
    return dbProgram.directPhoneIdentifier;
  }
  return await getPhoneNumber({
    ctx,
    tenantReservedPhoneNumbers,
    excelPhoneNumber: directPhoneIdentifier,
    ownerType: PhoneOwnerType.PROGRAM,
    ownerId: dbProgram?.id,
  });
};

const getDisplayPhoneNumber = async (
  ctx,
  { directPhoneIdentifier, displayPhoneNumber, tenantReservedPhoneNumbers, programDirectPhoneIdentifier, dbProgram },
) => {
  if (isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(directPhoneIdentifier.toString())) || displayPhoneNumber === directPhoneIdentifier) {
    return programDirectPhoneIdentifier;
  }
  return await getPhoneNumber({
    ctx,
    tenantReservedPhoneNumbers,
    excelPhoneNumber: displayPhoneNumber,
    ownerType: PhoneOwnerType.PROGRAM,
    ownerId: dbProgram?.id,
    isDisplayOnly: true,
  });
};

const getDbItemByName = (dbEntities, name) => dbEntities.find(e => e.name.toLowerCase() === name.toLowerCase());

const determineDataForForeignKeys = ({ programData, dbPrograms, dbSources, dbTeams, dbCampaigns, dbProperties, dbVoiceMessages, allDbPrograms }) => {
  const dbProgram = dbPrograms.find(p => p.name === programData.name);
  const team = getDbItemByName(dbTeams, programData.team) || {};
  const onSiteLeasingTeam = getDbItemByName(dbTeams, programData.onSiteLeasingTeam) || {};
  const source = getDbItemByName(dbSources, programData.source) || {};
  const dbVoiceMessage = getDbItemByName(dbVoiceMessages, programData.voiceMessage) || {};
  const campaign = (programData.campaign && getDbItemByName(dbCampaigns, programData.campaign)) || {};
  const defaultMatchSource = (programData.defaultMatchingSource && getDbItemByName(dbSources, programData.defaultMatchingSource)) || {};
  const property = getDbItemByName(dbProperties, programData.primaryProperty);

  let fallbackProgram = {};
  // if we just add the fallback program we want it to be active. in case it was a previously added one, there
  // is always a chance that one will also become inactive at some point so we leave it as is.
  // In case we are trying to add an inactive one now, we throw an error in validations

  if (programData.endDate && programData.programFallback) {
    fallbackProgram = getDbItemByName(allDbPrograms, programData.programFallback) || {};
    if (fallbackProgram.endDate && dbProgram?.programFallbackId !== fallbackProgram.id) {
      fallbackProgram = {};
    }
  }

  return { dbProgram, team, onSiteLeasingTeam, source, dbVoiceMessage, campaign, defaultMatchSource, property, fallbackProgram };
};

const getSelectedProperties = (dbProgram, properties, dbProperties) => {
  if (!properties?.length) return { selectedPropertyIds: [], invalidSelectedPropertiesNames: [] };

  const selectedPropertiesNames = extractValuesFromCommaSeparatedString(properties);
  const invalidSelectedPropertiesNames = selectedPropertiesNames.filter(name => !dbProperties.find(prop => prop.name === name));
  const selectedPropertyIds = dbProperties.filter(prop => selectedPropertiesNames.find(p => prop.name === p)).map(prop => prop.id);

  if (invalidSelectedPropertiesNames.length) return { selectedPropertyIds: dbProgram?.selectedProperties || [], invalidSelectedPropertiesNames };

  return { selectedPropertyIds, invalidSelectedPropertiesNames: [] };
};

const enhancePrograms = async ({
  ctx,
  programs,
  dbPrograms,
  inactiveDbProgramNames,
  tenantReservedPhoneNumbers,
  dbSources,
  dbTeams,
  dbCampaigns,
  dbProperties,
  dbVoiceMessages,
  allDbPrograms,
}) => {
  logger.trace({ ctx }, 'enhancing programs with phone and voice message information');

  const rowsForActiveProgramsOnly = programs.filter(row => !inactiveDbProgramNames.some(n => n === row.data.name.toLowerCase()));

  return await mapSeries(rowsForActiveProgramsOnly, async row => {
    logger.trace(
      { ctx, rowIndex: row.index, programName: row.data.name },
      'determining phone, voice message information, sources, teams, campaigns for program',
    );
    const programData = row.data;

    const { directPhoneIdentifier, displayPhoneNumber } = programData;

    const { dbProgram, team, onSiteLeasingTeam, source, dbVoiceMessage, campaign, defaultMatchSource, property, fallbackProgram } = determineDataForForeignKeys(
      {
        programData,
        dbPrograms,
        dbSources,
        dbTeams,
        dbCampaigns,
        dbProperties,
        dbVoiceMessages,
        allDbPrograms,
      },
    );

    const programDirectPhoneIdentifier = await getDirectPhoneIdentifier(ctx, {
      directPhoneIdentifier,
      tenantReservedPhoneNumbers,
      dbProgram,
    });

    if (programDirectPhoneIdentifier) {
      if (!tenantReservedPhoneNumbers.some(t => t.phoneNumber === programDirectPhoneIdentifier)) {
        // in case we needed to buy a new number when determining programDirectPhoneIdentifier we need to update our temporary tenant number list to include this numbers
        // and since we need this number to not be grabbed when determining the numbers for the other row, we mark it as used in our temp number list
        tenantReservedPhoneNumbers.push({
          phoneNumber: programDirectPhoneIdentifier,
          isUsed: true,
          ownerType: PhoneOwnerType.PROGRAM,
          ownerId: dbProgram?.id,
        });
      } else {
        tenantReservedPhoneNumbers.map(t => {
          if (t.phoneNumber === programDirectPhoneIdentifier) {
            t.isUsed = true; // the same as for the new numbers, for the numbers that the tenant already had before
            t.ownereType = PhoneOwnerType.PROGRAM;
            t.ownerId = dbProgram?.id;
          }
          return t; // import, we want to mark them as used until we finish allocating the rest of them. this is not done in db, only in our temp list. it will be marked as
        }); // used when a program is actually saved in db
      }
    }

    const programDisplayPhoneNumber = await getDisplayPhoneNumber(ctx, {
      directPhoneIdentifier,
      displayPhoneNumber,
      tenantReservedPhoneNumbers,
      programDirectPhoneIdentifier,
      dbProgram,
    });

    const { selectedPropertyIds, invalidSelectedPropertiesNames } = getSelectedProperties(dbProgram, programData.selectedProperties, dbProperties);

    return {
      ...row,
      data: {
        ...row.data,
        programDirectPhoneIdentifier,
        programDisplayPhoneNumber,
        voiceMessageId: dbVoiceMessage.id,
        teamId: team.id,
        teamEndDate: team.endDate,
        onSiteLeasingTeamId: onSiteLeasingTeam.id,
        onSiteLeasingTeamEndDate: onSiteLeasingTeam.endDate,
        sourceId: source.id,
        dbProgram,
        campaignId: campaign.id || null,
        defaultMatchingSourceId: defaultMatchSource.id || null,
        propertyId: property.id,
        programFallbackId: fallbackProgram.id || null,
        selectedPropertyIds,
        invalidSelectedPropertiesNames,
      },
    };
  });
};

const enhanceInactivePrograms = async ({
  ctx,
  programs,
  dbPrograms,
  tenantReservedPhoneNumbers,
  dbSources,
  dbTeams,
  dbCampaigns,
  dbProperties,
  dbVoiceMessages,
  allDbPrograms,
}) => {
  logger.trace({ ctx }, 'enhancing inactive programs with necessary data');

  const rowsForInactiveProgramsOnly = programs.filter(row => dbPrograms.some(p => p.name.toLowerCase() === row.data.name.toLowerCase()));

  return await mapSeries(rowsForInactiveProgramsOnly, async row => {
    logger.trace({ ctx, rowIndex: row.index, programName: row.data.name }, 'determining voice message information, sources, teams, campaigns for program');
    const programData = row.data;

    const { displayPhoneNumber } = programData;
    const { dbProgram, team, onSiteLeasingTeam, source, dbVoiceMessage, campaign, defaultMatchSource, property, fallbackProgram } = determineDataForForeignKeys(
      {
        programData,
        dbPrograms,
        dbSources,
        dbTeams,
        dbCampaigns,
        dbProperties,
        dbVoiceMessages,
        allDbPrograms,
      },
    );

    const programDisplayPhoneNumber = await getDisplayPhoneNumber(ctx, {
      directPhoneIdentifier: dbProgram.directPhoneIdentifier || '',
      displayPhoneNumber,
      tenantReservedPhoneNumbers,
      programDirectPhoneIdentifier: dbProgram.directPhoneIdentifier,
      dbProgram,
    });
    const { selectedPropertyIds, invalidSelectedPropertiesNames } = getSelectedProperties(dbProgram, programData.selectedProperties, dbProperties);

    return {
      ...row,
      data: {
        ...row.data,
        programDirectPhoneIdentifier: dbProgram.directPhoneIdentifier,
        programDisplayPhoneNumber,
        voiceMessageId: dbVoiceMessage.id,
        teamId: team.id,
        teamEndDate: team.endDate,
        onSiteLeasingTeamId: onSiteLeasingTeam.id,
        onSiteLeasingTeamEndDate: onSiteLeasingTeam.endDate,
        sourceId: source.id,
        dbProgram,
        campaignId: campaign.id || null,
        defaultMatchingSourceId: defaultMatchSource.id || null,
        propertyId: property.id,
        programFallbackId: fallbackProgram.id || null,
        selectedPropertyIds,
        invalidSelectedPropertiesNames,
      },
    };
  });
};

// workaround:
// not sure why 'directPhoneIdentifier' and 'displayPhoneNumber' fields are missing sometimes;
// when the value is not set in spreadsheet, it should be ''
// this happens only with some spreadsheets
const enhanceProgramsWithPhoneInformation = programs =>
  programs.map(p => ({
    ...p,
    data: {
      ...p.data,
      directPhoneIdentifier: p.data.directPhoneIdentifier || '',
      displayPhoneNumber: p.data.displayPhoneNumber || '',
      rank: getPhoneRankForRow(p.data.directPhoneIdentifier),
    },
  }));

const prepareAndSaveProgram = async (ctx, programRow) => {
  const { programDirectPhoneIdentifier: programDirectPhoneNumber, programDisplayPhoneNumber } = programRow;

  const program = formatProgramForSave(programRow, { programDirectPhoneNumber, programDisplayPhoneNumber });
  await saveProgram({ ctx, program, dbProgram: programRow.dbProgram, teamId: programRow.teamId, propertyId: programRow.propertyId });
};

const importRows = async (ctx, rows, dbPrograms, isInactiveProgramProcessing = false) => {
  const validFields = [];

  const invalidFields = await validate(
    rows,
    {
      requiredFields: sourceRequiredFields,
      async onValidEntity(program, index) {
        await prepareAndSaveProgram(ctx, program);
        validFields.push({
          index,
          data: rows,
        });
      },
      customCheck(program) {
        return customProgramsValidations({ ctx, program, programs: rows, dbPrograms, isInactiveProgramProcessing });
      },
    },
    ctx,
    spreadsheet.Program.columns,
  );

  return {
    validFields,
    invalidFields,
  };
};

const getRowsToBeSaved = (enhancedRows, dbPrograms) =>
  enhancedRows.filter(r => {
    const dbProgram = dbPrograms.find(c => c.name.toLowerCase() === r.data.name.toLowerCase());
    const formattedProgram = {
      ...r.data,
      ...formatProgramForSave(
        r.data,
        {
          programDirectPhoneNumber: r.data.programDirectPhoneIdentifier,
          programDisplayPhoneNumber: r.data.programDisplayPhoneNumber,
        },
        true,
      ),
    };
    return !dbProgram || !isProgramUpdated(formattedProgram, dbProgram);
  });

const enhanceAndImportRows = async ({
  ctx,
  programs,
  activeDbPrograms,
  inactiveDbProgramNames,
  tenantReservedPhoneNumbers,
  dbSources,
  dbTeams,
  dbCampaigns,
  dbProperties,
  dbVoiceMessages,
  allDbPrograms,
}) => {
  const enhancedRows = await enhancePrograms({
    ctx,
    programs,
    dbPrograms: activeDbPrograms,
    inactiveDbProgramNames,
    tenantReservedPhoneNumbers,
    dbSources,
    dbTeams,
    dbCampaigns,
    dbProperties,
    dbVoiceMessages,
    allDbPrograms,
  });

  const rowsToBeSaved = getRowsToBeSaved(enhancedRows, activeDbPrograms);
  const rowsIndexesToBeSaved = rowsToBeSaved.map(r => r.index) || [];
  const unchangedRows = enhancedRows.filter(row => !rowsIndexesToBeSaved.includes(row.index));
  const { invalidFields, validFields } = await importRows(ctx, rowsToBeSaved, activeDbPrograms);
  return { invalidFields, validFields: validFields.concat(unchangedRows) };
};

const loadDbData = async ctx => {
  const dbPrograms = await loadPrograms(ctx);

  const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);
  const dbSources = await getSources(ctx);
  const dbTeams = await getTeamsFromTenant(ctx.tenantId, false);
  const dbCampaigns = await getCampaigns(ctx);
  const dbProperties = await getProperties(ctx);
  const dbVoiceMessages = await getAllVoiceMessages(ctx);
  return { dbPrograms, tenantReservedPhoneNumbers, dbVoiceMessages, dbSources, dbTeams, dbCampaigns, dbProperties };
};

export const importPrograms = async (ctx, rows) => {
  const { dbPrograms, tenantReservedPhoneNumbers, dbVoiceMessages, dbSources, dbTeams, dbCampaigns, dbProperties } = await loadDbData(ctx);
  let inactiveDbPrograms = dbPrograms.filter(p => isInactiveProgram(p.endDate));
  let activeDbPrograms = dbPrograms.filter(x => !inactiveDbPrograms.includes(x));
  let inactiveDbProgramNames = inactiveDbPrograms.map(p => p.name.toLowerCase());

  let programs = enhanceProgramsWithPhoneInformation(rows);
  programs = orderBy(programs, ['data.rank', 'data.directPhoneIdentifier'], ['asc', 'asc']);

  const programsWithoutFallback = programs.filter(p => !p.data.programFallback);

  const { invalidFields, validFields } = await enhanceAndImportRows({
    ctx,
    programs: programsWithoutFallback,
    activeDbPrograms,
    inactiveDbProgramNames,
    tenantReservedPhoneNumbers,
    dbSources,
    dbTeams,
    dbCampaigns,
    dbProperties,
    dbVoiceMessages,
    allDbPrograms: dbPrograms,
  });

  // this is because we need the programs without fallback programs to be inserted already so that we can grab their id from db

  const programsWithFallback = programs.filter(p => p.data.programFallback);

  const dbProgramsAfterProgramsWithoutFallback = await loadPrograms(ctx);

  inactiveDbPrograms = dbProgramsAfterProgramsWithoutFallback.filter(p => isInactiveProgram(p.endDate));
  activeDbPrograms = dbProgramsAfterProgramsWithoutFallback.filter(x => !inactiveDbPrograms.includes(x));
  inactiveDbProgramNames = inactiveDbPrograms.map(p => p.name.toLowerCase());
  const tenantReservedPhoneNumbersAfterProgramsWithoutFallback = await getTenantReservedPhoneNumbers(ctx);

  const { invalidFields: invalidFieldsForActiveProgramsWithFallback, validFields: validEntitiesForActiveProgramsWithFallback } = await enhanceAndImportRows({
    ctx,
    programs: programsWithFallback,
    activeDbPrograms,
    inactiveDbProgramNames,
    tenantReservedPhoneNumbers: tenantReservedPhoneNumbersAfterProgramsWithoutFallback,
    dbSources,
    dbTeams,
    dbCampaigns,
    dbProperties,
    dbVoiceMessages,
    allDbPrograms: dbProgramsAfterProgramsWithoutFallback,
  });

  const enhancedInactiveRows = await enhanceInactivePrograms({
    ctx,
    programs,
    dbPrograms: inactiveDbPrograms,
    tenantReservedPhoneNumbers: tenantReservedPhoneNumbersAfterProgramsWithoutFallback,
    dbSources,
    dbTeams,
    dbCampaigns,
    dbProperties,
    dbVoiceMessages,
    allDbPrograms: dbProgramsAfterProgramsWithoutFallback,
  });

  const inactiveRowsToBeSaved = getRowsToBeSaved(enhancedInactiveRows, inactiveDbPrograms);
  const rowIndexesToBeSaved = inactiveRowsToBeSaved.map(r => r.index) || [];
  const inactiveUnchangedRows = enhancedInactiveRows.filter(row => !rowIndexesToBeSaved.includes(row.index));
  const { invalidFields: inactiveProgramFields, validFields: validInactiveProgramFields } = await importRows(
    ctx,
    inactiveRowsToBeSaved,
    inactiveDbPrograms,
    true,
  );

  return {
    invalidFields: invalidFields.concat(inactiveProgramFields).concat(invalidFieldsForActiveProgramsWithFallback),
    validFields: validFields.concat(validEntitiesForActiveProgramsWithFallback).concat(validInactiveProgramFields).concat(inactiveUnchangedRows),
  };
};

export const additionalProgramsProcess = async (_ctx, validEntities) => {
  if (!validEntities.length) return [];

  const activePrograms = validEntities.filter(program => !isInactiveProgram(program.data.endDate));

  const errors = activePrograms.map(program => {
    const programData = program.data;
    const invalidFields = [];
    if (programData.teamEndDate) {
      invalidFields.push({
        name: TEAM,
        message: INACTIVE_TEAM_ERROR,
      });
    }

    if (programData.onSiteLeasingTeamEndDate) {
      invalidFields.push({
        name: ON_SITE_LEASING_TEAM,
        message: INACTIVE_TEAM_ERROR,
      });
    }

    return invalidFields.length ? { index: program.index, invalidFields } : {};
  });

  return errors.filter(e => !!e.index);
};
