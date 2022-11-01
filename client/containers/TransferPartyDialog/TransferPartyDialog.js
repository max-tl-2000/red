/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { MsgBox, FormattedMarkdown, TextBox } from 'components';

export default class TransferPartyDialog extends Component {
  static propTypes = {
    open: PropTypes.bool,
    handleOnSubmit: PropTypes.func,
    cancelTransferPartyDialog: PropTypes.func,
    transferPartyDialogContent: PropTypes.string,
    handleOnReasonChange: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      reassignReason: '',
    };
  }

  handleOnReasonChange = ({ value }) => {
    this.setState({ reassignReason: value });
  };

  render = () => {
    const { open, handleOnSubmit, cancelTransferPartyDialog, transferPartyDialogContent } = this.props;
    const { reassignReason } = this.state;
    return (
      <MsgBox
        id="transferPartyDialog"
        key="transferPartyDialog"
        open={open}
        title={t('REASSIGN_PARTY')}
        lblOK={t('REASSIGN_PARTY_EXECUTE')}
        onOKClick={() => handleOnSubmit({ reassignReason })}
        btnOKDisabled={!reassignReason}
        lblCancel={t('CANCEL')}
        onCloseRequest={cancelTransferPartyDialog}>
        {
          <div>
            <FormattedMarkdown>{transferPartyDialogContent}</FormattedMarkdown>
            <FormattedMarkdown>{t('REASSIGN_PARTY_DIALOG_TEXT')}</FormattedMarkdown>
            <TextBox
              multiline
              numRows={1}
              autoResize={false}
              value={reassignReason}
              id="reasign-reason"
              onChange={this.handleOnReasonChange}
              label={t('REASSIGNMENT_REASON')}
              wide
              showClear
              required
              autoFocus
            />
          </div>
        }
      </MsgBox>
    );
  };
}
