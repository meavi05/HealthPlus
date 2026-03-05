import { useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, Save, User, X } from 'lucide-react';

interface ProfileUser {
  id: number | string;
  name: string;
  email?: string;
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
  const [imageErrored, setImageErrored] = useState(false);

  useEffect(() => {
    if (show && user) {
      setEditUser(user);
      setIsEditing(false);
      setImageErrored(false);
    }
  }, [show, user]);

  const resolvedProfilePicture = useMemo(() => editUser?.profile_picture || '', [editUser]);

  if (!show || !editUser) return null;

  const handleSave = () => {
    if (editUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editUser.email)) {
        alert('Please enter a valid email address');
        return;
      }
    }
    onSave(editUser);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">Profile</h3>
          <button type="button" onClick={onClose} className="text-white/90 hover:text-white" aria-label="Close profile">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden border-4 border-white shadow">
              {resolvedProfilePicture && !imageErrored ? (
                <img
                  src={resolvedProfilePicture}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageErrored(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={38} className="text-gray-400" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editUser.name || ''}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  className="mt-1 w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter your name"
                />
              ) : (
                <p className="mt-1 font-medium text-gray-800">{editUser.name || '-'}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><Mail size={13} /> Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editUser.email || ''}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="mt-1 w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter your email"
                />
              ) : (
                <p className="mt-1 text-gray-700">{editUser.email || '-'}</p>
              )}
            </div>

            {isEditing && (
              <div>
                <label className="text-xs text-gray-500">Profile photo URL</label>
                <input
                  type="text"
                  value={editUser.profile_picture || ''}
                  onChange={(e) => {
                    setImageErrored(false);
                    setEditUser({ ...editUser, profile_picture: e.target.value });
                  }}
                  className="mt-1 w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="https://..."
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            {isEditing ? (
              <button onClick={handleSave} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2">
                <Save size={16} /> Save
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg flex items-center justify-center gap-2">
                <Pencil size={16} /> Edit
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
