import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-meavo-bg px-4">
      <div className="card w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-meavo-accent">
          <span className="text-xl font-bold text-white">M</span>
        </div>
        <h1 className="text-2xl font-semibold text-meavo-ink">Meavo Clock-In</h1>
        <p className="page-subtitle mb-8">Factory time tracking admin</p>
        {error && (
          <p className="mb-4 rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">{error}</p>
        )}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={async (res) => {
              try {
                setError(null);
                await login(res.credential);
              } catch (err) {
                setError(err.message);
              }
            }}
            onError={() => setError('Google sign-in failed')}
            theme="outline"
            size="large"
            text="signin_with"
          />
        </div>
      </div>
    </div>
  );
}
