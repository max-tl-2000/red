/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import { createElement } from 'react';
import { cf, g } from './Typography.scss';
import { isValidChildrenProp } from './validate-content';

/**
 * create Typography element, since all of them share the same interface and the only thing
 * that really change is the name of the element, this was abstracted in order to avoid
 * code duplication
 *
 * @param      {string}  nameOfElement  The name of element
 * @return     {ReactElement}  A Typography element
 */
const elementCreator = nameOfElement => {
  const Element = ({
    className,
    raw,
    noDefaultColor,
    secondary,
    bold,
    errorUnderline,
    ellipsis,
    highlight,
    error,
    disabled,
    inline,
    children,
    lighter,
    uppercase,
    testId,
    ...props
  }) => {
    const theProps = {
      'data-id': testId,
      'data-component': nameOfElement,
      'data-typography-element': true,
      className: cf(
        nameOfElement,
        raw
          ? {}
          : {
              noDefaultColor,
              secondary,
              bold,
              highlight,
              ellipsis,
              error,
              lighter,
              errorUnderline,
              disabled,
              uppercase,
            },
        g(className),
      ),
      ...props,
    };

    const tagElement = inline ? 'span' : 'p';
    // some elements report typeof 'object' but are in reality arrays
    if (!isValidChildrenProp(children)) {
      console.error('Invalid children found', nameOfElement, children);
      children = ''; // just handle it as an empty text
    }

    return createElement(tagElement, theProps, children);
  };

  Element.displayName = nameOfElement;

  Element.propTypes = {
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number, PropTypes.element, PropTypes.array]),
    className: PropTypes.string,
    noDefaultColor: PropTypes.bool,
    secondary: PropTypes.bool,
    bold: PropTypes.bool,
    errorUnderline: PropTypes.bool,
    ellipsis: PropTypes.bool,
    highlight: PropTypes.bool,
    error: PropTypes.bool,
    disabled: PropTypes.bool,
    inline: PropTypes.bool,
    lighter: PropTypes.bool,
    uppercase: PropTypes.bool,
    raw: PropTypes.bool,
  };

  return Element;
};

export default elementCreator;
