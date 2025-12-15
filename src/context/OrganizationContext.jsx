import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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

    useEffect(() => {
        async function loadOrganization() {
            if (!currentUser) {
                setOrg(null);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // 1. Get User Document to find the orgId
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
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
                        // User has no Org ID (Migration scenario or Legacy user)
                        // For now, we can maybe treat them as "No Org" or generic
                        console.log("User has no orgId assigned");
                        setOrg(null);
                    }
                } else {
                    // User doc doesn't exist yet (might be creation delay)
                    setOrg(null);
                }
            } catch (err) {
                console.error("Failed to load organization:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadOrganization();
    }, [currentUser]);

    const value = {
        org,
        loading,
        error
    };

    return (
        <OrganizationContext.Provider value={value}>
            {!loading && children}
        </OrganizationContext.Provider>
    );
}
