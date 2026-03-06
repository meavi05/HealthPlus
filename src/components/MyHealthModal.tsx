import { useState, type ChangeEvent } from 'react';
import { CalendarClock, FileUp, X } from 'lucide-react';

interface MedicineRoutine {
  id?: number;
  medicine_name: string;
  last_taken_date: string;
  next_due_date: string;
  status?: string;
}

interface MyHealthModalProps {
  show: boolean;
  isUploadingPrescription: boolean;
  prescriptionError: string | null;
  routines: MedicineRoutine[];
  routineError: string | null;
  isSavingRoutine: boolean;
  onClose: () => void;
  onUploadPrescription: (files: File[]) => void;
  onCreateRoutine: (payload: { medicineName: string; lastTakenDate: string }) => void;
}

const MAX_FILES = 2;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function MyHealthModal({
  show,
  isUploadingPrescription,
  prescriptionError,
  routines,
  routineError,
  isSavingRoutine,
  onClose,
  onUploadPrescription,
  onCreateRoutine,
}: MyHealthModalProps) {
  const [activeSection, setActiveSection] = useState<'prescription' | 'routine'>('prescription');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localPrescriptionError, setLocalPrescriptionError] = useState<string | null>(null);
  const [medicineName, setMedicineName] = useState('');
  const [lastTakenDate, setLastTakenDate] = useState('');

  if (!show) return null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files || []) as File[];
    setLocalPrescriptionError(null);

    if (files.length > MAX_FILES) {
      setSelectedFiles(files.slice(0, MAX_FILES));
      setLocalPrescriptionError('You can select up to 2 files only.');
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setSelectedFiles([]);
        setLocalPrescriptionError('Only PDF, JPG, or PNG files are allowed.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setSelectedFiles([]);
        setLocalPrescriptionError('Each file must be 5 MB or smaller.');
        return;
      }
    }

    setSelectedFiles(files);
  };

  const submitPrescription = () => {
    if (selectedFiles.length === 0) {
      setLocalPrescriptionError('Please select at least one file.');
      return;
    }
    onUploadPrescription(selectedFiles);
  };

  const submitRoutine = () => {
    if (!medicineName.trim() || !lastTakenDate) {
      return;
    }
    onCreateRoutine({ medicineName: medicineName.trim(), lastTakenDate });
    setMedicineName('');
    setLastTakenDate('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl border border-gray-200 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">My Health</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close my health modal">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setActiveSection('prescription')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium border ${
                activeSection === 'prescription' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Prescription
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('routine')}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium border ${
                activeSection === 'routine' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Medicine Routine
            </button>
          </div>

          {activeSection === 'prescription' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Upload up to 2 files. Allowed: PDF, JPG, PNG. Max 5 MB each.</p>
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 transition-colors">
                <FileUp className="mx-auto text-gray-500 mb-2" />
                <span className="text-sm text-gray-700">Choose prescription files</span>
                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
              </label>

              {selectedFiles.length > 0 && (
                <ul className="text-sm text-gray-700 space-y-1">
                  {selectedFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex justify-between">
                      <span>{file.name}</span>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </li>
                  ))}
                </ul>
              )}

              {(localPrescriptionError || prescriptionError) && (
                <p className="text-sm text-red-600">{localPrescriptionError || prescriptionError}</p>
              )}

              <button
                type="button"
                onClick={submitPrescription}
                disabled={isUploadingPrescription}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-60"
              >
                {isUploadingPrescription ? 'Uploading...' : 'Upload Prescription'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Track regular medicines. Next due date is automatically set to 30 days from last taken date.</p>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Medicine name</label>
                  <input
                    type="text"
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    placeholder="e.g. Sugar medicine"
                    className="mt-1 w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Last taken date</label>
                  <div className="mt-1 relative">
                    <input
                      type="date"
                      value={lastTakenDate}
                      onChange={(e) => setLastTakenDate(e.target.value)}
                      className="w-full border rounded-lg p-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <CalendarClock size={16} className="absolute right-3 top-3 text-gray-400" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={submitRoutine}
                disabled={isSavingRoutine || !medicineName.trim() || !lastTakenDate}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-60"
              >
                {isSavingRoutine ? 'Saving...' : 'Save Routine'}
              </button>

              {routineError && <p className="text-sm text-red-600">{routineError}</p>}

              <div className="pt-2">
                <h4 className="font-medium text-gray-800 mb-2">Saved routines</h4>
                {routines.length === 0 ? (
                  <p className="text-sm text-gray-500">No routines yet.</p>
                ) : (
                  <div className="space-y-2">
                    {routines.map((routine) => (
                      <div key={`${routine.id ?? routine.medicine_name}-${routine.last_taken_date}`} className="rounded-lg border border-gray-200 p-3 text-sm">
                        <p className="font-medium text-gray-800">{routine.medicine_name}</p>
                        <p className="text-gray-600">Last taken: {routine.last_taken_date}</p>
                        <p className="text-teal-700 font-medium">Next due: {routine.next_due_date}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
