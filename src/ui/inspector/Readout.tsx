export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <span className="readout__value">{value}</span>
    </div>
  )
}
