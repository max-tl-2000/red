/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { MsgBox, FormattedMarkdown } from 'components';
import { t } from 'i18next';
import { toMoment } from '../../../common/helpers/moment-utils';
import { SHORT_MONTH_ORDINAL_DAY_FORMAT } from '../../../common/date-constants';

export default class ConfirmStartDateChangeDialog extends Component {
  handleUserAction = wasLeaseStartDateConfirmed => {
    const { onUserAction } = this.props;
    onUserAction && onUserAction(wasLeaseStartDateConfirmed);
  };

  onDialogCloseRequest = args => {
    if (args.source === 'escKeyPress') {
      const { onUserAction } = this.props;
      onUserAction && onUserAction(false);
    }
  };

  getDialogMessage = () => {
    const { leaseEndDate, selectedStartDate, timezone } = this.props;
    const selectedLeaseStartDate = toMoment(selectedStartDate, { timezone }).startOf('day');
    const activeLeaseEndDate = toMoment(leaseEndDate, { timezone }).startOf('day');
    const diffInDays = activeLeaseEndDate.diff(selectedLeaseStartDate, 'days');
    const messageParams = {
      leaseEndDate: activeLeaseEndDate.format(SHORT_MONTH_ORDINAL_DAY_FORMAT),
      days: Math.abs(diffInDays),
      leaseStartDate: selectedLeaseStartDate.format(SHORT_MONTH_ORDINAL_DAY_FORMAT),
    };

    return diffInDays > 0 ? t('CONFIRM_START_DATE_CHANGE_DIALOG_MSG_BEFORE', messageParams) : t('CONFIRM_START_DATE_CHANGE_DIALOG_MSG_AFTER', messageParams);
  };

  render() {
    const { open, id } = this.props;

    return (
      <MsgBox
        id={id}
        open={open}
        closeOnTapAway={false}
        lblOK={t('CONTINUE')}
        btnOKRole={'secondary'}
        onOKClick={() => this.handleUserAction(true)}
        onCancelClick={() => this.handleUserAction(false)}
        onCloseRequest={args => this.onDialogCloseRequest(args)}
        title={t('CONFIRM_START_DATE_CHANGE_DIALOG_TITLE')}>
        <FormattedMarkdown leftAlign>{this.getDialogMessage()}</FormattedMarkdown>
      </MsgBox>
    );
  }
}
