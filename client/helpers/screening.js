/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { ScreeningDecision } from '../../common/enums/applicationTypes';

export const PromoteActionType = {
  REVIEW_APPLICATION: 'review application',
  REQUEST_APPROVAL: 'request approval',
  CREATE_LEASE: 'create lease',
};

const isScreeningApproved = ({ applicationDecision, customApplicationDecision }) =>
  (customApplicationDecision || applicationDecision || '').toLowerCase() === ScreeningDecision.APPROVED;

export const isApprovedWithoutDisclosures = ({ applicationDecision, customApplicationDecision }, applicantsWithDisclosures) =>
  isScreeningApproved({ applicationDecision, customApplicationDecision }) && applicantsWithDisclosures.length < 1;

export const formatRecommendation = recommendation => `-  ${t(recommendation.toUpperCase())}`;
