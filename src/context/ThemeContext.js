import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEMES } from './themes';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('colorTheme') || 'blue');

    // Handle Dark/Light Mode
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Handle Color Theme
    useEffect(() => {
        const root = window.document.documentElement;
        const selectedTheme = THEMES[currentTheme];

        if (selectedTheme) {
            Object.entries(selectedTheme.colors).forEach(([shade, value]) => {
                root.style.setProperty(`--primary-${shade}`, value);
            });
            localStorage.setItem('colorTheme', currentTheme);
        }
    }, [currentTheme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const changeTheme = (themeName) => {
        if (THEMES[themeName]) {
            setCurrentTheme(themeName);
        }
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            currentTheme,
            changeTheme,
            themes: THEMES
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
