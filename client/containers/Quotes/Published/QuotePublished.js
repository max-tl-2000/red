/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { fetchQuoteTemplate } from 'redux/modules/quotes';
import PreloaderBlock from 'components/PreloaderBlock/PreloaderBlock';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import $ from 'jquery';
import { t } from 'i18next';
import { TemplateTypes } from '../../../../common/enums/templateTypes';
import NotFound from '../../NotFound/NotFound';
import Frame from '../../../custom-components/Frame/Frame';

const getPersonsIds = createSelector(
  s => s.dataStore.get('persons'),
  p =>
    Array.from(
      p.reduce((acc, person) => {
        acc.add(person.id);
        return acc;
      }, new Set()),
    ),
);

@connect(
  (state, props) => ({
    template: state.quotes.template,
    fetchingQuoteTemplateError: state.quotes.fetchingQuoteTemplateError,
    isFetchingQuoteTemplate: state.quotes.isFetchingQuoteTemplate,
    personsIds: getPersonsIds(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchQuoteTemplate,
      },
      dispatch,
    ),
)
class QuotePublished extends Component {
  async componentWillMount() {
    const { quoteId, partyId, disableApplyLink, personsIds, token } = this.props;
    await this.props.fetchQuoteTemplate({
      personId: personsIds[0],
      partyId,
      quoteId,
      context: TemplateTypes.EMAIL,
      hideApplicationLink: disableApplyLink,
      token,
    });
  }

  onFrameLoad(quoteFrameId) {
    const head = $(`#${quoteFrameId}`).contents().find('head');

    const removePrintHeaderAndFooterCss = `<style>
                                          @media print {
                                            @page { margin: 0; }
                                            body { margin: 1.6cm; }
                                          }
                                        </style>`;

    document.title = window.parent.document.title = t('PUBLISHED_QUOTE_PAGE_TITLE');
    $(head).append(removePrintHeaderAndFooterCss);
  }

  renderTemplate = ({ quoteFrameId, template, isFetchingQuoteTemplate, fetchingQuoteTemplateError }) => {
    if (isFetchingQuoteTemplate) return <PreloaderBlock />;

    if (fetchingQuoteTemplateError) return <NotFound />;

    return (
      <Frame
        id={quoteFrameId}
        content={template}
        style={{ border: 'none', height: '100vh', width: '100%', position: 'absolute', left: 0 }}
        onFrameLoad={() => this.onFrameLoad(quoteFrameId)}
      />
    );
  };

  render() {
    const { template, fetchingQuoteTemplateError, isFetchingQuoteTemplate, quoteFrameId } = this.props;
    return this.renderTemplate({ template, fetchingQuoteTemplateError, isFetchingQuoteTemplate, quoteFrameId });
  }
}

export default QuotePublished;
