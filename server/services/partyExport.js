/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import temp from 'temp';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import htmlToPdf from 'html-pdf';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';
import { mapSeries } from 'bluebird';
import { PartyExportConstants } from '../../common/party-export-constants';
import { FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { AdditionalInfoTypes } from '../../common/enums/partyTypes';
import { DALTypes } from '../../common/enums/DALTypes';
import { ScreeningDecision } from '../../common/enums/applicationTypes';

import { TemplateNames, TemplateTypes } from '../../common/enums/templateTypes';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { UTC_TIMEZONE, EXPORT_FILENAME_TIMESTAMP_FORMAT, PARTY_EXPORT_FILENAME_FORMAT } from '../../common/date-constants';
import thenify from '../../common/helpers/thenify';
import { getShortFormatRentableItem } from '../helpers/inventory';
import { replaceTemplatedValues, isUserAuthorizedToExportCreditReport } from '../../common/helpers/utils';
import { convertReactComponentToHtml } from '../../common/helpers/render-party-export-tpl';
import PartyExportTemplate from '../../resources/react-party-export-template/PartyExportTemplate';
import {
  getMemberNames,
  getPartyPersonApplicationsData,
  getIncomeSources,
  getAddressHistory,
  getDisclosures,
  getFormattedPartyInvoices,
} from '../helpers/party';
import * as partyRepo from '../dal/partyRepo';
import { getDeclineNotesByPartyId } from '../dal/activityLogRepo';
import { getSignedDocumentsForLease } from '../dal/documentsRepo';
import { getPublishedQuotesByPartyId } from '../dal/quoteRepo';
import { getPropertyById, getPropertyTimezone } from '../dal/propertyRepo';
import { getTeamsByNames } from '../dal/teamsRepo';
import { getPartyApplicationByPartyId, getDocumentsByPartyApplicationId } from '../../rentapp/server/services/party-application';
import { getPersonApplicationDocumentsByPartyId } from '../../rentapp/server/services/person-application';
import { downloadDocument } from '../workers/upload/documents/documentsS3Upload';
import { getInventoryItem } from './inventories';
import { renderTemplate } from './templates';
import { getAllQuotesByPartyId, getQuoteById } from './quotes';
import { getNameForExportedLease } from './helpers/party';
import { logEntity } from './activityLogService';
import { downloadLeaseDocument } from '../workers/lease/leaseS3Helper';
import logger from '../../common/helpers/logger';
import { toMoment, now } from '../../common/helpers/moment-utils';
import { sanitizeFilename } from '../../common/helpers/strings';
import { deferred } from '../../common/helpers/deferred';
import { isRevaAdmin } from '../../common/helpers/auth';
import { getActiveLeaseByPartyId, getSubmittedOrExecutedLeaseByPartyId, getUnitNameForActiveLeaseByPartyIds } from '../dal/leaseRepo';
import { getActiveLeaseWorkflowDataByPartyId } from '../dal/activeLeaseWorkflowRepo';
import { getInventoriesQualifiedNamesByIds } from '../dal/inventoryRepo';
import { getCommunicationsForPartyByCategory } from '../dal/communicationRepo';
import { getAllScreeningResultsForParty } from '../../rentapp/server/services/screening';

const FOLDER_NAME_MAX_LENGTH = 100; // limited to 100 chars - CPM-20296

const getQuoteAndInventory = async (ctx, result) => {
  const quote = await getQuoteById(ctx, result.quoteId);

  const inventories = quote?.inventoryId && (await getInventoriesQualifiedNamesByIds(ctx, [quote.inventoryId]));
  const inventoryName = inventories && inventories.length ? inventories[0].fullQualifiedName : '';

  return {
    quote,
    inventoryName,
  };
};

const getPartyInfoFileData = async (ctx, partyId, tenantId) => {
  const party = await partyRepo.loadParty(ctx, partyId);
  const partyMembers = await partyRepo.loadPartyMembers(ctx, partyId);
  const additionalInfo = await partyRepo.getAdditionalInfoByPartyAndType(ctx, partyId);
  const children = additionalInfo.filter(info => info.type === AdditionalInfoTypes.CHILD);
  const pets = additionalInfo.filter(info => info.type === AdditionalInfoTypes.PET);
  const vehicles = additionalInfo.filter(info => info.type === AdditionalInfoTypes.VEHICLE);
  const insuranceChoices = additionalInfo.filter(info => info.type === AdditionalInfoTypes.INSURANCE_CHOICE);
  const residents = partyMembers.filter(member => member.memberType === DALTypes.MemberType.RESIDENT);
  const guarantors = partyMembers.filter(member => member.memberType === DALTypes.MemberType.GUARANTOR);
  const leases = await getActiveLeaseByPartyId(ctx, partyId);
  const screenings = await getAllScreeningResultsForParty(ctx, partyId);
  const screeningResults = await mapSeries(screenings.screeningResults, async result => ({
    applicationDecision: result.applicationDecision,
    rentData: result.rentData,
    recommendations: result.recommendations,
    quoteAndInventory: await getQuoteAndInventory(ctx, result),
  }));

  const { timezone } = await getPropertyById(ctx, party.assignedPropertyId, false);

  const { additionalDataList, applicationDataList } = await getPartyPersonApplicationsData(ctx, partyId);
  const incomeSources = getIncomeSources(additionalDataList);

  const addressHistory = getAddressHistory(additionalDataList);
  const disclosures = await getDisclosures(ctx, additionalDataList);
  const partyInvoices = await getFormattedPartyInvoices(ctx, tenantId, partyId);

  return {
    party,
    children,
    pets,
    vehicles,
    insuranceChoices,
    residents,
    guarantors,
    applicationDataList,
    incomeSources,
    addressHistory,
    disclosures,
    partyInvoices,
    leases,
    screeningResults,
    timezone,
  };
};

const getPartyDocuments = async (ctx, partyId) => {
  logger.debug({ ctx, partyId }, 'getPartyDocuments');
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) {
    logger.debug({ ctx, partyId }, 'getPartyDocuments no partyApplication found');
    return [];
  }
  logger.trace({ ctx, partyId }, 'getPartyDocuments got partyApplication');

  const personApplicationDocuments = await getPersonApplicationDocumentsByPartyId(ctx, partyId);
  logger.trace({ ctx, partyId, numDocuments: personApplicationDocuments.length }, 'getPartyDocuments got partyApplication documents');
  let documentList = personApplicationDocuments.reduce((acc, document) => {
    const {
      documentId,
      documentName,
      accessType,
      uploadingUser: { personId },
    } = document.metadata;
    try {
      const personApplicationDocument = {
        stream: downloadDocument(ctx, documentId),
        name: documentName,
        accessType,
        personId,
      };
      acc.push(personApplicationDocument);
    } catch (error) {
      logger.error({ ctx, partyId, documentId, error }, 'document not found on aws');
    }
    return acc;
  }, []);

  const partyDocuments = await getDocumentsByPartyApplicationId(ctx, partyApplication.id);

  documentList = documentList.concat(
    partyDocuments.reduce((acc, document) => {
      const { id, originalName } = document.metadata.file;
      const { personId } = document.metadata.document.uploadingUser;
      try {
        const partyDocument = {
          stream: downloadDocument(ctx, id),
          name: originalName,
          accessType: document.metadata.accessType,
          personId,
        };
        acc.push(partyDocument);
      } catch (error) {
        logger.error({ ctx, partyId, documentId: id, error }, 'document not found on aws');
      }
      return acc;
    }, []),
  );
  return documentList;
};

