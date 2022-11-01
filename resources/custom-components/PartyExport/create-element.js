/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createElement } from 'react';
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
    ...props
  }) => {
    const theProps = {
      'data-component': nameOfElement,
      className: nameOfElement,
      ...props,
    };

    const tagElement = inline ? 'span' : 'p';
    if (children && typeof children === 'object') {
      // console.warn('object received in ', nameOfElement, children);
    }
    return createElement(tagElement, theProps, children);
  };

  Element.displayName = nameOfElement;

  return Element;
};

export default elementCreator;
