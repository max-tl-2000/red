/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTranslatedScreeningRecommendations } from 'helpers/quotes';
import { t } from 'i18next';
import { observable, computed, action } from 'mobx';
import maxBy from 'lodash/maxBy';
import { getShapeAndColorByApplicationStatus } from 'helpers/quotesTable';
import isEmpty from 'lodash/isEmpty';
import { ExpirationScreeningTypes } from '../../../common/enums/fadvRequestTypes';
import {
  areAllGuarantorsLinkedWhenNeeded,
  getUserFriendlyStatus,
  getCreditFreezeStatus,
  getDelayedCreditAndCriminalStatuses,
  getInternationalAddressDecisionForUser,
} from '../../../common/helpers/applicants-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { getQuoteAndLeaseTermMatch, updateTermWithMatrixRents } from '../../../common/helpers/quotes';

class LeaseTermModel {
  constructor({ quoteId, price, quotePublishDate, leaseTerm, screeningSummary, members, screeningExpirationResults, timer, allApplicationsCompleted, user }) {
    Object.assign(this, leaseTerm);
    this.leaseTerm = leaseTerm;
    this.price = price;
    this.quoteId = quoteId;
    this.quotePublishDate = quotePublishDate;
    this.screeningSummary = screeningSummary;
    this.members = members;
    this.screeningExpirationResults = screeningExpirationResults;
    this.timer = timer;
    this.allApplicationsCompleted = allApplicationsCompleted;
    this.user = user;
  }

  getTimeDiffInSeconds = startTime => this.timer.getTimeDiffInSeconds(startTime);

  // Based on the time the application was ready for screening (startTime) return an appropriate
  // token reflecting the delay
  getDelayedDecision = startTime => {
    const diffInSeconds = this.getTimeDiffInSeconds(startTime);

    if (diffInSeconds < 600) return ScreeningDecision.COMPILING;
    if (diffInSeconds < 7200) return ScreeningDecision.COMPILING_DELAYED;
    if (diffInSeconds >= 7200) return ScreeningDecision.RESULTS_DELAYED;
    return ScreeningDecision.NO_SCREENING_RESPONSE;
  };

  // TODO: use screeningResults instead?
  // note this function ONLY applies when we have NO results (is not called when we have incomplete responses)
  getDecisionWhenNoScreeningResponses = (quoteId, leaseTerm, screeningRequests) =>
    screeningRequests.reduce(
      (acc, screeningRequest) => {
        const { leaseTermMatches, quoteMatches } = getQuoteAndLeaseTermMatch(leaseTerm, quoteId, screeningRequest);
        const { applicants } = screeningRequest.applicantData || [];
        const hasInternationalAddress = applicants.some(applicant => applicant.haveInternationalAddress);
        if (leaseTermMatches && quoteMatches && hasInternationalAddress) {
          acc.applicationDecision = ScreeningDecision.NO_SCREENING_RESPONSE_INTERNATIONAL_ADDRESS;
          acc.internationalAddressDecisionForUser = getInternationalAddressDecisionForUser(applicants);
        } else if (leaseTermMatches && quoteMatches) {
          const requestCreatedAt = toMoment(screeningRequest.created_at, { timezone: 'UTC' });
          acc.applicationDecision = this.getDelayedDecision(requestCreatedAt);
        }
        return acc;
      },
      { applicationDecision: ScreeningDecision.NO_SCREENING_REQUEST },
    );

  getPreviousResultText = previousResult => {
    const previousDecision = previousResult && (previousResult.customApplicationDecision || previousResult.applicationDecision);
    return previousDecision ? t('PREVIOUS_SCREENING_STATUS', { previous: t(getUserFriendlyStatus(previousDecision)) }) : null;
  };