// we need to validate tje quotePromotion.id (lease.id from query ), all approval notes should have an id, if not, they are decline notes
const getFilteredPromotedQuoteInformation = async (ctx, partyId) => {
  const { rows = [] } = await partyRepo.getPromotedQuotesInformationByPartyId(ctx, partyId);
  const approvedPromotedQuotes = rows.filter(
    quotePromotion =>
      (quotePromotion.promotionStatus === DALTypes.PromotionStatus.APPROVED || quotePromotion.promotionStatus === DALTypes.PromotionStatus.CANCELED) &&
      quotePromotion.leaseType !== DALTypes.PartyTypes.CORPORATE &&
      quotePromotion.applicationDecision !== ScreeningDecision.APPROVED &&
      quotePromotion.id,
  );
  const declinedPromotedQuote = rows.find(
    quotePromotion =>
      quotePromotion.promotionStatus === DALTypes.PromotionStatus.CANCELED &&
      quotePromotion.leaseType !== DALTypes.PartyTypes.CORPORATE &&
      quotePromotion.applicationDecision !== ScreeningDecision.APPROVED,
  );
  if (!rows.length) return [];

  return {
    approvedPromotedQuotes,
    declinedPromotedQuote,
  };
};

const formatNote = note => (!isEmpty(note) ? note : PartyExportConstants.DEFAULT_NOTE);

