import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import MessagesView from '../components/MessagesView';

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <MessagesView
      user={user}
      onUserClick={(username) => navigate(`/profile/${username}`)}
    />
  );
}
