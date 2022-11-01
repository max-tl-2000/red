/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Typography, MsgBox } from 'components';
const { Text } = Typography;

export default class LeaseDateWarningDialog extends Component {
  static propTypes = {
    onDialogClosed: PropTypes.func,
    onEditLeaseClicked: PropTypes.func,
    isLeaseDateWarningDialogOpen: PropTypes.bool,
    titleText: PropTypes.string,
    contentText: PropTypes.string,
  };

  handleOnClose = () => {
    const { onDialogClosed } = this.props;
    onDialogClosed && onDialogClosed();
  };

  handleEditLease = () => {
    const { onEditLeaseClicked } = this.props;
    onEditLeaseClicked && onEditLeaseClicked();
  };

  render = ({ isLeaseDateWarningDialogOpen, titleText, contentText } = this.props) => (
    <MsgBox
      open={isLeaseDateWarningDialogOpen}
      title={titleText}
      lblOK={t('EDIT_LEASE')}
      onOKClick={this.handleEditLease}
      lblCancel={t('CANCEL')}
      onCancelClick={this.handleOnClose}
      onCloseRequest={this.handleOnClose}>
      <Text>{contentText}</Text>
    </MsgBox>
  );
}
