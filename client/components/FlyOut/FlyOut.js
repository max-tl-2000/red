/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable react/no-find-dom-node */
import PropTypes from 'prop-types';
import React, { Component, Children, cloneElement } from 'react';
import { observer } from 'mobx-react';
import { observable, computed, action, reaction } from 'mobx';

import {
  unstable_renderSubtreeIntoContainer, // eslint-disable-line
  unmountComponentAtNode,
  findDOMNode,
} from 'react-dom';

import $ from 'jquery';
import 'helpers/window-resize';

import generateId from 'helpers/generateId';

import clsc from 'helpers/coalescy';
import { cf } from './FlyOut.scss';

import FlyOutOverlay from './FlyOutOverlay';
import { document, setTimeout } from '../../../common/helpers/globals';
import sleep from '../../../common/helpers/sleep';

const flyOutOverlayType = (<FlyOutOverlay />).type;

const positionByExpandLocation = {
  bottom: {
    pos: {
      my: 'center top',
      at: 'center bottom',
    },
  },
  'bottom-right': {
    pos: {
      my: 'left top',
      at: 'left bottom',
    },
  },
  'bottom-left': {
    pos: {
      my: 'right top',
      at: 'right bottom',
    },
  },
  top: {
    pos: {
      my: 'center bottom',
      at: 'center top',
    },
  },
  'on-top': {
    pos: {
      my: 'center center',
      at: 'center center',
    },
  },
  'top-right': {
    pos: {
      my: 'left bottom',
      at: 'left top',
    },
  },
  'top-left': {
    pos: {
      my: 'right bottom',
      at: 'right top',
    },
  },
  right: {
    pos: {
      my: 'left center',
      at: 'right center',
    },
  },
  'right-bottom': {
    pos: {
      my: 'left top',
      at: 'right top',
    },
  },
  'right-top': {
    pos: {
      my: 'left bottom',
      at: 'right bottom',
    },
  },
  left: {
    pos: {
      my: 'right center',
      at: 'left center',
    },
  },
  'left-bottom': {
    pos: {
      my: 'right top',
      at: 'left top',
    },
  },
  'left-top': {
    pos: {
      my: 'right bottom',
      at: 'left bottom',
    },
  },
  'over-bottom': {
    pos: {
      my: 'center top',
      at: 'center top',
    },
  },
  'over-bottom-right': {
    pos: {
      my: 'left top',
      at: 'left top',
    },
  },
  'over-bottom-left': {
    pos: {
      my: 'right top',
      at: 'right top',
    },
  },
  'over-top': {
    pos: {
      my: 'center bottom',
      at: 'center bottom',
    },
  },
  'over-top-right': {
    pos: {
      my: 'left bottom',
      at: 'left bottom',
    },
  },
  'over-top-left': {
    pos: {
      my: 'right bottom',
      at: 'right bottom',
    },
  },
  'over-right': {
    pos: {
      my: 'left center',
      at: 'left center',
    },
  },
  'over-right-bottom': {
    pos: {
      my: 'left top',
      at: 'left top',
    },
  },
  'over-right-top': {
    pos: {
      my: 'left bottom',
      at: 'left bottom',
    },
  },
  'over-left': {
    pos: {
      my: 'right center',
      at: 'right center',
    },
  },
  'over-left-bottom': {
    pos: {
      my: 'right top',
      at: 'right top',
    },
  },
  'over-left-top': {
    pos: {
      my: 'right bottom',
      at: 'right bottom',
    },
  },
};

@observer
export default class FlyOut extends Component { // eslint-disable-line
  static propTypes = {
    id: PropTypes.string,
    expandTo: PropTypes.string,
    onPosition: PropTypes.func,
    onOpening: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onClosing: PropTypes.func,
    positionArgs: PropTypes.object,
    closeOnTapAway: PropTypes.bool,
    useHover: PropTypes.bool,
    hoverDelay: PropTypes.number,
    appendToBody: PropTypes.bool,
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
    zIndex: PropTypes.number,
    overlayContainer: PropTypes.string,
  };

  static defaultProps = {
    hoverDelay: 800,
    useHover: false,
    expandTo: 'bottom',
    closeOnTapAway: true,
  };

  @observable
  _open;

  constructor(props) {
    super(props);
    this.id = generateId(this);
    this.$doc = $(document);

    this._open = !!props.open;
  }

  @action
  open = () => {
    if (this._open) {
      return;
    }

    this._open = true;
  };

  @computed
  get isOpen() {
    return !!this._open;
  }

