export function RequestStatus({ label }: { label: string }) {
  return <div className="request-status" role="status" aria-live="polite" aria-busy="true">{label}</div>;
}
