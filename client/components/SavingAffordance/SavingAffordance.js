/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { findDOMNode } from 'react-dom';
import { create } from 'helpers/animator';
import $ from 'jquery';
import sleep from 'helpers/sleep';
import { t } from 'i18next';
import { SavingState } from './SavingState';
import * as T from '../Typography/Typography';
import { cf, g } from './SavingAffordance.scss';
import LoaderIndicator from '../LoaderIndicator/LoaderIndicator';
import Icon from '../Icon/Icon';

export const savingState = new SavingState();

@observer
export default class SavingAffordance extends Component {
  static propTypes = {
    id: PropTypes.string,
    lblSaveStart: PropTypes.string,
    lblSaveDone: PropTypes.string,
    matcher: PropTypes.any,
    lighter: PropTypes.bool,
    delayToShowLoadingMessage: PropTypes.number,
    timeToShowLoadingMessage: PropTypes.number,
    delayToShowDoneMessage: PropTypes.number,
    timeToHideDoneMessage: PropTypes.number,
  };

  static defaultProps = {
    delayToShowLoadingMessage: 100,
    timeToShowLoadingMessage: 1500,
    delayToShowDoneMessage: 100,
    timeToHideDoneMessage: 1500,
  };

  get lblSaveStart() {
    return $(this.dom).find('[data-part="lblSaveStart"]');
  }

  get lblSaveDone() {
    return $(this.dom).find('[data-part="lblSaveDone"]');
  }

  componentDidUpdate() {
    const isSaving = this.savingAttribute === 'true';

    if (isSaving && !this.wasSaving) {
      this.animator.show(this.lblSaveStart);
    }

    const { timeToShowLoadingMessage, delayToShowDoneMessage, timeToHideDoneMessage } = this.props;

    if (!isSaving && this.wasSaving) {
      setTimeout(async () => {
        // checks are needed because the element might be unmounted
        // at any time, after the sleep calls
        this.animator && this.animator.hide(this.lblSaveStart);

        await sleep(delayToShowDoneMessage);
        this.animator && this.animator.show(this.lblSaveDone);

        await sleep(timeToHideDoneMessage);
        this.animator && this.animator.hide(this.lblSaveDone);
      }, timeToShowLoadingMessage);
    }

    this.wasSaving = isSaving;
  }

  get dom() {
    return findDOMNode(this);
  }

  get savingAttribute() {
    return this.dom.getAttribute('data-saving');
  }

  componentWillUnmount() {
    this.animator = null;
  }

  componentDidMount() {
    this.animator = create();
    this.wasSaving = this.savingAttribute === 'true';
  }

  render() {
    const { id, lblSaveStart = t('SAVE_START'), lblSaveDone = t('SAVE_DONE'), matcher, lighter, className, compressed } = this.props;

    const isSaving = matcher ? savingState.pendingCallsCount && savingState.hasResource(matcher) : savingState.pendingCallsCount > 0;

    return (
      <span id={id} className={cf('save-affordance', g(className))} data-saving={isSaving} data-component="save-affordance">
        {/* TODO: Handle the case when the request fails. In that case we should probably show an error */}
        {/* Since the elements are absolute positioned we need to have an element
                with visibility:hidden to make the parent container to have a size that
                contains the elements */}
        <T.Caption className={cf('sizer')}>{lblSaveStart}</T.Caption>
        <span data-part="lblSaveStart" className={cf('save-start-msg')}>
          {compressed ? <LoaderIndicator className={cf('loader')} darker={!lighter} /> : <T.Caption lighter={lighter}>{lblSaveStart}</T.Caption>}
        </span>
        <span data-part="lblSaveDone" className={cf('save-done-msg')}>
          {compressed ? <Icon name="cloud-check" iconStyle={lighter ? 'light' : 'dark'} /> : <T.Caption lighter={lighter}>{lblSaveDone}</T.Caption>}
        </span>
      </span>
    );
  }
}
