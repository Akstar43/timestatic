
const isNonWorkingDay = (date, user) => {
    if (!user || !user.workingDays || user.workingDays.length === 0) {
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    }
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];
    return !user.workingDays.includes(dayName);
};

const calculateLeaveDuration = (fromStr, toStr, isSingleDay, singleDayType, startType, endType, user, holidaysMap) => {
    if (!fromStr || !toStr) return 0;

    const start = new Date(fromStr);
    const end = new Date(toStr);
    let totalDays = 0;
    let curr = new Date(start);

    // Normalize dates
    const startStr = start.toDateString();
    const endStr = end.toDateString();

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    console.log(`\n--- Calculation: ${fromStr} to ${toStr} ---`);
    console.log("User Config:", JSON.stringify(user));

    while (curr <= end) {
        const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
        const dayIdx = curr.getDay();
        const dayName = dayNames[dayIdx];

        const isHoliday = holidaysMap && holidaysMap[dateStr];
        const nonWorking = isNonWorkingDay(new Date(curr), user);

        console.log(`Date: ${dateStr} (${dayName}) | NonWorking: ${nonWorking} | Holiday: ${!!isHoliday}`);

        if (!nonWorking && !isHoliday) {
            let dayValue = 1;

            if (user?.halfWorkingDays?.includes(dayName)) {
                console.log(`  -> Detected Half Working Day (${dayName})`);
                dayValue = 0.5;
            }

            if (dayValue === 1) {
                if (isSingleDay) {
                    if (singleDayType !== "Full Day") dayValue = 0.5;
                }
                else {
                    if (curr.toDateString() === startStr && startType !== "Full Day") dayValue = 0.5;
                    else if (curr.toDateString() === endStr && endType !== "Full Day") dayValue = 0.5;
                }
            }
            console.log(`  -> Day Value Added: ${dayValue}`);
            totalDays += dayValue;
        }
        curr.setDate(curr.getDate() + 1);
    }
    return totalDays;
};

// --- SCENARIO 1: Standard Week, Sat Half Day ---
const user1 = {
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    halfWorkingDays: ["Sat"]
};

// Test 1: Sat Full Day Leave
const res1 = calculateLeaveDuration("2023-10-21", "2023-10-21", true, "Full Day", "Full Day", "Full Day", user1, {});
console.log(`Expected 0.5, Got: ${res1}`);

// Test 2: Sat Morning Leave
const res2 = calculateLeaveDuration("2023-10-21", "2023-10-21", true, "Morning", "Full Day", "Full Day", user1, {});
console.log(`Expected 0.5, Got: ${res2}`);

// Test 3: Fri Full + Sat Full
const res3 = calculateLeaveDuration("2023-10-20", "2023-10-21", false, "Full Day", "Full Day", "Full Day", user1, {});
console.log(`Expected 1.5, Got: ${res3}`);

// --- SCENARIO 2: Mismatch (Sat vs Saturday) ---
const user2 = {
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Saturday"], // Wrong name for test
    halfWorkingDays: ["Saturday"]
};

const res4 = calculateLeaveDuration("2023-10-21", "2023-10-21", true, "Full Day", "Full Day", "Full Day", user2, {});
console.log(`Mismatch Test (Expected 0 if NonWorking logic fails correct check): ${res4}`);

