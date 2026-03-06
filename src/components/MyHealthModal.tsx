import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarClock, FileUp, History, Pill, X } from 'lucide-react';

interface MedicineRoutine {
  id?: number;
  medicine_name: string;
  last_taken_date: string;
  next_due_date: string;
  status?: string;
}

interface PurchasedMedicine {
  medicine_id: number;
  medicine_name: string;
  last_purchased_at: string;
  purchase_count: number;
}

interface MyHealthModalProps {
  show: boolean;
  activeSection: 'prescription' | 'routine';
  isUploadingPrescription: boolean;
  prescriptionError: string | null;
  routines: MedicineRoutine[];
  purchasedMedicines: PurchasedMedicine[];
  routineError: string | null;
  isSavingRoutine: boolean;
  onClose: () => void;
  onUploadPrescription: (files: File[]) => void;
  onCreateRoutine: (payload: { medicineName: string; lastTakenDate: string }) => void;
}

const MAX_FILES = 2;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const formatDisplayDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
};

export default function MyHealthModal({
  show,
  activeSection,
  isUploadingPrescription,
  prescriptionError,
  routines,
  purchasedMedicines,
  routineError,
  isSavingRoutine,
  onClose,
  onUploadPrescription,
  onCreateRoutine,
}: MyHealthModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localPrescriptionError, setLocalPrescriptionError] = useState<string | null>(null);
  const [medicineName, setMedicineName] = useState('');
  const [lastTakenDate, setLastTakenDate] = useState('');

  const prescriptionHelper = useMemo(
    () => 'Upload up to 2 files. Allowed: PDF, JPG, PNG. Max 5 MB each.',
    []
  );

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
    if (!medicineName.trim() || !lastTakenDate) return;
    onCreateRoutine({ medicineName: medicineName.trim(), lastTakenDate });
    setMedicineName('');
    setLastTakenDate('');
  };

  const selectPurchasedMedicine = (medicine: PurchasedMedicine) => {
    setMedicineName(medicine.medicine_name);
    setLastTakenDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full shadow-xl border border-gray-200 max-h-[92vh] sm:max-h-[88vh] overflow-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">My Health</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeSection === 'prescription' ? 'Prescription Upload' : 'Medicine Routine'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close my health modal">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {activeSection === 'prescription' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{prescriptionHelper}</p>
              <label className="block border-2 border-dashed border-gray-300 rounded-xl p-5 sm:p-8 text-center cursor-pointer hover:border-teal-500 transition-colors bg-[#fafcfe]">
                <FileUp className="mx-auto text-gray-500 mb-2" />
                <span className="text-sm text-gray-700">Choose prescription files</span>
                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
              </label>

              {selectedFiles.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Selected files</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="flex justify-between">
                        <span>{file.name}</span>
                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
            <div className="space-y-5">
              <div className="rounded-xl border border-[#dfeafb] bg-[#f7fbff] p-4">
                <p className="text-sm text-gray-700">
                  Save your routine medicine cycle. <strong>Next due date</strong> is automatically calculated as
                  <strong> 30 days</strong> from the last taken date.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500">Medicine name</label>
                    <input
                      type="text"
                      value={medicineName}
                      onChange={(e) => setMedicineName(e.target.value)}
                      placeholder="e.g. Metformin"
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

                  <button
                    type="button"
                    onClick={submitRoutine}
                    disabled={isSavingRoutine || !medicineName.trim() || !lastTakenDate}
                    className="w-full bg-teal-600 text-white py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-60"
                  >
                    {isSavingRoutine ? 'Saving...' : 'Save Medicine Routine'}
                  </button>

                  {routineError && <p className="text-sm text-red-600">{routineError}</p>}
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <History size={16} className="text-teal-600" /> Medicines purchased by you
                  </h4>
                  {purchasedMedicines.length === 0 ? (
                    <p className="text-sm text-gray-500">No purchased medicines found yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 sm:max-h-64 overflow-auto pr-1">
                      {purchasedMedicines.map((medicine) => (
                        <button
                          key={`${medicine.medicine_id}-${medicine.last_purchased_at}`}
                          type="button"
                          onClick={() => selectPurchasedMedicine(medicine)}
                          className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-teal-300 hover:bg-[#f9fdff]"
                        >
                          <p className="text-sm font-medium text-gray-800">{medicine.medicine_name}</p>
                          <p className="text-xs text-gray-500">Last purchased: {formatDisplayDate(medicine.last_purchased_at)}</p>
                          <p className="text-xs text-teal-700">Orders: {medicine.purchase_count}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Pill size={16} className="text-teal-600" /> Saved medicine routine
                </h4>
                {routines.length === 0 ? (
                  <p className="text-sm text-gray-500">No routines yet.</p>
                ) : (
                  <div className="space-y-2">
                    {routines.map((routine) => (
                      <div key={`${routine.id ?? routine.medicine_name}-${routine.last_taken_date}`} className="rounded-lg border border-gray-200 p-3 text-sm">
                        <p className="font-medium text-gray-800">{routine.medicine_name}</p>
                        <p className="text-gray-600">Last taken: {formatDisplayDate(routine.last_taken_date)}</p>
                        <p className="text-teal-700 font-medium">Next due: {formatDisplayDate(routine.next_due_date)}</p>
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
