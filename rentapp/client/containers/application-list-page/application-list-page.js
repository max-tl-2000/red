/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { CardMenu, CardMenuItem, PreloaderBlock } from 'components';
import { t } from 'i18next';
import Headline from 'components/Typography/Headline';
import SubHeader from 'components/Typography/SubHeader';
import generateId from 'helpers/generateId';
import ErrorBlock from '../../custom-components/error-block/error-block';
import { Page } from '../../custom-components/page/page';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { cf } from './application-list-page.scss';
import { AppFooter } from '../../custom-components/app-footer/app-footer';
import { ApplicationCard } from './application-card';
import { ApplicantName } from '../applicant/applicant-name';
import { redirectToUrl } from '../../helpers/utils';

@inject('auth', 'application', 'applications')
@observer
export class ApplicationListPage extends React.Component {
  async componentWillMount() {
    const { applications, auth } = this.props;
    if (auth.isAuthenticated) {
      if (!auth.isUserLogged) {
        redirectToUrl('/');
      }
      await applications.fetchApplications();
      if (!applications.errors) {
        return applications.handleRedirection(auth.isUserLogged);
      }
    }
    return redirectToUrl('/');
  }

  renderAppBarActions = ({ auth } = this.props) => (
    <CardMenu
      iconName="dots-vertical"
      ref={ref => {
        this.applicationContextMenu = ref;
      }}
      onSelect={this.handleContextMenuAction}
      iconStyle="light">
      <CardMenuItem text={t('CHANGE_PRIMARY_EMAIL')} />
      {!auth.isImpersonation && <CardMenuItem text={t('SIGN_OUT')} onClick={() => auth.logout()} />}
    </CardMenu>
  );

  renderApplicationSection = (title, applications) => {
    if (!applications || !applications.length) return <noscript />;

    return (
      <div className={cf('application-section')}>
        <SubHeader>{title}</SubHeader>
        <div className={cf('application-list')}>
          {applications.map(application => (
            <ApplicationCard handleOnApplicationClick={this.handleOnApplicationClick} key={generateId(ApplicationCard)} item={application} />
          ))}
        </div>
      </div>
    );
  };

  handleOnApplicationClick = application => {
    const { auth } = this.props;
    const url = this.props.applications.getApplicationUrl(application, auth.isAuthenticated);
    redirectToUrl(url);
  };

  renderApplications = () => {
    const { lastApplications, olderApplications, applicantName, loaded, error } = this.props.applications;

    if (error) {
      return (
        <ErrorBlock
          className={cf('error-container')}
          error={{
            title: 'ISSUE_WITH_YOUR_APPLICATION_TITLE',
            message: 'ISSUE_WITH_YOUR_APPLICATION_MSG',
          }}
        />
      );
    }

    if (!loaded) return <PreloaderBlock />;

    return (
      <div className={cf('wrapper-container')}>
        <Headline secondary inline id="welcome-headline">
          {`${t('WELCOME')},`}
        </Headline>
        <ApplicantName applicantName={applicantName} symbol={''} />
        <SubHeader>{t('APPLICATION_LIST_SUBHEADER')}</SubHeader>
        {this.renderApplicationSection(t('APLICATIONS_LAST_30_DAYS'), lastApplications)}
        {this.renderApplicationSection(t('OLDER_APPLICATIONS'), olderApplications)}
      </div>
    );
  };

  render = () => (
    <Page appBar={<RentAppBar title={t('APPLICATION')} appBarActions={this.renderAppBarActions()} />}>
      {this.renderApplications()}
      <AppFooter className={cf('footer-container ')} />
    </Page>
  );
}