  @action
  close = () => {
    if (!this._open) {
      return;
    }

    this._open = false;
  };

  @action
  toggle = () => {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  @action
  setOpen = open => {
    this._open = open;
  };

  _onComplete() {
    const { _open: open, _trigger, mountPoint, id, $doc } = this;
    const { closeOnTapAway, onClose, onOpen, onCloseRequest } = this.props;

    if (!open) {
      mountPoint.removeClass(cf('open'));
      mountPoint.css('width', '');
      this.allowedToFireClose && setTimeout(() => onClose && onClose(), 0);
      $doc.off(`.ns_${id}`);
    } else {
      setTimeout(() => onOpen && onOpen(), 0);

      if (!closeOnTapAway) {
        return;
      }

      const ref = _trigger ? $(_trigger) : null;
      // the following listener is added to capture the mouseup event in the
      // entire page. We use the target to discern whether the events happened
      // inside the overlay or inside the element used as the trigger. If that's the
      // case we ignore the event. But if the event happened outside then
      // we close the overlay
      $doc.on(`mouseup.ns_${id}`, e => {
        const $target = $(e.target);
        const eventHappenedInsideOverlay = $target.closest(mountPoint).length > 0;
        const eventHappenedInsideTrigger = ref && $target.closest(ref).length > 0;

        if (eventHappenedInsideOverlay || eventHappenedInsideTrigger) {
          return;
        }

        if (this.isOpen && onCloseRequest) {
          onCloseRequest({
            source: 'tapAway',
            target: e.target,
            button: e.button,
          });
          return;
        }

        this.close();
      });

      $doc.on(`keyup.ns_${id}`, e => {
        if (e.keyCode === 27) {
          if (this.isOpen && onCloseRequest) {
            onCloseRequest({
              source: 'escKey',
              target: e.target,
            });
            return;
          }

          this.close();
        }
      });
    }
  }

  doOnComplete = () => {
    if (!this._mounted) {
      return;
    }
    this._onComplete();
  };

  _renderElement = () => {
    const { props, doOnComplete, mountPoint, _open: open } = this;

    if (!mountPoint) return;

    const [overlay] = Children.toArray(props.children).filter(child => child.type === flyOutOverlayType);

    if (!overlay) return;

    const { expandTo } = props;
    unstable_renderSubtreeIntoContainer(this, cloneElement(overlay, { ...overlay.props, onComplete: doOnComplete, open, expandTo }), mountPoint[0]);
  };

  _renderOverlay = ({ skipRenderOverlay } = {}) => {
    const { _open: open, mountPoint, props, _trigger } = this;

    if (!mountPoint) return;

    const [overlay] = Children.toArray(props.children).filter(child => child.type === flyOutOverlayType);

    if (!overlay) {
      return;
    }

    const { onOpening, onClosing } = props;

    setTimeout(() => {
      if (open) {
        onOpening && onOpening();
        this.allowedToFireClose = true;
      } else {
        const { allowedToFireClose } = this;
        if (allowedToFireClose) {
          onClosing && onClosing();
        }
      }
    }, 0);

    if (!skipRenderOverlay) {
      this._renderElement();
      this.locateFlyOutOverlay();
    }
  };

  removeOverlayWidth = () => {
    this.mountPoint?.css('width', 'auto');
  };

  locateFlyOutOverlay = async () => {
    const { props, _trigger, modalOverlay, mountPoint, isOpen } = this;
    const {
      expandTo,
      delayToApplyPosition = 16,
      delayToCalculateOverlayWidth = 0,
      onPosition,
      positionArgs,
      zIndex,
      overTrigger,
      modal,
      matchTriggerSize = true,
    } = props;

    if (!isOpen) {
      modal && modalOverlay.removeClass(cf('open'));
      return;
    }

    const ref = _trigger ? $(findDOMNode(_trigger)) : null;
    const { pos } = positionByExpandLocation[`${overTrigger ? 'over-' : ''}${expandTo}`];

    modal && modalOverlay.addClass(cf('open'));
    mountPoint.addClass(cf('open'));

    if (typeof zIndex === 'number') {
      if (modal) {
        modalOverlay.css({ zIndex });
      }
      mountPoint.css({ zIndex });
    }

    if (ref) {
      mountPoint.css('width', 'auto');
      await sleep(delayToCalculateOverlayWidth);
      const btnWidth = ref.outerWidth();
      const overlayWidth = mountPoint.outerWidth();

      if (matchTriggerSize && overlayWidth !== 0) {
        const oWidth = overlayWidth < btnWidth ? btnWidth : overlayWidth;
        mountPoint.css('width', oWidth);
      }
    }

    const pArgs = positionArgs || {};
    const args = {
      position: {
        my: clsc(pArgs.my, pos.my),
        at: clsc(pArgs.at, pos.at),
        of: clsc(pArgs.of, ref),
        collision: clsc(pArgs.collision, 'flipfit'),
        within: clsc(pArgs.within, props.overlayContainer),
      },
      $trigger: ref,
      autoPosition: true,
      $overlay: mountPoint,
    };

    await sleep(delayToApplyPosition);

    const { _mounted, isOpen: open } = this;
    if (!_mounted && !open) return;

    onPosition && onPosition(args);

    if (args.autoPosition) {
      mountPoint.position(args.position);
    }
  };

  _bindTriggers() {
    const { $trigger, props, id } = this;
    const { useHover, hoverDelay } = props;

    if (!useHover) {
      $trigger.on(`click.ns_${id}`, this.toggle);
    } else {
      $trigger.on(`mouseover.ns_${id}`, () => {
        clearTimeout(this._lastOpenTimerId);
        this._lastOpenTimerId = setTimeout(this.open, hoverDelay);
      });
      $trigger.on(`mouseout.ns_${id} click.ns_${id}`, () => {
        clearTimeout(this._lastOpenTimerId);
        this.close();
      });
    }
  }

  _unbindTriggers() {
    const { $trigger, id } = this;
    if (!$trigger) return;

    $trigger.off(`.ns_${id}`);
    this.$trigger = null;
  }

  _delayedMount = () => {
    const { id, props } = this;
    const { appendToBody, onCloseRequest, usePrevSiblingAsTrigger, children, noAutoBind, modal, skipInitialRenderingIfClosed } = props;

    const element = findDOMNode(this);
    const $element = $(element);

    this.$trigger = usePrevSiblingAsTrigger ? $element.prev() : $element;

    const _trigger = (this._trigger = this.$trigger[0]);

    const [theChild] = Children.toArray(children).filter(child => child.type !== flyOutOverlayType);

    if (theChild && !noAutoBind) {
      this._bindTriggers();
    }

    const parentNode = appendToBody ? 'body' : _trigger.parentNode;

    if (modal) {
      this.modalOverlay = $(`<div class=${cf('modal-overlay')} />`).appendTo(parentNode);
    }

    const mountPoint = (this.mountPoint = $(`<div class="${cf('flyout-container')}" />`).appendTo(parentNode));

    mountPoint.on(`window:resize.ns_${id}`, this.locateFlyOutOverlay);

    mountPoint.on(`mouseup.ns_${id} keyup._ns${id}`, '[data-action="close"]', e => {
      // this is required to prevent a FlyOut inside a FlyOut to close all the flyouts
      // instead of just closing itself
      e.stopPropagation && e.stopPropagation();

      if (e.type === 'keyup' && e.keyCode !== 13) {
        return;
      }

      const $target = $(e.target);
      if ($target.is(':disabled')) {
        return; // do nothing
      }

      if (onCloseRequest) {
        onCloseRequest({ source: 'dataAction', target: e.target });
        return;
      }

      this.close();
    });

    this.dispose = reaction(() => {
      const { isOpen } = this;
      return {
        isOpen,
      };
    }, this._renderOverlay);

    this._renderOverlay({ skipRenderOverlay: skipInitialRenderingIfClosed && !this.isOpen });
  };

  componentDidMount() {
    this._mounted = true;

    this._mountTimeout = setTimeout(this._delayedMount, 16);
  }

  componentDidUpdate() {
    const { props } = this;
    if ('open' in props && !!props.open !== this.isOpen) {
      this.setOpen(props.open);
    }

    this._renderElement();
  }

  componentWillUnmount() {
    this._mounted = false;
    clearTimeout(this._mountTimeout);

    const { $doc, mountPoint, id, modalOverlay, dispose } = this;

    dispose && dispose();

    if (mountPoint) {
      unmountComponentAtNode(mountPoint[0]);
      mountPoint.off(`.ns_${id}`);
      mountPoint.remove();
      this.mountPoint = null;
    }

    modalOverlay && modalOverlay.remove();
    this.modalOverlay = null;

    $doc.off(`.ns_${id}`);
    this.$doc = null;

    this._unbindTriggers();
    this._trigger = null;
  }

  render() {
    const [theChild] = Children.toArray(this.props.children).filter(child => child.type !== flyOutOverlayType);

    if (!theChild) {
      return <noscript />; // just render something that doesn't have a visual rep.
    }

    return theChild;
  }
}
