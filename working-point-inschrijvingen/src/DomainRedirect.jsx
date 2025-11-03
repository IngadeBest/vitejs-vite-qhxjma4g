import React from 'react';
import { Redirect } from 'react-router-dom';

const DomainRedirect = () => {
  const hostname = window.location.hostname;

  if (hostname.startsWith('app.')) {
    return <Redirect to="/beheer" />;
  } else {
    return <Redirect to="/publiek" />;
  }
};

export default DomainRedirect;