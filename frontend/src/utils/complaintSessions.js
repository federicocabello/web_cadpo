export const complaintSessionOptions = [
  { value: 'QUALY_SPRINT', label: 'Clasificación Sprint' },
  { value: 'SPRINT', label: 'Sprint' },
  { value: 'QUALY_FINAL', label: 'Clasificación Final' },
  { value: 'FINAL', label: 'Final' },
];

export const getComplaintSessionLabel = value =>
  complaintSessionOptions.find(option => option.value === String(value || '').toUpperCase())?.label || value;
