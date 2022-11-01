/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Table, Row, Cell, TextHighlight, Money, TextSecondary } from 'components/Table/RedTable';
import { Text } from 'components/Typography/Typography';
import { adjustmentText } from '../../../common/helpers/adjustmentText';
import { cf } from './SummarySection.scss';
import { convertToCamelCaseAndRemoveBrackets } from '../../../common/helpers/strings';

const getConcessionRowKey = (termId, concession) => `${termId}-${concession.id}-${concession.displayName}`;

const ConcessionsBlock = ({ concessions, term }) => (
  <Table dataId="concessionTable">
    {concessions.map(concession => {
      if (concession.bakedIntoAppliedFeeFlag || !concession.selected) return '';

      const isNotVariable = !concession.variableAdjustment;
      const isVariableAndSet = concession.variableAdjustment && concession.amountVariableAdjustment > 0;
      const isRecurringAndSet = concession.recurring && (isNotVariable || isVariableAndSet);
      const adjustmentCaption = adjustmentText(concession, term);
      const dataId = `${concession.displayName.replace(/\s/g, '_').toLowerCase()}_concession`;
      return (
        <Row key={getConcessionRowKey(term.id, concession)} className={cf('simple-row')}>
          <Cell noSidePadding>
            <Text data-id={dataId}>
              {`${concession.displayName}`} {concession.parentFeeDisplayName && `(${concession.parentFeeDisplayName})`}
            </Text>
            {isRecurringAndSet && <TextSecondary>{adjustmentCaption}</TextSecondary>}
          </Cell>
          <Cell dataId={`${convertToCamelCaseAndRemoveBrackets(concession.displayName)}_amount`} noSidePadding width="40%" textAlign="right">
            <TextHighlight>
              {t('SAVE')}
              <Money dataId={`${dataId}Amount`} amount={concession.computedValue} noFormat currency="USD" />
            </TextHighlight>
          </Cell>
        </Row>
      );
    })}
  </Table>
);

export default ConcessionsBlock;
