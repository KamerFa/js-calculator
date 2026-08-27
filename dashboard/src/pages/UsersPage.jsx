import { useNavigate } from 'react-router';
import UsersView from '../components/UsersView';

export default function UsersPage() {
  const navigate = useNavigate();

  return (
    <UsersView onUserClick={(username) => navigate(`/profile/${username}`)} />
  );
}
