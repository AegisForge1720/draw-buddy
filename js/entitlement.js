// Single entitlement gate for paid tools.
//
// A future App Store, Google Play, or RevenueCat integration should pass its
// result as storeEntitlement (true or false). That value is authoritative.
// Nothing in the page can set it. Until a store result arrives, paid tools stay locked.

export function isSubscribed({ storeEntitlement = null } = {}) {
    return storeEntitlement === true;
}
