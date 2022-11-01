/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import typeOf from '../../common/helpers/type-of';

/**
 * Helper function to calculate the shadow based on an elevation value. Based on
 * https://www.google.com/design/spec/what-is-material/elevation-shadows.html
 *
 * @method elevationShadow
 * @param elevationValue the value of the elevation for the shadow property to be generated
 */
export default function elevationShadow(elevationValue) {
  const type = typeOf(elevationValue);

  if (type !== 'number') {
    throw new Error(`elevationValue must be a Number. Current type ${type}, value is ${elevationValue}`);
  }

  const firstShadow = {
    // the original shadow was
    // box-shadow: 0 19px 38px 0 rgba(0, 0, 0, .3)
    //
    // This shadow correspond to an elevation of 24 accordingly to
    // https://www.google.com/design/spec/what-is-material/elevation-shadows.html#elevation-shadows-elevation-android-
    //
    // given those values we were able to find the factor doing:
    // displacement = 19/24 ==> 0.79166666666667, for css related stuff I've always kept as much precission as possible.
    // diffusion    = 38/24 ==> 1.58333333333333.
    displacement: 0.79166666666667 * elevationValue,
    diffusion: 1.5833333333333333 * elevationValue,
  };

  // the original shadow was
  // box-shadow: 0 15px 12px 0 rgba(0, 0, 0, .22)
  //
  // This shadow correspond to an elevation of 24 accordingly to
  // https://www.google.com/design/spec/what-is-material/elevation-shadows.html#elevation-shadows-elevation-android-
  //
  // given those values we were able to find the factor doing:
  // displacement = 15/24 ==> 0.625, for css related stuff I've always kept as much precission as possible.
  // diffusion    = 12/24 ==> 0.5
  const secondShadow = {
    displacement: 0.625 * elevationValue,
    diffusion: 0.5 * elevationValue,
  };

  const softShadow = elevationValue < 8 ? ', 0 -1px 5px 0 rgba(0, 0, 0, .08)' : '';

  return `0 ${firstShadow.displacement}px ${firstShadow.diffusion}px 0 rgba(0, 0, 0, .2), 0 ${secondShadow.displacement}px ${secondShadow.diffusion}px 0 rgba(0, 0, 0, .16) ${softShadow}`;
}
