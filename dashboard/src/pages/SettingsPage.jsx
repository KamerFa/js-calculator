import { useAuth } from '../context/AuthContext';
import SettingsView from '../components/SettingsView';

export default function SettingsPage() {
  const { user } = useAuth();

  return <SettingsView user={user} />;
}
