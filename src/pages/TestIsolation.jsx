import React, { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useOrganization } from '../context/OrganizationContext';

export default function TestIsolation() {
    const { org } = useOrganization();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const runTests = async () => {
        setLoading(true);
        const logs = [];
        const addLog = (msg, status = 'info') => logs.push({ msg, status });

        if (!org?.id) {
            addLog(`⚠️ Current User has no Organization ID. Please create a new company via /signup to test properly.`, 'warning');
        } else {
            addLog(`Current Org ID: ${org.id}`, 'info');
        }

        try {
            // Test 1: Fetch My Org Users
            // Expected: Success
            if (org?.id) {
                try {
                    const myUsersQ = query(collection(db, "users"), where("orgId", "==", org.id));
                    const myUsersSnap = await getDocs(myUsersQ);
                    addLog(`Test 1: Fetch My Users (orgId matches) -> Found ${myUsersSnap.size}`, 'success');
                } catch (e) {
                    addLog(`Test 1: Fetch My Users -> FAILED: ${e.message}`, 'error');
                }
            }

            // Test 2: Fetch ALL Users (The "Hacker" Test)
            // Expected: BLOCK (Missing Permissions) or Filtered Result
            try {
                const allUsersSnap = await getDocs(collection(db, "users"));
                // If we get here, rules allowed reading ALL users (Bad!) 
                // UNLESS it filtered them silently (rare without query).
                const foreignUsers = allUsersSnap.docs.filter(d => d.data().orgId !== org?.id).length;
                if (foreignUsers > 0) {
                    addLog(`Test 2: Fetch ALL Users -> ❌ LEAK DETECTED! Found ${foreignUsers} foreign users.`, 'error');
                } else {
                    addLog(`Test 2: Fetch ALL Users -> ⚠️ Allowed but no foreign data found. Rules might be weak.`, 'warning');
                }
            } catch (e) {
                if (e.message.includes("Missing or insufficient permissions")) {
                    addLog(`Test 2: Fetch ALL Users -> ✅ PASS. Access Denied (Blocked by Rules).`, 'success');
                } else {
                    addLog(`Test 2: Fetch ALL Users -> Error: ${e.message}`, 'error');
                }
            }

            // Test 3: Leaves "Hacker" Test
            try {
                const allLeavesSnap = await getDocs(collection(db, "leaveRequests"));
                const foreignLeaves = allLeavesSnap.docs.filter(d => d.data().orgId !== org?.id).length;
                if (foreignLeaves > 0) {
                    addLog(`Test 3: Fetch ALL Leaves -> ❌ LEAK DETECTED! Found ${foreignLeaves} foreign leaves.`, 'error');
                } else {
                    addLog(`Test 3: Fetch ALL Leaves -> ⚠️ Allowed but no foreign data found.`, 'warning');
                }
            } catch (e) {
                if (e.message.includes("Missing or insufficient permissions")) {
                    addLog(`Test 3: Fetch ALL Leaves -> ✅ PASS. Access Denied (Blocked by Rules).`, 'success');
                } else {
                    addLog(`Test 3: Fetch ALL Leaves -> Error: ${e.message}`, 'error');
                }
            }

        } catch (error) {
            addLog(`Critical Error: ${error.message}`, 'error');
        }

        setResults(logs);
        setLoading(false);
    };

    return (
        <div className="p-10 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">🕵️ Data Isolation Test</h1>

            <div className="bg-slate-100 p-4 rounded-lg mb-6">
                <p><strong>Goal:</strong> Verify that I cannot see data from other organizations.</p>
                <p className="mt-2 text-sm text-slate-600">
                    This script attempts to bypass the filter and read <code>collection('users')</code> directly.
                    If Firestore Rules are set up correctly, it should block requests or return only my own data.
                </p>
            </div>

            <button
                onClick={runTests}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-500 disabled:opacity-50"
            >
                {loading ? "Running Audit..." : "Run Security Audit"}
            </button>

            <div className="mt-8 space-y-2">
                {results.map((log, i) => (
                    <div key={i} className={`p-3 rounded border ${log.status === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                        log.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            log.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                'bg-white border-slate-200'
                        }`}>
                        {log.status === 'error' && '❌ '}
                        {log.status === 'success' && '✅ '}
                        {log.status === 'warning' && '⚠️ '}
                        {log.msg}
                    </div>
                ))}
            </div>
        </div>
    );
}
