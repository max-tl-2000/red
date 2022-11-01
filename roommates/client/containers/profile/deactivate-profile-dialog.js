/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { Dialog, DialogOverlay, DialogActions, Button, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './deactivate-profile-dialog.scss';

const { Text } = Typography;

export class DeactivateProfileDialog extends Component {
  constructor(props) {
    super(props);
    this.id = generateId(this);
  }

  static propTypes = {
    open: PropTypes.bool,
    onDeactivate: PropTypes.func,
    onCancel: PropTypes.func,
  };

  render() {
    const { onDeactivate, onCancel, id, open } = this.props;
    const theId = clsc(id, this.id);
    return (
      <Dialog open={open} id={theId}>
        <DialogOverlay container={false} title={t('ROOMMATE_DEACTIVATE_PROFILE')}>
          <div className={cf('deactivate-dialog-wrapper')}>
            <div>
              <Text>{t('ROOMMATE_DEACTIVATE_PROFILE_QUESTION')}</Text>
              <Text>{t('ROOMMATE_DEACTIVATE_PROFILE_MESSAGE')}</Text>
            </div>
          </div>
          <DialogActions>
            <Button label={t('CANCEL')} type="flat" btnRole="secondary" onClick={onCancel} />
            <Button label={t('HIDE_PROFILE')} type="flat" onClick={onDeactivate} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
