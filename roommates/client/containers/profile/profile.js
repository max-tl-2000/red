/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Card, Typography } from 'components';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { Page } from '../page/page';
import { Header } from './header';
import { ProfileForm } from './profile-form';
import { cf } from './profile-form.scss';
import { replace } from '../../../../client/helpers/navigator';

const { Text } = Typography;
const isValidValue = value => value != null && value !== '';

@inject('auth', 'profile')
@observer
export class Profile extends Component {
  constructor(props, context) {
    super(props, context);

    const { ProfileModel } = props.profile;
    this.state = {
      profileModel: props.profile.ProfileModel,
      formModel: ProfileModel.create({}),
      roommateProfile: {},
    };
  }

  async componentWillMount() {
    const { user } = this.props.auth.authInfo;
    const roommateProfile = await this.props.profile.fetchProfile(user.id);

    if (!roommateProfile) return;

    const formModel = this.props.profile.ProfileModel.create({
      initialState: roommateProfile,
    });
    this.activateDeactivateProfile(formModel.fields.isActive.value);
    this.setState({ formModel, roommateProfile });
  }

  componentDidMount() {
    window.onpopstate = this.onBrowserBackButtonEvent;
  }

  onBrowserBackButtonEvent = () => {
    this.preventBrowserBackIfProfileIsIncompleted();
  };

  preventBrowserBackIfProfileIsIncompleted = () => {
    const { ProfileModel } = this.props.profile;
    const { roommateProfile } = this.state;
    if (!ProfileModel.isProfileCompleted(roommateProfile)) {
      replace('/profile');
    }
  };

  activateDeactivateProfile = activate => {
    const { formModel } = this.state;
    formModel.fields.isActive.value = isValidValue(activate) ? activate : true;
  };

  handleDeactivateActivateProfile = async activate => {
    const { user } = this.props.auth.authInfo;
    await this.props.profile.ProfileModel.deactivateProfile(user.id, {
      isActive: activate,
    });
    this.activateDeactivateProfile(activate);

    const eventName = (activate && 'shown') || 'hidden';
    window.ga && window.ga('send', 'event', 'profile', eventName);
  };

  render() {
    const { formModel, roommateProfile } = this.state;
    const { ProfileModel } = this.props.profile;

    const { user } = this.props.auth.authInfo;
    const isProfileCompleted = ProfileModel.isProfileCompleted(roommateProfile);

    const isActive = isValidValue(formModel.fields.isActive.value) ? formModel.fields.isActive.value : true;

    const shouldDisplayProfile = JSON.parse(isActive) || !isProfileCompleted;

    return (
      <Page centerContent contentDirection="column" onAppBarIconSectionClick={ProfileModel.onAppBarIconSectionClick}>
        <Header
          email={user.email}
          isActive={shouldDisplayProfile}
          isDisabled={!isProfileCompleted}
          handleDeactivateProfileAction={this.handleDeactivateActivateProfile}
        />
        {!shouldDisplayProfile && (
          <div className={cf('profile-form')}>
            <Card className={cf('card')} container={false}>
              <Text>{t('ROOMMATE_INACTIVE_ACCOUNT_MESSAGE')}</Text>
            </Card>
          </div>
        )}
        {shouldDisplayProfile && <ProfileForm formModel={formModel} isProfileCompleted={isProfileCompleted} />}
      </Page>
    );
  }
}
