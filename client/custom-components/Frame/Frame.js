/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

export default class Frame extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    const { content = '', bodyStyle = {} } = this.props;

    const doc = this.frame.contentDocument;
    doc.open();
    doc.write(content);
    doc.close();

    Object.keys(bodyStyle).forEach(key => {
      doc.body.style[key] = bodyStyle[key];
    });
  }

  handleLoad = () => {
    this.setState({ contentHeight: this.frame.contentWindow.document.body.scrollHeight + 30 });

    this.props.onFrameLoad && this.props.onFrameLoad();
  };

  render = ({ ...rest }) => {
    const { contentHeight } = this.state;
    const { style = {}, stretchToContentSize, id } = this.props;
    const finalStyle = stretchToContentSize ? { ...style, height: contentHeight, width: '100%' } : style;

    return (
      <iframe
        style={finalStyle}
        onLoad={this.handleLoad}
        ref={node => {
          this.frame = node;
        }}
        id={id}
        {...rest}
      />
    );
  };
}
