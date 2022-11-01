/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Field } from 'components';
import { t } from 'i18next';
import groupBy from 'lodash/groupBy';
import LeaseLength from '../LeaseLength/LeaseLength';

const LeaseLengthQuestion = ({ leaseTerms = [], leaseLength = {}, handleQuestionsAnswered, disabled, columns }) => {
  const getLeaseTermsIds = () =>
    Object.entries(leaseLength).reduce((acc, [field, values]) => {
      const leaseTermsSelected = leaseTerms.filter(leaseTerm => leaseTerm.period === field && values.some(termLength => termLength === leaseTerm.termLength));
      acc.push(...leaseTermsSelected.map(leaseTerm => leaseTerm.id));
      return acc;
    }, []);

  const getLeaseTermsSelected = ({ ids, items }) => {
    const leaseTermsSelected = items.filter(leaseTerm => ids.some(id => id === leaseTerm.id));
    const groupedItems = groupBy(leaseTermsSelected, 'period');
    return Object.keys(groupedItems).reduce((acc, field) => {
      acc[field] = groupedItems[field].map(x => x.termLength);
      return acc;
    }, {});
  };

  return (
    <Field columns={columns}>
      <LeaseLength
        disabled={disabled}
        leaseTerms={leaseTerms || []}
        leaseTermsSelected={getLeaseTermsIds()}
        onChange={args => handleQuestionsAnswered({ leaseLength: getLeaseTermsSelected(args) })}
        label={t('LENGTH_OF_LEASE')}
        renderSpecialsAndDates={true}
        wide
      />
    </Field>
  );
};

LeaseLengthQuestion.displayName = 'leaseLength';
export default LeaseLengthQuestion;
