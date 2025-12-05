import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { userData } = useAuth();

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold">Welcome {userData?.email}</h1>
      <p className="mt-3">Branch: {userData?.branch}</p>
    </div>
  );
}
