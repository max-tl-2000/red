/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAllScreeningResultsForParty } from '../dal/fadv-submission-repo';
import { getPersonApplicationsByFilter } from '../dal/person-application-repo';
import { areAllScreeningsCompleted } from '../helpers/screening-helper';
import { loadPartyMembers, isCorporateLeaseType } from '../../../server/dal/partyRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { applicationSummaryStatus } from '../../common/application-constants';

export const allPartyMembersHavePersonApplication = (members, applicationsByParty = []) =>
  members.every(member => applicationsByParty.some(app => app.personId === member.personId));

const areAllApplicationsCompleted = async (ctx, applicationsByParty, partyId) => {
  const members = await loadPartyMembers(ctx, partyId);
  return (
    allPartyMembersHavePersonApplication(members, applicationsByParty) &&
    applicationsByParty.every(app => app.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED)
  );
};

const getScreeningSummaryStatus = isCompleted => (isCompleted ? applicationSummaryStatus.COMPLETE : applicationSummaryStatus.INCOMPLETE);

const getApplicationSummaryStatus = (isCompleted, noPaidApplications) => {
  if (noPaidApplications) return applicationSummaryStatus.NO_DATA;
  return isCompleted ? applicationSummaryStatus.COMPLETE : applicationSummaryStatus.INCOMPLETE;
};
const addStatusDescription = applicationSummary => ({
  ...applicationSummary,
  applicationStatus: getApplicationSummaryStatus(applicationSummary.applicationsCompleted, applicationSummary.noPaidApplications),
  screeningStatus: getScreeningSummaryStatus(applicationSummary.screeningsCompleted),
});

export const getApplicationSummaryForParty = async (ctx, partyId) => {
  const isCorporateParty = await isCorporateLeaseType(ctx, partyId);
  if (isCorporateParty) return null;

  const applicationSummary = { screeningsCompleted: false, applicationsCompleted: false, noPaidApplications: false };
  const applicationsByParty = await getPersonApplicationsByFilter(ctx, { partyId });
  if (!applicationsByParty || !applicationsByParty.length) return addStatusDescription({ ...applicationSummary, noPaidApplications: true });

  const applicationsCompleted = await areAllApplicationsCompleted(ctx, applicationsByParty, partyId);

  const screeningResults = await getAllScreeningResultsForParty(ctx, partyId);
  if (!screeningResults || !screeningResults.length) return addStatusDescription({ ...applicationSummary, applicationsCompleted });

  return addStatusDescription({
    ...applicationSummary,
    screeningsCompleted: areAllScreeningsCompleted(screeningResults),
    applicationsCompleted,
  });
};
