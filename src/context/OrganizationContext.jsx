import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase/firebase";

const OrganizationContext = createContext();

export function useOrganization() {
    return useContext(OrganizationContext);
}

export function OrganizationProvider({ children }) {
    const { currentUser } = useAuth();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

}

loadOrganization();
    }, [currentUser]);

const reloadOrganization = () => {
    setLoading(true);
    setError("");
    // Re-trigger the effect by effectively "refreshing" logic, 
    // but easier to just extract load function. 
    // For simplicity, let's just expose a function that duplicates the check or sets a trigger.
    // Actually, best way: 
    const fetchNow = async () => {
        // ... logic ...
        // To avoid code duplication, let's just refactor 'loadOrganization' out of useEffect.
    };
};

// Better refactor:
const loadOrganization = async () => {
    if (!currentUser) {
        setOrg(null);
        setLoading(false);
        return;
    }

    try {
        setLoading(true);
        // 1. Get User Document by UID (Query instead of direct Get, for OTP support)
        // Note: ensuring limit(1) so it works with strict keys
        const q = query(collection(db, "users"), where("uid", "==", currentUser.uid), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDocSnap = querySnapshot.docs[0];
            const userData = userDocSnap.data();
            const orgId = userData.orgId;

            if (orgId) {
                // 2. Get Organization Document
                const orgDocRef = doc(db, "organizations", orgId);
                const orgDocSnap = await getDoc(orgDocRef);

                if (orgDocSnap.exists()) {
                    setOrg({ id: orgDocSnap.id, ...orgDocSnap.data() });
                } else {
                    console.warn(`Organization ${orgId} not found for user ${currentUser.uid}`);
                    setError("Organization not found");
                }
            } else {
                console.log("User has no orgId assigned");
                setOrg(null);
            }
        } else {
            setOrg(null);
        }
    } catch (err) {
        console.error("Failed to load organization:", err);
        setError(err.message);
    } finally {
        setLoading(false);
    }
};

useEffect(() => {
    loadOrganization();
}, [currentUser]);

const value = {
    org,
    loading,
    error,
    reloadOrganization: loadOrganization
};

return (
    <OrganizationContext.Provider value={value}>
        {!loading && children}
    </OrganizationContext.Provider>
);
}
