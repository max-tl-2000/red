/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, FormattedMarkdown, Typography, Dropdown } from 'components';
import { t } from 'i18next';
import { cf } from './ConfirmLeaseTermDialog.scss';
import { getEndDateFromStartDate, calculateNewLeaseTerms } from '../../../common/helpers/quotes';
import { DATE_ONLY_FORMAT } from '../../../common/date-constants';

const { Text } = Typography;

export default class ConfirmLeaseTermDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onConfirmLeaseTerm: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {
      selectedLeaseTermLength: [],
    };
  }

  handleChange = ({ ids }) => {
    this.setState({ selectedLeaseTermLength: ids });
  };

  getComputedLeaseEndDate = leaseStartDate => {
    const { timezone } = this.props;
    const { selectedLeaseTermId } = this.state;
    const selectedTerm = this.getSelectedLeaseTermById(selectedLeaseTermId);

    return getEndDateFromStartDate(leaseStartDate, selectedTerm, timezone).format(DATE_ONLY_FORMAT);
  };

  renderDateMessage = () => {
    const { selectedLeaseTermId } = this.state;
    const defaultLeaseTermId = this.props.selectedLeaseTermId;
    const { leaseToPublish } = this.props;
    const { leaseStartDate: selectedLeaseStartDate } = leaseToPublish || {};

    if (defaultLeaseTermId !== selectedLeaseTermId && !this.isLeaseEndDateChangedByUser()) {
      const computedEndDate = this.getComputedLeaseEndDate(selectedLeaseStartDate);
      return (
        <Text className={cf('date-message')}>
          {t('LEASE_END_DATE_UPDATED')}
          <span>{computedEndDate}</span>
        </Text>
      );
    }
    return <noscript />;
  };

  closeConfirmLeaseDialog = wasLeaseTermConfirmed => {
    const { onCloseRequest, updatedLeaseDurationInDays } = this.props;
    const { selectedLeaseTermLength } = this.state;
    const newLeaseTermLength = selectedLeaseTermLength.length !== 0 ? selectedLeaseTermLength[0] : this.computeDropdownValues()[0].id;
    const leaseTermsOptions = calculateNewLeaseTerms(updatedLeaseDurationInDays);
    onCloseRequest && onCloseRequest({ wasLeaseTermConfirmed, newLeaseTermLength, leaseTermsOptions });
  };

  onDialogCloseRequest = args => {
    if (args.source === 'escKeyPress') {
      const { onCloseRequest } = this.props;
      onCloseRequest && onCloseRequest({ wasLeaseTermConfirmed: false });
    }
  };

  getDropdownText = nrOfMonths => (nrOfMonths === 1 ? '1 month' : `${nrOfMonths} months`);

  computeDropdownValues = () => {
    const { updatedLeaseDurationInDays } = this.props;
    const dropdownValues = calculateNewLeaseTerms(updatedLeaseDurationInDays).map(i => ({ id: i, text: this.getDropdownText(i) }));

    return dropdownValues;
  };

  getSelectedValue = dropdownValues => {
    const { selectedLeaseTermLength } = this.state;
    if (selectedLeaseTermLength.length) return selectedLeaseTermLength;

    return dropdownValues && dropdownValues[0] ? [dropdownValues[0].id] : [];
  };

  render = () => {
    const { open, id } = this.props;
    const dropdownValues = this.computeDropdownValues();
    const selectedValue = this.getSelectedValue(dropdownValues);

    return (
      <MsgBox
        id={id}
        open={open}
        overlayClassName={cf('confirm-lease-term-dialog')}
        title={t('CONFIRM_LEASE_TERM_LENGTH')}
        lblOK={t('CONFIRM')}
        lblCancel=""
        onOKClick={() => this.closeConfirmLeaseDialog(true)}
        onCloseRequest={args => this.onDialogCloseRequest(args)}>
        <FormattedMarkdown>{t('UPDATED_LEASE_DATES_MESSAGE')}</FormattedMarkdown>
        <Dropdown id="confirmLeaseTermDropdown" items={dropdownValues} onChange={this.handleChange} selectedValue={selectedValue} />
        {this.renderDateMessage()}
      </MsgBox>
    );
  };
}
