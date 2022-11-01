/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Card, Typography } from 'components';
import { t } from 'i18next';
import snackbar from 'helpers/snackbar/snackbar';
import { cf } from './home.scss';
import { Page } from '../page/page';
import { LeftPanel } from './left-panel';
import { FilterTabs } from './filter-tabs';
import { FeedPanel } from './feed-panel';
import { RoommateFilters } from './roommate-filters';
import { RoommateCardList } from '../roommate-cards/roommate-card-list';
import SvgMenuUp from '../../../../resources/icons/menu-up.svg';
import { ContactFormDialog } from '../contact-form/contact-form-dialog';
import { MyProfileView } from '../../components/my-profile-view/my-profile-view';
import { replace } from '../../../../client/helpers/navigator';
import { groupFilterTypes } from '../../../common/enums/filter-constants';

const { Text, SubHeader } = Typography;

const renderNotAllowedMessage = handleOnClickOverlay => (
  <div className={cf('blur-layer')} onClick={handleOnClickOverlay}>
    <div className={cf('not-allowed-message-container')}>
      <div className={cf('not-allowed-icon-container')}>
        <SvgMenuUp />
      </div>
      <SubHeader>{t('ROOMMATES_SIGN_IN_OR_REGISTER')}</SubHeader>
      <SubHeader>{t('ROOMMATES_NOT_ALLOWED_MSG')}</SubHeader>
    </div>
  </div>
);

const getFormattedContact = (id, name) => ({
  id,
  name,
});

@inject('auth', 'home', 'profile')
@observer
export class Home extends Component { // eslint-disable-line
  constructor(props, context) {
    super(props, context);
    this.state = {
      homeModel: props.home.HomeModel,
      isContactFormDialogOpen: false,
      selectedContact: {},
    };
  }

  async componentWillMount() {
    const {
      home,
      auth: { authInfo },
      profile,
    } = this.props;
    const userId = authInfo && authInfo.user ? authInfo.user.id : null;
    if (userId) {
      const roommateProfile = await profile.fetchProfile(userId);
      home.setMyRoommateProfile(roommateProfile);
      this.verifyIfProfileIsCompleted();
    } else {
      home.fetchRoommates({ filter: { isActive: true } });
    }
  }

  componentWillReceiveProps() {
    const {
      home,
      auth: { authInfo = {} },
    } = this.props;
    if (!(authInfo.user && authInfo.user.id)) {
      home.fetchRoommates({ filter: { isActive: true } });
    }
  }

  verifyIfProfileIsCompleted = () => {
    const {
      home: { myProfile },
      profile: { ProfileModel },
    } = this.props;
    if (!ProfileModel.isProfileCompleted(myProfile) || myProfile.isActive === 'false') {
      replace('/profile');
    }
  };

  canRenderContactForm = () => {
    const {
      auth: { propertyId, propertyName },
    } = this.props;
    const { applicantName, roommate } = this.state.selectedContact;
    const isSenderValid = applicantName && propertyId && propertyName;
    const isReceiverValid = roommate && roommate.preferredName;
    return isSenderValid && isReceiverValid;
  };

  handleContactFormDialog = showDialog => this.setState({ isContactFormDialogOpen: showDialog });

  handleSubmitContactForm = async message => {
    if (!(this.state.selectedContact.roommate && this.props.home.myProfile)) {
      return;
    }

    const { roommate: selectedRoommate } = this.state.selectedContact;
    const {
      home,
      auth: { propertyId, propertyName, user },
    } = this.props;
    const property = { id: propertyId, name: propertyName };
    const {
      id,
      metadata: { applicationId },
    } = user;
    const profile = getFormattedContact(id, home.myProfile.preferredName);
    const roommate = getFormattedContact(selectedRoommate.id, selectedRoommate.preferredName);

    await home.sendEmailToRoommate(property, profile, roommate, message, applicationId);

    this.handleContactFormDialog(false);
    this.setState({ selectedContact: {} });
    !home.homeError &&
      snackbar.show({
        text: t('ROOMMATE_MESSAGE_SENT_TO_CONTACT', { name: roommate.name }),
      });
    if (window.ga) {
      window.ga('send', 'event', 'communication', 'sent');
    }
  };

  handleCloseContactForm = () => {
    this.setState({ selectedContact: {} });
    this.handleContactFormDialog(false);
  };

  handleSelectContact = contact => {
    if (!this.props.home.myProfile) return;

    const {
      home: { myProfile },
      auth: { propertyName },
    } = this.props;
    const newContact = {
      applicantName: myProfile.preferredName,
      roommate: contact,
      propertyName,
    };
    this.setState({ selectedContact: newContact });
    this.handleContactFormDialog(true);
  };

  handleOnClickOverlay = () => {
    this.props.home.HomeModel.setShowNotAllowedMessage(false);
  };

  render() {
    const { homeModel } = this.state;
    const {
      home: { roommates, myProfile, roommatesFilter },
      auth: { isAuthenticated },
    } = this.props;
    const selectedGroupFilter = roommatesFilter ? roommatesFilter.selectedGroupFilter : groupFilterTypes.ALL;

    return (
      <Page onMainSectionClick={() => homeModel.showNotAllowedMessage && this.handleOnClickOverlay()}>
        <LeftPanel>
          {!isAuthenticated && (
            <Card elevation={0} className={cf('preferences-card')}>
              <SubHeader className={cf('left-panel-header')}>{t('ROOMMATE_PREFERENCES')}</SubHeader>
              <Text>{t('ROOMMATE_PREFERENCES_NOTE')}</Text>
            </Card>
          )}
          {isAuthenticated && myProfile && (
            <div>
              <RoommateFilters myProfile={myProfile} />
              <MyProfileView profile={myProfile} />
            </div>
          )}
        </LeftPanel>
        {roommates && (
          <FeedPanel>
            <FilterTabs />
            <RoommateCardList
              roommates={roommates}
              onSelectContact={this.handleSelectContact}
              isAuthenticated={isAuthenticated}
              selectedGroupFilter={selectedGroupFilter}
            />
          </FeedPanel>
        )}
        {homeModel.showNotAllowedMessage && !isAuthenticated && renderNotAllowedMessage(this.handleOnClickOverlay)}
        {this.canRenderContactForm() && (
          <ContactFormDialog
            open={this.state.isContactFormDialogOpen}
            onSubmit={this.handleSubmitContactForm}
            onCancel={this.handleCloseContactForm}
            contactFormModel={this.state.selectedContact || {}}
          />
        )}
      </Page>
    );
  }
}