const formatLeaseNotes = async (ctx, partyId, isAnAuthorizedUser, options) => {
  const notes = [];
  const promotedQuoteInformation = await getFilteredPromotedQuoteInformation(ctx, partyId);
  if (promotedQuoteInformation.approvedPromotedQuotes?.length) {
    promotedQuoteInformation.approvedPromotedQuotes.forEach(approvedPromotedQuote => {
      notes.push({
        id: approvedPromotedQuote.id,
        info: {
          approvalNotes: formatNote(approvedPromotedQuote.notes),
          status: DALTypes.PromotionStatus.APPROVED,
          propertyTimeZone: options.propertyTimeZone,
          isAnAuthorizedUser,
          ...approvedPromotedQuote,
        },
      });
    });
  }
  if (promotedQuoteInformation.declinedPromotedQuote) {
    const { rows: declinedApplications = [] } = await getDeclineNotesByPartyId(ctx, partyId);
    if (declinedApplications.length) {
      declinedApplications.forEach(declineApplication => {
        notes.push({
          id: declineApplication.id,
          info: {
            declinedNotes: formatNote(declineApplication.notes),
            status: DALTypes.PromotionStatus.CANCELED,
            propertyTimeZone: options.propertyTimeZone,
            isAnAuthorizedUser,
            user: declineApplication.user,
            created_at: declineApplication.created_at,
          },
        });
      });
    }
  }
  if (!notes.length) notes.push({ info: { isAnAuthorizedUser } });
  return notes;
};

const getLeaseNotesfromPartyId = async (ctx, partyId, isAnAuthorizedUser) => {
  try {
    const assignedPropertyId = await partyRepo.getAssignedPropertyByPartyId(ctx, partyId);
    const propertyTimeZone = assignedPropertyId ? await getPropertyTimezone(ctx, assignedPropertyId) : UTC_TIMEZONE;
    const publishedPartyQuotes = await getPublishedQuotesByPartyId(ctx, partyId);
    if (!publishedPartyQuotes.length) return [{ info: { isAnAuthorizedUser } }];
    return await formatLeaseNotes(ctx, partyId, isAnAuthorizedUser, { propertyTimeZone });
  } catch (err) {
    logger.error({ ctx, partyId, err }, 'error getting lease Notes');
    return [{ info: { isAnAuthorizedUser } }];
  }
};

const getOriginPartyIdByPartyId = async (ctx, partyId) => {
  const rows = await partyRepo.getOriginPartyIdByPartyId(ctx, partyId);
  const originalParty = rows.find(row => row.workflowName === DALTypes.WorkflowName.NEW_LEASE);
  if (!originalParty) return null;
  return originalParty.id;
};

const getLeaseNotes = async (ctx, partyId, isAnAuthorizedUser, options) => {
  logger.trace({ ctx, partyId, options, isAnAuthorizedUser }, 'getting lease notes');
  const newPartyId = (await getOriginPartyIdByPartyId(ctx, partyId)) || partyId;
  return await getLeaseNotesfromPartyId(ctx, newPartyId, isAnAuthorizedUser);
};

const getLeaseDocumentsFromPartyId = async (ctx, partyId, leases) => {
  if (!leases.length) return [];
  const documents = await Promise.all(leases.map(async lease => await getSignedDocumentsForLease(ctx, lease.id)));
  const streams = await Promise.all(
    flatten(documents).map(async document => {
      const { documentName, leaseId, uploadFileName, documentNames, envelopeId } = document.metadata;
      // for backward compatibility with existing documents
      if (documentName) {
        const formattedName = path.extname(documentName) === '.pdf' ? documentName : `${documentName}.pdf`;
        return {
          stream: downloadLeaseDocument(ctx, envelopeId, document.uuid),
          name: formattedName,
        };
      }
      if (documentNames) {
        logger.trace({ ctx, partyId, document }, 'exporting lease document');
        const name = uploadFileName || (await getNameForExportedLease(ctx, leaseId));
        return {
          stream: downloadLeaseDocument(ctx, leaseId, document.uuid),
          name,
        };
      }

      logger.error({ ctx, partyId }, 'partyExport - failed to export lease documents');
      return { stream: [], name: document.id };
    }),
  );
  return streams;
};

const getLeaseDocuments = async (ctx, partyId, lease) => {
  if (!lease) return [];
  return await getLeaseDocumentsFromPartyId(ctx, partyId, [lease]);
};

const getCreditReportByQuoteId = async (ctx, partyId, creditReports) => {
  const promotedLease = await getSubmittedOrExecutedLeaseByPartyId(ctx, partyId);
  const quoteId = promotedLease?.quoteId || null;
  if (quoteId) {
    return creditReports.filter(creditReport => creditReport.quoteId === quoteId);
  }
  logger.trace({ ctx, quoteId, partyId }, 'no valid credit report found');
  return creditReports;
};

