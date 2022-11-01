/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const tryCatch = (tryFn, catchAction) => {
  try {
    tryFn && tryFn();
  } catch (err) {
    catchAction && catchAction(err);
  }
};

const isInViewport = el => {
  const rect = el.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

export default function scrollIntoView(el, useScrollIntoView) {
  if (!el) return;

  if (el.scrollIntoViewIfNeeded && !useScrollIntoView) {
    // setTimeout needed to give time to the UI to update
    setTimeout(
      () =>
        tryCatch(
          () => el.scrollIntoViewIfNeeded(true),
          err => console.error('calling scrollIntoViewifNeeded failed', err),
        ),
      0,
    );
    return;
  }

  if (isInViewport(el)) {
    // only attempt to scroll if the element is not currently in the viewport
    return;
  }

  if (el.scrollIntoView) {
    const scrollIntoViewFn = opts => (opts ? el.scrollIntoView(opts) : el.scrollIntoView());
    tryCatch(
      // first attempt using the parameters
      () => scrollIntoViewFn({ behavior: 'smooth', block: 'center', inline: 'nearest' }),
      // in case of failure (Firefox Mobile) we just call it without parameters
      // and also catch the case where just calling it could produce an error
      tryCatch(
        () => scrollIntoViewFn(null),
        err => console.error('cannot scroll element into view', err, el),
      ),
    );
  }
}
