import { useRouter } from 'expo-router';
import HomeScreen from '../src/screens/member/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();

  const handleNavigate = (route) => {
    router.push(route);
  };

  return (
    <HomeScreen 
      onGoToProfile={() => router.push('profile')}
      onGoToEditProfile={() => router.push('edit-profile')}
      onNavigate={handleNavigate}
    />
  );
}