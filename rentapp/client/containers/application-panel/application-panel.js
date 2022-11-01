/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observer, inject } from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';

import { t } from 'i18next';
import { Button, PreloaderBlock } from 'components';
import { windowOpen } from 'helpers/win-open';
import { UnitBlock, SummarySection } from 'custom-components/QuoteSummary/QuoteSummary';
import { AgentInfo } from '../../custom-components/agent-info/agent-info';
import { PropertyPolicies } from './property-policies';
import { cf } from './application-panel.scss';

@inject('quoteSummary', 'agent', 'application', 'auth')
@observer
export class ApplicationPanel extends React.Component {
  static propTypes = {
    quoteId: PropTypes.string,
    partyId: PropTypes.string,
  };

  componentWillMount() {
    if (this.props.quoteId) {
      this.props.quoteSummary.fetchQuoteAndInventory(this.props.quoteId);
    }
    if (this.props.partyId) {
      this.props.agent.fetchPartyAgent(this.props.partyId);
    }
  }

  handleViewFullQuote = () => {
    const { quote } = this.props.quoteSummary;
    if (quote) {
      const url = `${window.location.protocol}//${this.props.application.tenantDomain}/publishedQuote/${quote.id}?token=${this.props.auth.token}`;
      this.windowOpen(url);
    }
  };

  handlePropertyPolicy = property => {
    if (property && property.id) {
      this.windowOpen(property.policyUrl);
    }
  };

  windowOpen(url) {
    // Why is the https replacement needed?
    // should this be removed?
    // TODO: Check if this hack can be removed
    if (!url.match(/^https?:\/\//i)) {
      url = `http://${url}`;
    }
    return windowOpen(url);
  }

  renderQuoteSummary() {
    const { quote, inventory } = this.props.quoteSummary;
    return (
      <div>
        <div className={cf('quote-summary')}>
          <div>
            {inventory && inventory.id && <UnitBlock reflow hideStatus inventory={inventory} />}
            {quote && <SummarySection quote={quote} className={cf('quote')} renderLeaseTerms={false} />}
          </div>
          <div className={cf('quote-actions')}>
            <Button type="flat" label={t('VIEW_FULL_QUOTE')} onClick={this.handleViewFullQuote} />
          </div>
        </div>
      </div>
    );
  }

  hasPropertyPolicies = propertyPolicies => propertyPolicies && !!propertyPolicies.length;

  renderPropertyPolicies() {
    const { application, quoteSummary, displayPropertyPolicies = true } = this.props;
    const noPolicyContent = <div className={cf('no-policy')} />;
    if (!displayPropertyPolicies) return noPolicyContent;

    const propertyPolicies = application.generatePropertyPolicies(quoteSummary.propertyPolicies);
    return this.hasPropertyPolicies(propertyPolicies) ? (
      <PropertyPolicies reflow properties={propertyPolicies} onPropertyPolicy={this.handlePropertyPolicy} className={cf('property-policies')} />
    ) : (
      noPolicyContent
    );
  }

  render() {
    const { reflow } = this.props;
    const { agent, isAgentReady } = this.props.agent;
    const { loadingQuote, hasQuote } = this.props.quoteSummary;

    return (
      <div className={cf('application-panel', { reflow })}>
        {isAgentReady && <AgentInfo agent={agent} />}
        {this.renderPropertyPolicies()}
        {hasQuote && this.renderQuoteSummary()}
        {loadingQuote && <PreloaderBlock />}
      </div>
    );
  }
}
