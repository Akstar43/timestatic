export default function Input({ label, value, onChange, type="text" }) {
  return (
    <div className="mb-3">
      <label className="block mb-1 font-semibold">{label}</label>
      <input
        className="border p-2 w-full rounded"
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
      />
    </div>
  );
}
