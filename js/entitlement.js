// Single entitlement gate for paid tools.
//
// A future App Store, Google Play, or RevenueCat integration should pass its
// result as storeEntitlement (true or false). That value is authoritative.
// The debug tier is a local preview only, and only when the caller says debug
// mode is on (?debug=1). Production leaves storeEntitlement null and debug false,
// so this returns false and paid tools stay locked.

export function isSubscribed({ debug = false, debugTier = "free", storeEntitlement = null } = {}) {
    if (typeof storeEntitlement === "boolean") return storeEntitlement;
    if (debug && debugTier === "pro") return true;
    return false;
}
