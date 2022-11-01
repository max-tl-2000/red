/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { windowOpen } from 'helpers/win-open';
import { bindActionCreators } from 'redux';
import { getCurrentUser } from 'redux/selectors/userSelectors';
import { t } from 'i18next';
import { requestSandboxCreation, getSandboxUrl } from 'redux/modules/usersStore';
import * as T from '../../components/Typography/Typography';
import Button from '../../components/Button/Button';
import Status from '../../components/Status/Status';
import SVGInTheComputer from '../../../resources/pictographs/in-the-computer.svg';
import ListItem from '../../components/List/ListItem';
import MainSection from '../../components/List/MainSection';
import AvatarSection from '../../components/List/AvatarSection';
import Icon from '../../components/Icon/Icon';

import { cf } from './RevaUniversity.scss';

@connect(
  state => ({
    currentUser: getCurrentUser(state),
  }),
  dispatch =>
    bindActionCreators(
      {
        requestSandboxCreation,
        getSandboxUrl,
      },
      dispatch,
    ),
)
export default class RevaUniversity extends Component {
  constructor(props) {
    super(props);
    this.state = {
      processing: false,
    };
  }

  async componentDidMount() {
    const { currentUser } = this.props;
    if (currentUser?.metadata?.sandboxAvailable) {
      const { sandboxUrl, loginToken } = await this.props.getSandboxUrl(this.props.currentUser.id);
      if (sandboxUrl) {
        this.setState({ sandboxUrl, loginToken });
      }
    }
  }

  gettingStarted = () => (
    <div className={cf('gettingStartedSection')}>
      <div key={'university-half-section'} className={cf('halfSection')}>
        <T.TextHeavy>{t('LEARN_PRACTICE_IMPROVE')}</T.TextHeavy>
        <T.Text secondary>{t('BECOME_A_REVA_NINJA')}</T.Text>
        <T.Headline>{t('GETTING_STARTED')}</T.Headline>
        <T.Text className={cf('smallMargin')}>{t('GETTING_STARTED_DESCRIPTION')}</T.Text>
        <T.Text className={cf('mediumMargin')}>{t('GETTING_STARTED_LET_US_KNOW')}</T.Text>
      </div>
      <SVGInTheComputer width={'50%'} height={'351'} className={cf('inTheComputer halfSection')} />
    </div>
  );

  renderCourseSummary = () => {
    const groupedItems = [
      { title: 'LEARNING_WHERE_EVERYTHING_IS' },
      {
        title: 'MANAGING_YOUR_WORK',
        items: ['CREATING_A_PARTY', 'READING_THE_CARDS', 'HOW_CARDS_WORK'],
      },
      {
        title: 'WORKING_WITH_A_PARTY',
        items: ['ADDING_OR_REMOVING_PARTY_MEMBERS', 'CREATING_A_QUOTE', 'GENERATIONG_THE_LEASE', 'TYING_UP_LOOSE_ENDS'],
      },
    ];
    const icon = <Icon name="minicon-circle" className={cf('icon')} />;

    return groupedItems.map(group => (
      <div key={`${group.title}-group`}>
        <ListItem hoverable={false} key={group.title}>
          <AvatarSection className={cf('avatarSection')}>{icon}</AvatarSection>
          <MainSection className={cf('mainSection')}>
            <T.Text>{t(group.title)}</T.Text>
          </MainSection>
        </ListItem>
        {group?.items?.length &&
          group.items.map(item => (
            <ListItem key={item} hoverable={false} className={cf('groupList')}>
              <AvatarSection className={cf('avatarSection')}>{icon}</AvatarSection>
              <MainSection className={cf('mainSection')}>
                <T.Text>{t(item)}</T.Text>
              </MainSection>
            </ListItem>
          ))}
      </div>
    ));
  };

  createSandbox = async () => {
    const { currentUser } = this.props;
    await this.props.requestSandboxCreation(currentUser.id);
    this.setState({ processing: true });
  };

  buildAutoLoginUrl = (url, loginToken) => `${url}?autoLogin=${loginToken}`;

  generateTenant = async () => {
    const { currentUser } = this.props;
    if (!currentUser?.metadata?.sandboxAvailable) {
      await this.createSandbox();
    } else {
      const { sandboxUrl, loginToken } = this.state;
      if (sandboxUrl) {
        const url = this.buildAutoLoginUrl(sandboxUrl, loginToken);
        windowOpen(url);
      } else {
        const { sandboxUrl: boxUrl, loginToken: token } = await this.props.getSandboxUrl(this.props.currentUser.id);
        if (boxUrl) {
          const url = this.buildAutoLoginUrl(boxUrl, token);
          windowOpen(url);
        }
      }
    }
  };

  renderGenerateTenantProcess = buttonText => {
    const { processing } = this.state;
    return (
      <div>
        <Button label={t(buttonText)} onClick={this.generateTenant} disabled={processing} />
        {processing && <T.Text>{t('SORTING_SANDBOX')} </T.Text>}
        <Status processing={processing} height={4} />
      </div>
    );
  };

  beginnerLeasing = buttonText => (
    <div className={cf('beginnerLeasingSection')}>
      <div className={cf('beginnerLeasingContent halfSection')}>
        <T.Headline>{t('BEGINNER_LEASING')}</T.Headline>
        <T.Text className={cf('smallMargin')}>{t('INTRODUCTORY_COURSES')}</T.Text>
        <div className={cf('mediumMargin')}>
          <T.Text>{t('COURSE_SUMMARY')}</T.Text>
          {this.renderCourseSummary()}
        </div>
      </div>
      <div className={cf('sandboxSection halfSection')}>
        <T.Text>{t('TRAINING_IN_SANDBOX')}</T.Text>
        <T.Text>{t('COURSE_DEADLINE')} </T.Text>
        <T.Text>{t('SELECT_COURSE')}</T.Text>
        {this.renderGenerateTenantProcess(buttonText)}
      </div>
    </div>
  );

  advancedLeasing = () => (
    <div className={cf('advancedLeasingSection halfSection')}>
      <T.Headline>{t('ADVANCED_LEASING')}</T.Headline>
      <T.Text className={cf('smallMargin')}>{t('LAYING_THE_GROUNDWORK_FOR_ADVANCED_TOPICS')}</T.Text>
    </div>
  );

  render() {
    const { currentUser } = this.props;
    const buttonText = currentUser?.metadata?.sandboxAvailable ? 'OPEN_LEASING_SANDBOX' : 'PREPARE_SANDBOX';
    if (currentUser?.metadata?.sandboxAvailable && this.state.processing === true) {
      this.setState({ processing: false });
    }

    return (
      <div className={cf('revaUniversityContainer')}>
        {this.gettingStarted()}
        {this.beginnerLeasing(buttonText)}
        {this.advancedLeasing()}
      </div>
    );
  }
}
