/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { setQueryParams, getOrigin } from 'helpers/url';
import tryParse from 'helpers/try-parse';
import { cf, g } from './Iframe.scss';
import { location } from '../../helpers/navigator';

/**
 * This component is an abstraction over the iframe and the
 * postMessage function. This hides the complexity of dealing
 * with messages coming from within the Iframe providing an event
 * that is fired from the Iframe instance making it easier to
 * handle the messages coming from within the iframes
 *
 * It also expects a serialized message, content inside the iframe
 * should use the `sendToParent` helper inside the `helpers/postMessage` module
 * */
export default class Iframe extends Component {
  constructor(props, context) {
    super(props, context);
    this.generatedId = generateId(this);
    this.origin = location.origin;
  }

  // handles the messages coming from within the iframe
  // messages that are not originated from within this iframe instance
  // will be filtered out. We use the id of the Iframe as a way to identify
  // the messages that are sent to this particular instance we also provide
  // the origin of the parent so the iframe can call us back...
  handleMessage = e => {
    const { onMessage, src } = this.props;

    const targetOrigin = getOrigin(src);

    // this is important for security
    // we only handle the message if it comes from the origin of the url we have loaded
    // since the iframe might have navigated. Messages coming from other origins should
    // be discarded
    if (e.origin !== targetOrigin) {
      // TODO: should we warn?
      return;
    }

    const args = tryParse(e.data);

    if (!args || args.senderId !== `${this.id}` || !args.content) {
      // TODO: should we warn??
      return;
    }

    onMessage && onMessage(args.content);
  };

  postMessage = message => {
    const { src } = this.props;
    const targetOrigin = getOrigin(src);

    const strMessage = JSON.stringify(message);
    this.iframe.contentWindow.postMessage(strMessage, targetOrigin);
  };

  handleLoad = () => {
    this.props.onLoad && this.props.onLoad();
  };

  componentDidMount() {
    window.addEventListener('message', this.handleMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.handleMessage);
  }

  get id() {
    const { id } = this.props;
    return clsc(id, this.generatedId);
  }

  render() {
    const {
      src,
      className,
      onMessage, // eslint-disable-line
      testId,
      ...props
    } = this.props;

    const origin = this.origin;

    const theId = this.id;
    const theSrc = setQueryParams({
      url: src,
      params: { frameId: theId, pOrigin: origin },
    });

    return (
      // eslint-disable-next-line jsx-a11y/iframe-has-title
      <iframe
        ref={node => {
          this.iframe = node;
        }}
        data-id={testId}
        onLoad={this.handleLoad}
        className={cf('iframe', g(className))}
        id={theId}
        src={theSrc}
        {...props}
      />
    );
  }
}
