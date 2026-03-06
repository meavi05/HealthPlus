import { useMemo, useState, type ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';

interface PrescriptionModalProps {
  show: boolean;
  isUploading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (files: File[]) => void;
}

const MAX_FILES = 2;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function PrescriptionModal({ show, isUploading, error, onClose, onSubmit }: PrescriptionModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const combinedError = localError || error;

  const helperText = useMemo(
    () => 'Upload up to 2 files. Allowed types: PDF, JPG, PNG. Max size: 5 MB each.',
    []
  );

  if (!show) return null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setLocalError(null);

    if (files.length > MAX_FILES) {
      setSelectedFiles(files.slice(0, MAX_FILES));
      setLocalError('You can select up to 2 files only.');
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setSelectedFiles([]);
        setLocalError('Only PDF, JPG, or PNG files are allowed.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setSelectedFiles([]);
        setLocalError('Each file must be 5 MB or smaller.');
        return;
      }
    }

    setSelectedFiles(files);
  };

  const submit = () => {
    if (selectedFiles.length === 0) {
      setLocalError('Please select at least one file.');
      return;
    }
    onSubmit(selectedFiles);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Upload Prescription</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close prescription modal">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{helperText}</p>

          <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 transition-colors">
            <Upload className="mx-auto text-gray-500 mb-2" />
            <span className="text-sm text-gray-700">Choose files</span>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
          </label>

          {selectedFiles.length > 0 && (
            <ul className="text-sm text-gray-700 space-y-1">
              {selectedFiles.map((file) => (
                <li key={file.name} className="flex justify-between">
                  <span>{file.name}</span>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </li>
              ))}
            </ul>
          )}

          {combinedError && <p className="text-sm text-red-600">{combinedError}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={isUploading}
              className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-60"
            >
              {isUploading ? 'Uploading...' : 'Upload Prescription'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