const getScreeningCreditReport = async (ctx, partyId = '', isAuditor, excludeObsolete = true, allowUnmatched = true, returnAll = true) => {
  const { getScreeningReportSummary } = require('../../rentapp/server/services/screening'); // eslint-disable-line global-require
  const creditReports = [].concat(await getScreeningReportSummary(ctx, { partyId, excludeObsolete, allowUnmatched, returnAll }));
  if (isAuditor) {
    return creditReports;
  }
  return getCreditReportByQuoteId(ctx, partyId, creditReports);
};

// hack to avoid big font sizes when converting html to pdf
const addZoomConfigToHtml = html => {
  const STYLE_TAG = '<STYLE>';
  const indexOfStyle = html.indexOf(STYLE_TAG) + STYLE_TAG.length;
  return `${html.slice(0, indexOfStyle)} ${PartyExportConstants.PARTY_CREDIT_REPORT_FIX_STYLE} ${html.slice(indexOfStyle)}`;
};

const getFormattedCreditReport = async creditReports => {
  if (!creditReports?.length) return [];
  const filteredCreditReports = creditReports.filter(creditReport => creditReport?.createdAt && creditReport?.backgroundReport);
  const listOfCreditReports = [];
  await mapSeries(filteredCreditReports, async creditReport => {
    try {
      const { createdAt, backgroundReport } = creditReport;
      const formattedCreditReport = addZoomConfigToHtml(backgroundReport);
      const pdf = htmlToPdf.create(formattedCreditReport);
      const pdfToStream = thenify(pdf.toStream, pdf);
      const stream = await pdfToStream();
      const formattedName = `${PartyExportConstants.PARTY_CREDIT_REPORT_FILE} - ${createdAt}.pdf`.replace(/\//g, '-');
      listOfCreditReports.push({ stream, name: formattedName });
    } catch (e) {
      logger.error({ creditReportId: creditReport.id, error: e }, 'error while processing screening report stream');
    }
  });
  return listOfCreditReports;
};

const getFullCreditReport = async (ctx, partyId, options) => {
  logger.trace({ ctx, partyId, options }, 'getFullCreditReport');
  const { isAuditor, party, currentUserLaaAccessLevels } = options;
  try {
    const newPartyId = (await getOriginPartyIdByPartyId(ctx, partyId)) || partyId;
    const creditReports = await getScreeningCreditReport(ctx, newPartyId, isAuditor);
    const filteredCreditReports = isAuditor
      ? creditReports
      : creditReports.filter(creditReport =>
          isUserAuthorizedToExportCreditReport(creditReport.applicationDecision, { laaAccessLevels: currentUserLaaAccessLevels }, party.ownerTeam),
        );

    return await getFormattedCreditReport(filteredCreditReports);
  } catch (e) {
    logger.error({ ctx, partyId, error: e }, 'error on adding credit report to exported party file');
    return [];
  }
};

const getQuoteTemplate = async (ctx, quote, partyId) => {
  logger.trace({ ctx, partyId, quote }, 'get quote template');

  const context = TemplateTypes.EMAIL;
  const { leaseState, timezone } = quote;
  const inventoryId = quote.inventory.id;
  const isRenewalQuote = leaseState === DALTypes.LeaseState.RENEWAL;
  const templateName = !isRenewalQuote ? TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE : undefined;
  const inventory = await getInventoryItem(ctx, inventoryId);
  const unitName = await getShortFormatRentableItem(ctx, inventoryId);
  const createdAt = toMoment(quote.created_at, { timezone }).format(EXPORT_FILENAME_TIMESTAMP_FORMAT);

  const propertyTemplate = isRenewalQuote
    ? {
        section: 'QUOTE',
        action: 'RENEWAL_LETTER',
        propertyId: inventory?.propertyId,
      }
    : undefined;
  const personId = await partyRepo.getARandomPersonIdByPartyId(ctx, [partyId], { excludeInactive: true });
  const templateArgs = { quoteId: quote.id, personId };
  const templateArguments = isRenewalQuote ? { ...templateArgs, personId } : { quoteId: quote.id };
  const templateDataOverride = { quote: { hideApplicationLink: true } };
  const quoteTemplate = await renderTemplate(ctx, {
    propertyTemplate,
    templateName,
    context,
    partyId,
    templateDataOverride,
    templateArgs: { ...templateArguments, inventoryId, seedPartyAllowedWorkflowStates: [DALTypes.WorkflowState.ACTIVE, DALTypes.WorkflowState.ARCHIVED] },
  });
  return { ...quoteTemplate, unitName, createdAt };
};

const getQuotes = async (ctx, party, lease) => {
  let quotesToExport;

  const quotesByPartyId = (await getAllQuotesByPartyId(ctx, party.id)) || [];
  const publishedQuotes = quotesByPartyId.filter(quote => quote.publishDate);

  if (lease && party.leaseType === DALTypes.PartyTypes.CORPORATE) {
    const inventoryId = lease.baselineData.quote.inventoryId;
    quotesToExport = publishedQuotes.filter(quote => quote.publishedQuoteData.inventoryId === inventoryId);
  } else quotesToExport = publishedQuotes;

  return await mapSeries(quotesToExport, quote => getQuoteTemplate(ctx, quote, quote.partyId));
};

const getPartyQuote = async (ctx, party, lease) => {
  try {
    const quotes = await getQuotes(ctx, party, lease);
    const pdfQuotes = await Promise.all(
      quotes.map(async quote => {
        const pdf = htmlToPdf.create(quote.body);
        const pdfToStream = thenify(pdf.toStream, pdf);
        const stream = await pdfToStream();
        return { stream, name: `${PartyExportConstants.QUOTE_BASE_NAME} ${quote.unitName} ${quote.createdAt}.pdf`, unitName: quote.unitName };
      }),
    );
    return pdfQuotes;
  } catch (e) {
    logger.error({ ctx, partyId: party.id, error: e }, 'error on adding quote to exported party file');
    return [];
  }
};

const getAdverseLetters = async (ctx, party, timezone) => {
  try {
    const comms = await getCommunicationsForPartyByCategory(ctx, party.id, DALTypes.CommunicationCategory.APPLICATION_DECLINED);
    const emailComms = comms.filter(comm => comm.type === DALTypes.CommunicationMessageType.EMAIL);

    const pdfLetters = await Promise.all(
      emailComms.map(async comm => {
        const pdf = htmlToPdf.create(comm.message.html);
        const pdfToStream = thenify(pdf.toStream, pdf);
        const stream = await pdfToStream();
        const createdAt = toMoment(comm.created_at, { timezone }).format(EXPORT_FILENAME_TIMESTAMP_FORMAT);
        return { stream, name: `${PartyExportConstants.ADVERSE_LETTER}-${createdAt}.pdf` };
      }),
    );
    return pdfLetters;
  } catch (e) {
    logger.error({ ctx, partyId: party.id, error: e }, 'error on adding adverse letters to exported party file');
    throw e;
  }
};

const getPdfOptionsForPartyInfoFile = (partyInfoFileName, partyId) => ({
  format: PartyExportConstants.PARTY_INFO_FILE_PAGE_SIZE,
  header: {
    height: PartyExportConstants.PARTY_INFO_HEADER_HEIGHT,
    contents: replaceTemplatedValues(PartyExportConstants.PARTY_INFO_HEADER_CONTENT, {
      reportName: partyInfoFileName,
      reportTitle: PartyExportConstants.PARTY_INFO_FILE_TITLE,
    }),
  },
  footer: {
    height: PartyExportConstants.PARTY_INFO_FOOTER_HEIGHT,
    contents: {
      default: replaceTemplatedValues(PartyExportConstants.PARTY_INFO_FOOTER_CONTENT, {
        partyId,
      }),
    },
  },
});

const getPartyFileName = (partyId, unit = '', residentsNames = '') => {
  let partyInfoFileName = '';

  if (unit) partyInfoFileName += `${unit} - `;

  partyInfoFileName += `${residentsNames} - ${partyId.substr(-6)}`;
  const sanitizedFilename = sanitizeFilename(partyInfoFileName);

  return sanitizedFilename.substr(0, FOLDER_NAME_MAX_LENGTH);
};

const checkExportAuthorizedUser = async (ctx, partyId, isAuditorRequest) => {
  const partyTeams = (await partyRepo.getTeamsForParties(ctx, [partyId])) || [];
  const authUserTeams = ctx?.authUser?.teams || [];
  const ownerTeam = await partyRepo.getOwnerTeamByPartyId(ctx, partyId);
  const associatedOwnerTeamNames = (ownerTeam?.metadata?.associatedTeamNames?.split(',') || []).map(t => t.trim());
  const associatedOwnerTeamIds = (await getTeamsByNames(ctx, uniq(associatedOwnerTeamNames))).map(t => t.id);
  const allPartyTeams = [...partyTeams, ...associatedOwnerTeamIds];

  const allAuthUserTeams = await mapSeries(authUserTeams, async team => {
    const associatedTeamNames = (team?.metadata?.associatedTeamNames?.split(',') || []).map(t => t.trim());
    const associatedTeamIds = (await getTeamsByNames(ctx, uniq(associatedTeamNames))).map(t => t.id);
    return {
      ...team,
      associatedTeamIds: associatedTeamIds || [],
    };
  });

  if (!allPartyTeams.length || !allAuthUserTeams.length) return false;
  const functionalRoles = allAuthUserTeams.reduce((acc, team) => {
    if (allPartyTeams.includes(team.id)) {
      acc.push(...team.functionalRoles);
    }

    if (intersection(allPartyTeams, team.associatedTeamIds).length) {
      acc.push(...team.functionalRoles);
    }
    return acc;
  }, []);

  const currentUserLaaAccessLevels = authUserTeams.map(team => ({ teamId: team.id, laaAccessLevels: team.laaAccessLevels }));
  const authorizedRoles = [FunctionalRoleDefinition.LAA.name];
  const isAdmin = isRevaAdmin(ctx.authUser);
  const hasAuditorRole = functionalRoles.some(r => r === FunctionalRoleDefinition.AUD.name);
  const isAuditor = isAuditorRequest && hasAuditorRole;
  if (!isAdmin && functionalRoles) {
    const isAnAuthorizedUser = functionalRoles.some(r => authorizedRoles.includes(r));
    return { isAnAuthorizedUser, isAuditor, currentUserLaaAccessLevels };
  }
  return { isAnAuthorizedUser: isAdmin, isAuditor, currentUserLaaAccessLevels };
};

const getPartyFolderName = (partyToExport, lease, alwd, inventoryName, timezone) => {
  let folderName;
  let unitName;
  let leaseStartDate;
  let leaseEndDate;

  if (lease && lease.baselineData) {
    leaseStartDate = lease.baselineData?.publishedLease?.leaseStartDate;
    leaseEndDate = lease.baselineData?.publishedLease?.leaseEndDate;
    unitName = lease.baselineData?.quote?.unitName;
  } else if (alwd && alwd.leaseData) {
    leaseStartDate = alwd.leaseData.leaseStartDate;
    leaseEndDate = alwd.leaseData.leaseEndDate;
    unitName = inventoryName;
  }

  const residentsNames = getMemberNames(partyToExport.partyMembers);

  if (leaseStartDate && leaseEndDate && unitName) {
    if (toMoment(leaseStartDate, { timezone }).isAfter(now({ timezone }))) {
      folderName = `${PartyExportConstants.UPCOMING_LEASE} - ${residentsNames} - ${partyToExport.id.substr(-6)}`;
    } else if (toMoment(leaseEndDate, { timezone }).isBefore(now({ timezone }))) {
      folderName = `${PartyExportConstants.PAST_LEASE}${toMoment(leaseEndDate, { timezone }).format(
        PARTY_EXPORT_FILENAME_FORMAT,
      )} - Unit ${unitName} - ${residentsNames} - ${toMoment(leaseStartDate, { timezone }).format(PARTY_EXPORT_FILENAME_FORMAT)} - ${partyToExport.id.substr(
        -6,
      )}`;
    } else {
      folderName = `${PartyExportConstants.CURRENT_LEASE}${toMoment(leaseEndDate, { timezone }).format(
        PARTY_EXPORT_FILENAME_FORMAT,
      )} - Unit ${unitName} - ${residentsNames} - ${toMoment(leaseStartDate, { timezone }).format(PARTY_EXPORT_FILENAME_FORMAT)} - ${partyToExport.id.substr(
        -6,
      )}`;
    }
  } else {
    folderName = `${PartyExportConstants.UPCOMING_LEASE} - ${residentsNames} - ${partyToExport.id.substr(-6)}`;
  }

  return folderName.substr(0, FOLDER_NAME_MAX_LENGTH);
};

const createAndAddDocs = async (ctx, zipFile, partyId, directoryName, otherData) => {
  const {
    children,
    pets,
    vehicles,
    insuranceChoices,
    residents,
    guarantors,
    applicationDataList,
    incomeSources,
    addressHistory,
    disclosures,
    partyInvoices,
    partyWorkflowStatus,
    isAuditorRequest,
    party,
    partyInfoFileName,
    screeningResults,
    lease,
    timezone,
  } = otherData;

  const partyDocuments = await getPartyDocuments(ctx, partyId);
  const partyDocumentsSummary = [];
  partyDocuments.forEach(({ stream, name, accessType, personId }) => {
    partyDocumentsSummary.push({ name, accessType, personId });
    zipFile.append(stream, { name: `${directoryName}${name}` });
  });

  const leaseDocuments = await getLeaseDocuments(ctx, partyId, lease);
  leaseDocuments.forEach(({ stream, name }) => zipFile.append(stream, { name: `${directoryName}${name}` }));

  const { isAnAuthorizedUser, isAuditor, currentUserLaaAccessLevels } = await checkExportAuthorizedUser(ctx, partyId, isAuditorRequest);

  const isAuthorized = isAnAuthorizedUser || isAuditor;
  const leaseNotes = await getLeaseNotes(ctx, partyId, isAuthorized, { party, partyWorkflowStatus });

  if (isAuthorized) {
    const fullCreditReport = await getFullCreditReport(ctx, partyId, { party, partyWorkflowStatus, isAuditor, currentUserLaaAccessLevels });
    fullCreditReport.forEach(({ stream, name }) => zipFile.append(stream, { name: `${directoryName}${name}` }));
  }

  const quotes = await getPartyQuote(ctx, party, lease);
  quotes?.forEach(({ stream, name }) => zipFile.append(stream, { name: `${directoryName}${name}` }));

  const adverseLetters = await getAdverseLetters(ctx, party, timezone);
  adverseLetters?.forEach(({ stream, name }) => zipFile.append(stream, { name: `${directoryName}${name}` }));

  const htmlTemplate = await convertReactComponentToHtml(PartyExportTemplate, {
    leaseNotes,
    residents,
    guarantors,
    children,
    pets,
    vehicles,
    insuranceChoices,
    incomeSources,
    addressHistory,
    partyDocumentsSummary,
    disclosures,
    partyInvoices,
    screeningResults,
    applicationDataList,
  });

  const pdfOptions = await getPdfOptionsForPartyInfoFile(partyInfoFileName, partyId);

  const pdf = htmlToPdf.create(htmlTemplate, pdfOptions);
  const pdfToStream = thenify(pdf.toStream, pdf);
  const stream = await pdfToStream();

  await zipFile.append(stream, { name: `${directoryName}${PartyExportConstants.PARTY_INFO_FILE}` });
};

const addDocumentsToZip = async (zipFile, ctx, reqPartyId) => {
  const tenantId = ctx.tenantId;
  const isAuditorRequest = ctx?.query?.isAuditor === 'true';
  let partyInfoFileName;
  let unitNameForParty;

  try {
    let partiesToExport;

    const reqParty = await partyRepo.loadParty(ctx, reqPartyId);
    const allPartiesInGroup = await partyRepo.getPartiesByPartyGroupId(ctx, reqParty.partyGroupId);
    const newLeaseAndRenewalWfs = allPartiesInGroup.filter(party =>
      [DALTypes.WorkflowName.NEW_LEASE, DALTypes.WorkflowName.RENEWAL].includes(party.workflowName),
    );

    const activeLeaseWf = allPartiesInGroup.filter(party => party.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);

    if (newLeaseAndRenewalWfs.length > 0) {
      partiesToExport = newLeaseAndRenewalWfs;
    } else {
      // this means we only have an active lease, from the import.
      partiesToExport = activeLeaseWf;
    }

    const allPMs = await partyRepo.loadPartyMembersBy(ctx, q =>
      q.whereIn(
        'PartyMember.partyId',
        partiesToExport.map(party => party.id),
      ),
    );

    if (reqParty.leaseType === DALTypes.PartyTypes.TRADITIONAL) {
      const alwd = await getActiveLeaseWorkflowDataByPartyId(ctx, reqParty.id);
      const inventoryId = alwd?.leaseData?.inventoryId;
      const inventories = inventoryId && (await getInventoriesQualifiedNamesByIds(ctx, [inventoryId]));
      const inventoryName = inventories && inventories.length ? inventories[0].fullQualifiedName : '';
      const partiesToExportIds = partiesToExport.map(party => party.id);
      const unitsNames = await getUnitNameForActiveLeaseByPartyIds(ctx, partiesToExportIds);
      const unitNameForLease = unitsNames.find(unitName => unitName);
      unitNameForParty = unitNameForLease?.unitName || inventoryName;
    }

    const memberNames = getMemberNames(allPMs);
    partyInfoFileName = getPartyFileName(reqParty.partyGroupId, unitNameForParty, memberNames);

    await mapSeries(partiesToExport, async partyToExport => {
      const partyId = partyToExport.id;

      const {
        children,
        pets,
        vehicles,
        insuranceChoices,
        residents,
        guarantors,
        applicationDataList,
        incomeSources,
        addressHistory,
        disclosures,
        partyInvoices,
        party,
        leases,
        screeningResults,
        timezone,
      } = await getPartyInfoFileData(ctx, partyId, tenantId);

      const partyWorkflowStatus = await partyRepo.getPartyWorkflowByPartyId(ctx, partyId);

      if (!leases.length || party.leaseType === DALTypes.PartyTypes.TRADITIONAL) {
        const lease = leases.length ? leases[0] : null;
        const alwdForExportedParty = await getActiveLeaseWorkflowDataByPartyId(ctx, partyId);
        const partyFolderName = getPartyFolderName(party, lease, alwdForExportedParty, unitNameForParty, timezone);
        const directoryName = `${partyInfoFileName}/${partyFolderName}/`;
        zipFile.append(null, { name: directoryName });

        await createAndAddDocs(ctx, zipFile, partyId, directoryName, {
          children,
          pets,
          vehicles,
          insuranceChoices,
          residents,
          guarantors,
          applicationDataList,
          incomeSources,
          addressHistory,
          disclosures,
          partyInvoices,
          partyWorkflowStatus,
          isAuditorRequest,
          party,
          partyInfoFileName,
          screeningResults,
          lease,
          timezone,
        });
      } else if (party.leaseType === DALTypes.PartyTypes.CORPORATE) {
        await mapSeries(leases, async lease => {
          const unitName = lease?.baselineData?.quote?.unitName;

          const partyFolderName = getPartyFolderName(party, lease, null, unitName, timezone);
          const directoryName = `${partyInfoFileName}/${partyFolderName}/`;
          zipFile.append(null, { name: directoryName });

          await createAndAddDocs(ctx, zipFile, partyId, directoryName, {
            children,
            pets,
            vehicles,
            insuranceChoices,
            residents,
            guarantors,
            applicationDataList,
            incomeSources,
            addressHistory,
            disclosures,
            partyInvoices,
            partyWorkflowStatus,
            isAuditorRequest,
            party,
            screeningResults,
            partyInfoFileName,
            lease,
            timezone,
          });
        });
      }
    });
  } catch (error) {
    logger.error({ ctx, error }, 'Error creating party export report');
    throw error;
  } finally {
    zipFile.finalize();
  }

  return { zipFileName: `${partyInfoFileName}.zip` };
};

const createPartyZipFile = async (ctx, dirPath) => {
  const dfd = deferred();

  const partyId = ctx.params.partyId;
  const fileTempPath = `${dirPath}/${PartyExportConstants.EXPORT_FILE_NAME}`;
  const output = fs.createWriteStream(fileTempPath);
  const zipFile = archiver('zip', {
    store: true, // Sets the compression method to STORE.
  });

  zipFile.on('error', error => dfd.reject(error));

  zipFile.pipe(output);

  const { zipFileName } = await addDocumentsToZip(zipFile, ctx, partyId);

  output.on('close', async () => {
    const { state } = await partyRepo.loadParty(ctx, partyId);
    await logEntity(ctx, { entity: { id: partyId, state }, activityType: ACTIVITY_TYPES.EXPORT, component: COMPONENT_TYPES.PARTY });

    dfd.resolve({
      type: 'stream',
      filename: zipFileName,
      stream: fs.createReadStream(fileTempPath),
    });
  });

  return dfd;
};

function redirectFunction() {
  let authToken = '';
  const localStorageAuth = window.lsGet('revatech-auth', {});
  if (localStorageAuth.token) {
    authToken = localStorageAuth.token;
  }
  const replacedURL = window.location.href.replace(/\/proxy$/, '');
  const theURL = `${replacedURL}?token=${authToken}`;
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function handleStateChange() {
    if (xmlHttp.readyState === 4) {
      if (xmlHttp.status === 200) {
        window.open(theURL, '_self');
      }
      if (xmlHttp.status === 401 || xmlHttp.status === 404) {
        window.open(window.location.href.replace(/\/api\/.*$/g, '/*'), '_self');
      }
    }
  };
  xmlHttp.open('GET', theURL, true);
  xmlHttp.send(null);
}

export const exportPartyFromHtml = async res => {
  res.send(`<!DOCTYPE html>
  <html>
  <head>
  <script>
   ${redirectFunction.toString()}
  </script>
  </head>
  <body onload="redirectFunction()">
  </body>
  </html>`);
};

export const exportParty = async req => {
  temp.track();
  const mkdir = thenify(temp.mkdir);
  try {
    const dirPath = await mkdir(PartyExportConstants.EXPORT_FOLDER_NAME);
    return await createPartyZipFile(req, dirPath);
  } catch (error) {
    logger.error({ ctx: req, err: error }, 'exportParty error trying to create the zip file');
    throw error;
  }
};
