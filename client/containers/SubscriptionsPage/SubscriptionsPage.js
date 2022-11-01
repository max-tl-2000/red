/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import newUUID from 'uuid/v4';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import DocumentMeta from 'react-document-meta';
import { t } from 'i18next';
import startCase from 'lodash/startCase';
import sortBy from 'lodash/sortBy';
import { AppBar, Button, Dropdown, TextBox, Section, AppBarActions, IconButton, CardMenu, CardMenuItem, PreloaderBlock } from 'components';
import { inject, observer } from 'mobx-react';
import { fetchSubscriptions, updateSubscriptions, deleteSubscriptions, addSubscriptions } from 'redux/modules/subscriptionsStore';
import { logout } from 'helpers/auth-helper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { IS_URL_WITHOUT_DOMAIN } from '../../../common/regex';
import { now } from '../../../common/helpers/moment-utils';

import { cf } from './SubscriptionsPage.scss';

@connect(
  state => ({
    authUser: state.auth.user,
    subscriptions: state.subscriptionsStore.subscriptions,
    isLoading: state.subscriptionsStore.isLoading,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchSubscriptions,
        updateSubscriptions,
        deleteSubscriptions,
        addSubscriptions,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class SubscriptionsPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { subscriptions: [], newSubscriptions: [] };
  }

  componentWillMount() {
    this.props.fetchSubscriptions();
  }

  componentWillReceiveProps(nextProps) {
    const sortedSubscriptions = sortBy(nextProps.subscriptions || [], 'decision_name');
    if (sortedSubscriptions !== this.state.subscriptions) {
      this.setState({
        subscriptions: sortedSubscriptions,
      });
    }
  }

  dropdownItems = Object.values(DALTypes.PartyEventType).map(i => ({
    id: i,
    text: startCase(i.trim().replace(/_/g, ' ')),
  }));

  navigateToHome = () => this.props.leasingNavigator.navigateToHome();

  handleLogout = event => {
    event.preventDefault();
    this.navigateToHome();
    logout();
  };

  getSectionName = subscription => {
    if (!subscription.decision_name) return t('NEW_SUBSCRIPTION');
    const parts = subscription.decision_name.split(':');

    if (parts.length === 2) {
      return `[ ${parts[0].toUpperCase()} ] ${startCase(parts[1])} subscription`;
    }

    return startCase(`${subscription.decision_name.replace(/_/g, ' ')} subscription`);
  };

  markForDeletion = subscription => {
    // In case a not yet saved subscription is deleted, just erase it from memory
    if (subscription.isNew) {
      this.setState(prevState => {
        const newSubscriptions = prevState.newSubscriptions.filter(s => s.id !== subscription.id);
        return { newSubscriptions };
      });
    } else {
      this.setState(prevState => {
        const dirtySubscription = { shouldDelete: true, ...subscription };
        const restOfSubscriptions = prevState.subscriptions.filter(s => s.id !== subscription.id);
        const newSubscriptions = sortBy([dirtySubscription, ...restOfSubscriptions], 'decision_name');
        return { subscriptions: newSubscriptions };
      });
    }
  };

  updateSubscriptionsInState = (originalSubscription, updatedSubscription) => {
    this.setState(prevState => {
      const dirtySubscription = { ...updatedSubscription, isDirty: true };
      const array = originalSubscription.isNew ? prevState.newSubscriptions : prevState.subscriptions;
      const updatedSubscriptions = [dirtySubscription, ...array.filter(s => s.id !== originalSubscription.id)];
      const sortedSubscriptions = sortBy(updatedSubscriptions, 'decision_name');
      return originalSubscription.isNew ? { newSubscriptions: sortedSubscriptions } : { subscriptions: sortedSubscriptions };
    });
  };

  selectAllEvents = subscription => {
    if (subscription.activeForEvents.length === this.dropdownItems.count) return;

    const updatedSubscription = { ...subscription, newActiveForEvents: this.dropdownItems.map(i => i.id) };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  clearAllEvents = subscription => {
    const { activeForEvents = [], newActiveForEvents = [] } = subscription;
    if (!activeForEvents.length && !newActiveForEvents.length) return;

    const updatedSubscription = { ...subscription, newActiveForEvents: [] };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  updateDecisionName = (subscription, newDecisionName) => {
    const updatedSubscription = { ...subscription, newDecision_name: newDecisionName.value };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  updateAuthToken = (subscription, newAuthToken) => {
    const updatedSubscription = { ...subscription, newAuth_token: newAuthToken.value };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  updateUrl = (subscription, newUrl) => {
    const updatedSubscription = { ...subscription, newUrl: newUrl.value };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  updateEvents = (subscription, newEvents) => {
    const updatedSubscription = { ...subscription, newActiveForEvents: newEvents.ids };
    this.updateSubscriptionsInState(subscription, updatedSubscription);
  };

  addNewSubscription = () => {
    const newSubscription = { created_at: now(), id: newUUID(), activeForEvents: [], url: '', decision_name: '', auth_token: '', isNew: true };
    this.setState(prevState => {
      const newSubscriptions = [...prevState.newSubscriptions, newSubscription];
      return { newSubscriptions };
    });
  };

  isDecisionNameValid = sub => ('newDecision_name' in sub ? !!sub.newDecision_name : !!sub.decision_name);

  isTokenValid = sub => ('newAuth_token' in sub ? !!sub.newAuth_token : !!sub.auth_token);

  isURLValid = sub => ('newUrl' in sub ? !!sub.newUrl && sub.newUrl.match(IS_URL_WITHOUT_DOMAIN) : !!sub.url && sub.url.match(IS_URL_WITHOUT_DOMAIN));

  isSubscriptionInvalid = sub => !this.isDecisionNameValid(sub) || !this.isTokenValid(sub) || !this.isURLValid(sub);

  isPageInvalid = () => {
    const { subscriptions, newSubscriptions } = this.state;
    // Cannot save subscriptions unless all entities are valid, except the ones being deleted.
    return subscriptions
      .concat(newSubscriptions)
      .filter(sub => !sub.shouldDelete)
      .some(this.isSubscriptionInvalid);
  };

  createSubscriptionEntity = subscriptionData => ({
    id: subscriptionData.id,
    decision_name: subscriptionData.newDecision_name || subscriptionData.decision_name,
    auth_token: subscriptionData.newAuth_token || subscriptionData.auth_token,
    url: subscriptionData.newUrl || subscriptionData.url,
    activeForEvents: subscriptionData.newActiveForEvents || subscriptionData.activeForEvents,
  });

  persistSubscriptions = () => {
    const { subscriptions, newSubscriptions } = this.state;

    this.props.deleteSubscriptions(subscriptions.filter(s => s.shouldDelete).map(s => s.id));
    this.props.updateSubscriptions(subscriptions.filter(s => s.isDirty).map(this.createSubscriptionEntity));
    this.props.addSubscriptions(newSubscriptions.map(this.createSubscriptionEntity));

    this.props.leasingNavigator.navigateToHome();
  };

  renderSubscriptions = subscriptions =>
    subscriptions
      .filter(s => !s.shouldDelete)
      .map(sub => (
        <Section key={sub.id} title={this.getSectionName(sub)}>
          <div key={sub.id} className={cf('subscriptionRow')}>
            <TextBox
              wide
              key={sub.decision_name}
              label={t('DECISION_NAME')}
              value={sub.decision_name}
              onChange={value => this.updateDecisionName(sub, value)}
              errorMessage={this.isDecisionNameValid(sub) ? null : t('DECISION_NAME_ERROR')}
            />
            <TextBox
              wide
              key={`url:${sub.url}`}
              label={t('URL')}
              value={sub.url}
              onChange={value => this.updateUrl(sub, value)}
              errorMessage={this.isURLValid(sub) ? null : t('URL_ERROR')}
            />
            <div className={cf('eventsRow')}>
              <Dropdown
                multiple
                wide
                label={(sub.newActiveForEvents || sub.activeForEvents).length > 0 ? t('ACTIVE_FOR_EVENTS') : t('CURRENTLY_DISABLED_FOR_ALL_EVENTS')}
                items={this.dropdownItems}
                selectedValue={sub.newActiveForEvents || sub.activeForEvents}
                onChange={value => this.updateEvents(sub, value)}
              />
              <Button className={cf('dropdownButton')} type="flat" label={t('NONE')} onClick={() => this.clearAllEvents(sub)} />
              <Button className={cf('dropdownButton')} type="flat" label={t('ALL')} onClick={() => this.selectAllEvents(sub)} />
            </div>
            <TextBox
              wide
              key={`auth:${sub.auth_token}`}
              label={t('AUTH_TOKEN')}
              value={sub.auth_token}
              onChange={value => this.updateAuthToken(sub, value)}
              errorMessage={this.isTokenValid(sub) ? null : t('AUTH_TOKEN_ERROR')}
            />
            <div className={cf('deleteButton')}>
              <Button label={t('DELETE_SUBSCRIPTION')} onClick={() => this.markForDeletion(sub)} />
            </div>
          </div>
        </Section>
      ));

  render({ authUser, isLoading } = this.props) {
    const { subscriptions, newSubscriptions } = this.state;
    const orderedSubscriptions = subscriptions.concat(sortBy(newSubscriptions, 'created_at'));
    return (
      <div className={cf('subscriptionsPage')}>
        <DocumentMeta title={t('SUBSCRIPTIONS_PAGE')} />
        <AppBar title={authUser.tenantName} icon={<IconButton iconStyle="light" iconName="home" onClick={this.navigateToHome} />}>
          <AppBarActions>
            <CardMenu iconName="dots-vertical" iconStyle="light" menuListStyle={{ width: 200 }}>
              <CardMenuItem text={t('LOGOUT')} onClick={this.handleLogout} />
            </CardMenu>
          </AppBarActions>
        </AppBar>
        {isLoading && <PreloaderBlock />}
        {!isLoading && <div className={cf('subscriptionsContainer')}>{this.renderSubscriptions(orderedSubscriptions)}</div>}
        <Section title={t('ADD_SUBSCRIPTION')}>
          <div className={cf('buttonBar')}>
            <Button label={t('ADD_SUBSCRIPTION')} disabled={false} onClick={() => this.addNewSubscription()} />
          </div>
        </Section>
        <Section title={t('PERSIST_SUBSCRIPTIONS')}>
          <div className={cf('buttonBar')}>
            <Button label={t('SAVE_SUBSCRIPTIONS')} disabled={this.isPageInvalid()} onClick={() => this.persistSubscriptions()} />
            <Button label={t('BACK')} onClick={this.navigateToHome} />
          </div>
        </Section>
      </div>
    );
  }
}
