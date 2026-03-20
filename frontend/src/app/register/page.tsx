import { Suspense } from 'react';

import { RegisterScreen } from './register-screen';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterScreen />
    </Suspense>
  );
}
