/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { t } from 'i18next';
import { cf } from './PartyTypeLabel.scss';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Caption } = Typography;

const allowedPartyTypeIndicators = {
  [DALTypes.QualificationQuestions.GroupProfile.CORPORATE]: {
    indicatorKey: 'CORPORATE_INDICATOR',
    className: 'corporate',
  },
  [DALTypes.QualificationQuestions.GroupProfile.SECTION8]: {
    indicatorKey: 'SECTION8_INDICATOR',
    className: 'section8',
  },
  [DALTypes.QualificationQuestions.GroupProfile.GOOD_SAMARITAN]: {
    indicatorKey: 'GOOD_SAMARITAN_INDICATOR',
    className: 'good_samaritan',
  },
  [DALTypes.QualificationQuestions.GroupProfile.EMPLOYEE]: {
    indicatorKey: 'EMPLOYEE_INDICATOR',
    className: 'employee',
  },
  [DALTypes.QualificationQuestions.GroupProfile.STUDENTS]: {
    indicatorKey: 'STUDENTS_INDICATOR',
    className: 'student',
  },
};

const PartyTypeLabel = ({ party = {} }) => {
  const { groupProfile } = party.qualificationQuestions || {};
  if (!groupProfile) return null;

  const partyTypeIndicator = allowedPartyTypeIndicators[groupProfile];
  if (!partyTypeIndicator) return null;

  return (
    <div className={cf('label-wrapper')}>
      <div className={cf('label-circle', partyTypeIndicator.className)}>
        <Caption className={`${cf('label')} ${partyTypeIndicator.className}PartyType`} inline style={{ fontSize: '.625rem' }}>
          {t(partyTypeIndicator.indicatorKey)}
        </Caption>
      </div>
    </div>
  );
};

export default PartyTypeLabel;
