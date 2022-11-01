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
import { getDisplayName } from '../../../common/helpers/person-helper';
const { Text } = Typography;

export default class LeasedUnitDialog extends Component {
  static propTypes = {
    approvalText: PropTypes.string,
    onDialogClosed: PropTypes.func,
    isLeasedUnitDialogOpen: PropTypes.bool,
    partyMembers: PropTypes.array,
  };

  close = () => {
    const { onDialogClosed } = this.props;
    onDialogClosed && onDialogClosed();
  };

  getMessageBody = () => {
    const { partyMembers } = this.props;

    if (!partyMembers?.length) return t('LEASED_UNIT_ON_THIRD_PARTY_DIALOG_BODY');

    const partyMembersNames = partyMembers.map(member => getDisplayName(member)).join(', ');
    return t('LEASED_UNIT_DIALOG_BODY', {
      partyMembers: partyMembersNames,
    });
  };

  render = ({ isLeasedUnitDialogOpen, approvalText = '' } = this.props) => (
    <MsgBox open={isLeasedUnitDialogOpen} title={t('LEASED_UNIT_DIALOG_TITLE')} lblOK={t('OK_GOT_IT')} onOKClick={this.close} lblCancel="">
      <Text>{this.getMessageBody()}</Text>
      {approvalText && <Text>{approvalText}</Text>}
    </MsgBox>
  );
}
