/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { Card, Field, DateRange, Dropdown } from 'components';
import { cf } from './roommate-filters.scss';
import { DALTypes } from '../../../common/enums/dal-types';
import { groupFilterTypes } from '../../../common/enums/filter-constants';
// import moment from 'moment'; // TODO: Uncomment this line there are more roommates on the app
// import { DATE_US_FORMAT } from '../../../../common/date-constants'; // TODO: Uncomment this line there are more roommates on the app

const getDropDownItems = itemsObject =>
  Object.keys(itemsObject).map(key => ({
    id: itemsObject[key],
    text: t(key),
  }));

@inject('auth', 'home')
@observer
export class RoommateFilters extends Component { // eslint-disable-line

  constructor(props, context) {
    super(props, context);
    /* The below funcionality will be available when there are more roommates on the app
       const today = now();
       const from =  Date.parse(props.myProfile.moveInDateFrom) < today ? today.format(DATE_US_FORMAT) : props.myProfile.moveInDateFrom;
       const to = props.myProfile.moveInDateTo;
     */
    const from = null; // TODO: Undo this when there are more roommates on the app
    const to = null; // TODO: Undo this when there are more roommates on the app

    this.state = {
      moveInDateRange: {
        from,
        to,
      },
      preferLiveWith: props.myProfile.preferLiveWith,
      gender: props.myProfile.gender,
    };
  }

  componentWillMount() {
    this.filterRoommates();
  }

  static propTypes = {
    myProfile: PropTypes.object,
  };

  static defaultProps = {
    myProfile: {},
  };

  buildFilterObject = () => {
    const {
      moveInDateRange: { from, to },
      preferLiveWith,
      gender,
    } = this.state;

    return {
      moveInDateFrom: from,
      moveInDateTo: to,
      preferLiveWith,
      isActive: true,
      gender,
    };
  };

  filterRoommates = async () => {
    const {
      home,
      home: { roommatesFilter },
      auth: { authInfo },
    } = this.props;

    if (roommatesFilter.selectedGroupFilter !== groupFilterTypes.CONTACTED) {
      await home.fetchRoommates({
        userId: authInfo.user.id,
        filter: this.buildFilterObject(),
      });
    } else {
      home.updateFilterState(this.buildFilterObject());
    }
  };

  onMoveInDateRangeDateRangePickerChange = value => {
    this.setState({ moveInDateRange: value }, () => this.filterRoommates());
  };

  onPreferLiveWithDropdownChange = value => {
    this.setState({ preferLiveWith: value }, () => this.filterRoommates());
  };

  render() {
    const { moveInDateRange, preferLiveWith } = this.state;

    const preferLiveWithItems = getDropDownItems(DALTypes.PreferLiveWith);

    return (
      <Card elevation={0} className={cf('card')}>
        <Field columns={12}>
          <DateRange
            tz={this.props.auth.propertyTimezone}
            label={t('ROOMMATE_PREFERRED_MOVE_IN_DATE_RANGE')}
            lblFrom={t('FROM')}
            lblTo={t('TO')}
            className={cf('date-range')}
            value={moveInDateRange}
            onChange={({ value }) => this.onMoveInDateRangeDateRangePickerChange(value)}
          />
        </Field>
        <Field columns={12}>
          <Dropdown
            items={preferLiveWithItems}
            label={t('ROOMMATE_LIVE_WITH')}
            wide
            selectedValue={preferLiveWith}
            className={cf('dropdown')}
            onChange={({ id }) => this.onPreferLiveWithDropdownChange(id)}
          />
        </Field>
      </Card>
    );
  }
}
