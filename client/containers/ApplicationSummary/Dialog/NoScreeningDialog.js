/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { MsgBox, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './NoScreeningDialog.scss';

const { Text } = Typography;

export default class NoScreeningDialog extends Component {
  render = () => {
    const { open, onConfirm, onCloseRequest } = this.props;

    return (
      <div className={cf('no-screening-dialog')}>
        <MsgBox
          open={open}
          ref="noScreeningDialog"
          closeOnTapAway={false}
          lblOK={t('CONFIRM')}
          onOKClick={() => onConfirm && onConfirm()}
          lblCancel={t('CANCEL')}
          onCloseRequest={() => onCloseRequest && onCloseRequest()}
          title={t('SCREENING_INCOMPLETE')}
          id="screeningIncompleteDialog">
          <Text inline>{t('SCREENING_INCOMPLETE_MESSAGE')}</Text>
        </MsgBox>
      </div>
    );
  };
}
