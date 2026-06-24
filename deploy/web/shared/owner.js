"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.STAFF_ROLES_CREATABLE_BY_OWNER = exports.STAFF_ROLE_LABELS = void 0;
exports.hasPermission = hasPermission;
exports.STAFF_ROLE_LABELS = {
    owner: 'Owner',
    admin: 'Admin',
    accountant: 'Accountant',
    dispatcher: 'Dispatcher',
    support: 'Support',
};
exports.STAFF_ROLES_CREATABLE_BY_OWNER = [
    'admin',
    'accountant',
    'dispatcher',
    'support',
];
exports.PERMISSIONS = {
    manage_staff: ['owner'],
    manage_expenses: ['owner', 'admin', 'accountant'],
    view_reports: ['owner', 'admin', 'accountant'],
    view_drivers: ['owner', 'admin', 'accountant', 'dispatcher'],
    view_rides: ['owner', 'admin', 'accountant', 'dispatcher', 'support'],
};
function hasPermission(role, permission) {
    return exports.PERMISSIONS[permission].includes(role);
}
