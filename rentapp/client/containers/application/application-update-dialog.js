/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { MsgBox, Typography } from 'components';
import { t } from 'i18next';

const { Text } = Typography;

export default class ApplicationUpdateDialog extends Component {
  static propTypes = { open: PropTypes.bool };

  handlePageReload = () => window.location.reload();

  render = ({ open } = this.props) => (
    <MsgBox open={open} closeOnEscape={false} title={t('APPLICATION_UPDATED_TITLE')} lblOK={t('OK_GOT_IT')} hideCancelButton onOKClick={this.handlePageReload}>
      <Text>{t('APPLICATION_UPDATED_CONTENT')}</Text>
    </MsgBox>
  );
}
