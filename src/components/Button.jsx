export default function Button({ text, onClick }) {
  return (
    <button
      className="w-full bg-blue-600 text-white p-2 rounded mt-2"
      onClick={onClick}
    >
      {text}
    </button>
  );
}
