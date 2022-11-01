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
import { getCounterSignDialogTexts } from '../../../common/helpers/quotes';

export default class CounterSignerWarning extends Component {
  static propTypes = {
    hasApplicationStatusChanged: PropTypes.bool,
    onWarningClosed: PropTypes.func,
    onContinueClicked: PropTypes.func,
    isCounterSignWarningOpen: PropTypes.bool,
  };

  handleOnClose = () => {
    const { onWarningClosed } = this.props;
    onWarningClosed && onWarningClosed();
  };

  handleContinue = () => {
    const { onContinueClicked } = this.props;
    onContinueClicked && onContinueClicked();
  };

  render() {
    const { isCounterSignWarningOpen, hasApplicationStatusChanged } = this.props;
    const { titleText, contentText, contentQuestionText, continueButtonText } = getCounterSignDialogTexts(hasApplicationStatusChanged);

    const title = t('COUNTERSIGN_WARNING_TITLE', { condition: titleText });
    const content = t('COUNTERSIGN_WARNING_CONTENT', { action: contentText });
    const contentQuestion = t('COUNTERSIGN_WARNING_CONTENT_QUESTION', { action: contentQuestionText });
    const buttonLbl = t('COUNTERSIGN_WARNING_BUTTON', { action: continueButtonText });

    return (
      <MsgBox
        open={isCounterSignWarningOpen}
        title={title}
        lblOK={t('CANCEL')}
        onOKClick={this.handleOnClose}
        lblCancel={buttonLbl}
        onCancelClick={this.handleContinue}
        onCloseRequest={this.handleOnClose}
        titleIconName="alert"
        titleIconClassName="icon-alert">
        <Text>{content}</Text>
        <Text style={{ marginTop: '1.5rem' }}>{contentQuestion}</Text>
      </MsgBox>
    );
  }
}
