/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import cheerio from 'cheerio';
import sortBy from 'lodash/sortBy';
import nullish from '../../../../common/helpers/nullish';
import { IDictionaryHash, IDbContext } from '../../../../common/types/base-types';
import logger from '../../../../common/helpers/logger';
import { BadRequestError, NoRetryError, ServiceError } from '../../../../server/common/errors';
import {
  IParsedResponse,
  IParsedCriteriaObject,
  ICriteria,
  IScreeningReportCustomRecord,
  IFadvServiceStatus,
  IParsedServiceStatusV2,
  IFadvResponseApplicant,
  IFadvService,
  IFormattedServicesV1,
  IParsedServiceStatusV1,
  IApplicantDecisionItem,
  IFadvInstructions,
  IParsedOverrideRecommendation,
  IScreeningResponse,
  IScreeningResponseValidation,
  IScreeningCustomRecord,
  IScreeningKeyValuePair,
  IApplicantScreening,
  IParseApplicantDecisionOptions,
} from '../../helpers/applicant-types';
import { assert } from '../../../../common/assert';
import { applicationDecisionHasErrorOther, formatApplicantsCreditScore, customerFromApplicant } from '../../helpers/screening-helper';
import { ScreeningDecision } from '../../../../common/enums/applicationTypes';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
import { FADV_SERVICE_STATUS, FADV_TO_DATABASE_SERVICE_STATUS_TRANS } from '../../../common/enums/fadv-service-status';
import { getApplicantReportRequestsById } from '../../dal/applicant-report-request-tracking-repo';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { hasOwnProp } from '../../../../common/helpers/objUtils';
import { getSubmissionRequest } from '../../dal/fadv-submission-repo';
import { BREAKLINE, HYPHEN_BETWEEN_SPACE } from '../../../../common/regex';
import { PARSE_ERROR } from '../../../common/screening-constants';

export const FADV_RESPONSE_CUSTOM_RECORDS: IDictionaryHash<string> = {
  SCREENING_REQUEST_ID: 'screeningRequestId',
  TENANT_ID: 'tenantId',
  VERSION: 'version',
  ENVIRONMENT: 'environment',
};

export const validateScreeningResponse = (screeningResponse?: IScreeningResponse | any): IScreeningResponseValidation => {
  if (!screeningResponse) {
    return { isValid: false, errors: ['Missing screeningResponse!'] };
  }

  if (screeningResponse instanceof String) {
    return { isValid: false, errors: ['The parser expects already-parsed XML object'] };
  }

  if (!screeningResponse.ApplicantScreening) {
    return { isValid: false, errors: ['Attempt to parse screeningResponse without ApplicantScreening!'] };
  }

  const validation: IScreeningResponseValidation = {
    isValid: false,
    errors: [],
  };

  const { LeaseTerms = [], Response = [] } = screeningResponse.ApplicantScreening;

  if (!Response[0]) {
    validation.errors.push('Response is required in screeningResponse');
  }

  if (Response[0] && !Response[0].ApplicationDecision) {
    validation.errors.push('ApplicationDecision is required in screeningResponse Response');
  }

  if (!(LeaseTerms[0] || {}).MonthlyRent) {
    validation.errors.push('LeaseTerms MonthlyRent is required in screeningResponse');
  }

  if (validation.errors.length > 0) return validation;

  return { isValid: true, errors: [] };
};

/**
 * Parse the Custom Records to JS object
 * @param {Object} customRecords - Custom records sent from FADV
 * @return {Object} customRecords - Custom records
           {string} customRecords.name - Custom record name
          {string} customRecords.value -  Custom record value
  customRecords has this form:
  customRecords: {
                   <Record/Name>: { value: <Record/Value> },
                   <Record/Name>: { value: <Record/Value>},
                   <Record/Name>: { value: <Record/Value> },
                  },
  Ex:
  customRecords: {
                  screeningRequestId: {value: '527d4ca4-074d-ce67-223e-64c8e056f8b5' }
                }
*/
export const parseCustomRecords = (customRecords: Array<IScreeningCustomRecord>): IScreeningReportCustomRecord | null => {
  if (!customRecords || !customRecords.length) return null;

  return customRecords[0].Record.reduce((acc: IScreeningReportCustomRecord, item: IScreeningKeyValuePair) => {
    acc[item.Name[0]] = item.Value[0];
    return acc;
  }, {} as IScreeningReportCustomRecord);
};

