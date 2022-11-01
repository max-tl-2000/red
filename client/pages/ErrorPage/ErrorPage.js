/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';

import * as T from '../../components/Typography/Typography';
import ErrorImage from '../../../resources/pictographs/500-error.svg';
import { cf } from './ErrorPage.scss';
import Page from '../common/Page/Page';
import FormattedMarkdown from '../../components/Markdown/FormattedMarkdown';

@inject('screen', 'urls', 'serverError')
@observer
export default class ErrorPage extends Component {
  render() {
    const { screen, serverError } = this.props;
    const small = screen.isAtMostSmall1;

    const errorMessage = t('ERROR_PAGE_DEFAULT_TEXT', { linkClassName: cf('link'), supportEmail: 'support@reva.tech' });

    return (
      <Page className={cf('page', { small })}>
        <ErrorImage className={cf('image500', { small })} />
        <T.Headline>{t('ERROR_PAGE_DEFAULT_TITLE')}</T.Headline>
        <FormattedMarkdown className={cf('errorMessage')}>{errorMessage}</FormattedMarkdown>
        {serverError.stack && <T.Title className={cf('errorTitle', { small })}>{serverError.message}</T.Title>}
        {serverError.token && <T.Text className={cf('errorTitle', { small })}>{serverError.token}</T.Text>}
        {serverError.stack && (
          <pre className={cf('codeBlock', { small })}>
            <code>{serverError.stack}</code>
          </pre>
        )}
      </Page>
    );
  }
}
