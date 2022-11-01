/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

function injectProps(target, name, descriptor) {
  const oldFunction = descriptor.value;

  descriptor.value = function propsInjectorFunction() {
    return oldFunction.bind(this)(this.props);
  };

  return descriptor;
}

export default injectProps;