// Note: we are currently using the default xml2js settings, which includes "explicitArrays"
// This means the parser will ALWAYS put child nodes in an array.
// The many [0] references in the code below refer to cases in which exactly one node is expected to be returned
// A future improvement might be to selectively convert nodes which are only expected to have 1 child to not
// be arrays.

const getApplicantIdentifier = (applicants, index) => {
  // TODO: this check is temporary to handle the fact that the generic template always has one identifier
  // In real life , we should have a 1:1 relationship
  const modIndex = index < applicants.length ? index : applicants.length - 1;
  return applicants[modIndex].AS_Information[0].ApplicantIdentifier[0];
};

const getApplicantId = (ctx: IDbContext, applicantIdentifier: string) => {
  const informationIdentifiers = applicantIdentifier.split(/:+/g);
  // accepted data format for the applicant identifier should be:
  // tenantId:partyApplicationId:personId - this accomodates the old data - we send the same thing to FADV as previously sent
  // tenantId:applicantId - this accomodates the new data format
  if (informationIdentifiers.length !== 2 && informationIdentifiers.length !== 3) {
    logger.error({ ctx }, 'Error while parsing the Applicant identifier, it should be <ApplicantIdentifier>tenantId:applicantId</ApplicantIdentifier>');
    logger.error({ ctx }, `<ApplicantIdentifier> is: ${informationIdentifiers}`);
    throw new BadRequestError('ERROR_APPLICANT_IDENTIFIER_FORMAT_VALUE');
  }

  return informationIdentifiers.length === 3 ? `${informationIdentifiers[1]}:${informationIdentifiers[2]}` : informationIdentifiers[1];
};

/*
 * parse the Applicant decision to Array
 * @param {IDbContext} ctx - context
 * @param {string} applicantDecisionsStr - Applicant decisions as string
 * @param {Object[]} applicants - Applicants
 * @return {Object[]} applicantDecisions - Applicant decisions
           {string} applicantDecisions[].applicantName - First name and last name.
          {string} applicantDecisions[].result - Decision's status
*/
const parseApplicantDecision = (
  ctx: IDbContext,
  applicantDecisionsStr: string,
  applicants: IFadvResponseApplicant[],
  { includeApplicantName = false, creditInformation = [] }: IParseApplicantDecisionOptions,
): IApplicantDecisionItem[] | IDictionaryHash<any> => {
  logger.debug({ ctx, applicantDecisionsStr }, 'parsing applicant decision');
  if (!applicants || !applicants.length) {
    throw new Error('NO_APPLICANTS_PASSED_IN');
  }

  const applicantDecisions = applicantDecisionsStr
    .split(BREAKLINE)
    .filter(item => item.trim().length)
    .map((item, index) => {
      const [applicantName, applicantResult] = item.split(HYPHEN_BETWEEN_SPACE) || ['', ''];
      const applicantDecisionItem: IApplicantDecisionItem | IDictionaryHash<any> = {};

      const applicantIdentifier = getApplicantIdentifier(applicants, index);
      applicantDecisionItem.applicantId = getApplicantId(ctx, applicantIdentifier);
      applicantDecisionItem.result = applicantResult.trim();
      const applicantCredit = (!!creditInformation.length && creditInformation.find(ci => ci.applicantId === applicantDecisionItem.applicantId)) || {};
      applicantCredit.creditScore && (applicantDecisionItem.crediScore = applicantCredit.creditScore);
      applicantCredit.creditAssessment && (applicantDecisionItem.creditAssessment = applicantCredit.creditAssessment);

      includeApplicantName && (applicantDecisionItem.applicantName = applicantName.trim());
      return applicantDecisionItem;
    });

  const hasValidApplicantDecisions = applicantDecisions.length === applicants.length;

  if (!hasValidApplicantDecisions) {
    logger.warn(
      { ctx, hasValidApplicantDecisions, numOfApplicants: applicants.length, numApplicantDecisions: applicantDecisions.length },
      'Error while parsing the applicant decisions',
    );
    return [];
  }
  return applicantDecisions;
};

