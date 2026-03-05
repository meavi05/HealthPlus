import { useEffect, useState } from 'react';
import { User, X } from 'lucide-react';

interface ProfileUser {
  id: number;
  name: string;
  email: string;
  profile_picture?: string;
}

interface ProfileModalProps {
  show: boolean;
  user: ProfileUser | null;
  onClose: () => void;
  onSave: (updatedUser: ProfileUser) => void;
}

export default function ProfileModal({ show, user, onClose, onSave }: ProfileModalProps) {
  const [editUser, setEditUser] = useState<ProfileUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (show && user) {
      setEditUser(user);
      setIsEditing(false);
    }
  }, [show, user]);

  if (!show || !editUser) return null;

  const handleSave = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editUser.email)) {
      alert('Please enter a valid email address');
      return;
    }
    onSave(editUser);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close profile">
          <X size={20} />
        </button>
        <h3 className="text-xl font-semibold mb-4">User Profile</h3>
        <div className="flex flex-col gap-4">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {editUser.profile_picture ? (
              <img src={editUser.profile_picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-gray-400" />
            )}
          </div>
          {isEditing ? (
            <>
              <input type="text" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} className="border p-2 rounded" placeholder="Name" />
              <input type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} className="border p-2 rounded" placeholder="Email" />
              <input type="text" value={editUser.profile_picture || ''} onChange={(e) => setEditUser({ ...editUser, profile_picture: e.target.value })} className="border p-2 rounded" placeholder="Profile Picture URL" />
            </>
          ) : (
            <>
              <p><strong>Name:</strong> {editUser.name}</p>
              <p><strong>Email:</strong> {editUser.email}</p>
            </>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          {isEditing ? (
            <button onClick={handleSave} className="flex-1 bg-teal-600 text-white py-2 rounded">Save</button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="flex-1 bg-teal-600 text-white py-2 rounded">Edit</button>
          )}
        </div>
      </div>
    </div>
  );
}
