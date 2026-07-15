export function toPositiveInt(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (Array.isArray(value))
        value = value[0];
    const str = String(value).trim();
    if (str === '' ||
        str === 'undefined' ||
        str === 'null' ||
        str === 'NaN' ||
        str === 'todos' ||
        str === 'todas') {
        return undefined;
    }
    const n = Number(str);
    return Number.isInteger(n) && n > 0 ? n : undefined;
}
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;
export function normalizeMessagePagination(query = {}) {
    const limit = Math.min(toPositiveInt(query.limit) ?? DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);
    const beforeId = toPositiveInt(query.before_id);
    const page = toPositiveInt(query.page);
    const offset = page && page > 1 ? (page - 1) * limit : 0;
    return {
        limit,
        beforeId,
        page: page || 1,
        offset,
    };
}
