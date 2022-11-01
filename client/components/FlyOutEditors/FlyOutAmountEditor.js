/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import $ from 'jquery';
import { t } from 'i18next';
import { isNumber } from 'helpers/type-of';
import trim from 'helpers/trim';
import { observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';
import { getHumanRep } from 'helpers/number';
import { cf } from './FlyOutAmountEditor.scss';

import Button from '../Button/Button';
import Money from '../Table/Money';

import FlyOut from '../FlyOut/FlyOut';
import FlyOutOverlay from '../FlyOut/FlyOutOverlay';
import FlyOutActions from '../FlyOut/FlyOutActions';
import TextBox from '../TextBox/TextBox';

import Text from '../Typography/Text';
import Caption from '../Typography/Caption';

const isNotANumber = value => isNaN(value);
const isValueGreaterThanMax = (max, value) => !!max && value > max;
const isValueLowerThanMin = (min, value) => min !== undefined && value < min;
@observer
export default class FlyOutAmountEditor extends Component {
  @observable
  _open;

  @observable
  value;

  static propTypes = {
    expandTo: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    displayValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onChange: PropTypes.func,
    prefix: PropTypes.string,
    max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    min: PropTypes.number,
    invalidInputError: PropTypes.string,
    greaterThanMaxError: PropTypes.string,
    lowerThanMinError: PropTypes.string,
    periodic: PropTypes.bool,
    period: PropTypes.number,
    lblDone: PropTypes.string,
    onLabelClick: PropTypes.func,
    onCloseRequest: PropTypes.func,
    originalValue: PropTypes.number,
    dataId: PropTypes.string,
  };

  static defaultProps = {
    prefix: '$',
    periodic: false,
    period: 12,
    expandTo: 'bottom-left',
    invalidInputError: 'Please enter only numbers',
    greaterThanMaxError: 'The amount you entered is greater than max',
    lowerThanMinError: 'The amount you entered is lower than min',
  };

  constructor(props, context) {
    super(props, context);

    this.setProps(props);
  }

  @computed
  get parsedValue() {
    const pv = parseFloat(this.value);
    if (isNaN(pv)) {
      return 0;
    }
    return pv;
  }

  @computed
  get validations() {
    const { invalidInputError, greaterThanMaxError, lowerThanMinError, min, max } = this.props;
    return [
      { fn: isNotANumber, error: invalidInputError, plainVal: true },
      { fn: isValueGreaterThanMax.bind(null, max), error: greaterThanMaxError },
      { fn: isValueLowerThanMin.bind(null, min), error: lowerThanMinError },
    ];
  }

  @computed
  get errorMessage() {
    if (trim(this.value) === '') return '';
    const parsedValue = this.parsedValue;
    const { error } = this.validations.find(validation => validation.fn(validation.plainVal ? this.value : parsedValue)) || {};

    return error;
  }

  @action
  setProps(props) {
    this.value = props.value;
    this._open = props.open;
  }

  @action
  setValue(value) {
    this.value = value;
  }

  @action
  open = () => {
    this._open = true;
  };

  @action
  doClose = () => {
    const { onCloseRequest } = this.props;

    if (onCloseRequest) {
      onCloseRequest({ close: () => this.close(), value: this.value });
      return;
    }

    this.close();
  };

  @action
  close() {
    this._open = false;
  }

  componentWillReceiveProps(nextProps) {
    if ('value' in nextProps && this.props.value !== nextProps.value) {
      this.setValue(nextProps.value);
    }

    if ('open' in nextProps && this.props.open !== nextProps.open) {
      if (nextProps.open) {
        this.open();
      } else {
        this.close();
      }
    }
  }

  handlePosition = args => {
    args.position = {
      my: 'right top',
      at: 'right+22 top-22',
      collision: 'flipfit',
      of: $(findDOMNode(this)).find('[data-component="money"]'),
    };
  };

  handleAnimation({ animProps }) {
    animProps.animation = {
      // eslint-disable-line no-param-reassign
      ...animProps.animation,
      transformOriginX: ['85%', '85%'],
      transformOriginY: ['20%', '20%'],
    };
  }

  handleTextChange = ({ value }) => {
    this.setValue(value);
  };

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this.enterPressTimeout);
  }

  handleOpen = () => {
    const { txt } = this.refs;
    txt.focus();
    txt.select();
  };

  handleEnterPress = () => {
    clearTimeout(this.enterPressTimeout);
    this.enterPressTimeout = setTimeout(() => this.handleConfirmFlyoutValue(), 60); // onChange is debounced 50s, 10s so we have the actual value
  };

  handleClose = () => {
    this.close();
  };

  handleMoneyClick = e => {
    const { onLabelClick } = this.props;

    if (onLabelClick) {
      onLabelClick(e);
      return;
    }

    this.open();
  };

  handleConfirmFlyoutValue = () => {
    if (!this._mounted) return;

    const { onChange, value: originalValue } = this.props;

    if (this.errorMessage) {
      this.setValue(originalValue);
    }

    if (this.parsedValue !== parseFloat(originalValue)) {
      onChange && onChange({ value: this.parsedValue });
    }

    this.doClose();
  };

  resetValue = () => {
    const { onChange, originalValue } = this.props;
    this.setValue(originalValue);
    onChange && onChange({ value: originalValue });
  };

  @computed
  get percentageText() {
    const { value: commitedValue, originalValue, showPercentage, relativeToLastValue } = this.props;
    const { parsedValue, _open } = this;
    const theOriginalValue = parseFloat(originalValue);

    const parsedOriginalValue = relativeToLastValue || isNaN(theOriginalValue) ? parseFloat(commitedValue) : theOriginalValue;

    if (!showPercentage || !parsedValue || isNaN(parsedOriginalValue) || parsedOriginalValue === 0 || !_open) {
      return null;
    }

    const thePercentage = ((parsedValue - parsedOriginalValue) / parsedOriginalValue) * 100;

    if (thePercentage === 0) return null;

    return (
      <Caption secondary>
        {`${getHumanRep(thePercentage)}% ${t('FROM')} `}
        <Money amount={parsedOriginalValue} noFormat />
      </Caption>
    );
  }

  render() {
    const {
      expandTo,
      prefix,
      max,
      min,
      value,
      displayValue,
      periodic,
      period,
      lblDone,
      showPercentage,
      relativeToLastValue, // eslint-disable-line
      originalValue,
      dataId,
    } = this.props;
    const { value: stateValue, _open, errorMessage } = this;

    const shouldDisplayReset = isNumber(originalValue);
    const editorAmountDataId = dataId ? `editorAmount${dataId}Text` : dataId;
    const editorTextBoxDataId = dataId ? `flyoutAmount${dataId}Text` : dataId;

    return (
      <div>
        <Money data-id={editorAmountDataId} amount={(periodic ? period : 1) * (displayValue >= 0 ? displayValue : value)} onClick={this.handleMoneyClick} />
        <FlyOut open={_open} onOpen={this.handleOpen} onCloseRequest={this.doClose} expandTo={expandTo} onPosition={this.handlePosition}>
          <FlyOutOverlay elevation={2} animationFn={this.handleAnimation} lazy className={cf('amount-editor')} container={false}>
            <div className={cf('content')}>
              <Text secondary className={cf('money-sign')}>
                {prefix}
              </Text>
              <TextBox
                id={editorTextBoxDataId}
                ref="txt"
                onEnterPress={this.handleEnterPress}
                value={displayValue}
                onChange={this.handleTextChange}
                errorMessage={errorMessage}
              />
              {!errorMessage && (
                <div
                  className={cf('helper-text', {
                    'no-periodic': !periodic && !this.percentageText,
                  })}>
                  {periodic && !showPercentage && (
                    <Caption secondary>
                      {`${t('TOTAL')}: `}
                      <Money amount={period * stateValue} noFormat />
                    </Caption>
                  )}
                  {this.percentageText}
                  <div className={cf('helperTextWrapper')}>
                    {min !== undefined && (
                      <Caption data-id={`flyOutAmount${dataId}minText`} secondary>
                        {`${t('MIN')}: `}
                        <Money amount={min} noFormat />
                      </Caption>
                    )}
                    {max && (
                      <Caption data-id={`flyOutAmount${dataId}maxText`} secondary>
                        {`${t('MAX')}: `}
                        <Money amount={max} noFormat />
                      </Caption>
                    )}
                  </div>
                </div>
              )}
            </div>
            <FlyOutActions className={cf('actions', { 'no-reset': !shouldDisplayReset })}>
              {shouldDisplayReset && (
                <Button
                  id="flyoutResetBtn"
                  className={cf('reset')}
                  btnRole="secondary"
                  disabled={parseFloat(originalValue) === this.parsedValue}
                  onClick={this.resetValue}
                  type="flat"
                  label={t('RESET_LABEL')}
                />
              )}
              <Button data-id="flyoutDoneBtn" onClick={this.handleConfirmFlyoutValue} type="flat" label={lblDone || t('DONE')} />
            </FlyOutActions>
          </FlyOutOverlay>
        </FlyOut>
      </div>
    );
  }
}
