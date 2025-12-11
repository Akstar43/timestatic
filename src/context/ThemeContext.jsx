import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export const THEMES = {
    blue: {
        name: 'Ocean Blue',
        colors: {
            50: '240 249 255',
            100: '224 242 254',
            200: '186 230 253',
            300: '125 211 252',
            400: '56 189 248',
            500: '14 165 233',
            600: '2 132 199',
            700: '3 105 161',
            800: '7 89 133',
            900: '12 74 110',
            950: '8 47 73',
        }
    },
    purple: {
        name: 'Royal Purple',
        colors: {
            50: '245 243 255',
            100: '237 233 254',
            200: '221 214 254',
            300: '196 181 253',
            400: '167 139 250',
            500: '139 92 246',
            600: '124 58 237',
            700: '109 40 217',
            800: '91 33 182',
            900: '76 29 149',
            950: '46 16 101',
        }
    },
    green: {
        name: 'Emerald Green',
        colors: {
            50: '236 253 245',
            100: '209 250 229',
            200: '167 243 208',
            300: '110 231 183',
            400: '52 211 153',
            500: '16 185 129',
            600: '5 150 105',
            700: '4 120 87',
            800: '6 95 70',
            900: '6 78 59',
            950: '2 44 34',
        }
    },
    orange: {
        name: 'Sunset Orange',
        colors: {
            50: '255 247 237',
            100: '255 237 213',
            200: '254 215 170',
            300: '253 186 116',
            400: '251 146 60',
            500: '249 115 22',
            600: '234 88 12',
            700: '194 65 12',
            800: '154 52 18',
            900: '124 45 18',
            950: '67 20 7',
        }
    },
    pink: {
        name: 'Rose Pink',
        colors: {
            50: '255 241 242',
            100: '255 228 230',
            200: '254 205 211',
            300: '253 164 175',
            400: '251 113 133',
            500: '244 63 94',
            600: '225 29 72',
            700: '190 18 60',
            800: '159 18 57',
            900: '136 19 55',
            950: '76 5 25',
        }
    }
};

export function ThemeProvider({ children }) {
    const { currentUser } = useAuth();
    const [currentTheme, setCurrentTheme] = useState('blue');

    // Load theme from local storage initially
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme_color');
        if (savedTheme && THEMES[savedTheme]) {
            applyTheme(savedTheme);
        }
    }, []);

    // Sync with Firestore when user logs in
    useEffect(() => {
        if (currentUser) {
            const fetchUserTheme = async () => {
                try {
                    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.themeColor && THEMES[userData.themeColor]) {
                            applyTheme(userData.themeColor);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user theme:", error);
                }
            };
            fetchUserTheme();
        }
    }, [currentUser]);

    const applyTheme = (themeKey) => {
        const theme = THEMES[themeKey];
        if (!theme) return;

        setCurrentTheme(themeKey);
        localStorage.setItem('theme_color', themeKey);

        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([shade, value]) => {
            root.style.setProperty(`--primary-${shade}`, value);
        });
    };

    const changeTheme = async (themeKey) => {
        applyTheme(themeKey);

        // Save to Firestore if logged in
        if (currentUser) {
            try {
                await updateDoc(doc(db, "users", currentUser.uid), {
                    themeColor: themeKey
                });
            } catch (error) {
                console.error("Error saving theme to profile:", error);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ currentTheme, changeTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
