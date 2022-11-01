/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer, inject } from 'mobx-react';
import React, { Component } from 'react';
import Router from 'react-router/lib/Router';
import MobxDevTools from 'mobx-react-devtools';
import { hot } from 'react-hot-loader';

import { DALTypes } from 'enums/DALTypes';
import { Welcome } from '../welcome/welcome';
import { ApplicationAdditionalInfo } from '../application-additional-info/application-additional-info';
import { ApplicationPage } from '../application-page/application-page';
import { ApplicationComplete } from '../application-complete/application-complete';
import { ApprovalProcessSummaryPage } from '../approval-process-summary-page/approval-process-summary-page';
import { ResetPasswordPage, ConfirmResetPasswordPage } from '../reset-password';
import { Login } from '../login/login';
import { cf } from './root.scss';
import { location as loc } from '../../../../client/helpers/navigator';
import NotFound from '../../custom-components/not-found/not-found';
import { ApplicationListPage } from '../application-list-page/application-list-page';
import { getIPs } from '../../../../common/client/clientNetwork';

@inject('auth', 'location', 'application')
@observer
class Root extends Component {
  // eslint-disable-line react/prefer-stateless-function

  constructor(props) {
    super(props);
    const routes = {
      childRoutes: [
        {
          path: '/welcome(/:rentappToken)',
          component: Welcome,
          onEnter: this.handleOnEnter,
        },
        {
          path: '/applicationAdditionalInfo(/:rentappToken)',
          component: ApplicationAdditionalInfo,
          onEnter: this.handleOnEnter,
        },
        {
          path: '/applicantDetails',
          component: ApplicationPage,
          onEnter: this.handleOnEnter,
        },
        {
          path: '/applicationComplete',
          component: ApplicationComplete,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        {
          path: '/applicationList(/:rentappToken)',
          component: ApplicationListPage,
          onEnter: this.handleOnEnter,
        },
        {
          path: '/partyApplications/:partyId/review(/:agentToken)',
          component: ApprovalProcessSummaryPage,
          onEnter: this.handleOnEnter,
        },
        { path: '/resetPassword/:authToken', component: ResetPasswordPage },
        {
          path: '/confirmResetPassword/:authToken',
          component: ConfirmResetPasswordPage,
        },
        {
          path: '/notFound',
          component: this.getNotFoundComponent,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
        {
          path: '/',
          component: Login,
          onEnter: this.handleOnEnter,
          noAuthRequired: true,
        },
      ],
    };

    this.state = { routes };
  }

  /* eslint-disable new-cap */
  getNotFoundComponent = () =>
    NotFound({
      error: {
        title: 'LINK_EXPIRED_TITLE',
        message: 'LINK_EXPIRED_MSG',
      },
      propertyName: 'RENTAPP_TITLE',
    });
  /* eslint-enable new-cap */

  redirectToLogin = () => loc.replace('/');

  handleOnEnter = async ({ location, routes }) => {
    // routes parameter is an array with 2 elements:
    //
    // - the first element (index 0) is all the provided routes
    // - and the second element is the current matched route (index 1)
    //
    // we need the current matched route object as we store some
    // metadata on that element to decide if a given route needs
    // or not authenticated sessions

    if (location.pathname.includes('/welcome/') && this.props.auth.isAuthenticated) {
      await this.props.application.fetchApplicant();

      const { shouldRedirectToApplicationList, impersonatorUserId } = this.props.application;
      if (shouldRedirectToApplicationList && !impersonatorUserId) {
        window.location.reload();
        return;
      }

      const ip = await getIPs();
      const localIP = ip && ip.length ? ip[0] : '';

      this.props.application.saveEvent({
        eventType: DALTypes.ApplicationWelcomeScreenEvents.PAGE_VIEW,
        localIP,
      });
    }
    const matched = routes[1];
    // wonder why we didn't use the matched.path
    // instead... matched.path is the raw route
    this.props.location.updatePath(location.pathname);
    if (matched.noAuthRequired) {
      return;
    }

    const { auth } = this.props;

    if (!auth.isAuthenticated) this.redirectToLogin();
  };

  render() {
    const { history } = this.props;
    const { routes } = this.state;

    return (
      <div className={cf('root')}>
        <Router history={history} routes={routes} />
        {__MOBX_DEVTOOLS__ && <MobxDevTools />}
      </div>
    );
  }
}

export default hot(module)(Root);
