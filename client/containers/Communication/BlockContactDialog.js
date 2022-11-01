/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { MsgBox, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './BlockContactDialog.scss';

const { Text } = Typography;

export default class BlockContactDialog extends Component {
  render = () => {
    const { open, title, fullName, msgCommunicationFrom, channel, onBlockContact, onCloseRequest } = this.props;

    return (
      <div className={cf('mark-spam-dialog')}>
        <MsgBox
          appendToBody
          open={open}
          ref="blockContactDialog"
          closeOnTapAway={false}
          lblOK={t('BLOCK')}
          onOKClick={() => onBlockContact && onBlockContact()}
          title={title || t('BLOCK_CONFIRMATION', { name: fullName })}
          onCloseRequest={onCloseRequest}>
          <Text inline>{msgCommunicationFrom}</Text>
          <Text inline bold>{` ${channel} `}</Text>
          <Text inline>{t('WILL_BE_IGNORED')}</Text>
          <div className={cf('undo-admin')}>
            <Text>{t('UNDO_OPERATION_ADMIN')}</Text>
          </div>
        </MsgBox>
      </div>
    );
  };
}
