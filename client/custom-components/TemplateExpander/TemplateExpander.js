/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observable, computed, action } from 'mobx';
import { observer, inject, Observer } from 'mobx-react';
import { t } from 'i18next';

import Status from '../../components/Status/Status';
import { cf, g } from './TemplateExpander.scss';
import nullish from '../../../common/helpers/nullish';
import NotificationBanner from '../../components/NotificationBanner/NotificationBanner';
import trim from '../../../common/helpers/trim';
import { STRING_BREAK_LINES } from '../../../common/regex';
import { getClosestWordByPosition } from '../../helpers/strings';

@inject('templateManagerFactory')
@observer
export default class TemplateExpander extends Component {
  @observable.shallow
  undoStack = [];

  constructor(props) {
    super(props);
    // use the injected factory to create the manager
    this.templateManager = props.templateManagerFactory.create();
  }

  /**
   * Extracts the word under the current selectionEnd position (the caret position)
   */
  getWordFromTextInput = target => {
    const { value, selectionEnd } = target;

    return getClosestWordByPosition(value, selectionEnd);
  };

  getWordFromContentEditable = target => {
    const selection = target.ownerDocument.getSelection();

    const {
      focusNode: { textContent },
      focusOffset: position,
    } = selection;

    return getClosestWordByPosition(textContent, position);
  };

  targetIsTextField = target => {
    const { tagName } = target;
    const tag = tagName.toLowerCase();

    return tag === 'textarea' || tag === 'input';
  };

  getWordFromTarget = target => {
    if (this.targetIsTextField(target)) {
      return this.getWordFromTextInput(target);
    }

    // TODO: add here the code get the word if the wrapped element is a content editable area

    return '';
  };

  /**
   * return a processor instance that abstract the manipulation of a target element and returns
   * a known interface with the following methods
   *
   * - getWord, used to return the word under the current caret position in the target
   * - setResult, used to set the result of processing the template to the target
   * - getValue, return the value of the target element
   * - restoreState, restore the state of the target, if any previous state was saved
   */
  getProcessorBasedOnTarget = target => {
    if (this.targetIsTextField(target)) {
      return {
        getWord: this.getWordFromTextInput,
        setResult: (templateResult, signature = '') => {
          target.value = `${templateResult.body}\n\n${trim(signature)}`;
          const len = templateResult.body.length;
          target.setSelectionRange(len, len);
        },
        getValue: () => target.value,
        restoreState: valDescriptor => {
          const { value, caretPosition } = valDescriptor || {};
          target.value = value;
          target.setSelectionRange(caretPosition, caretPosition);
          return;
        },
      };
    }

    const { getEditorInstance } = this.props;
    const editorInstance = getEditorInstance && getEditorInstance();
    if (editorInstance) {
      return {
        getWord: this.getWordFromContentEditable,
        setResult: (templateResult, signature = '') => {
          editorInstance.html.set(`${templateResult.body}\n\n${trim(signature)}`.replace(STRING_BREAK_LINES, '<br />'));
          editorInstance.selection.setAtEnd(editorInstance.$el.get(0));
          editorInstance.selection.restore();
        },
        getValue: () => editorInstance.html.get(),
        restoreState: valDescriptor => {
          const { value } = valDescriptor || {};
          editorInstance.html.set(value);
        },
      };
    }

    return {
      getWord: () => '',
      setResult: () => {},
      getValue: () => '',
      restoreState: () => {},
    };
  };

  /**
   * this method will check if the shortCode found under the cursor is one of the knonw
   * shortcodes that matches a given template and proceed to expand it if it is the case
   */
  processPossibleShortCode = async e => {
    const { target } = e;
    const { dataset = {}, contentEditable } = target;
    const isContentEditable = contentEditable.toLowerCase() === 'true';

    if (!dataset.expansionTrigger && !isContentEditable) return; // ignore TextEntries that are not expansion triggers or not contentEditable

    const { getWord, setResult, getValue, restoreState } = this.getProcessorBasedOnTarget(target);

    // get the word under the cursor
    const word = getWord(target);

    if (!word) return;

    const { templateManager, props } = this;

    const { partyId, data, context, getSubject, setSubject, onExpand, signature } = props;

    // call the service endpoint with the word to check if it matches any known shortCode
    const templateResult = await templateManager.renderTemplate({ word, partyId, ...data, context });

    if (!templateResult || !templateResult.body) return;

    // the original value in the target
    const value = getValue();

    // the original subject if a function to get the subject was provided
    const subject = getSubject ? getSubject() : undefined;

    // push the current state to the undoStack with all the info needed to revert the
    // template expansion if needed.
    this.pushUndo({ value, subject, caretPosition: target.selectionStart, restoreState });

    // set the result of the template expansion
    setResult(templateResult, signature);

    onExpand && onExpand(templateResult);

    // if we did had a subject received as part of the template
    // expansion replace the existing one only if no subject is present
    if (setSubject && !subject && templateResult.subject) {
      setSubject(templateResult.subject);
    }
  };

