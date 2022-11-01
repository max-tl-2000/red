/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { cf } from './QualificationQuestionsSummary.scss';
import Caption from '../../components/Typography/Caption';
import Text from '../../components/Typography/Text';

const QualificationQuestionsSummary = observer(({ qualificationAnswers }) => {
  const SummaryCard = ({ summaryLine, index }) => (
    <div className={cf('answer-card')} key={`summaryLine-${index}`}>
      <Caption secondary>{summaryLine.label}</Caption>
      <Text data-id={summaryLine.id}>{summaryLine.value}</Text>
    </div>
  );

  return (
    <div className={cf('answers-area')}>
      {!qualificationAnswers.length ? (
        <Text>{t('NO_QUESTIONS_ANSWERED')}</Text>
      ) : (
        qualificationAnswers.map((summaryLine, index) => (
          // TODO: We need to find a proper id here
          // eslint-disable-next-line react/no-array-index-key
          <SummaryCard summaryLine={summaryLine} key={index} />
        ))
      )}
    </div>
  );
});

QualificationQuestionsSummary.propTypes = {
  qualificationAnswers: PropTypes.array,
};

export default QualificationQuestionsSummary;
