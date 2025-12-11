import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './AuthContext';
import { THEMES } from './themes';

// Safe default context
const defaultContext = {
    theme: 'light',
    toggleTheme: () => console.warn("toggleTheme (default)"),
    currentTheme: 'blue',
    changeTheme: () => console.warn("changeTheme (default)"),
    themes: THEMES
};

// Create Context
const ThemeContext = createContext(defaultContext);

export function ThemeProvider({ children }) {
    const { currentUser } = useAuth();

    // Dark Mode State
    const [theme, setTheme] = useState('light'); // 'light' | 'dark'

    // Brand Color State
    const [brand, setBrand] = useState('blue');

    // Load Settings on Mount
    useEffect(() => {
        // Load Dark Mode
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setTheme(savedTheme);
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            }
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            // Auto-detect system preference
            setTheme('dark');
            document.documentElement.classList.add('dark');
        }

        // Load Brand Color
        const savedBrand = localStorage.getItem('theme_color');
        if (savedBrand && THEMES[savedBrand]) {
            applyBrand(savedBrand);
        }
    }, []);

    // Sync with Firestore
    useEffect(() => {
        if (currentUser) {
            const fetchSettings = async () => {
                try {
                    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        // Sync Brand
                        if (data.themeColor && THEMES[data.themeColor]) {
                            applyBrand(data.themeColor);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user settings:", error);
                }
            };
            fetchSettings();
        }
    }, [currentUser]);

    // Toggle Dark Mode
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // Change Brand Color Helper
    const applyBrand = (brandKey) => {
        const b = THEMES[brandKey];
        if (!b) return;

        setBrand(brandKey);
        localStorage.setItem('theme_color', brandKey);

        const root = document.documentElement;
        Object.entries(b.colors).forEach(([shade, value]) => {
            root.style.setProperty(`--primary-${shade}`, value);
        });
    };

    // Exposed Change Function
    const changeTheme = async (brandKey) => {
        applyBrand(brandKey);

        // Save to Firestore
        if (currentUser) {
            try {
                await updateDoc(doc(db, "users", currentUser.uid), {
                    themeColor: brandKey
                });
            } catch (error) {
                console.error("Error saving theme to profile:", error);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            currentTheme: brand,
            changeTheme,
            themes: THEMES
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    // Force fallback if context is missing/null/undefined for any reason
    return ctx || defaultContext;
}
