import { useRouter } from 'expo-router';
import EditProfileScreen from '../src/screens/member/EditProfileScreen';

export default function EditProfileRoute() {
  const router = useRouter();
  return <EditProfileScreen onSave={() => router.back()} />;
}