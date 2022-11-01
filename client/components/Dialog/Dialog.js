/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component, Children, cloneElement } from 'react';
import generateId from 'helpers/generateId';
import $ from 'jquery';
import 'helpers/window-resize';
import typeOf from 'helpers/type-of';

import {
  unstable_renderSubtreeIntoContainer, // eslint-disable-line
  unmountComponentAtNode,
  findDOMNode,
} from 'react-dom';
import DialogOverlay from './DialogOverlay';
import { cf, g } from './Dialog.scss';
import contains from '../../helpers/contains';
import { document, window } from '../../../common/helpers/globals';

const dialogOverlayType = (<DialogOverlay />).type;

const $win = $(window);

let stackingCount = 0;
const defaultBaseZIndex = 100;

const dlgContainerClass = cf('dialog-container');
const dlgWrapperClass = cf('dialog-wrapper');

export default class Dialog extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.$doc = $(document);
    this._wasOpenAtConstructor = !!props.open;
    this.state = {
      open: props.open,
    };
  }

  static propTypes = {
    id: PropTypes.string,
    onOpening: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onClosing: PropTypes.func,
    positionArgs: PropTypes.object,
    closeOnTapAway: PropTypes.bool,
    closeOnEscape: PropTypes.bool,
    baseZIndex: PropTypes.number,
    onOpened: PropTypes.func,
    absoluteZIndex: PropTypes.number,
    // there are sometimes where dealing with zIndexes might be
    // too complicated. It is always better to rely on the
    // elements to auto stack, by default elements at the bottom
    // of the DOM tree will be shown above elements before.
    // This is usually considered better than specifying z-indexes by hand
    appendToBody: PropTypes.bool,
    // the class to the outerMost dialog element
    // useful to control the z-index of the dialog
    // on cases where the element is not the top most element
    // Usually this should not be needed
    // but there might be a couple of instances where this is required
    dialogWrapperClass: PropTypes.bool,

    // a dialog inside a flyOut or inside another Dialog
    // could have the coordinate system broken due to this
    // issue: http://stackoverflow.com/a/15256339/538752
    // Setting this to true will fix the issue but it will be
    // more expensive than not using it so it won't be set
    // true by default, will have to be used on demand
    relativeToWindow: PropTypes.bool,
    type: PropTypes.oneOf(['modal', 'overlay', 'fullscreen']),
    open: PropTypes.bool,
    onCloseRequest: PropTypes.func,
  };

  static defaultProps = {
    appendToBody: false,
    closeOnTapAway: false,
    relativeToWindow: false,
    closeOnEscape: true,
    type: 'modal',
  };

  state = {
    open: false,
  };

  safeSetState(...args) {
    if (!this._mounted) {
      return;
    }
    this.setState(...args);
  }

  open() {
    if (this.state.open) {
      return;
    }

    // needed to determine if we need to fire onClose event
    // we assume that the first time we don't need so we
    // make sure we have displayed the dialog at least once
    if (!this._openedAtLeastOnce) {
      this._openedAtLeastOnce = true;
    }

    this.safeSetState({
      open: true,
    });

    this._raiseOpening();
  }

  close() {
    if (!this.state.open) {
      return;
    }

    this.safeSetState({
      open: false,
    });

    this._raiseClosing();
  }

  toggle() {
    if (this.state.open) {
      this.close();
    } else {
      this.open();
    }
  }

  _onComplete = () => {
    if (!this._mounted) {
      return;
    }

    const { open } = this.state;
    const { closeOnTapAway, onClose, closeOnEscape, onOpen, onCloseRequest } = this.props;

    if (!open) {
      this.mountPoint && this.mountPoint.removeClass(cf('open'));
      if (this._openedAtLeastOnce || this._wasOpenAtConstructor) {
        closeOnTapAway && this.$doc.off(`mouseup.ns_${this.id}`);
        closeOnEscape && this.$doc.off(`keyup.ns_${this.id}`);
        setTimeout(() => onClose && onClose(), 0);
      }
    } else {
      $win.trigger('overlay:open');
      setTimeout(() => onOpen && onOpen(), 0);

      const ref = this._trigger ? $(findDOMNode(this._trigger)) : null;

      closeOnTapAway &&
        this.$doc.on(`mouseup.ns_${this.id}`, e => {
          const $target = $(e.target);

          if ($target.closest(this.mountPoint.find('[data-part="dlg-container"]')).length > 0 || (ref && $target.closest(ref).length > 0)) {
            return;
          }

          if (this.state.open && onCloseRequest) {
            onCloseRequest({ source: 'tapAway', target: e.target });
            return;
          }

          this.close();
        });

      closeOnEscape &&
        this.$doc.on(`keyup.ns_${this.id}`, e => {
          const ESC_KEY = 27;
          if (e.keyCode === ESC_KEY) {
            if (this.state.open && onCloseRequest) {
              onCloseRequest({ source: 'escKeyPress', target: e.target });
              return;
            }
            this.close();
          }
        });
    }
  };

  get theOverlay() {
    const arr = Children.toArray(this.props.children);
    const [overlay] = arr.filter(child => child.type === dialogOverlayType);
    return overlay;
  }

  forceCleanUpIfNeeded() {
    if (!this.state.open) return;
    const overlay = this.theOverlay;
    if (!overlay) return;
    const { type } = this.props;

    unstable_renderSubtreeIntoContainer(
      this,
      cloneElement(overlay, {
        ...overlay.props,
        onComplete: null,
        open: false,
        type,
      }),
      this.mountPoint.find(`.${dlgWrapperClass}`)[0],
    );
  }

  _preventTab = e => {
    const { forceFocusOnDialog } = this.props;
    if (!forceFocusOnDialog) return;

    const prevActive = document.activeElement;
    const THRESHOLD_TO_CHECK_FOR_TAB_SIDE_EFFECTS = 16;

    if (e.keyCode === 9) {
      setTimeout(() => {
        this._checkForActiveElement(prevActive);
      }, THRESHOLD_TO_CHECK_FOR_TAB_SIDE_EFFECTS);
    }
  };

  _checkForActiveElement = prevActive => {
    if (!this.mountPoint) return; // dialog might be unmounted by this point

    if (contains(this.mountPoint[0], document.activeElement)) {
      return;
    }
    if (prevActive && contains(this.mountPoint[0], prevActive)) {
      prevActive.focus && prevActive.focus();
      return;
    }

    const { onFocusRequest } = this.props;

    if (onFocusRequest) {
      onFocusRequest(this.mountPoint.find('[data-component="dialog-overlay"]'));
    }
  };

  _handleWindowFocus = () => {
    this._checkForActiveElement();
  };

  _raiseOpening = () => {
    const { onOpening } = this.props;
    onOpening && onOpening();

    window.addEventListener('keydown', this._preventTab, true);
    window.addEventListener('focus', this._handleWindowFocus, true);
  };

  _raiseClosing = () => {
    const { onClosing } = this.props;
    onClosing && onClosing();
    window.removeEventListener('keydown', this._preventTab, true);
    window.removeEventListener('focus', this._handleWindowFocus, true);
  };

  _renderOverlay() {
    if (!this.mountPoint) {
      console.warn('Attempt to render a dialog without a mount point');
      return;
    }

    const overlay = this.theOverlay;

    let { open } = this.state;
    const { type, relativeToWindow } = this.props;

    if (this._wasOpenAtConstructor && !this._firedOpeningDuringRender) {
      if (open) {
        setTimeout(() => this._raiseOpening(), 0);
      }
      this._firedOpeningDuringRender = true;
    }

    open = !!open;

    unstable_renderSubtreeIntoContainer(
      this,
      cloneElement(overlay, {
        ...overlay.props,
        onComplete: this._onComplete,
        open,
        type,
      }),
      this.mountPoint.find(`.${dlgWrapperClass}`)[0],
    );

    this.mountPoint.toggleClass(cf('modal'), type === 'modal' && open);

    if (open) {
      if (!this._mounted) return;

      this.mountPoint.addClass(cf('open'));

      if (relativeToWindow) {
        this.mountPoint.position({
          my: 'left top',
          at: 'left top',
          of: window,
        });
        this.mountPoint.width($win.width());
        this.mountPoint.height($win.height());
      }
    } else {
      this.$doc.off(`.ns_${this.id}`);
    }
  }

  componentDidUpdate() {
    this._renderOverlay();
  }

  componentDidMount() {
    this._mounted = true;
    stackingCount++;

    const { dialogWrapperClass, appendToBody, baseZIndex, absoluteZIndex, id, onCloseRequest, noAutoBind } = this.props;

    this._trigger = findDOMNode(this);

    const wrapperId = id || this.id;

    const [theTrigger] = Children.toArray(this.props.children).filter(child => child.type !== DialogOverlay);

    if (theTrigger && !noAutoBind) {
      this._bindTriggers(this._trigger);
    }

    const parentNode = appendToBody ? 'body' : this._trigger.parentNode;

    let calculatedZIndex;

    if (typeOf(absoluteZIndex) === 'number') {
      calculatedZIndex = absoluteZIndex;
    } else if (typeOf(baseZIndex) === 'number') {
      calculatedZIndex = baseZIndex + stackingCount;
    } else {
      calculatedZIndex = defaultBaseZIndex + stackingCount;
    }

    this.mountPoint = $(`
      <div data-component="dialog-wrapper" id="${wrapperId}" class="${cf('dialog-outer', g(dialogWrapperClass))}" style="z-index:${calculatedZIndex}">
        <div class="${dlgContainerClass}">
          <div data-part="dlg-container" class="${dlgWrapperClass}" />
        </div>
      </div>`).appendTo(parentNode);

    this.mountPoint.on(`window:resize.ns_${this.id}`, () => {
      this._renderOverlay();
    });

    this.mountPoint.on(`mouseup.ns_${this.id} keyup.ns_${this.id}`, '[data-action="close"]', e => {
      const ENTER = 13;

      e.stopPropagation && e.stopPropagation();

      if (e.type === 'keyup' && e.keyCode !== ENTER) {
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

    this._renderOverlay();
  }

  componentWillReceiveProps(nextProps) {
    if ('open' in nextProps && nextProps.open !== this.props.open) {
      if (nextProps.open) {
        this.open();
      } else {
        this.close();
      }
    }
    if ('absoluteZIndex' in nextProps && nextProps.absoluteZIndex !== this.props.absoluteZIndex) {
      this.mountPoint?.css('zIndex', nextProps.absoluteZIndex);
    }
  }

  _bindTriggers(trigger) {
    const $trigger = (this.$trigger = $(trigger));
    $trigger.on(`click.ns_${this.id}`, () => this.toggle());
  }

  _unbindTriggers() {
    if (this.$trigger) {
      this.$trigger.off(`.ns_${this.id}`);
      this.$trigger = null;
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    stackingCount--;

    this.forceCleanUpIfNeeded();
    unmountComponentAtNode(this.mountPoint[0]);
    this.mountPoint.off(`.ns_${this.id}`);
    this.mountPoint.remove();
    this.mountPoint = null;
    this.$doc.off(`.ns_${this.id}`);
    this.$doc = null;

    this._unbindTriggers();
    this._trigger = null;
  }

  render() {
    // get the wrapped trigger
    const [theTrigger] = Children.toArray(this.props.children).filter(child => child.type !== dialogOverlayType);

    if (!theTrigger) {
      return <noscript />; // just render something that doesn't have a visual rep.
    }

    return theTrigger;
  }
}
