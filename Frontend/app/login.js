import { useAuth } from '../src/context/AuthContext';
import LoginScreen from '../src/screens/member/LoginScreen';

export default function LoginRoute() {
  const { login } = useAuth();

  const handleLogin = async (email, password) => {
    await login(email, password);
  };

  return <LoginScreen onLogin={handleLogin} />;
}