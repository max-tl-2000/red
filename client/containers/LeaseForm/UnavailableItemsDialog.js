/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './UnavailableItemsDialog.scss';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { statesTranslationKeys } from '../../../common/enums/inventoryStates';
import { toMoment } from '../../../common/helpers/moment-utils';

const { Text } = T;

export default class UnavailableItemsDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
  };

  closeUnavailableItemsDialog = () => {
    const { onCloseRequest } = this.props;
    onCloseRequest && onCloseRequest();
  };

  onDialogCloseRequest = args => {
    if (args.source === 'escKeyPress') {
      const { onCloseRequest } = this.props;
      onCloseRequest && onCloseRequest();
    }
  };

  shouldDisplayInventoryStartDate = item => {
    const { timezone, leaseStartDate } = this.props;
    return item.stateStartDate && toMoment(item.stateStartDate, { timezone }).isAfter(toMoment(leaseStartDate, { timezone }));
  };

  getDialogMessage = () => {
    const { selectedInventories, timezone } = this.props;
    const unavailableRentableItemsSelected = selectedInventories.filter(inv => inv.unavailable);

    return unavailableRentableItemsSelected.map(item => (
      <Text>
        {this.shouldDisplayInventoryStartDate(item)
          ? `- ${item.buildingText}: ${t(statesTranslationKeys[item.state])} (${toMoment(item.stateStartDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT)})`
          : `- ${item.buildingText}: ${t(statesTranslationKeys[item.state])}`}
      </Text>
    ));
  };

  render = () => {
    const { open, id, backendName } = this.props;

    return (
      <MsgBox
        id={id}
        open={open}
        overlayClassName={cf('unavailable-items-dialog')}
        title={t('UNAVAILABLE_ITEMS_SELECTED')}
        lblOK={t('OK_GOT_IT')}
        lblCancel=""
        onOKClick={() => this.closeUnavailableItemsDialog()}
        onCloseRequest={args => this.onDialogCloseRequest(args)}>
        <Text>{t('UNAVAILABLE_RENTABLE_ITEMS_SELECTED_MESSAGE')}</Text>
        {this.getDialogMessage()}
        <Text className={cf('unavailable-item-message')}>{t('UPDATE_RENTABLE_ITEMS_SELECTED_MESSAGE', { backendName })}</Text>
      </MsgBox>
    );
  };
}
