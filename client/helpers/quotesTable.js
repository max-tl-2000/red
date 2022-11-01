/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import findKey from 'lodash/findKey';
import SvgIconCircle from '../../resources/icons/minicon-circle.svg';
import SvgIconTriangle from '../../resources/icons/minicon-triangle.svg';
import SvgIconSquare from '../../resources/icons/minicon-square.svg';
import { cf } from '../containers/Quotes/QuoteList.scss';
import { ScreeningDecision } from '../../common/enums/applicationTypes';

const CIRCLE = 'circle';
const TRIANGLE = 'triangle';
const SQUARE = 'square';

const shapeComponentMap = {
  [CIRCLE]: SvgIconCircle,
  [TRIANGLE]: SvgIconTriangle,
  [SQUARE]: SvgIconSquare,
};

export const renderApplicationStatusIcon = screening => {
  const { shape = CIRCLE, color = 'grey' } = screening;
  const SvgComponent = shapeComponentMap[shape] || shapeComponentMap[CIRCLE];
  return <SvgComponent width={20} height={20} className={cf(`${shape}`, { [color]: color })} />;
};

export const getShapeAndColorByApplicationStatus = applicationDecision => {
  const shapeDecisionMap = {
    [CIRCLE]: [
      ScreeningDecision.APPROVED,
      ScreeningDecision.INCOMPLETE,
      ScreeningDecision.ON_HOLD,
      ScreeningDecision.COMPILING,
      ScreeningDecision.COMPILING_DELAYED,
      ScreeningDecision.NO_SCREENING_REQUEST,
      ScreeningDecision.NO_SCREENING_RESPONSE,
      ScreeningDecision.SCREENING_IN_PROGRESS,
      ScreeningDecision.NO_SCREENING_RESPONSE_INTERNATIONAL_ADDRESS,
      ScreeningDecision.DRAFT,
    ],
    [TRIANGLE]: [ScreeningDecision.FURTHER_REVIEW, ScreeningDecision.APPROVED_WITH_COND],
    [SQUARE]: [
      ScreeningDecision.GUARANTOR_REQUIRED,
      ScreeningDecision.DECLINED,
      ScreeningDecision.DISPUTED,
      ScreeningDecision.ERROR_RESPONSE_UNPARSABLE,
      ScreeningDecision.ERROR_OTHER,
      ScreeningDecision.GUARANTOR_DENIED,
      ScreeningDecision.ERROR_ADDRESS_UNPARSABLE,
      ScreeningDecision.EXPIRED,
    ],
  };
  let color;
  const shape = findKey(shapeDecisionMap, shapeDecision => shapeDecision.some(status => status === applicationDecision)) || TRIANGLE;

  switch (shape) {
    case TRIANGLE:
      color = 'orange';
      break;
    case SQUARE:
      color = 'red';
      break;
    default:
      color = 'grey';
  }

  if (applicationDecision === ScreeningDecision.APPROVED) {
    color = 'green';
  }

  return { shape, color };
};