  getScreeningDisplayInfo = matchedResult => {
    if (!this.allApplicationsCompleted) {
      const { shape, color } = getShapeAndColorByApplicationStatus(ScreeningDecision.INCOMPLETE);
      return { text: getUserFriendlyStatus(ScreeningDecision.INCOMPLETE), shape, color };
    }

    let applicationDecision = matchedResult.customApplicationDecision || matchedResult.applicationDecision;

    let text;
    if (matchedResult.hasNoPendingResponses) {
      text = getUserFriendlyStatus(applicationDecision);
      if (matchedResult.isExpired) {
        applicationDecision = ScreeningDecision.EXPIRED;
        text = getUserFriendlyStatus(applicationDecision);
      }

      const creditAndCriminalStatus = getDelayedCreditAndCriminalStatuses(matchedResult, this.user);
      if (creditAndCriminalStatus) text = creditAndCriminalStatus;

      const creditFreezeStatus = getCreditFreezeStatus(matchedResult);

      if (creditFreezeStatus || creditAndCriminalStatus) {
        applicationDecision = ScreeningDecision.APPROVED_WITH_COND;
      }

      const { shape, color } = getShapeAndColorByApplicationStatus(applicationDecision);
      return { text: creditFreezeStatus || text, shape, color };
    }

    if (!areAllGuarantorsLinkedWhenNeeded(this.members)) {
      const { shape, color } = getShapeAndColorByApplicationStatus(ScreeningDecision.ON_HOLD);
      return { text: getUserFriendlyStatus(ScreeningDecision.ON_HOLD), shape, color };
    }

    const previousResultText = !applicationDecision
      ? null
      : t('PREVIOUS_SCREENING_STATUS', {
          previous: getUserFriendlyStatus(applicationDecision),
        });

    const { applicationDecision: decisionWithoutScreening, internationalAddressDecisionForUser } = this.getDecisionWhenNoScreeningResponses(
      this.quoteId,
      this.leaseTerm,
      this.screeningSummary.screeningRequests,
    );

    const screeningDecision = internationalAddressDecisionForUser || decisionWithoutScreening;
    text = getUserFriendlyStatus(screeningDecision);
    const { shape, color } = getShapeAndColorByApplicationStatus(screeningDecision);

    return { previousResultText, text, delayedDecision: decisionWithoutScreening, shape, color };
  };

  @computed
  get matchedResult() {
    const { screeningResults } = this.screeningSummary;
    return screeningResults.find(screeningResult => {
      const { leaseTermMatches, quoteMatches } = getQuoteAndLeaseTermMatch(this.leaseTerm, this.quoteId, screeningResult);
      const isMatchedResult = leaseTermMatches && quoteMatches && !screeningResult.isObsolete;
      return isMatchedResult;
    });
  }

  @computed
  get baseMarketRent() {
    return this.price;
  }

  @computed
  get previousResult() {
    // returns the most recent matching result that is obsolete
    const { obsoleteScreeningResults = [] } = this.screeningSummary;
    const matchingObsoleteResultsWithDecision = obsoleteScreeningResults.filter(result => {
      const { leaseTermMatches, quoteMatches } = getQuoteAndLeaseTermMatch(this.leaseTerm, this.quoteId, result);
      const isMatchedResult = leaseTermMatches && quoteMatches;
      return isMatchedResult;
    });
    const mostRecentObsoleteResult = maxBy(matchingObsoleteResultsWithDecision, ['created_at', 'submissionResponseCreatedAt']);
    return mostRecentObsoleteResult;
  }

  // returns timestamp of when the application was originally ready for screening
  // timeReadyForScreening is a timestamp (longint)
  // quotePublishDate is a string
  get timeQuoteReadyForScreening() {
    const timeReadyForScreening = toMoment(this.screeningSummary.timeReadyForScreening);
    const quotePublishDate = toMoment(this.quotePublishDate);

    return timeReadyForScreening.isAfter(quotePublishDate) ? timeReadyForScreening : quotePublishDate;
  }

  @computed
  get screening() {
    const matchedResult = this.matchedResult;
    const previousResult = this.previousResult;
    const { expirationScreeningType } = this.screeningExpirationResults;
    const isExpired = expirationScreeningType === ExpirationScreeningTypes.EXPIRED;

    if (!matchedResult) {
      if (isExpired) {
        const applicationDecision = ScreeningDecision.EXPIRED;
        const text = getUserFriendlyStatus(applicationDecision);
        const { shape, color } = getShapeAndColorByApplicationStatus(applicationDecision);
        return {
          shape,
          text,
          color,
          isExpired,
        };
      }

      if (!this.allApplicationsCompleted || !this.quotePublishDate) {
        const applicationDecision = !this.allApplicationsCompleted ? ScreeningDecision.INCOMPLETE : ScreeningDecision.DRAFT;
        const { shape, color } = getShapeAndColorByApplicationStatus(applicationDecision);
        return {
          text: getUserFriendlyStatus(applicationDecision),
          previousResultText: this.getPreviousResultText(previousResult),
          shape,
          color,
        };
      }

      const startTime = toMoment(this.timeQuoteReadyForScreening);
      const delayedDecision = this.getDelayedDecision(startTime);
      const decisionText = getUserFriendlyStatus(delayedDecision);
      const { shape, color } = getShapeAndColorByApplicationStatus(delayedDecision);

      return {
        shape,
        text: decisionText,
        delayedDecision,
        color,
        previousResultText: this.getPreviousResultText(previousResult),
        isExpired,
      };
    }

    const { text, delayedDecision, shape, color } = this.getScreeningDisplayInfo(matchedResult);
    const recommendedConditions = matchedResult.recommendedConditions && getTranslatedScreeningRecommendations(matchedResult.recommendedConditions);

    return {
      result: { ...matchedResult, recommendedConditions },
      shape,
      text,
      delayedDecision,
      color,
      isExpired: matchedResult.isExpired,
    };
  }
}

