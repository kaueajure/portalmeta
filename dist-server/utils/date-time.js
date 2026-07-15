function pad(value) {
    return String(value).padStart(2, '0');
}
export function formatDateTimeForMySQL(date = new Date()) {
    return `${formatDateForMySQL(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function addMinutesForMySQL(minutes, fromDate = new Date()) {
    const date = new Date(fromDate);
    date.setMinutes(date.getMinutes() + minutes);
    return formatDateTimeForMySQL(date);
}
export function formatDateForMySQL(date = new Date()) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-');
}
