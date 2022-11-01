/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component, Children } from 'react';
import { findDOMNode } from 'react-dom';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import typeOf from 'helpers/type-of';
import nullish from 'helpers/nullish';
import { t } from 'i18next';
import $ from 'jquery';
import scrollIntoView from 'helpers/scrollIntoView';
import { toTitleCase } from 'helpers/capitalize';
import { cf, g } from './Stepper.scss';
import SubHeader from '../Typography/SubHeader';
import Caption from '../Typography/Caption';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import StepSummary from './StepSummary';
import StepContent from './StepContent';
import Card from '../Card/Card';
import CardActions from '../Card/CardActions';
import Dialog from '../Dialog/Dialog';
import DialogOverlay from '../Dialog/DialogOverlay';
import DialogActions from '../Dialog/DialogActions';

const stepSummaryType = (<StepSummary />).type;
const stepContentType = (<StepContent />).type;

export default class Stepper extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    const selectedIndex = clsc(props.selectedIndex, -1);
    const visitedSteps = {};

    for (let i = 0; i <= selectedIndex; i++) {
      visitedSteps[i] = true;
    }

    this.state = {
      selectedIndex,
      open: selectedIndex > -1 && selectedIndex < this.props.children.length,
      visitedSteps,
      expanded: props.expanded,
    };
  }

  static propTypes = {
    id: PropTypes.string,
    lblClose: PropTypes.string,
    lblNext: PropTypes.string,
    lblDone: PropTypes.string,
    onComplete: PropTypes.func,
    onStepChange: PropTypes.func,
    onCollapse: PropTypes.func,
    onExpanded: PropTypes.func,
    onExpanding: PropTypes.func,
    expanded: PropTypes.bool,
    className: PropTypes.string,
    cardClassName: PropTypes.string,
    summaryOnly: PropTypes.bool,
    headerToggle: PropTypes.bool,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
  };

  static defaultProps = {
    headerToggle: true,
  };

  get filteredChildren() {
    return Children.toArray(this.props.children).filter(child => !!child);
  }

  getSections(children) {
    if (!Array.isArray(children)) {
      children = [children]; // eslint-disable-line
    }
    return children.reduce((seq, child) => {
      if (child.type === stepSummaryType) {
        seq.stepSummary = child;
      }
      if (child.type === stepContentType) {
        seq.stepContent = child;
      }
      return seq;
    }, {});
  }

  closeStep = () => {
    const { selectedIndex, expanded } = this.state;
    const nextState = {
      selectedIndex,
      open: false,
    };

    const children = this.filteredChildren;

    const theStep = children[selectedIndex] || {};
    const stepProps = theStep.props || {};
    const { onBeforeStepClose, onClose: onStepClose } = stepProps;

    let args = {
      performClose: () => {
        if (expanded) {
          nextState.expanded = false;
        }

        this.setState(nextState, () => {
          if (expanded) {
            this._raiseCollapse();
          }

          this._raiseChange(nextState);
          this._raiseClose(onStepClose);
        });
      },
    };

    if (onBeforeStepClose) {
      args = {
        cancel: false,
        selectedIndex,
        ...args,
      };

      onBeforeStepClose(args);

      if (args.cancel) {
        return;
      }
    }

    args.performClose();
  };

  goNext = beforeGoNext => {
    const args = {
      goNext: this._goNext,
      cancel: false,
    };
    const onBeforeGoNext = beforeGoNext || this.props.onBeforeGoNext;
    onBeforeGoNext && onBeforeGoNext(args);

    if (args.cancel) return;

    this._goNext();
  };

  _goNext = () => {
    const children = this.filteredChildren;
    let nextIndex = this.state.selectedIndex + 1;

    for (let i = nextIndex; i < children.length; i++) {
      const nextStep = children[i] || {};
      const { disabled } = nextStep.props || {};

      if (!disabled) {
        nextIndex = i;
        break;
      }
    }

    this._goToStep(nextIndex, false);
  };

  handleStepperComplete = () => {
    const { onComplete, onBeforeComplete } = this.props;

    let args = {
      performDone: () => {
        const nextState = {
          open: false,
          expanded: false,
        };

        this.setState(nextState, () => {
          this._raiseCollapse();
          this.closeStep();

          onComplete && onComplete();
        });
      },
    };

    if (onBeforeComplete) {
      args = {
        cancel: false,
        ...args,
      };

      onBeforeComplete(args);
      if (args.cancel) return;
    }

    args.performDone();
  };

  _raiseChange(nextState) {
    const { onStepChange } = this.props;
    onStepChange && onStepChange(nextState);
  }

  _raiseOpen(nextState) {
    const { onOpen } = this.props;
    onOpen && onOpen(nextState);
  }

  _raiseClose(onStepClose) {
    onStepClose && onStepClose();
    const { onClose } = this.props;
    onClose && onClose();
  }

  _raiseCollapse() {
    const ele = this.$container.find('[data-step-current="true"]')[0];
    scrollIntoView(ele, true);

    const { onCollapse } = this.props;
    onCollapse && onCollapse();
  }

  get $container() {
    if (!this._container) {
      this._container = $(findDOMNode(this));
    }
    return this._container;
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.selectedIndex !== prevState.selectedIndex) {
      const ele = this.$container.find('[data-step-open="true"]')[0];

      scrollIntoView(ele, true);
    }
  }

  _goToStep(index, isOpen) {
    const { selectedIndex, expanded } = this.state;
    const { nonLinear } = this.props;

    const shouldChange = (selectedIndex !== index || !expanded) && (nonLinear || (!isOpen && (index - selectedIndex <= 1 || index <= selectedIndex)));
    if (!shouldChange) {
      return;
    }

    let args = {
      performChange: () => {
        const nextState = {
          selectedIndex: index,
          open: true,
        };

        if (expanded) {
          nextState.expanded = false;
        }

        if (!this.state.visitedSteps[index]) {
          nextState.visitedSteps = {
            ...this.state.visitedSteps,
            [index]: true,
          };
        }

        if (!this.state.open && nextState.open) {
          this._raiseOpen(nextState);
        }

        this.setState(nextState, () => {
          if (expanded) {
            this._raiseCollapse();
          }

          this._raiseChange(nextState);
        });
      },
    };
    if (index >= 0) {
      const children = this.filteredChildren;

      const theStep = children[selectedIndex] || {};
      const stepProps = theStep.props || {};
      const { onBeforeStepChange } = stepProps;

      const nextStep = children[index] || {};
      const { disabled } = nextStep.props || {};

      if (disabled) {
        // do not go into disabled steps
        return;
      }

      if (onBeforeStepChange) {
        args = {
          cancel: false,
          toIndex: index,
          fromIndex: selectedIndex,
          ...args,
        };
        onBeforeStepChange(args);

        if (args.cancel) {
          return;
        }
      }

      args.performChange();
    }
  }

  expand = () => {
    if (this.state.expanded) return;

    this.setState({ expanded: true });
  };

  collapse = () => {
    if (!this.state.expanded) return;

    this.setState({ expanded: false });
  };

  componentWillReceiveProps(nextProps) {
    if ('expanded' in nextProps) {
      const { expanded } = nextProps;
      if (expanded !== this.props.expanded) {
        if (expanded) {
          this.expand();
        } else {
          this.collapse();
        }
      }
    }

    if (nextProps.selectedIndex !== this.props.selectedIndex) {
      this._goToStep(nextProps.selectedIndex, false);
    }
  }

  handleTouch = e => {
    const $target = $(e.target).closest('[data-step-header]');
    if ($target.length === 0 || $target.is('[data-disabled]')) {
      return;
    }
    const index = parseInt($target.attr('data-idx'), 10);
    const isOpen = $target.attr('data-open') === 'true';

    const { headerToggle } = this.props;
    if (isOpen && headerToggle) {
      this.closeStep();
      return;
    }

    if (!isOpen) {
      const { selectedIndex } = this.state;
      if (index === selectedIndex) {
        this.setState({ open: true }, () => {
          this._raiseOpen({ selectedIndex });
        });

        return;
      }
    }

    this._goToStep(index, isOpen);
  };

  _getHelperText(helperText, disabled) {
    if (typeOf(helperText) === 'string') {
      helperText = (
        <Caption secondary disabled={disabled} className={cf('helper-text')}>
          {helperText}
        </Caption>
      );
    }

    return helperText;
  }

  render() {
    const {
      className,
      cardClassName,
      id,
      lblClose,
      lblNext,
      lblDone,
      onExpanding,
      onExpanded,
      nonLinear,
      extraButtonClass,
      actionsClassName,
      onBeforeComplete, // eslint-disable-line
      onComplete, // eslint-disable-line
      selectedIndex: _selectedIndex, // eslint-disable-line
      expanded: _expanded, // eslint-disable-line
      onCollapse, // eslint-disable-line
      onStepChange, // eslint-disable-line
      summaryOnly,
      headerToggle, // eslint-disable-line
      onOpen, // eslint-disable-line
      onClose, // eslint-disable-line
      warningMessage,
      showWarningMessage,
      ...rest
    } = this.props;
    const children = this.filteredChildren;
    const lastIndex = Array.isArray(children) ? children.length - 1 : 0;

    const { selectedIndex, open, visitedSteps, expanded } = this.state;
    const nextAvailableIndex = selectedIndex + 1;

    const theChildren = Children.map(children, (child, index) => {
      const { disabled: stepperDisabled } = this.props;
      if (!child) return undefined;
      let {
        id: _id,
        lblExtraButton, // eslint-disable-line
        onExtraButtonTouch, // eslint-disable-line
        btnExtraButtonDisabled, // eslint-disable-line
        title,
        // expandedClass name is used to add proper styles to
        // the dialog when the step is expanded
        expandedClassName, // eslint-disable-line
        helperText,
        lblClose: _lblClose,
        lblNext: _lblNext,
        lblDone: _lblDone,
        disabled,
        extraButtonClass: _extraButtonClass,
        actionsClassName: _actionsClassName,
        stepOpenHelperText, // eslint-disable-line
        stepVisitedHelperText, // eslint-disable-line
        btnNextDisabled, // eslint-disable-line
        btnDoneDisabled, // eslint-disable-line
        btnCloseDisabled, // eslint-disable-line
        requiredStepComplete, // eslint-disable-line
        warningMessage: _warningMessage,
        showWarningMessage: _showWarningMessage,
        onBeforeGoNext, // eslint-disable-line
      } = child.props;

      disabled = disabled || stepperDisabled;

      const sections = this.getSections(child.props.children);
      _lblClose = _lblClose || (nullish(lblClose) ? t('CLOSE') : lblClose);
      _lblNext = _lblNext || (nullish(lblNext) ? t('CONTINUE') : lblNext);
      _lblDone = _lblDone || (nullish(lblDone) ? t('DONE') : lblDone);
      _extraButtonClass = _extraButtonClass || extraButtonClass;
      _actionsClassName = _actionsClassName || actionsClassName;
      _warningMessage = _warningMessage || warningMessage;
      _showWarningMessage = (_showWarningMessage || showWarningMessage) && !requiredStepComplete;

      const isLast = lastIndex === index;
      const visited = nonLinear ? visitedSteps[index] : selectedIndex > index || visitedSteps[index];
      const current = selectedIndex === index;
      const isOpen = open && current;

      const dataStepName = title;
      if (typeOf(title) === 'string') {
        const textProps = { className: cf('title'), disabled, bold: isOpen };

        if (!(nonLinear || visited || (nextAvailableIndex === index && !nonLinear))) {
          textProps.secondary = true;
        }
        const capTitle = toTitleCase(title);
        title = <SubHeader {...textProps}>{capTitle}</SubHeader>;
      }

      if (isOpen) {
        helperText = clsc(stepOpenHelperText, helperText);
      } else if (visited) {
        helperText = clsc(stepVisitedHelperText, helperText);
      }

      helperText = this._getHelperText(helperText, disabled);

      let ActionsTag = DialogActions;
      const actionsProps = {
        className: cf('card-actions', g(_actionsClassName)),
      };

      if (!expanded) {
        ActionsTag = CardActions;
        actionsProps.textAlign = 'right';
      }

      const highlightIncompleteRequiredStep = _showWarningMessage;

      const actions = (
        <ActionsTag {...actionsProps}>
          {lblExtraButton && (
            <Button
              className={cf('extra-button', g(_extraButtonClass))}
              disabled={btnExtraButtonDisabled}
              type="flat"
              label={lblExtraButton}
              btnRole="secondary"
              onClick={onExtraButtonTouch}
            />
          )}
          {_lblClose && !isLast && <Button disabled={btnCloseDisabled} type="flat" label={_lblClose} btnRole="secondary" onClick={this.closeStep} />}
          {_lblNext && !isLast && (
            <Button disabled={btnNextDisabled} id="nextStep" type="flat" label={_lblNext} btnRole="primary" onClick={() => this.goNext(onBeforeGoNext)} />
          )}
          {_lblDone && isLast && (
            <Button
              disabled={btnDoneDisabled}
              id="doneStep"
              type={expanded ? 'flat' : 'raised'}
              label={_lblDone}
              btnRole="primary"
              onClick={this.handleStepperComplete}
            />
          )}
        </ActionsTag>
      );

      const idx = `Step_${index}`;

      return (
        <div
          key={idx}
          id={_id}
          data-step-current={current}
          data-step-open={isOpen}
          data-next-available={nextAvailableIndex === index || nonLinear}
          className={cf('step-wrapper')}>
          <div className={cf('line')} />
          <div
            className={cf('step-header')}
            data-visited={visited || summaryOnly}
            data-step-header="true"
            data-disabled={disabled}
            data-summary-only={summaryOnly}
            data-idx={index}
            data-open={isOpen}
            data-step-name={dataStepName}>
            <div className={cf('icon-holder', { missedRequiredStep: highlightIncompleteRequiredStep })}>
              {!highlightIncompleteRequiredStep && <Icon name="pencil" iconStyle="light" />}
            </div>
            {title}
            {helperText}
            {_showWarningMessage && _warningMessage}
          </div>
          {do {
            if (isOpen && !summaryOnly) {
              if (!expanded) {
                <Card container={false} elevation={2} className={cf('card', 'content-wrapper', g(cardClassName))}>
                  {sections.stepContent}
                  {actions}
                </Card>;
              } else {
                <Dialog open={true} onOpening={onExpanding} type="modal" onOpen={onExpanded}>
                  <DialogOverlay container={false} className={cf('dialog-overlay', g(expandedClassName))}>
                    {sections.stepContent}
                    {actions}
                  </DialogOverlay>
                </Dialog>;
              }
            }
          }}
          {((!isOpen && visited) || summaryOnly) && sections.stepSummary}
        </div>
      );
    });
    // use the provided id if provided or the default otherwise
    const theId = clsc(id, this.id);

    const handleTouch = !summaryOnly && this.handleTouch;

    return (
      <div id={theId} className={cf('stepper', { hoverable: !summaryOnly, nonLinear }, g(className))} onClick={handleTouch} {...rest}>
        {theChildren}
      </div>
    );
  }
}
