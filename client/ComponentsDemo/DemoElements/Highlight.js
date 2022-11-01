/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import hljs from 'highlight.js';
import React from 'react';
import ReactDOM from 'react-dom';
import shallowCompare from 'helpers/shallowCompare';

// eslint-disable-next-line react/prefer-es6-class
const Highlight = React.createClass({
  getDefaultProps() {
    return {
      innerHTML: false,
      className: null,
      element: null,
    };
  },
  componentDidMount() {
    this.highlightCode();
  },

  shouldComponentUpdate(nextProps) {
    return !shallowCompare(nextProps, this.props, ['children', 'className', 'innerHTML', 'element']);
  },

  componentDidUpdate() {
    this.highlightCode();
  },

  highlightCode() {
    const domNode = ReactDOM.findDOMNode(this); // eslint-disable-line
    const nodes = [].slice.call(domNode.querySelectorAll('pre code'));

    nodes.forEach(node => hljs.highlightBlock(node));
  },

  render() {
    let theElement = this.props.element ? React.DOM[this.props.element] : null;

    if (this.props.innerHTML) {
      if (!theElement) {
        theElement = React.DOM.div;
      }
      return theElement(
        {
          dangerouslySetInnerHTML: {
            __html: this.props.children,
          },
          className: this.props.className || null,
        },
        null,
      );
    }

    if (theElement) {
      return theElement(
        {
          className: this.props.className,
        },
        this.props.children,
      );
    }

    return (
      <pre>
        <code className={this.props.className}>{this.props.children}</code>
      </pre>
    );
  },
});

export default Highlight;
