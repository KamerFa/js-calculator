import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import CommunityView from '../components/CommunityView';

export default function CommunityPage() {
  const { user } = useAuth();
  const { reload } = useData();
  const navigate = useNavigate();

  return (
    <CommunityView
      user={user}
      onProjectClick={(id) => navigate(`/project/${id}`)}
      onReload={reload}
      onUserClick={(username) => navigate(`/profile/${username}`)}
    />
  );
}
