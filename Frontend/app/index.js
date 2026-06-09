import { useRouter } from 'expo-router';
import HomeScreen from '../src/screens/member/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  return <HomeScreen onNavigate={(route) => router.push(route)} />;

  
}

