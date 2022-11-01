/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { MsgBox, Radio } from 'components';
import { observer } from 'mobx-react';
import { t } from 'i18next';

@observer
export default class TransferLeaseDialog extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isTransferSelected: props.party.isTransferLease,
    };
  }

  handleClose = () => {
    const { model = {}, party = {} } = this.props;
    model.close();
    this.setState({ isTransferSelected: party.isTransferLease });
  };

  handleTransferClicked = () => {
    const { onTransferClick } = this.props;
    onTransferClick && onTransferClick(this.state.isTransferSelected);
  };

  render = () => {
    const { model } = this.props;
    const { isTransferSelected } = this.state;

    return (
      <div>
        <MsgBox
          appendToBody
          onCloseRequest={model.close}
          open={model.isOpen}
          closeOnTapAway={false}
          lblOK={t('DONE')}
          onOKClick={this.handleTransferClicked}
          title={t('NEW_OR_TRANSFER_LEASE')}
          lblCance={t('CLOSE')}
          onCancelClick={this.handleClose}>
          <Radio label={t('TRANSFER_LEASE')} checked={isTransferSelected} onChange={() => this.setState({ isTransferSelected: !isTransferSelected })} />
          <Radio label={t('NEW_LEASE')} checked={!isTransferSelected} onChange={() => this.setState({ isTransferSelected: !isTransferSelected })} />
        </MsgBox>
      </div>
    );
  };
}