// extract fadv applicant id
// e.g., SSN encountered a problem processing applicant (31719437) for Unit...
const extractScreeningApplicantIdsFromBlockedStatus = (blockedstatus: string): string[] => {
  const applicantIdExpression = /applicant\s+\((\d+)\)/gi;
  let applicantIdExtracted;
  const screeningApplicantIds: string[] = [];

  do {
    applicantIdExtracted = applicantIdExpression.exec(blockedstatus);
    applicantIdExtracted && screeningApplicantIds.push(applicantIdExtracted[1]);
  } while (applicantIdExtracted);
  return screeningApplicantIds;
};

// map <screeningApplicantID>: <revaApplicantId>;
export const mapApplicantIds = (ctx: IDbContext, applicationScreening: IApplicantScreening, screeningRequestId: string): IDictionaryHash<string> => {
  logger.debug({ ctx }, 'mapping applicantIds');
  const applicantsInformation = get(
    applicationScreening,
    'CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].ApplicationInformation[0].ApplicantInformation',
    [],
  );
  const applicants = applicationScreening.Applicant || [];

  // This happens when the CustomRecordsExtended is not available, usually under an incomplete response
  if (!applicantsInformation.length) {
    const screeningApplicantIds = extractScreeningApplicantIdsFromBlockedStatus(get(applicationScreening, 'Response[0].BlockedStatus[0]', ''));
    logger.debug({ ctx, screeningApplicantIds }, 'mapping applicantIds found no applicantsInfo from CustomRecordsExtended, using blockedStatus');
    if (!screeningApplicantIds.length) return {};

    const document = cheerio.load(get(applicationScreening, 'Response[0].BackgroundReport[0]', ''));
    const applicantDecision = parseApplicantDecision(ctx, get(applicationScreening, 'Response[0].ApplicantDecision[0]', ''), applicants, {
      includeApplicantName: true,
    });

    return screeningApplicantIds.reduce((acc, id) => {
      const identifier = document(`tr th:contains("${id}")`);
      const applicantInformation = identifier ? identifier.html() : '';

      if (nullish(applicantInformation)) {
        logger.error({ ctx, screeningRequestId }, 'Error while parsing applicant information on background report');
        throw new ServiceError({
          token: PARSE_ERROR,
          screeningRequestId,
          data: { ApplicantScreening: { ...applicationScreening } },
        });
      }

      const [, applicantName, screeningApplicantId] = applicantInformation.match(/([^(]*)\(([^)]\d+).*/) || ['', '', ''];
      if (!screeningApplicantId) return acc;

      const appDecision =
        applicantDecision.find(decision => {
          const name = decision.applicantName
            .split(',')
            .reverse()
            .map(it => it.trim())
            .join(' ');
          return name === applicantName.trim();
        }) || {};
      if (!appDecision || !appDecision.applicantId) return acc;

      return {
        ...acc,
        [screeningApplicantId]: appDecision.applicantId,
      };
    }, {});
  }

  return applicantsInformation.reduce((acc, applicantInformation) => {
    const applicantIdentifier = get(applicantInformation, 'Applicant[0].ExternalId[0]', '');
    const existsApplicant = applicants.some(applicant => get(applicant, 'AS_Information[0].ApplicantIdentifier[0]') === applicantIdentifier);
    if (!existsApplicant) {
      logger.warn({ ctx, applicantInformation, applicantIdentifier }, 'Could not find applicant for this identifier');
      return acc;
    }

    return {
      ...acc,
      [applicantInformation.$.applicantid]: getApplicantId(ctx, applicantIdentifier),
    };
  }, {});
};

export const parsePropertyCriteria = (criterias: Array<ICriteria>): IParsedCriteriaObject =>
  criterias.reduce((accumulator, criteria) => {
    const theAreApplicantsResults = criteria.ApplicantResults || criteria.ApplicantResults!.length !== 0;
    assert(theAreApplicantsResults, 'parsePropertyCriteria: Missing ApplicantResults from FADV response');

    accumulator[criteria.CriteriaID] = {
      passFail: criteria.PassFail[0],
      criteriaDescription: criteria.CriteriaDescription[0],
      criteriaId: criteria.CriteriaID[0],
      criteriaType: criteria.CriteriaType[0],
      override: criteria.Override[0],
      applicantResults: criteria.ApplicantResults[0].Result.reduce((applicantAccumulator, applicantResult) => {
        const criteriaResult = applicantResult._;

        if (criteriaResult) {
          Object.assign(applicantAccumulator, {
            [applicantResult.$.applicantid]: criteriaResult,
          });
        }

        return applicantAccumulator;
      }, {}),
    };
    return accumulator;
  }, {});

/*
 * Get the tenant id
 * @param {Object[]} applicants - Applicants
 * @return {string} tenantId - The tenant id
 */
const getTenantId = applicants => {
  const applicantIdentifier = applicants[0].AS_Information[0].ApplicantIdentifier[0].split(/:+/g);
  if (applicantIdentifier.length !== 2 && applicantIdentifier.length !== 3) {
    // to support old data
    logger.error('Error while parsing the Applicant identifier, it should be <ApplicantIdentifier>tenantId:applicantId</ApplicantIdentifier>');
    logger.error(`<ApplicantIdentifier> is: ${applicants[0].AS_Information[0].ApplicantIdentifier[0]}`);
    throw new BadRequestError('ERROR_APPLICANT_IDENTIFIER_FORMAT_VALUE');
  }
  return applicantIdentifier[0];
};

const overrideTypes = ['StandardOverride', 'UnitOverride', 'InstructionalOverride'];

const getApplicants = overrides =>
  overrides.reduce((applicants, override) => {
    if (!override.Applicant) {
      throw new BadRequestError('ERROR_APPLICANT_SHOULD_ALWAYS_BE_PRESENT_AT_OVERRIDE');
    }
    return applicants.concat(override.Applicant);
  }, []);

const getApplicantOverrides = applicant =>
  overrideTypes.reduce((applicantOverrides, overrideType) => {
    if (applicant[overrideType]) {
      return applicantOverrides.concat(applicant[overrideType]);
    }
    return applicantOverrides;
  }, []);

const getApplicantSafeScan = applicant => {
  const text = applicant?.SafeScan?.map(ss => ss.SafeScanText).join('. ');

  return {
    id: 'reva-safescan',
    text,
  };
};

const getOverrideTypes = applicants => applicants.reduce((overridesDetail, applicant) => overridesDetail.concat(getApplicantOverrides(applicant)), []);
const getSafeScan = applicants =>
  applicants.reduce((overridesDetail, applicant) => overridesDetail.concat(applicant?.SafeScan && getApplicantSafeScan(applicant)), []);

const getOverrideDetail = (ctx: IDbContext, overridesDetail) =>
  overridesDetail.reduce((recommendations, overrideDetail) => {
    if (!overrideDetail.OverrideText[0]) {
      logger.error({ ctx }, 'Error while parsing override details, it must have an override text');
    }
    return recommendations.concat({
      id: overrideDetail.OverrideID[0],
      text: overrideDetail.OverrideText[0],
    });
  }, []);

const parseRecommendationsFromOverrides = (ctx: IDbContext, instructions: IFadvInstructions): IParsedOverrideRecommendation[] => {
  if (!instructions.ApplicantOverride || !instructions.ApplicantOverride.length) {
    return [];
  }
  const overrides = instructions.ApplicantOverride;
  const applicants = getApplicants(overrides);
  const applicantOverrides = getOverrideTypes(applicants);
  const applicantsSafeScan = getSafeScan(applicants).filter(x => x);
  const overrideDetail = getOverrideDetail(ctx, applicantOverrides);

  return overrideDetail.concat(applicantsSafeScan);
};

// FADV has had inconsistencies with the values for <ApplicationDecision>
// this maps the Reva screening decision to the Fadv application decision.
const applicationDecisionMap = {
  [ScreeningDecision.FURTHER_REVIEW]: ['FURTHER_REVIEW', 'FURTHER REVIEW'],
  [ScreeningDecision.APPROVED_WITH_COND]: ['APPROVED_WITH_COND', 'APPRVD W/COND', 'APPROVED WITH CONDITIONS'],
  [ScreeningDecision.DISPUTED]: ['DISPUTED', 'DISPUTE BLOCKED'],
  [ScreeningDecision.GUARANTOR_REQUIRED]: ['GUARANTOR REQUIRED'],
  [ScreeningDecision.APPROVED]: ['APPROVED'],
  [ScreeningDecision.DECLINED]: ['DECLINED'],
  [ScreeningDecision.PENDING]: ['PENDING', ''],
};

const parseApplicationDecision = (ctx: IDbContext, applicationDecision: string = ''): string => {
  const mappedApplicationDecision = Object.entries(applicationDecisionMap).find(([_, values]) =>
    values.some(decision => decision.toLowerCase() === applicationDecision.toLowerCase()),
  );

  if (applicationDecision && !mappedApplicationDecision) {
    logger.error({ ctx, applicationDecision }, 'Unknown application decision status received from FADV');
  }

  return mappedApplicationDecision ? mappedApplicationDecision[0] : applicationDecision;
};

const getStatusValue = status => (status.includes(FADV_SERVICE_STATUS.BLOCKED) ? FADV_SERVICE_STATUS.BLOCKED : status);

const getFormattedServices = (services: IFadvService[]): IFormattedServicesV1[] => {
  if (!services) return [];
  const formattedServices = services.map(service => {
    let status = getStatusValue(service._.toUpperCase());
    status = FADV_TO_DATABASE_SERVICE_STATUS_TRANS[status] || FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.INCOMPLETE];

    return { serviceName: get(service, '$.Name'), status };
  });

  return sortBy(formattedServices, 'serviceName');
};

