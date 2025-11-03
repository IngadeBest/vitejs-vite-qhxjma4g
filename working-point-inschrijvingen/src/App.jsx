import React from 'react';
import { HashRouter as Router, Route, Switch } from 'react-router-dom';
import DomainRedirect from './DomainRedirect';
import PublicInschrijven from './features/inschrijven/pages/PublicInschrijven';

const App = () => {
  return (
    <Router>
      <DomainRedirect />
      <Switch>
        <Route path="/" exact component={PublicInschrijven} />
        {/* Add more routes here as needed */}
      </Switch>
    </Router>
  );
};

export default App;