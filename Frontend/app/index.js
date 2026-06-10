
export default function HomeRoute() {
  const router = useRouter();

  
  const handleNavigate = (route) => {
    router.push(route);
  };

  return <HomeScreen onNavigate={handleNavigate} />;
  
}

