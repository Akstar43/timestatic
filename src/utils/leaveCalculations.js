export const isNonWorkingDay = (date, user) => {
    if (!user || !user.workingDays || user.workingDays.length === 0) {
        // Default: Saturday (6) and Sunday (0) are non-working
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    }

    // Map day index to day name
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];

    // If the day is NOT in the user's working days, it's a non-working day
    return !user.workingDays.includes(dayName);
};

export const calculateLeaveDuration = (fromStr, toStr, isSingleDay, singleDayType, startType, endType, user, holidaysMap) => {
    if (!fromStr || !toStr) return 0;

    const start = new Date(fromStr);
    const end = new Date(toStr);
    let totalDays = 0;
    let curr = new Date(start);

    // Normalize dates to handle simple comparison
    const startStr = start.toDateString();
    const endStr = end.toDateString();

    while (curr <= end) {
        const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;

        // If it's NOT a non-working day AND NOT a holiday
        const isHoliday = holidaysMap && holidaysMap[dateStr];

        if (!isNonWorkingDay(curr, user) && !isHoliday) {
            let dayValue = 1; // Default full day

            // Logic for single day request
            if (isSingleDay) {
                if (singleDayType !== "Full Day") dayValue = 0.5;
            }
            // Logic for multi-day range
            else {
                if (curr.toDateString() === startStr && startType !== "Full Day") dayValue = 0.5;
                else if (curr.toDateString() === endStr && endType !== "Full Day") dayValue = 0.5;
            }

            totalDays += dayValue;
        }
        curr.setDate(curr.getDate() + 1);
    }
    return totalDays;
};
