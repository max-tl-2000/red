/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import 'highlight.js/styles/github.css';
import reduceLeftPad from 'helpers/reduceLeftPad';
import Highlight from './Highlight';

const PrettyPrint = ({ children, className = 'javascript' }) => {
  children = reduceLeftPad(children); // eslint-disable-line

  return <Highlight className={className}>{children}</Highlight>;
};

export default PrettyPrint;
