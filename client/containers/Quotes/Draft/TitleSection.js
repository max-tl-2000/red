/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { connect } from 'react-redux';
import { t } from 'i18next';

import { toMoment, now } from '../../../../common/helpers/moment-utils';
import { getInventoryLeaseSelector } from '../../../helpers/unitsUtils';
import LeasingQuoteTitleSection from './LeasingQuoteTitleSection';
import RenewalTitleSection from './RenewalTitleSection';
import { DALTypes } from '../../../../common/enums/DALTypes';
import ConfirmStartDateChangeDialog from '../../LeaseForm/ConfirmStartDateChangeDialog';
import { SHORT_MONTH_ORDINAL_DAY_FORMAT } from '../../../../common/date-constants';

@connect((state, props) => ({
  leases: getInventoryLeaseSelector(state, props),
}))
@observer
class TitleSection extends React.Component {
  static propTypes = {
    quoteModel: PropTypes.object, // mobx object
    inventory: PropTypes.object,
    isLeaseStartDateInThePast: PropTypes.bool,
    defaultStartDate: PropTypes.string,
    isExistingQuote: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    this.state = {
      confirmStartDateChangeDialogOpen: false,
      startDateWarningMsg: '',
      newLeaseStartDate: null,
      oldLeaseStartDate: null,
      leaseStartDateConfirmationAlreadyDisplayed: false,
    };
  }

  componentDidMount() {
    const { quoteModel } = this.props;
    const { isSavedDraft } = quoteModel;
    if (isSavedDraft) {
      this.validateSatrtDate();
    }
  }

  componentDidUpdate() {
    this.initLeaseStartDate();
  }

  initLeaseStartDate = () => {
    const { quoteModel, leaseEndDate, isExistingQuote } = this.props;
    const { leaseStartDate, propertyTimezone } = quoteModel;

    if (!leaseStartDate) {
      const isLeaseEndDateInThePast = toMoment(leaseEndDate, { timezone: propertyTimezone }).isBefore(now({ timezone: propertyTimezone }));
      const newLeaseStartDate = isLeaseEndDateInThePast && !isExistingQuote ? null : toMoment(leaseEndDate, { timezone: propertyTimezone }).add(1, 'days');
      quoteModel.updateLeaseStartDate(newLeaseStartDate, false);
    }
  };

  validateSatrtDate = () => {
    const { quoteModel, leaseEndDate } = this.props;
    const { leaseState, leaseStartDate, propertyTimezone: timezone } = quoteModel;
    const isLeaseRenewal = leaseState === DALTypes.LeaseState.RENEWAL;
    if (isLeaseRenewal && leaseStartDate && leaseEndDate && this.isStartDateDifferentFromActiveLeaseEndDatePlusOne(leaseStartDate, leaseEndDate)) {
      const activeLeaseEndDate = toMoment(leaseEndDate, { timezone }).format(SHORT_MONTH_ORDINAL_DAY_FORMAT);
      this.setState({
        startDateWarningMsg: t('LEASE_FORM_LEASE_START_DATE_VALIDATION_RENEWAL', { activeLeaseEndDate }),
      });
    } else {
      this.setState({
        startDateWarningMsg: '',
      });
    }
  };

  handleDropdownChange = args => {
    const { quoteModel } = this.props;
    const isUserInput = true;
    quoteModel.updateSelectedLeaseTerms(args, isUserInput);
  };

  handleDateChange = value => {
    const { quoteModel } = this.props;
    const isUserInput = true;

    if (this.shouldOpenConfirmStartDateChangeDialog(value)) {
      this.openConfirmStartDateChangeDialog();
      return;
    }
    quoteModel.updateLeaseStartDate(value, isUserInput);
    this.validateSatrtDate();
  };

  openConfirmStartDateChangeDialog = () => this.setState({ confirmStartDateChangeDialogOpen: true });

  isStartDateDifferentFromActiveLeaseEndDatePlusOne = (startDate, endDate) => {
    const { quoteModel } = this.props;
    const { propertyTimezone } = quoteModel;
    const selectedLeaseStartDateToCompare = toMoment(startDate, { propertyTimezone });
    const activeLeaseEndDateToCompare = toMoment(endDate, { propertyTimezone }).add(1, 'day');
    return !selectedLeaseStartDateToCompare.isSame(activeLeaseEndDateToCompare, 'day');
  };

  shouldOpenConfirmStartDateChangeDialog = newStartDate => {
    const { quoteModel, leaseEndDate } = this.props;
    const { leaseState, leaseStartDate: oldStartDate } = quoteModel;
    const isRenewal = leaseState === DALTypes.LeaseState.RENEWAL;
    const { leaseStartDateConfirmationAlreadyDisplayed, confirmStartDateChangeDialogOpen } = this.state;

    if (
      isRenewal &&
      !leaseStartDateConfirmationAlreadyDisplayed &&
      !confirmStartDateChangeDialogOpen &&
      newStartDate &&
      this.isStartDateDifferentFromActiveLeaseEndDatePlusOne(newStartDate, leaseEndDate)
    ) {
      this.setState({
        newLeaseStartDate: newStartDate,
        oldLeaseStartDate: oldStartDate,
      });
      return true;
    }
    return false;
  };

  closeConfirmStartDateChangeDialog = leaseStartDateConfirmed =>
    this.setState({
      newLeaseStartDate: null,
      oldLeaseStartDate: null,
      confirmStartDateChangeDialogOpen: false,
      ...(leaseStartDateConfirmed && { leaseStartDateConfirmationAlreadyDisplayed: true }),
    });

  handleConfirmStartDateChange = wasLeaseStartDateConfirmed => {
    const { newLeaseStartDate, oldLeaseStartDate } = this.state;

    if (wasLeaseStartDateConfirmed) {
      this.handleDateChange(newLeaseStartDate);
    } else {
      this.handleDateChange(oldLeaseStartDate);
    }

    this.closeConfirmStartDateChangeDialog(wasLeaseStartDateConfirmed);
  };

  render() {
    const { inventory, quoteModel, leases, isInventoryAvailable, leaseEndDate } = this.props;
    // TODO: check why we need to disable the no-unused-vars.
    // Was it due to mobx need to access the value to "observe" it?
    // if so we should add a comment explaining that as it is not obvious for other devs
    // eslint-disable-next-line no-unused-vars
    const { leaseState, propertyTimezone, leaseStartDate } = quoteModel;

    const isLeaseRenewal = leaseState === DALTypes.LeaseState.RENEWAL;

    return isLeaseRenewal ? (
      <div>
        {this.state.confirmStartDateChangeDialogOpen && (
          <ConfirmStartDateChangeDialog
            id="confirmStartDateChangeDialog"
            open={this.state.confirmStartDateChangeDialogOpen}
            onUserAction={this.handleConfirmStartDateChange}
            leaseEndDate={leaseEndDate}
            selectedStartDate={this.state.newLeaseStartDate}
            timezone={propertyTimezone}
          />
        )}
        <RenewalTitleSection
          isInventoryAvailable={isInventoryAvailable}
          quoteModel={quoteModel}
          handleDateChange={this.handleDateChange}
          handleDropdownChange={this.handleDropdownChange}
          leaseEndDate={leaseEndDate}
          warningMsg={this.state.startDateWarningMsg}
        />
      </div>
    ) : (
      <LeasingQuoteTitleSection
        inventory={inventory}
        leases={leases}
        quoteModel={quoteModel}
        isInventoryAvailable={isInventoryAvailable}
        handleDateChange={this.handleDateChange}
        handleDropdownChange={this.handleDropdownChange}
      />
    );
  }
}

export default TitleSection;