  @action
  pushUndo = undoDescriptor => {
    this.undoStack.push(undoDescriptor);
  };

  @action
  restorePrevValue = () => {
    const { undoStack, props } = this;
    const descriptor = undoStack.pop();

    if (!descriptor) return;

    const { setSubject } = props;

    const { restoreState, subject, ...desc } = descriptor;

    restoreState(desc);

    if (setSubject && !nullish(subject)) setSubject(subject);
  };

  @computed
  get hasPrevValue() {
    return this.undoStack.length > 0;
  }

  clearStack = () => {
    this.undoStack = [];
  };

  handleKeyUp = e => {
    const SPACE = 32;

    if (e.keyCode === SPACE && e.shiftKey) {
      e.preventDefault();
      this.processPossibleShortCode(e);
      return;
    }
  };

  componentDidMount() {
    const { templateManager } = this;
    const { propertyId } = this.props;
    propertyId && templateManager.loadTemplatesForProperty(propertyId);

    const { node } = this;
    if (!node) return;
    node.addEventListener('keydown', this.handleKeyUp);
    this.addEditorIframeEventListener();
  }

  addEditorIframeEventListener() {
    const { node } = this;
    const [iframe] = node.getElementsByTagName('iframe');
    if (iframe) {
      iframe.contentWindow.document.addEventListener('keydown', this.handleKeyUp);
      this.isEventListenerAttachedToEditor = true;
    }
  }

  destroyUndoStack() {
    this.undoStack = null;
  }

  componentWillReceiveProps(nextProps) {
    const { props } = this;
    if (props.propertyId !== nextProps.propertyId) {
      props.templateManager.loadTemplatesForProperty(nextProps.propertyId);
    }
    const { getEditorInstance } = nextProps;
    // waits for component mount before add the event listener
    if (!this.isEventListenerAttachedToEditor && getEditorInstance) {
      setTimeout(() => {
        this.addEditorIframeEventListener();
      }, 0);
    }
  }

  componentWillUnmount() {
    const { node, props } = this;
    if (!node) return;

    node.removeEventListener('keydown', this.handleKeyUp);
    const [iframe] = node.getElementsByTagName('iframe');
    if (iframe) {
      iframe.contentWindow.document.removeEventListener('keydown', this.handleKeyUp);
    }

    const { templateManagerFactory } = props;
    templateManagerFactory.removeInstance(this.templateManager);
    this.templateManager = null;
    this.destroyUndoStack();
  }

  renderProcessingStatus = () => {
    const { templateManager: tm } = this;
    return <Observer>{() => <Status height={1} processing={tm.busy} />}</Observer>;
  };

  renderErrorSection = ({ style } = {}) => {
    const { templateManager: tm } = this;
    return (
      <Observer>
        {() => (
          <NotificationBanner
            style={style}
            type="warning"
            visible={!!tm.templateRenderError}
            closeable
            content={t('TEMPLATE_LOADING_FAILURE')}
            onCloseRequest={tm.clearError}
          />
        )}
      </Observer>
    );
  };

  renderChildren = () => {
    const { props, renderErrorSection, renderProcessingStatus } = this;
    const { children } = props;
    if (typeof children === 'function') {
      return children({ renderErrorSection, renderProcessingStatus });
    }
    return children;
  };

  render() {
    const { className, style } = this.props;

    return (
      <div ref={node => (this.node = node)} className={cf('expander', g(className))} style={style}>
        {this.renderChildren()}
      </div>
    );
  }
}
