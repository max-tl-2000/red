/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Router } from 'react-router';
import { Provider } from 'react-redux';

import MobxDevTools from 'mobx-react-devtools';
import { setPreviousPath } from 'helpers/auth-helper';
import {
  IncomingCallForm,
  WrapUpTimeCounter,
  Home,
  PrintFriendly,
  NotFound,
  RegisterWithInvite,
  NeedHelp,
  ResetPassword,
  InventoryPage,
  GlobalSearch,
  PersonDetailsPage,
  TenantAdmin,
  ContactUsForm,
  FlyOutContainer,
  ExecuteLeasePage,
  ReviewLeasePage,
  SignLeaseInOfficePage,
  ResidentSignLeaseFromEmailPage,
  DownloadLeasePage,
  DownloadLeasePreviewPage,
  SignLeasePage,
  RingCentralTokenRefreshPage,
  SignatureConfirmation,
  PartyPageUnified,
  FakeDocuSignPage,
  AppSettingsPage,
  SubscriptionsPage,
  CommunicationManagement,
} from 'containers';
import { hot } from 'react-hot-loader';

import { isAdmin, isCustomerAdmin } from '../../../common/helpers/auth';
import AppVersion from '../../custom-components/AppVersion/AppVersion';
import ForbiddenDialog from '../../custom-components/ForbiddenDialog/ForbiddenDialog';
import SisenseIFrame from '../../custom-components/SisenseIFrame/SisenseIFrame';

import DevTools from '../DevTools/DevTools';

import QuotePublishedLinkView from '../Quotes/Published/QuotePublishedLinkView';
import { logout } from '../../helpers/auth-helper';
import { combineCallbacks } from '../../../common/client/callbacks-helper';
import { userHasPropertyAndTeamAndChannelSelections, doesPartyHaveWorkflow } from '../../redux/selectors/userSelectors';
import { window } from '../../../common/helpers/globals';
import { allowedAccessToCohortCommms } from '../../../common/acd/access';
import { paths } from '../../../common/helpers/paths';

class Root extends Component {
  static propTypes = {
    history: PropTypes.object.isRequired,
    store: PropTypes.object.isRequired,
  };

  forceLogout = (nextState, replace, next) => {
    const { props } = this;

    const state = props.store.getState();
    const { auth } = state;
    // if the user is logged in, we need to log him out
    // in routes like `/resetPassword`
    if (auth.user || auth.token) {
      logout();
      return;
    }
    next(); // call the next callback
  };

  constructor(props) {
    super(props);

    this.adminAccess = [paths.TENANT_ADMIN, paths.TENANT_RINGCENTRAL_TOKEN, paths.APP_SETTINGS, paths.SUBSCRIPTIONS];
    this.superAdminAccess = [paths.HOME];
    this.openPaths = [
      paths.HOME,
      paths.CONTACT_US,
      paths.NEED_HELP,
      paths.REGISTER,
      paths.RESET_PASSWORD,
      paths.NOT_FOUND,
      paths.SIGN_LEASE_IN_OFFICE,
      paths.SIGN_GUARANTEE_LEASE_IN_OFFICE,
      paths.RESIDENT_SIGN_LEASE_FROM_EMAIL,
      paths.REVIEW_LEASE,
      paths.EXECUTE_LEASE,
      paths.DOWNLOAD_LEASE,
      paths.DOWNLOAD_LEASE_PREVIEW,
      paths.SIGNATURE_CONFIRMATION,
      paths.PUBLISHED_QUOTE,
      paths.TEST_DOCUSIGN,
    ];

    this.userAccess = [
      paths.PARTY_PAGE_UNIFIED,
      paths.PARTY_PAGE_UNIFIED_APPOINTMENT,
      paths.PARTY_PAGE_UNIFIED_LEASE,
      paths.PERSON_DETAILS,
      paths.SIGN_LEASE,
      paths.PARTY_PAGE,
      paths.INVENTORY_DETAILS,
      paths.SEARCH,
      paths.COUNTERSIGN_LEASE_IN_OFFICE,
      paths.QUOTE,
      paths.COMMUNICATION_MANAGEMENT,
      ...this.openPaths,
    ];

    this.customerAdminAccess = [...this.userAccess, paths.TENANT_ADMIN, paths.TENANT_RINGCENTRAL_TOKEN];

    this.cohortCommunicationApproverAccess = [paths.COMMUNICATION_MANAGEMENT];

    const routes = {
      childRoutes: [
        {
          path: paths.HOME,
          component: Home,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PRINT,
          component: PrintFriendly,
        },
        {
          path: paths.CONTACT_US,
          component: ContactUsForm,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.REGISTER,
          component: RegisterWithInvite,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PARTY_PAGE_UNIFIED,
          component: PartyPageUnified,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PARTY_PAGE_UNIFIED_APPOINTMENT,
          component: PartyPageUnified,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PARTY_PAGE_UNIFIED_LEASE,
          component: SignLeasePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PUBLISHED_QUOTE,
          component: QuotePublishedLinkView,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.QUOTE,
          component: QuotePublishedLinkView,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.SIGNATURE_CONFIRMATION,
          component: SignatureConfirmation,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.PERSON_DETAILS,
          component: PersonDetailsPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.SIGN_LEASE,
          component: SignLeasePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.COUNTERSIGN_LEASE_IN_OFFICE,
          component: SignLeaseInOfficePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.EXECUTE_LEASE,
          component: ExecuteLeasePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.REVIEW_LEASE,
          component: ReviewLeasePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.SIGN_LEASE_IN_OFFICE,
          component: SignLeaseInOfficePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.SIGN_GUARANTEE_LEASE_IN_OFFICE,
          component: SignLeaseInOfficePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.RESIDENT_SIGN_LEASE_FROM_EMAIL,
          component: ResidentSignLeaseFromEmailPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.DOWNLOAD_LEASE_PREVIEW,
          component: DownloadLeasePreviewPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.DOWNLOAD_LEASE,
          component: DownloadLeasePage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.INVENTORY_DETAILS,
          component: InventoryPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.NEED_HELP,
          component: NeedHelp,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.RESET_PASSWORD,
          component: ResetPassword,
          onEnter: combineCallbacks([this.forceLogout, this.performAcdCheck]),
        },
        {
          path: paths.SEARCH,
          component: GlobalSearch,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.TENANT_ADMIN,
          component: TenantAdmin,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.TENANT_RINGCENTRAL_TOKEN,
          component: RingCentralTokenRefreshPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.TEST_DOCUSIGN,
          component: FakeDocuSignPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.APP_SETTINGS,
          component: AppSettingsPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.SUBSCRIPTIONS,
          component: SubscriptionsPage,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.COMMUNICATION_MANAGEMENT,
          component: CommunicationManagement,
          onEnter: this.performAcdCheck,
        },
        {
          path: paths.NOT_FOUND,
          component: NotFound,
          onEnter: (nextState, replace) => {
            const { location } = nextState;
            if (location.pathname.match('/prospect')) {
              replace({
                ...location,
                pathname: location.pathname.replace(/^\/prospect/, '/party'),
              });
            }
          },
        },
      ],
    };

    this.state = { routes };
  }

