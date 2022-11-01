/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { closeForbiddenDialog } from 'redux/modules/forbiddenDialogStore';
import { t } from 'i18next';
import { Dialog, DialogOverlay, DialogHeader, DialogActions, Button } from 'components';

@connect(
  state => ({
    isOpened: state.forbiddenDialogStore.isOpened,
  }),
  dispatch =>
    bindActionCreators(
      {
        closeForbiddenDialog,
      },
      dispatch,
    ),
)
export default class ForbiddenDialog extends Component {
  static propTypes = {
    isOpened: PropTypes.bool,
  };

  render = ({ isOpened } = this.props) => (
    <Dialog open={isOpened}>
      <DialogOverlay>
        <DialogHeader title={t('ACCESS_RESTRICTED')} />
        <div>
          <p className="p">{t('ACCESS_RESTRICTED_FOR_PARTY')}</p>
        </div>
        <DialogActions>
          <Button
            onClick={() => {
              this.props.closeForbiddenDialog();
            }}
            label={t('MSG_BOX_BTN_OK')}
            type="flat"
          />
        </DialogActions>
      </DialogOverlay>
    </Dialog>
  );
}
