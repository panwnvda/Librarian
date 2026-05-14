import React from 'react';
import HomePage from './custom/HomePage';
import WelcomeModal from '@/components/WelcomeModal';

const HOME_KEY = 'rtHome';

export default function RedTeamHome() {
  return (
    <>
      <WelcomeModal />
      <HomePage pageKey={HOME_KEY} />
    </>
  );
}
