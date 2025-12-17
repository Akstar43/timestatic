import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
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

    const loadOrganization = async () => {
        if (!currentUser) {
            setOrg(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // --- MIGRATION / SELF-HEALING LOGIC ---
            // 1. Check if the *Correct* doc exists (Doc ID == Auth UID)
            const correctDocRef = doc(db, "users", currentUser.uid);
            let userDocSnap = await getDoc(correctDocRef);
            let userData = null;

            if (userDocSnap.exists()) {
                userData = userDocSnap.data();
                // Self-healing: Ensure UID matches (consistency)
                if (userData.uid !== currentUser.uid) {
                    await updateDoc(correctDocRef, { uid: currentUser.uid });
                }
            } else {
                // 2. Not found? It might be a Legacy User (Created by Admin, has random ID)
                // Search by Email to find the old doc
                if (currentUser.email) {
                    const q = query(collection(db, "users"), where("email", "==", currentUser.email.toLowerCase()), limit(1));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        // FOUND LEGACY DOC -> MIGRATE IT
                        const oldDoc = snapshot.docs[0];
                        const oldData = oldDoc.data();

                        console.log(`[OrgContext] Migrating user ${oldData.email} from ID ${oldDoc.id} to ${currentUser.uid}`);

                        // Copy to new ID
                        await setDoc(correctDocRef, {
                            ...oldData,
                            uid: currentUser.uid, // Enforce correct UID
                            photoURL: currentUser.photoURL || oldData.photoURL || "",
                            // Ensure name exists
                            name: oldData.name || currentUser.displayName || currentUser.email.split('@')[0]
                        });

                        // Delete old ID
                        await deleteDoc(doc(db, "users", oldDoc.id));

                        // Update local ref
                        userDocSnap = await getDoc(correctDocRef);
                        userData = userDocSnap.data();
                        console.log("[OrgContext] Migration complete.");
                    }
                }
            }

            // --- LOAD ORGANIZATION ---
            if (userData) {
                const orgId = userData.orgId;

                if (orgId) {
                    // Get Organization Document
                    const orgDocRef = doc(db, "organizations", orgId);
                    const orgDocSnap = await getDoc(orgDocRef);

                    if (orgDocSnap.exists()) {
                        setOrg({ id: orgDocSnap.id, ...orgDocSnap.data() });
                    } else {
                        // Feature: Master Admin Auto-Gen
                        if (orgId === "MASTER_ADMIN") {
                            console.log("Auto-generating Master Admin Org context");
                            setOrg({
                                id: "MASTER_ADMIN",
                                name: "System Administrator",
                                ownerId: currentUser.uid,
                                settings: { allowAdminsToBook: true }
                            });
                        } else {
                            console.warn(`Organization ${orgId} not found for user ${currentUser.uid}`);
                            setError("Organization not found");
                            setOrg(null);
                        }
                    }
                } else {
                    console.log("User has no orgId assigned");
                    setOrg(null);
                }
            } else {
                // User logged in but no Firestore Doc found (New User waiting for registration?)
                console.log("No user document found for authenticated user.");
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
