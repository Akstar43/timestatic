import React, { useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ResetData() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const navigate = useNavigate();

    const COLLECTIONS = [
        "users",
        "organizations",
        "invitations",
        "leaveRequests",
        "publicHolidays"
    ];

    const handleReset = async () => {
        if (!window.confirm("ARE YOU SURE? THIS CANNOT BE UNDONE. ALL DATA WILL BE DELETED.")) return;

        setLoading(true);
        try {
            for (const colName of COLLECTIONS) {
                setStatus(`Deleting ${colName}...`);
                const colRef = collection(db, colName);
                const snapshot = await getDocs(colRef);

                const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, colName, d.id)));
                await Promise.all(deletePromises);
                console.log(`Deleted ${snapshot.size} docs from ${colName}`);
            }

            setStatus("Deleting your Auth Account...");
            try {
                if (auth.currentUser) await auth.currentUser.delete(); // Delete from Firebase Auth
            } catch (err) {
                console.error("Auth delete failed (might need fresh login):", err);
            }

            setStatus("Signing out...");
            await signOut(auth); // Just in case delete failed or for cleanup

            toast.success("All data wiped. Redirecting...");
            setTimeout(() => navigate("/"), 2000);

        } catch (error) {
            console.error("Reset failed:", error);
            setStatus("Error: " + error.message);
            toast.error("Cleanup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border-2 border-red-100">
                <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ Danger Zone</h1>
                <p className="text-slate-600 mb-8">
                    This utility will delete ALL data from the database.
                    <br />
                    <strong>Users, Organizations, Leaves, Invites.</strong>
                    <br />
                    Use this to clear conflicts from previous versions.
                </p>

                {status && (
                    <div className="mb-4 p-3 bg-slate-100 rounded text-sm font-mono text-slate-700">
                        {status}
                    </div>
                )}

                <button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? "WIPING DATA..." : "DELETE ALL DATA"}
                </button>
            </div>
        </div>
    );
}