  shouldRedirectToDashboard = state => {
    const hasPropertyAndTeamAndChannel = userHasPropertyAndTeamAndChannelSelections(state);
    const hasPartyWorkflow = doesPartyHaveWorkflow(state);

    return !hasPartyWorkflow || !hasPropertyAndTeamAndChannel;
  };

  performAcdCheck = (nextState, replace) => {
    const { props, shouldRedirectToDashboard } = this;
    const state = props.store.getState();

    const { auth } = state;
    const isAdminUser = auth.token && isAdmin(auth.user);
    const isAdminSuperUser = isAdminUser && auth.user.tenantId === 'admin';
    const isUser = auth.token && !isAdminUser;
    const isCustomerAdminUser = auth.token && isCustomerAdmin(auth.user);
    const [, nextRoute] = nextState.routes;
    const currentPath = nextState.location.pathname;

    if (['/party', '/party/'].includes(currentPath) && shouldRedirectToDashboard(state)) replace(paths.HOME);

    const superAdminAttemptingUnathorizedPath = isAdminSuperUser && !this.superAdminAccess.includes(nextRoute.path) && currentPath !== paths.HOME;
    const adminAttemptingUnathorizedPath = isAdminUser && !isAdminSuperUser && !this.adminAccess.includes(nextRoute.path) && currentPath !== paths.TENANT_ADMIN;
    const regularUserAttemptingUnathorizedPath = !isCustomerAdminUser && isUser && !this.userAccess.includes(nextRoute.path) && currentPath !== paths.HOME;
    const customerAdminAttemptingUnauthorizedPath = isCustomerAdminUser && !this.customerAdminAccess.includes(nextRoute.path) && currentPath !== paths.HOME;
    const unathorizedVisitorAttemptingClosedPath = !auth.token && !this.openPaths.includes(nextRoute.path) && currentPath !== paths.HOME;
    const userAttemptingUnathorizedAccessToCohortComms =
      this.cohortCommunicationApproverAccess.includes(currentPath) && !allowedAccessToCohortCommms(auth.user);
    // check for admin and redirect if necesary
    if (superAdminAttemptingUnathorizedPath) replace(paths.HOME);
    else if (adminAttemptingUnathorizedPath) replace(paths.TENANT_ADMIN);
    else if (regularUserAttemptingUnathorizedPath || customerAdminAttemptingUnauthorizedPath || userAttemptingUnathorizedAccessToCohortComms) {
      replace(paths.HOME);
    } else if (unathorizedVisitorAttemptingClosedPath) {
      const { location } = window;
      // prevent the error: https://github.com/reactjs/react-router-redux/issues/330
      const origin = location.origin ? location.origin : `${location.protocol}//${location.host}`;
      const locationWithoutOrigin = location.href.replace(new RegExp(`^${origin}`), '');
      setPreviousPath(locationWithoutOrigin);
      replace(paths.HOME);
    }
  };

  render() {
    const { props, state } = this;
    const { store, history } = props;
    // routes defined as JS object play better with HMR
    // for more details check: https://github.com/reactjs/react-router-redux/issues/179#issuecomment-227193510
    const RouterC = <Router history={history} routes={state.routes} />;

    const wideAvailableElements = (
      <div>
        <IncomingCallForm />
        <WrapUpTimeCounter />
        <FlyOutContainer />
        <ForbiddenDialog />
        <SisenseIFrame />
      </div>
    );

    const combinedRouterAndWideElem = (
      <div>
        {RouterC}
        {wideAvailableElements}
        {__MOBX_DEVTOOLS__ && <MobxDevTools />}
        {__DEVTOOLS__ && !window.devToolsExtension && <DevTools />}
        <AppVersion />
      </div>
    );

    return <Provider store={store}>{combinedRouterAndWideElem}</Provider>;
  }
}

export default hot(module)(Root);
