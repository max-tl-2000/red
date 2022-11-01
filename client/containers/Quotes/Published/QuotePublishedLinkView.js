/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { PreloaderBlock } from 'components';
import { fetchQuote } from 'redux/modules/quotes';
import QuotePublished from './QuotePublished';
import NotFound from '../../NotFound/NotFound';

@connect(
  state => ({
    quote: state.quotes.quote,
    quoteFetchFailed: state.quotes.quoteFetchFailed,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchQuote,
      },
      dispatch,
    ),
)
class QuotePublishedLinkView extends Component {
  static propTypes = {
    inventory: PropTypes.object,
    quoteFetchFailed: PropTypes.bool,
    quote: PropTypes.object,
  };

  get token() {
    return this.props.location.query.token;
  }

  get quoteId() {
    return this.props.params.quoteId;
  }

  async componentDidMount() {
    await this.props.fetchQuote(this.quoteId, true, this.token);
  }

  render() {
    const { quoteFetchFailed, quote } = this.props;

    return (
      <div>
        {do {
          if (quoteFetchFailed) {
            <NotFound />;
          } else if (quote) {
            <QuotePublished quoteId={quote.id} partyId={quote.partyId} token={this.token} />;
          } else {
            <PreloaderBlock />;
          }
        }}
      </div>
    );
  }
}

export default QuotePublishedLinkView;
