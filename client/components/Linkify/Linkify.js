/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// copying the component here to make it work with our current version of react
// https://www.npmjs.com/package/react-linkify version 0.2.1
//
// LICENSE:
// The MIT License (MIT)
//
// Copyright (c) 2015 Tasti Zakarie
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Reva changes: heavily modified to operate over strings instead of over react elements

import PropTypes from 'prop-types';

import { Component, createElement } from 'react';
import LinkifyIt from 'linkify-it';
import tlds from 'tlds';
import reduceLeftPad from 'helpers/reduceLeftPad';
import he from 'he';
import trim from 'helpers/trim';
import { cf, g } from './Linkify.scss';

export const linkify = new LinkifyIt();
linkify.tlds(tlds);

const escape = he.encode;
const linkifyContent = (content = '', { linkEmails } = {}) => {
  let out = escape(content);
  const matches = linkify.match(content);
  const result = [];
  let last;

  if (matches) {
    last = 0;
    matches.forEach(match => {
      if (match.url.indexOf('mailto:') > -1 && !linkEmails) {
        // skip mailto links
        return;
      }
      if (last < match.index) {
        result.push(escape(content.slice(last, match.index)));
      }
      result.push('<a target="_blank" href="');
      result.push(escape(match.url));
      result.push('">');
      result.push(escape(match.text));
      result.push('</a>');
      last = match.lastIndex;
    });

    if (last < content.length) {
      result.push(escape(content.slice(last)));
    }

    out = result.join('');
  }

  return out;
};

class Linkify extends Component {
  static MATCH = 'LINKIFY_MATCH';

  static propTypes = {
    className: PropTypes.string,
    nlToBr: PropTypes.bool,
    wrapperElement: PropTypes.string,
    linkEmails: PropTypes.bool,
    collapseBrs: PropTypes.bool,
    collapseTabs: PropTypes.bool,
    removeEmptyLines: PropTypes.bool,
  };

  static defaultProps = {
    className: '',
    component: 'a',
    wrapperElement: 'div',
    properties: {},
    children: '',
    nlToBr: true,
    linkEmails: false,
    collapseBrs: false,
    collapseTabs: true,
    removeEmptyLines: false,
  };

  storeRef = ref => {
    this.linkifyRef = ref;
  };

  update = () => {
    const { children = '', nlToBr, linkEmails, collapseBrs, collapseTabs, removeEmptyLines } = this.props;
    const text = reduceLeftPad(children);
    let linkifiedContent = linkifyContent(text, { linkEmails }) || '';

    if (removeEmptyLines) {
      const lines = linkifiedContent.split(/\n/).reduce((acc, line) => {
        if (!trim(line)) return acc;
        acc.push(line);
        return acc;
      }, []);

      linkifiedContent = lines.join('\n');
    }

    if (collapseBrs) {
      linkifiedContent = linkifiedContent.replace(/\n+/g, '\n');
    }

    if (collapseTabs) {
      linkifiedContent = linkifiedContent.replace(/\t+/g, '\t');
    }

    this.linkifyRef.innerHTML = nlToBr ? linkifiedContent.replace(/\r?\n/g, '<br>') : linkifiedContent;
  };

  componentDidMount() {
    this.update();
  }

  componentDidUpdate() {
    this.update();
  }

  render() {
    const { className, wrapperElement } = this.props;
    const eleProps = {
      ref: this.storeRef,
      className: cf('linkify', g(className)),
    };

    eleProps['data-c'] = 'linkify';

    return createElement(wrapperElement, eleProps);
  }
}

export default Linkify;
