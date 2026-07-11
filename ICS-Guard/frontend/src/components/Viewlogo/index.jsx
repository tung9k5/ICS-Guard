import React from 'react';
import './Viewlogo.scss';

const Viewlogo = ({ size, animate = 'float', className = '', style = {}, ...props }) => {
  const mergedStyle = {
    ...(size ? { maxWidth: typeof size === 'number' ? `${size}px` : size } : {}),
    ...style
  };

  let animationClass = '';
  if (animate === 'float' || animate === true) animationClass = 'animate-float';
  else if (animate === 'spin') animationClass = 'animate-spin';

  return (
    <img 
      src="/image-logo.png" 
      alt="ICS-Guard Logo" 
      className={`view-logo ${animationClass} ${className}`.trim()} 
      style={mergedStyle}
      {...props}
    />
  );
};

export default Viewlogo;
