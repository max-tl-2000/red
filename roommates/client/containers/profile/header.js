/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Card, CardHeader, CardSubTitle, Typography, Button } from 'components';
import { t } from 'i18next';
import injectProps from 'helpers/injectProps';
import { cf } from './header.scss';
import { DeactivateProfileDialog } from './deactivate-profile-dialog';
import { replace } from '../../../../client/helpers/navigator';

const { Caption } = Typography;

export class Header extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      isDeactivateProfileDialogOpen: false,
    };
  }

  static propTypes = {
    email: PropTypes.string,
    isActive: PropTypes.bool,
    isDisabled: PropTypes.bool,
    handleDeactivateProfileAction: PropTypes.func,
  };

  handleDeactivateProfileDialog = showDialog => this.setState({ isDeactivateProfileDialogOpen: showDialog });

  handleReactivateProfile = activate => {
    this.props.handleDeactivateProfileAction(activate);
  };

  handleDeactivateProfile = () => {
    this.props.handleDeactivateProfileAction(false);
    this.handleDeactivateProfileDialog(false);
  };

  @injectProps
  render({ isActive, email, isDisabled }) {
    return (
      <div className={cf('profile-header')}>
        <Card className={cf('card')} container={false}>
          <div className={cf('card-header')}>
            <CardHeader className={cf('card-title')} title={t('MY_ROOMMATE_PROFILE')} />
            {isActive && (
              <Button
                useWaves
                type="raised"
                btnRole="secondary"
                disabled={isDisabled}
                label={t('HIDE_PROFILE')}
                onClick={() => this.handleDeactivateProfileDialog(true)}
              />
            )}
            {!isActive && <Button useWaves type="raised" label={t('SHOW_PROFILE')} onClick={() => this.handleReactivateProfile(true)} />}
          </div>
          <CardSubTitle>{email}</CardSubTitle>
          <Caption className={cf('header-note')} secondary>
            {t('ROOMMATE_PROFILE_HEADER_NOTE')}
          </Caption>
          <Button useWaves type="flat" btnRole="primary" label={t('CHANGE_ROOMMATE_PASSWORD')} onClick={() => replace('/resetPassword')} />
        </Card>
        <DeactivateProfileDialog
          open={this.state.isDeactivateProfileDialogOpen}
          onDeactivate={this.handleDeactivateProfile}
          onCancel={() => this.handleDeactivateProfileDialog(false)}
        />
      </div>
    );
  }
}
