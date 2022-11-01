/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const BODY_MARGIN_ZERO_MATCHER = /(html.+}body.+)(margin:0px)(.+)/gim;
export const MARGIN_ZERO_REPLACE_TAG = '/*##removed-margin-0##*/';