export class QuoteModel {
  constructor({
    quote,
    screeningSummary = { screeningResults: [], screeningRequests: [] },
    screeningExpirationResults = {
      expirationScreeningType: ExpirationScreeningTypes.NONE,
    },
    members,
    timer,
    allApplicationsCompleted,
    user,
  }) {
    Object.assign(this, quote);
    const getLeaseTermPrice = (currentQuote, leaseTerm) => {
      const { rentMatrix, propertyTimezone, leaseStartDate, publishDate } = currentQuote;
      if (publishDate) return leaseTerm.adjustedMarketRent;
      const adjustedMarketRent = (updateTermWithMatrixRents(leaseTerm, leaseStartDate, rentMatrix, propertyTimezone) || {}).adjustedMarketRent;
      return adjustedMarketRent ? leaseTerm.overwrittenBaseRent || adjustedMarketRent : null;
    };

    // override leaseTerms property of the quote
    const leaseTerms = !isEmpty(quote.selections)
      ? quote.leaseTerms.filter(leaseTerm => quote.selections.selectedLeaseTerms.some(s => leaseTerm.id === s.id))
      : quote.leaseTerms;
    this.leaseTerms = leaseTerms.map(
      leaseTerm =>
        new LeaseTermModel({
          quoteId: quote.id,
          price: getLeaseTermPrice(quote, leaseTerm),
          quotePublishDate: quote.publishDate,
          leaseTerm,
          screeningSummary,
          members,
          screeningExpirationResults,
          timer,
          allApplicationsCompleted,
          user,
        }),
    );
  }
}

// Every 15 seconds application status will be computed if the screening doesnt have response
const TIMEOUT_UPDATE_NOW_UTC = 15000;

class Timer {
  @observable
  nowUtc;

  constructor() {
    this.nowUtc = now({ timezone: 'UTC' });
    if (this.timeOut) clearTimeout(this.timeOut);
  }

  getTimeDiffInSeconds = time => this.nowUtc.diff(time, 'seconds');

  @action
  updateNow = () => {
    this.nowUtc = now({ timezone: 'UTC' });
    this.timeOut = setTimeout(this.updateNow, TIMEOUT_UPDATE_NOW_UTC);
  };

  @action
  start = () => {
    this.timeOut = setTimeout(this.updateNow, TIMEOUT_UPDATE_NOW_UTC);
  };

  @action
  stop = () => {
    if (this.timeOut) clearTimeout(this.timeOut);
  };
}

export default class QuoteListModel {
  @observable
  timer;

  quotes = [];

  get allApplicationsCompleted() {
    return this.members.every(member => member.application && member.application.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED);
  }

  get applicationsStatusCompleted() {
    return this.allApplicationsCompleted && this.screeningStatuses && this.screeningStatuses.areScreeningsCompleted;
  }

  constructor({
    quotes = [],
    screeningSummary = { screeningResults: [], screeningRequests: [] },
    screeningExpirationResults = {
      expirationScreeningType: ExpirationScreeningTypes.NONE,
    },
    members = [],
    user = {},
  }) {
    this.timer = new Timer();
    this.members = members;
    this.screeningSummary = screeningSummary;
    this.quotes = quotes.map(
      quote =>
        new QuoteModel({
          quote,
          screeningSummary,
          members,
          screeningExpirationResults,
          timer: this.timer,
          allApplicationsCompleted: this.allApplicationsCompleted,
          user,
        }),
    );
  }
}
