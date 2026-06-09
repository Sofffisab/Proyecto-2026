import { useRouter } from 'expo-router';
import ProfileScreen from '../src/screens/member/ProfileScreen';

export default function ProfileRoute() {
  const router = useRouter();
  return <ProfileScreen onEditPress={() => router.push('/edit-profile')} />;
}