/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { MsgBox, Icon } from 'components';
import { cf } from './InternalErrorDialog.scss';
import { Text, Title } from '../../components/Typography/Typography';

export default class InternalErrorDialog extends Component {
  renderContent = () => (
    <div>
      <div className={cf('dialogTitle')}>
        <Title>{t('INTERNAL_ERROR_TITLE')}</Title>
      </div>
      <div className={cf('dialogContent')}>
        <Icon className={cf('icon')} name={'alert'} />
        <Text>{t('INTERNAL_ERROR_MESSAGE')}</Text>
      </div>
    </div>
  );

  render({ open, onCloseRequest } = this.props) {
    return <MsgBox open={open} content={this.renderContent()} onCloseRequest={onCloseRequest} lblOK={t('CLOSE')} hideCancelButton />;
  }
}