const getApplicantIds = (ctx: IDbContext, applicants: IFadvResponseApplicant[]): string[] =>
  applicants.map(applicant => {
    const applicantIdentifier = get(applicant, 'AS_Information[0].ApplicantIdentifier[0]', '');
    return getApplicantId(ctx, applicantIdentifier);
  });

const cleanName = name =>
  name
    .trim()
    .replace(/[^a-z ]/gi, '')
    .toLowerCase();
const isSameApplicantName = (services, { firstName, lastName }) =>
  cleanName(get(services, 'Applicant[0]')) === `${cleanName(firstName)} ${cleanName(lastName)}`;
const containsApplicant = (applicantIds, { applicantId }) => applicantIds.includes(applicantId);

interface IParseServiceV1Params {
  responseApplicants: IFadvResponseApplicant[];
  servicesStatus: IFadvServiceStatus[];
  submissionRequestId: string;
}

/*
 * parse FADV ServiceStatus Response
 * @param {Array} applicants already-parsed array
 *        {Array} servicesStatus already-parsed array
 * @return {Object} Parsed FADV service status for each applicant
          with structure: { applicantId: { serviceName: <name>, status: <status> } }
*/
const parseServiceStatus = async (
  ctx: IDbContext,
  { responseApplicants, servicesStatus, submissionRequestId }: IParseServiceV1Params,
): Promise<IParsedServiceStatusV1> => {
  logger.trace({ ctx, servicesStatus }, 'parseServiceStatus parsing serviceStatus');
  const { applicantData = {} } = (await getSubmissionRequest(ctx, submissionRequestId)) || {};
  let { applicants = [] } = applicantData;
  logger.trace({ ctx, applicantData, applicants }, 'parseServiceStatus extracted applicants');
  let applicantIds = getApplicantIds(ctx, responseApplicants);
  if (!applicantData || !applicants.length) {
    // this is only expected to happen in testing
    logger.warn({ ctx, submissionRequestId }, 'parseServiceStatus could not find applicantData in Reva DB, will create from response');
    applicants = responseApplicants.map((responseApplicant, idx) => {
      const applicantId = getApplicantId(ctx, getApplicantIdentifier(responseApplicants, idx));
      const name = customerFromApplicant(responseApplicant).Name[0];
      const firstName = name.FirstName[0];
      const lastName = name.LastName[0];
      return {
        applicantId,
        lastName,
        firstName,
      };
    });
    applicantIds = applicants.map(applicant => applicant.applicantId);
  }

  if (!applicantIds || !Array.isArray(applicantIds)) return {};

  return servicesStatus.reduce((acc, services) => {
    if (!services || typeof services !== 'object') return acc;

    const matchingApplicant = applicants.find(applicant => isSameApplicantName(services, applicant) && containsApplicant(applicantIds, applicant));
    if (!matchingApplicant) {
      logger.warn({ ctx, servicesStatus, applicantIds }, 'parseServiceStatus found NO matching applicant');
      return acc;
    }
    const { applicantId } = matchingApplicant;
    logger.info({ ctx, applicantId, applicantIds, services }, 'parseServiceStatus found matching applicantId');
    const serviceStatus = getFormattedServices(services.Service);
    if (serviceStatus.length) {
      acc[applicantId] = serviceStatus;
    }
    return acc;
  }, {});
};

