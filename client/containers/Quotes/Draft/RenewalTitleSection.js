/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import LeaseLengthList from 'custom-components/LeaseLengthList/LeaseLengthList';
import { cf } from './RenewalTitleSection.scss';

import DateSelector from '../../../components/DateSelector/DateSelector';
import { now } from '../../../../common/helpers/moment-utils';

@observer
export default class RenewalTitleSection extends Component {
  renderList = () => {
    const { quoteModel, handleDropdownChange } = this.props;
    const { leaseTerms, theSelectedTermsIds } = quoteModel;
    return <LeaseLengthList leaseTerms={Array.from(leaseTerms)} leaseTermsSelected={theSelectedTermsIds} onChange={handleDropdownChange} />;
  };

  render = () => {
    const { quoteModel, isInventoryAvailable, handleDateChange, warningMsg } = this.props;
    const { propertyTimezone, leaseStartDate } = quoteModel;

    const errorMsg = isInventoryAvailable ? t('LEASE_START_PRECEDES_UNIT_AVAILABILITY_WARNING') : null;
    const datePickerMin = now({ timezone: propertyTimezone }).startOf('day');

    return (
      <div>
        <DateSelector
          id="leaseStartDateTxt"
          className={cf('dateSelector')}
          wide
          zIndex={150}
          appendToBody={false}
          selectedDate={leaseStartDate}
          min={datePickerMin}
          tz={propertyTimezone}
          format={'MMMM DD, YYYY'}
          onChange={handleDateChange}
          errorMessage={errorMsg}
          warningMessage={warningMsg}
          label={t('RENEWAL_START_DATE')}
        />
        {this.renderList()}
      </div>
    );
  };
}
