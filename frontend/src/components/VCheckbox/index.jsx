import React, { useEffect, useRef, forwardRef } from 'react';

const VCheckbox = forwardRef(({ indeterminate, ...rest }, externalRef) => {
  const internalRef = useRef(null);
  const ref = externalRef || internalRef;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = typeof indeterminate === 'boolean' ? indeterminate : false;
    }
  }, [indeterminate, ref]);

  return (
    <input 
      type="checkbox" 
      ref={ref} 
      className={`v-checkbox ${rest.className || ''}`}
      {...rest} 
    />
  );
});

VCheckbox.displayName = 'VCheckbox';

export default VCheckbox;