interface IParseServiceV2Params {
  servicesStatus: IFadvServiceStatus[];
  submissionRequestId: string;
}

/*
 * parse FADV ServiceStatus Response
 * @param  {Array} servicesStatus already-parsed array
 * @return {Object} Parsed FADV service status for each applicant
          with structure: { serviceName: { status: <status>, updatedAt: <updatedAt> } }
*/
const parseServiceStatusV2 = async (ctx: IDbContext, { servicesStatus, submissionRequestId }: IParseServiceV2Params): Promise<IParsedServiceStatusV2> => {
  const { timezone } = await getApplicantReportRequestsById(ctx, submissionRequestId);

  return servicesStatus.reduce((acc, services) => {
    if (!services || typeof services !== 'object') return acc;

    const serviceStatus = services.Service;
    if (!serviceStatus) return acc;

    serviceStatus.forEach(service => {
      let status = getStatusValue(service._.toUpperCase());
      status = FADV_TO_DATABASE_SERVICE_STATUS_TRANS[status] || FADV_TO_DATABASE_SERVICE_STATUS_TRANS[FADV_SERVICE_STATUS.INCOMPLETE];
      const serviceName = get(service, '$.Name');
      const updatedAt = get(service, '$.Date');
      const updatedAtWithTimezone = updatedAt ? toMoment(updatedAt, { timezone }) : '';
      acc[serviceName] = { status, updatedAt: updatedAtWithTimezone };
    });
    return acc;
  }, {});
};

