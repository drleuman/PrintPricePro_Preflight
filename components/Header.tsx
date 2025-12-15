import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
};

// The component now accepts and is typed with the 'Props' object
const Header: React.FC<Props> = ({ title, subtitle }) => {
  // Header temporarily hidden
  return null; 

  // When you want to show it again, you can use the props like this:
  /*
  return (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
  */
};

export default Header;