/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import 'froala-editor/css/froala_style.min.css';
import 'froala-editor/css/froala_editor.pkgd.min.css';

import 'froala-editor/js/froala_editor.pkgd.min.js';
import 'froala-editor/js/plugins.pkgd.min.js';

import FroalaEditorComponent from 'react-froala-wysiwyg';
import FE from 'froala-editor';
import generateId from 'helpers/generateId';

import { enableCustomCommands } from './customCommands';
import { getConfig } from './config';

import { cf } from './FroalaEditor.scss';
import { CONTENT_EDITABLE, STRING_BREAK_LINES, SCRIPT_TAG } from '../../../common/regex';
import { MARGIN_ZERO_REPLACE_TAG, BODY_MARGIN_ZERO_MATCHER } from '../../helpers/froala';

export default class FroalaEditor extends Component {
  constructor({ content }) {
    super();

    // convert text newlines to breakLine tag
    content = content.replace(STRING_BREAK_LINES, '<br />');

    this.state = {
      content: `${content}`,
    };
    this.editorRef = null;
    enableCustomCommands({ froalaEditor: FE });
    this.id = generateId(this);
  }

  componentDidMount = () => {
    const { handleAttachmentClick, sendMessage } = this.props;
    const { editor } = this.editorRef;

    editor.handleAttachmentClick = handleAttachmentClick;
    editor.sendMessage = sendMessage;
  };

  onContentChange = content => {
    this?.props?.onContentChange ? this.props.onContentChange(content) : this.setState({ content });
  };

  getContent = () => this.state.content;

  getEditor = () => this?.editorRef?.editor;

  getInnerValues() {
    const { innerHTML = '', innerText = '' } = this?.editorRef?.editor?.doc?.documentElement;
    this.html = `<!DOCTYPE html>
    <html>
      ${innerHTML}
    </html>`.replace(CONTENT_EDITABLE, ' ');

    // fix osx mail client left padding issue by removing margin: 0px from body
    this.html = this.html.replace(STRING_BREAK_LINES, '').replace(SCRIPT_TAG, '').replace(BODY_MARGIN_ZERO_MATCHER, `$1${MARGIN_ZERO_REPLACE_TAG}$3`);
    this.text = innerText;
    return { html: this.html, text: this.text };
  }

  onModelChange = model => {
    this.setState({ content: model });
    this.props.scrollToBottom && this.props.scrollToBottom();
  };

  render() {
    const { content } = this.state;
    const { config: propsConfig } = this.props;
    const toolbarId = `froalaToolbarContainerId${this.id}`;
    const config = getConfig({
      froalaEditor: FE,
      toolbarId: `${toolbarId}`,
      ...propsConfig,
    });

    return (
      <div className={cf('froalaEditor')}>
        <FroalaEditorComponent
          tag="textarea"
          model={content}
          config={config}
          ref={editor => (this.editorRef = editor)}
          onModelChange={model => this.onModelChange(model)}
        />
        {this.props.footer && this.props.footer()}
        <div id={toolbarId} className={cf('froalaToolbar')}>
          <div className={cf('sendButtonWrapper')}>{this.props.sendMessageButton()}</div>
        </div>
      </div>
    );
  }
}