/*
 * parse FADV Response
 * @param {string} screeningResponse already-parsed object
 * @return {Object} Elements from FADV response
           {string} response.TransactionNumber
           {string} response.ReportDate
           {Object[]} response.ApplicantDecision
           {string} response.ApplicationDecision
           {string} response.Status
           {string} response.RequestID_Returned
           {string} response.BackgroundReport - HTML report
*/
export const handleParsedFADVResponse = async (ctx: IDbContext, screeningResponse: IDictionaryHash<any>): Promise<IParsedResponse | IDictionaryHash<any>> => {
  logger.trace({ ctx }, 'handleParsedFADVResponse');
  const validationResult = validateScreeningResponse(screeningResponse);
  if (!validationResult.isValid) {
    logger.error({ ctx, screeningResponse, errors: validationResult.errors }, 'screening response is invalid');
    throw new NoRetryError(validationResult.errors.join(', '));
  }
  // Applicant is an array of applicants provided by FADV
  const { Request, LeaseTerms, Response, Applicant, CustomRecords } = screeningResponse.ApplicantScreening;

  const criteria = get(screeningResponse, 'ApplicantScreening.CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].PropertyCriteria[0].Criteria');

  const response: IParsedResponse | IDictionaryHash<any> = {};
  response.MonthlyRent = parseFloat(LeaseTerms[0].MonthlyRent);
  if (criteria) {
    response.criteriaResult = parsePropertyCriteria(criteria);
  }
  // TODO: we should probably disable explicitArray and convert the possible array nodes here...
  response.ApplicationDecision = parseApplicationDecision(ctx, Response[0].ApplicationDecision[0]);
  response.TransactionNumber = Response[0].TransactionNumber[0];
  if (!applicationDecisionHasErrorOther(response.ApplicationDecision)) {
    response.externalId = Request[0].ReportID[0] || response.TransactionNumber;
  }

  response.ReportDate = Response[0].ReportDate[0];
  response.Status = Response[0].Status[0];
  response.RequestID_Returned = Response[0].RequestID_Returned[0];

  let submissionRequestId;
  if (CustomRecords && CustomRecords.length > 0) {
    response.customRecords = parseCustomRecords(CustomRecords);
    submissionRequestId = response.customRecords && response.customRecords[FADV_RESPONSE_CUSTOM_RECORDS.SCREENING_REQUEST_ID];
  }

  let tenantId = response.customRecords && response.customRecords[FADV_RESPONSE_CUSTOM_RECORDS.TENANT_ID];
  if (!tenantId) {
    tenantId = getTenantId(Applicant);
    logger.error({ ctx, identifierTenantId: tenantId }, 'Tenant Id not available on custom records');
  }
  response.tenantId = tenantId;
  const context = { ...ctx, tenantId };

  response.ErrorCode = Response[0].ErrorCode && Response[0].ErrorCode[0];
  response.ErrorDescription = Response[0].ErrorDescription && Response[0].ErrorDescription[0];
  response.BlockedStatus = Response[0].BlockedStatus && Response[0].BlockedStatus[0];
  response.CreditBureau = get(
    screeningResponse,
    'ApplicantScreening.CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].CreditSourceInformation[0].CreditBureau[0]',
  );

  const screeningVersion = (response.customRecords && response.customRecords.version) || ScreeningVersion.V1;
  const servicesStatus = get(screeningResponse, 'ApplicantScreening.Response[0].ServiceStatus', []);
  response.serviceStatus =
    screeningVersion === ScreeningVersion.V1
      ? await parseServiceStatus(context, { responseApplicants: Applicant, servicesStatus, submissionRequestId })
      : await parseServiceStatusV2(context, { servicesStatus, submissionRequestId });

  if (hasOwnProp(Response[0], 'BackgroundReport')) {
    // At this point the content of the report is valid HTML because the xml parser
    // takes care of removing the encoding characters once it parses the BackgroundReport node
    response.BackgroundReport = Response[0].BackgroundReport[0];
  }

  const rentIncomesApplicants = get(
    screeningResponse,
    'ApplicantScreening.CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].RentToIncomes[0].Applicant',
  );

  const applicantsIdMap = mapApplicantIds(ctx, screeningResponse.ApplicantScreening, submissionRequestId);
  const creditInformation = formatApplicantsCreditScore(applicantsIdMap, rentIncomesApplicants);
  response.ApplicantDecision = parseApplicantDecision(ctx, Response[0].ApplicantDecision[0], Applicant, { creditInformation });

  const instructions = get(screeningResponse, 'ApplicantScreening.CustomRecordsExtended[0].Record[0].Value[0].AEROReport[0].Instructions');
  if (instructions) {
    response.recommendations = parseRecommendationsFromOverrides(ctx, instructions[0]);

    // CPM-20175
    const RECOMMENDATION_ID_PROVIDE_DEPOSIT_OR_GUARANTOR = '705';
    if (
      response.recommendations[0]?.id === RECOMMENDATION_ID_PROVIDE_DEPOSIT_OR_GUARANTOR &&
      response.ApplicationDecision === ScreeningDecision.GUARANTOR_REQUIRED
    ) {
      logger.debug({ ctx }, 'updating decision from Guarantor Required to Approved w/ Conditions due to presence of recommendation');
      response.ApplicationDecision = ScreeningDecision.APPROVED_WITH_COND;
    }
  }
  logger.trace({ ctx }, 'handleParsedFADVResponse finished');
  return response;
};
