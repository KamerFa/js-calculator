import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import ProfileView from '../components/ProfileView';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const { reload } = useData();
  const navigate = useNavigate();

  return (
    <ProfileView
      user={user}
      profileUsername={username || null}
      onProjectClick={(id) => navigate(`/project/${id}`)}
      onReload={reload}
    />
  );
}
